/**
 * FILE CHANGE LISTENER HOOK
 * =========================
 * Purpose
 * - Detect tracked project file edits after write-capable tools.
 * - Publish typed `farplane.*` file events plus compact legacy status-bubble summaries.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseFarplaneFileEvent, type FarplaneFileEvent } from "./file-event-registry";
import { readFileEventSnapshot, writeFileEventSnapshot } from "./file-event-snapshot-store";
import {
  resolveCodexSummaryOptions,
  summarizeTrackedFileChangeWithCodex,
  type CodexSummaryOptions,
} from "../shared/codex-summary";
import { publishHookTelemetryWithOutbox } from "../shared/telemetry-outbox";
import { defaultTrackedPathPatterns } from "../shared/project-hook-config";

type JsonRecord = Record<string, unknown>;

export type FileChangeBubbleCandidate = {
  threadId?: string;
  sessionId?: string;
  projectPath: string;
  filePath: string;
  message: string;
  eventAt: number;
  eventKey: string;
};

export type PublishFileChangeOptions = {
  endpointBaseUrl?: string;
  telemetryToken?: string;
  fetchImpl?: typeof fetch;
};

export type FileChangeParseOptions = {
  trackedPathPatterns?: readonly string[];
  codexSummary?: CodexSummaryOptions;
  fileEventStateDir?: string;
  updateFileEventState?: boolean;
};

const WRITE_TOOL_PATTERN = /(?:bash|apply_patch|edit|write|create|delete|multi_tool_use)/i;
const MAX_CHANGED_FILES = 12;
const MAX_FILE_BYTES = 24_000;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value: unknown, limit = 500): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed.slice(0, limit) : undefined;
}

function resolveToolName(payload: JsonRecord): string {
  return (
    cleanString(payload.toolName, 120) ??
    cleanString(payload.tool_name, 120) ??
    cleanString(payload.tool, 120) ??
    "unknown"
  );
}

function resolveEventName(payload: JsonRecord): string {
  return (
    cleanString(payload.event, 120) ??
    cleanString(payload.hook_event_name, 120) ??
    cleanString(payload.hookEventName, 120) ??
    cleanString(payload.type, 120) ??
    "PostToolUse"
  );
}

function resolveOccurredAt(payload: JsonRecord, now: number): number {
  const direct = payload.timestamp ?? payload.occurredAt ?? payload.occurred_at;
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;
  const parsed = Date.parse(cleanString(direct, 80) ?? "");
  return Number.isFinite(parsed) ? parsed : now;
}

function resolveMetadata(payload: JsonRecord): {
  sessionId?: string;
  threadId?: string;
  projectPath?: string;
} {
  const session = isRecord(payload.session) ? payload.session : {};
  const thread = isRecord(payload.thread) ? payload.thread : {};
  return {
    sessionId:
      cleanString(payload.sessionId, 200) ??
      cleanString(payload.session_id, 200) ??
      cleanString(session.id, 200) ??
      cleanString(session.key, 200),
    threadId:
      cleanString(payload.threadId, 200) ??
      cleanString(payload.thread_id, 200) ??
      cleanString(thread.id, 200),
    projectPath:
      cleanString(payload.cwd, 1_000) ??
      cleanString(payload.projectPath, 1_000) ??
      cleanString(payload.project_path, 1_000),
  };
}

function normalizeRelativePath(candidate: string, projectPath: string): string | null {
  const trimmed = candidate.trim().replace(/^['"`]+|['"`:,]+$/g, "");
  if (!trimmed || /^[a-z]+:\/\//i.test(trimmed)) return null;
  const withoutLine = trimmed.replace(/:\d+(?::\d+)?$/, "");
  const absolute = path.isAbsolute(withoutLine)
    ? path.normalize(withoutLine)
    : path.resolve(projectPath, withoutLine);
  const relative = path.relative(projectPath, absolute).replace(/\\/g, "/");
  if (!relative || relative.startsWith("../") || relative === ".." || path.isAbsolute(relative)) return null;
  return relative;
}

function globToRegExp(pattern: string): RegExp {
  const normalized = pattern.trim().replace(/\\/g, "/");
  let source = "";
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (char === "*" && next === "*") {
      source += ".*";
      index += 1;
      continue;
    }
    if (char === "*") {
      source += "[^/]*";
      continue;
    }
    source += char.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
  }
  return new RegExp(`^${source}$`, "i");
}

function trackedPathMatchers(patterns: readonly string[] = defaultTrackedPathPatterns()): RegExp[] {
  return patterns.map((pattern) => globToRegExp(pattern));
}

function isTrackedBubblePath(filePath: string, matchers = trackedPathMatchers()): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return matchers.some((matcher) => matcher.test(normalized));
}

function extractPatchPaths(text: string): string[] {
  const paths: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\*\*\* (?:Add|Update|Delete) File:\s+(.+)$/);
    if (match?.[1]) paths.push(match[1].trim());
  }
  return paths;
}

function extractPathsFromCommand(command: string): string[] {
  const paths = new Set<string>();
  const tokens = shellTokens(command);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]?.toLowerCase();
    if (token === ">" || token === ">>") {
      const target = tokens[index + 1];
      if (target) paths.add(target);
      continue;
    }
    if (token === "tee" || token === "touch" || token === "rm" || token === "unlink") {
      for (let next = index + 1; next < tokens.length; next += 1) {
        const candidate = tokens[next];
        if (!candidate || isShellBoundary(candidate)) break;
        if (!candidate.startsWith("-")) paths.add(candidate);
      }
      continue;
    }
    if (token === "mv" || token === "cp") {
      const commandPaths: string[] = [];
      for (let next = index + 1; next < tokens.length; next += 1) {
        const candidate = tokens[next];
        if (!candidate || isShellBoundary(candidate)) break;
        if (!candidate.startsWith("-")) commandPaths.push(candidate);
      }
      for (const candidate of commandPaths) paths.add(candidate);
    }
  }
  return [...paths];
}

function shellTokens(command: string): string[] {
  const tokens: string[] = [];
  const tokenPattern = /"([^"]+)"|'([^']+)'|`([^`]+)`|(&&|\|\||>>|[;&|<>])|([^\s;&|<>]+)/g;
  for (const match of command.matchAll(tokenPattern)) {
    const token = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5] ?? "")
      .trim()
      .replace(/^[({[]+|[),;\]}]+$/g, "");
    if (token) tokens.push(token);
  }
  return tokens;
}

function isShellBoundary(token: string): boolean {
  return token === ";" || token === "&&" || token === "||" || token === "|" || token === "<" || token === ">" || token === ">>";
}

function extractLikelyPathStrings(value: unknown, depth = 0): string[] {
  if (depth > 5) return [];
  if (typeof value === "string") {
    return [...extractPatchPaths(value), ...extractPathsFromCommand(value)];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractLikelyPathStrings(entry, depth + 1));
  }
  if (!isRecord(value)) return [];

  const paths: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (/^(path|file|filePath|file_path|filename|target|targetPath|target_path|paths|changedFiles|changed_files)$/i.test(key)) {
      if (typeof child === "string") paths.push(child);
      if (Array.isArray(child)) {
        paths.push(...child.filter((entry): entry is string => typeof entry === "string"));
      }
      continue;
    }
    if (
      /^(files|edits|toolInput|tool_input|input|parameters|args|cmd|command|toolResponse|tool_response|output)$/i.test(
        key,
      )
    ) {
      paths.push(...extractLikelyPathStrings(child, depth + 1));
    }
  }
  return paths;
}

function changedTrackedFilesFromPayload(
  payload: JsonRecord,
  projectPath: string,
  patterns?: readonly string[],
): string[] {
  const matchers = trackedPathMatchers(patterns);
  const candidates = extractLikelyPathStrings(payload);
  const normalized = new Set<string>();
  for (const candidate of candidates) {
    const relative = normalizeRelativePath(candidate, projectPath);
    if (relative && isTrackedBubblePath(relative, matchers)) normalized.add(relative);
    if (normalized.size >= MAX_CHANGED_FILES) break;
  }
  return [...normalized];
}

function fileContentSnippet(projectPath: string, filePath: string): string {
  const absolutePath = path.resolve(projectPath, filePath);
  if (!existsSync(absolutePath)) return "";
  try {
    return readFileSync(absolutePath, { encoding: "utf8", flag: "r" }).slice(0, MAX_FILE_BYTES);
  } catch {
    return "";
  }
}

function readFileContent(projectPath: string, filePath: string): string {
  const absolutePath = path.resolve(projectPath, filePath);
  if (!existsSync(absolutePath)) return "";
  try {
    return readFileSync(absolutePath, { encoding: "utf8", flag: "r" });
  } catch {
    return "";
  }
}

function payloadSnippet(payload: JsonRecord): string {
  try {
    return JSON.stringify(payload, (_key, value) => {
      if (typeof value === "string") return value.slice(0, 1_000);
      return value;
    }).slice(0, 2_000);
  } catch {
    return "";
  }
}

function stableEventKey(input: {
  sessionId?: string;
  threadId?: string;
  projectPath: string;
  filePath: string;
  message: string;
}): string {
  const hash = createHash("sha1")
    .update([input.projectPath, input.filePath, input.message].join("\n"))
    .digest("hex")
    .slice(0, 16);
  return [
    "file-change",
    input.threadId ?? input.sessionId ?? "thread",
    input.filePath.replace(/\s+/g, "-"),
    hash,
  ]
    .join(":")
    .slice(0, 500);
}

function parseFileChangeCandidatePathsFromPayload(
  payload: unknown,
  now = Date.now(),
  options: FileChangeParseOptions = {},
): Array<Omit<FileChangeBubbleCandidate, "message" | "eventKey">> {
  if (!isRecord(payload)) return [];
  if (!/post.*tool.*use/i.test(resolveEventName(payload))) return [];
  if (!WRITE_TOOL_PATTERN.test(resolveToolName(payload))) return [];
  const metadata = resolveMetadata(payload);
  if (!metadata.projectPath) return [];
  const projectPath = path.resolve(metadata.projectPath);
  const eventAt = resolveOccurredAt(payload, now);
  return changedTrackedFilesFromPayload(payload, projectPath, options.trackedPathPatterns).map((filePath) => {
    return {
      threadId: metadata.threadId ?? metadata.sessionId,
      sessionId: metadata.sessionId,
      projectPath,
      filePath,
      eventAt,
    };
  });
}

export async function parseFileChangeBubbleCandidatesFromPayload(
  payload: unknown,
  now = Date.now(),
  options: FileChangeParseOptions = {},
): Promise<FileChangeBubbleCandidate[]> {
  const paths = parseFileChangeCandidatePathsFromPayload(payload, now, options);
  const record = isRecord(payload) ? payload : {};
  const codexSummary = options.codexSummary ?? resolveCodexSummaryOptions();
  const candidates: FileChangeBubbleCandidate[] = [];

  for (const candidate of paths) {
    const message =
      await summarizeTrackedFileChangeWithCodex(
        {
          projectPath: candidate.projectPath,
          filePath: candidate.filePath,
          fileContentSnippet: fileContentSnippet(candidate.projectPath, candidate.filePath),
          toolPayloadSnippet: payloadSnippet(record),
        },
        codexSummary,
      );
    if (!message) continue;
    candidates.push({
      ...candidate,
      message,
      eventAt: Date.now(),
      eventKey: stableEventKey({
        threadId: candidate.threadId,
        sessionId: candidate.sessionId,
        projectPath: candidate.projectPath,
        filePath: candidate.filePath,
        message,
      }),
    });
  }

  return candidates;
}

export type FarplaneFileEventCandidate = FarplaneFileEvent & {
  projectPath: string;
};

export function parseFarplaneFileEventCandidatesFromPayload(
  payload: unknown,
  now = Date.now(),
  options: FileChangeParseOptions = {},
): FarplaneFileEventCandidate[] {
  const paths = parseFileChangeCandidatePathsFromPayload(payload, now, options);
  const updateState = options.updateFileEventState !== false;
  const candidates: FarplaneFileEventCandidate[] = [];
  for (const candidate of paths) {
    const text = readFileContent(candidate.projectPath, candidate.filePath);
    if (!text) continue;
    const previous = readFileEventSnapshot({
      projectPath: candidate.projectPath,
      filePath: candidate.filePath,
      stateDir: options.fileEventStateDir,
    });
    const parsed = parseFarplaneFileEvent({
      path: candidate.filePath,
      text,
      previous,
      eventAt: candidate.eventAt,
      sessionId: candidate.sessionId,
      threadId: candidate.threadId,
    });
    if (!parsed.event || !parsed.snapshot) continue;
    candidates.push({
      ...parsed.event,
      projectPath: candidate.projectPath,
    });
    if (updateState) {
      writeFileEventSnapshot({
        projectPath: candidate.projectPath,
        filePath: candidate.filePath,
        stateDir: options.fileEventStateDir,
        snapshot: parsed.snapshot,
      });
    }
  }
  return candidates;
}

export function parseFarplaneFileEventCandidatesFromStdin(
  stdin: string,
  now = Date.now(),
  options: FileChangeParseOptions = {},
): FarplaneFileEventCandidate[] {
  try {
    return parseFarplaneFileEventCandidatesFromPayload(JSON.parse(stdin), now, options);
  } catch {
    return [];
  }
}

export async function parseFileChangeBubbleCandidatesFromStdin(
  stdin: string,
  now = Date.now(),
  options: FileChangeParseOptions = {},
): Promise<FileChangeBubbleCandidate[]> {
  try {
    return await parseFileChangeBubbleCandidatesFromPayload(JSON.parse(stdin), now, options);
  } catch {
    return [];
  }
}

export async function publishFileChangeBubbleCandidates(
  candidates: FileChangeBubbleCandidate[],
  options: PublishFileChangeOptions = {},
): Promise<{ attempted: number; published: number; skipped: boolean; queued?: number; replayed?: number }> {
  const primaryProjectPath = candidates[0]?.projectPath;
  const result = await publishHookTelemetryWithOutbox(
    candidates.map((candidate) => ({
      hookName: "file-change-listener",
      hookType: "PostToolUse",
      projectId: undefined,
      sessionId: candidate.sessionId,
      payload: {
        eventName: "file.change.summary",
        threadId: candidate.threadId,
        cwd: candidate.projectPath,
        paths: [candidate.filePath],
        message: candidate.message,
      },
      eventAt: candidate.eventAt,
      eventKey: candidate.eventKey,
    })),
    {
      endpointBaseUrl: options.endpointBaseUrl,
      telemetryToken: options.telemetryToken,
      fetchImpl: options.fetchImpl,
      projectPath: primaryProjectPath,
    },
  );
  return result;
}

export async function publishFarplaneFileEventCandidates(
  candidates: FarplaneFileEventCandidate[],
  options: PublishFileChangeOptions = {},
): Promise<{ attempted: number; published: number; skipped: boolean; queued?: number; replayed?: number }> {
  const primaryProjectPath = candidates[0]?.projectPath;
  const result = await publishHookTelemetryWithOutbox(
    candidates.map((candidate) => {
      const { projectPath: _projectPath, ...event } = candidate;
      return {
        hookName: "file-change-listener",
        hookType: "PostToolUse",
        projectId: candidate.projectId,
        sessionId: candidate.sessionId,
        payload: {
          ...event,
          cwd: candidate.projectPath,
        },
        eventAt: candidate.eventAt,
        eventKey: candidate.eventKey,
      };
    }),
    {
      endpointBaseUrl: options.endpointBaseUrl,
      telemetryToken: options.telemetryToken,
      fetchImpl: options.fetchImpl,
      projectPath: primaryProjectPath,
    },
  );
  return result;
}
