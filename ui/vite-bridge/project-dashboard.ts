import { readFileSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

type JsonObject = Record<string, unknown>;

export type RuntimeSourceCandidate = {
  id: string;
  label: string;
  path: string;
  kind: "file" | "directory";
};

export function readDashboardRuntimeSourceCandidates(repoRoot: string): RuntimeSourceCandidate[] {
  const manifestPath = path.join(repoRoot, "farplane/dashboard-runtime-sources.json");
  try {
    const raw = JSON.parse(readFileSync(manifestPath, "utf-8")) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((entry): entry is JsonObject => Boolean(entry && typeof entry === "object"))
      .map((entry) => ({
        id: String(entry.id ?? "").trim(),
        label: String(entry.label ?? "").trim(),
        path: String(entry.path ?? "").trim(),
        kind: entry.kind === "directory" ? "directory" : "file",
      }))
      .filter((entry) => entry.id && entry.label && entry.path);
  } catch {
    return [];
  }
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => String(entry ?? "").trim()).filter(Boolean))];
}

function isSafeProjectPath(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const projectPath = value.trim();
  if (!projectPath || projectPath.includes("\0")) return false;
  return path.isAbsolute(projectPath);
}

function normalizedUniqueProjectPaths(values: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const roots: string[] = [];
  for (const value of values) {
    if (!isSafeProjectPath(value)) continue;
    const root = path.resolve(value.trim());
    const key = root.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    roots.push(root);
  }
  return roots;
}

function projectPathsFromCodexUiState(uiState: JsonObject): string[] {
  return normalizedUniqueProjectPaths([
    ...(Array.isArray(uiState.pinnedProjectIds) ? uiState.pinnedProjectIds : []),
    ...(Array.isArray(uiState.projectOrder) ? uiState.projectOrder : []),
    ...(Array.isArray(uiState.savedWorkspaceRoots) ? uiState.savedWorkspaceRoots : []),
    ...(Array.isArray(uiState.activeWorkspaceRoots) ? uiState.activeWorkspaceRoots : []),
  ]);
}

async function readJsonFile(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf-8")) as unknown;
  } catch {
    return {};
  }
}

async function readCodexUiState(codexGlobalStatePath: string): Promise<JsonObject> {
  const raw = await readJsonFile(codexGlobalStatePath);
  const state = raw && typeof raw === "object" ? (raw as JsonObject) : {};
  return {
    savedWorkspaceRoots: normalizeStringList(state["electron-saved-workspace-roots"]),
    activeWorkspaceRoots: normalizeStringList(state["active-workspace-roots"]),
    projectOrder: normalizeStringList(state["project-order"]),
    pinnedProjectIds: normalizeStringList(state["pinned-project-ids"]),
  };
}

async function resolveKnownProjectPath({
  codexGlobalStatePath,
  extraKnownProjectPaths = [],
  projectPath,
  repoRoot,
}: {
  codexGlobalStatePath: string;
  extraKnownProjectPaths?: string[];
  projectPath: string | null | undefined;
  repoRoot: string;
}): Promise<string | null> {
  const requestedPath = projectPath?.trim();
  if (!requestedPath || !isSafeProjectPath(requestedPath)) return null;
  const resolvedPath = path.resolve(requestedPath);
  const uiState = await readCodexUiState(codexGlobalStatePath);
  const allowedRoots = normalizedUniqueProjectPaths([
    repoRoot,
    ...extraKnownProjectPaths,
    ...projectPathsFromCodexUiState(uiState),
  ]);
  const requestedKey = resolvedPath.toLowerCase();
  return allowedRoots.some((root) => root.toLowerCase() === requestedKey) ? resolvedPath : null;
}

export async function readOverviewSurfaceBridge({
  codexGlobalStatePath,
  projectPath,
  repoRoot,
}: {
  codexGlobalStatePath: string;
  projectPath: string | null | undefined;
  repoRoot: string;
}): Promise<{ status: number; payload: JsonObject }> {
  const rootPath = await resolveKnownProjectPath({ codexGlobalStatePath, projectPath, repoRoot });
  if (!rootPath) {
    return { status: 400, payload: { ok: false, error: "project_path_required" } };
  }
  const surfacePath = path.join(rootPath, ".farplane/state/overview_surface.json");
  const relativePath = path.relative(rootPath, surfacePath);
  const fileStat = await stat(surfacePath).catch(() => null);
  if (!fileStat?.isFile()) {
    return {
      status: 200,
      payload: { ok: true, exists: false, path: relativePath, surface: null },
    };
  }
  try {
    return {
      status: 200,
      payload: {
        ok: true,
        exists: true,
        path: relativePath,
        updatedAtMs: fileStat.mtimeMs,
        surface: JSON.parse(await readFile(surfacePath, "utf-8")) as JsonObject,
      },
    };
  } catch {
    return {
      status: 500,
      payload: {
        ok: false,
        exists: true,
        path: relativePath,
        error: "overview_surface_read_or_parse_failed",
      },
    };
  }
}

export async function readFeedScoutBridge({
  codexGlobalStatePath,
  date,
  frameworkRoot,
  projectPath,
  repoRoot,
}: {
  codexGlobalStatePath: string;
  date: string | null | undefined;
  frameworkRoot: string;
  projectPath: string | null | undefined;
  repoRoot: string;
}): Promise<{ status: number; payload: JsonObject }> {
  const requestedProjectPath = projectPath?.trim() || frameworkRoot;
  const preferredRootPath = await resolveKnownProjectPath({
    codexGlobalStatePath,
    extraKnownProjectPaths: [frameworkRoot],
    projectPath: requestedProjectPath,
    repoRoot,
  });
  if (!preferredRootPath) {
    return { status: 400, payload: { ok: false, error: "project_path_required" } };
  }

  const rootPath = preferredRootPath;
  const feedRoot = path.join(rootPath, ".farplane", "feed-scout", "daily");
  const availableDates = await listFeedScoutDates(feedRoot);
  const requestedDate = date?.trim() ?? "latest";
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : "latest";
  const feedPath = path.join(
    feedRoot,
    selectedDate === "latest" ? "latest.json" : `feed-${selectedDate}.json`,
  );
  const relativeFeedPath = path.relative(rootPath, feedPath);
  const fileStat = await stat(feedPath).catch(() => null);
  if (!fileStat?.isFile()) {
    return {
      status: 200,
      payload: {
        ok: true,
        exists: false,
        availableDates,
        path: relativeFeedPath,
        projectPath: rootPath,
        feed: null,
      },
    };
  }

  try {
    const feed = await readJsonFile(feedPath);
    return {
      status: 200,
      payload: {
        ok: true,
        exists: true,
        availableDates,
        path: relativeFeedPath,
        projectPath: rootPath,
        updatedAtMs: fileStat.mtimeMs,
        feed,
      },
    };
  } catch {
    return {
      status: 500,
      payload: {
        ok: false,
        exists: true,
        path: relativeFeedPath,
        error: "feed_scout_read_or_parse_failed",
      },
    };
  }
}

async function listFeedScoutDates(feedRoot: string): Promise<string[]> {
  const entries = await readdir(feedRoot).catch(() => []);
  return entries
    .map((entry) => entry.match(/^feed-(\d{4}-\d{2}-\d{2})\.json$/)?.[1] ?? "")
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left));
}
