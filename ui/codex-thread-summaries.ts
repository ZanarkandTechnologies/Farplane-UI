import path from "node:path";
import { readdir, readFile, stat } from "node:fs/promises";

// Node-side Codex thread summary bridge helpers. Inputs are known project roots and
// project-local PM manifests; output mirrors the Codex app-server thread/list rows.
type JsonObject = Record<string, unknown>;

type ProjectPmReader = (projectPath: string) => Promise<JsonObject | null>;

const CODEX_THREAD_SUMMARY_FILE_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/i;

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function isDirectory(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isDirectory();
  } catch {
    return false;
  }
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => String(entry ?? "").trim()).filter(Boolean))];
}

function normalizedProjectPmThreadIds(pm: JsonObject | null): Set<string> {
  if (!pm) return new Set();
  const threads = pm.threads && typeof pm.threads === "object" ? (pm.threads as JsonObject) : {};
  return new Set([
    ...(Array.isArray(pm.threads) ? normalizeStringList(pm.threads) : []),
    ...normalizeStringList(threads.chats),
    ...normalizeStringList(threads.automations),
  ]);
}

function parseDateMs(value: unknown): number | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function clippedText(value: unknown, max = 180): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}...` : text;
}

function newestExchange(summary: JsonObject): JsonObject | null {
  const exchanges = Array.isArray(summary.rolling_exchanges)
    ? summary.rolling_exchanges
    : Array.isArray(summary.rollingExchangeWindow)
      ? summary.rollingExchangeWindow
      : [];
  for (let index = exchanges.length - 1; index >= 0; index -= 1) {
    const entry = exchanges[index];
    if (entry && typeof entry === "object") return entry as JsonObject;
  }
  return null;
}

function messageWindowPreview(summary: JsonObject): string {
  const pending =
    summary.pending_user_turn && typeof summary.pending_user_turn === "object"
      ? (summary.pending_user_turn as JsonObject)
      : {};
  const exchange = newestExchange(summary) ?? {};
  return (
    clippedText(pending.user_text) ||
    clippedText(exchange.user_text) ||
    clippedText(exchange.assistant_text) ||
    clippedText(pending.user_summary) ||
    clippedText(exchange.user_summary)
  );
}

function messageWindowUpdatedMs(summary: JsonObject, fallbackMs: number): number {
  const pending =
    summary.pending_user_turn && typeof summary.pending_user_turn === "object"
      ? (summary.pending_user_turn as JsonObject)
      : {};
  const exchange = newestExchange(summary) ?? {};
  return (
    parseDateMs(summary.updated_at) ??
    parseDateMs(pending.user_captured_at) ??
    parseDateMs(pending.assistant_captured_at) ??
    parseDateMs(exchange.assistant_captured_at) ??
    parseDateMs(exchange.user_captured_at) ??
    fallbackMs
  );
}

async function readMessageWindowThreadSummaries(
  projectPath: string,
  pmThreadIds: Set<string>,
): Promise<JsonObject[]> {
  const root = path.resolve(projectPath);
  const messageWindowDir = path.join(root, ".farplane", "state", "message-windows");
  if (!(await isDirectory(messageWindowDir))) return [];
  const entries = await readdir(messageWindowDir, { withFileTypes: true }).catch(() => []);
  const rows: JsonObject[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !CODEX_THREAD_SUMMARY_FILE_RE.test(entry.name)) continue;
    const threadId = path.basename(entry.name, ".json");
    const filePath = path.join(messageWindowDir, entry.name);
    const fileStat = await stat(filePath).catch(() => null);
    const summary = await readJsonFile<JsonObject>(filePath, {});
    const updatedMs = messageWindowUpdatedMs(summary, fileStat?.mtimeMs ?? Date.now());
    const preview = messageWindowPreview(summary) || `Codex thread ${threadId.slice(0, 8)}`;
    rows.push({
      id: threadId,
      sessionId: typeof summary.session_id === "string" ? summary.session_id : undefined,
      preview,
      cwd: root,
      updatedAt: Math.floor(updatedMs / 1000),
      status: { type: "notLoaded" },
      source: {
        kind: "farplane-message-window",
        projectPath: root,
        projectPmOwned: pmThreadIds.has(threadId),
      },
    });
  }
  return rows;
}

function codexThreadUpdatedAt(row: JsonObject): number {
  const updatedAt = typeof row.updatedAt === "number" ? row.updatedAt : 0;
  const createdAt = typeof row.createdAt === "number" ? row.createdAt : 0;
  return Math.max(updatedAt, createdAt);
}

export async function readFilesystemObservedCodexThreads(input: {
  projectPaths: string[];
  limit: number;
  readProjectPmConfig: ProjectPmReader;
}): Promise<JsonObject[]> {
  const perProjectRows = await Promise.all(
    input.projectPaths.map(async (projectPath) => {
      const pm = await input.readProjectPmConfig(projectPath);
      return readMessageWindowThreadSummaries(projectPath, normalizedProjectPmThreadIds(pm));
    }),
  );
  return perProjectRows
    .flat()
    .sort((a, b) => Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0))
    .slice(0, input.limit);
}

export function mergeFilesystemThreadsIntoThreadList(input: {
  result: unknown;
  filesystemRows: JsonObject[];
  limit: number;
}): JsonObject {
  const base = input.result && typeof input.result === "object" ? (input.result as JsonObject) : {};
  const existingRows = Array.isArray(base.data)
    ? base.data.filter((entry): entry is JsonObject => Boolean(entry && typeof entry === "object"))
    : [];
  const seenIds = new Set(
    existingRows.map((entry) => String(entry.id ?? "").trim()).filter(Boolean),
  );
  const mergedRows = [...existingRows];
  for (const row of input.filesystemRows) {
    const id = String(row.id ?? "").trim();
    if (!id || seenIds.has(id)) continue;
    seenIds.add(id);
    mergedRows.push(row);
  }
  mergedRows.sort((a, b) => codexThreadUpdatedAt(b) - codexThreadUpdatedAt(a));
  return {
    ...base,
    data: mergedRows.slice(0, input.limit),
  };
}
