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

function defaultCodexHome(): string {
  if (process.env.CODEX_HOME) return process.env.CODEX_HOME;
  return process.env.HOME ? path.join(process.env.HOME, ".codex") : "";
}

function clippedText(value: unknown, max = 180): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}...` : text;
}

function threadTitleText(value: unknown, max = 72): string {
  if (typeof value !== "string") return "";
  let text = value.trim();
  const requestMarker = "## My request for Codex:";
  const requestIndex = text.indexOf(requestMarker);
  if (requestIndex >= 0) text = text.slice(requestIndex + requestMarker.length).trim();
  text = text
    .replace(/<image\b[\s\S]*?<\/image>/gi, " ")
    .replace(/^# AGENTS\.md instructions[\s\S]*$/i, " ")
    .replace(/^# Files mentioned by the user:[\s\S]*?## My request for Codex:/i, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}...` : text;
}

function isLowSignalThreadTitle(value: string): boolean {
  return /^(ok|okay|sure|yes|pls|please)?\s*(continue|go on|do it|impl|implement|commit|commit this|thanks?)\s*$/i.test(
    value.trim(),
  );
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

function messageWindowTitle(summary: JsonObject): string {
  const directTitle =
    threadTitleText(summary.title) ||
    threadTitleText(summary.name) ||
    threadTitleText(summary.thread_title) ||
    threadTitleText(summary.threadTitle) ||
    threadTitleText(summary.session_name) ||
    threadTitleText(summary.sessionName);
  if (directTitle) return directTitle;

  const exchanges = Array.isArray(summary.rolling_exchanges)
    ? summary.rolling_exchanges
    : Array.isArray(summary.rollingExchangeWindow)
      ? summary.rollingExchangeWindow
      : [];
  for (const entry of exchanges) {
    if (!entry || typeof entry !== "object") continue;
    const title = threadTitleText((entry as JsonObject).user_text);
    if (title && !isLowSignalThreadTitle(title)) return title;
  }

  const pending =
    summary.pending_user_turn && typeof summary.pending_user_turn === "object"
      ? (summary.pending_user_turn as JsonObject)
      : {};
  const pendingTitle = threadTitleText(pending.user_text);
  return pendingTitle && !isLowSignalThreadTitle(pendingTitle) ? pendingTitle : "";
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

function messageWindowText(summary: JsonObject): string {
  const parts: string[] = [];
  const pending =
    summary.pending_user_turn && typeof summary.pending_user_turn === "object"
      ? (summary.pending_user_turn as JsonObject)
      : {};
  parts.push(String(pending.user_text ?? ""), String(pending.user_summary ?? ""));
  const exchanges = Array.isArray(summary.rolling_exchanges)
    ? summary.rolling_exchanges
    : Array.isArray(summary.rollingExchangeWindow)
      ? summary.rollingExchangeWindow
      : [];
  for (const entry of exchanges) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as JsonObject;
    parts.push(String(row.user_text ?? ""), String(row.user_summary ?? ""));
  }
  return parts.filter(Boolean).join("\n");
}

function isInternalAuxiliaryMessageWindow(summary: JsonObject): boolean {
  const runtime =
    summary.runtime && typeof summary.runtime === "object" ? (summary.runtime as JsonObject) : {};
  const runtimeKind = String(runtime.kind ?? "").trim().toLowerCase();
  const runtimePurpose = String(runtime.purpose ?? "").trim().toLowerCase();
  if (
    runtimeKind === "ephemeral" ||
    runtimeKind === "headless" ||
    runtimePurpose === "eval" ||
    runtimePurpose === "evaluation"
  ) {
    return true;
  }
  const text = messageWindowText(summary);
  return (
    /(^|\n)\s*You are judging an agent answer(?:\s+for\s+(?:a\s+)?harness eval)?\b/i.test(
      text,
    ) ||
    /\b(codex[-_\s]?exec|headless|ephemeral|harness eval|run_evals\.py|\.farplane\/evals)\b/i.test(
      text,
    ) ||
    /(^|\n)\s*Summarize this project file change as one (tiny employee status bubble label|concise employee status bubble)\b/i.test(
      text,
    ) ||
    /(^|\n)# Overview\s+Generate 0 to 3 hyperpersonalized suggestions for what this user can do with Codex\b/i.test(
      text,
    )
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

async function readCodexSessionIndexThreadNames(codexHome?: string): Promise<Map<string, string>> {
  const root = codexHome || defaultCodexHome();
  if (!root) return new Map();
  const raw = await readFile(path.join(root, "session_index.jsonl"), "utf-8").catch(() => "");
  const names = new Map<string, { name: string; updatedMs: number }>();
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let row: JsonObject;
    try {
      row = JSON.parse(line) as JsonObject;
    } catch {
      continue;
    }
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const name =
      threadTitleText(row.thread_name) ||
      threadTitleText(row.threadName) ||
      threadTitleText(row.title) ||
      threadTitleText(row.name);
    if (!id || !name) continue;
    const updatedMs = parseDateMs(row.updated_at) ?? parseDateMs(row.updatedAt) ?? 0;
    const existing = names.get(id);
    if (!existing || updatedMs >= existing.updatedMs) {
      names.set(id, { name, updatedMs });
    }
  }
  return new Map([...names].map(([id, value]) => [id, value.name]));
}

async function readMessageWindowThreadSummaries(
  projectPath: string,
  pmThreadIds: Set<string>,
  sessionIndexThreadNames: Map<string, string>,
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
    if (isInternalAuxiliaryMessageWindow(summary)) continue;
    const updatedMs = messageWindowUpdatedMs(summary, fileStat?.mtimeMs ?? Date.now());
    const preview = messageWindowPreview(summary) || `Codex thread ${threadId.slice(0, 8)}`;
    const name = sessionIndexThreadNames.get(threadId) || messageWindowTitle(summary) || preview;
    rows.push({
      id: threadId,
      sessionId: typeof summary.session_id === "string" ? summary.session_id : undefined,
      name,
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
  codexHome?: string;
}): Promise<JsonObject[]> {
  const sessionIndexThreadNames = await readCodexSessionIndexThreadNames(input.codexHome);
  const perProjectRows = await Promise.all(
    input.projectPaths.map(async (projectPath) => {
      const pm = await input.readProjectPmConfig(projectPath);
      return readMessageWindowThreadSummaries(
        projectPath,
        normalizedProjectPmThreadIds(pm),
        sessionIndexThreadNames,
      );
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
  const filesystemById = new Map(
    input.filesystemRows
      .map((entry) => [String(entry.id ?? "").trim(), entry] as const)
      .filter(([id]) => Boolean(id)),
  );
  const seenIds = new Set(
    existingRows.map((entry) => String(entry.id ?? "").trim()).filter(Boolean),
  );
  const mergedRows = existingRows.map((entry) => {
    const filesystemRow = filesystemById.get(String(entry.id ?? "").trim());
    if (!filesystemRow) return entry;
    return {
      ...entry,
      name:
        typeof entry.name === "string" && entry.name.trim()
          ? entry.name
          : filesystemRow.name,
      source: entry.source ?? filesystemRow.source,
    };
  });
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
