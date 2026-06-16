/**
 * SKILL INVOCATION LISTENER HOOK
 * ==============================
 * Ownership: Codex PostToolUse hook package.
 * Inputs: untrusted hook payload JSON from stdin.
 * Outputs: compact skill invocation candidates and optional Convex HTTP writes.
 * Side effects: network POST only through publishSkillInvocations.
 * Invariants: raw hook payloads and tool outputs are never persisted.
 */

import fs from "node:fs";
import path from "node:path";
import { buildSkillInvocationTelemetryEnvelope } from "./telemetry";

export type SkillInvocationCandidate = {
  skillId: string;
  skillPath: string;
  sourceTool: string;
  sourceEvent: "PostToolUse";
  label: "Read skill MD";
  sessionId?: string;
  turnId?: string;
  projectPath?: string;
  occurredAt: number;
  stepKey: string;
};

type JsonRecord = Record<string, unknown>;

const MAX_STRING_SCAN_LENGTH = 2_000;
const MAX_ARRAY_SCAN_ITEMS = 50;
const MAX_OBJECT_SCAN_KEYS = 80;
const SKILL_PATH_PATTERN =
  /(?:^|["'\s=:(])((?:~|\/|[A-Za-z]:[\\/])[^"'\n\r\t]*?[\\/]SKILL\.md)(?=$|["'\s),;])/g;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value: unknown, limit = 240): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, limit);
}

function normalizePathSeparators(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/");
}

function stripPathQuotes(value: string): string {
  return value.replace(/^["'(<\s]+/, "").replace(/[>"')\],;:\s]+$/, "");
}

export function normalizeSkillPath(rawPath: string): string | null {
  const cleaned = normalizePathSeparators(stripPathQuotes(rawPath));
  if (!/(^|\/)SKILL\.md$/i.test(cleaned)) return null;
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return cleaned;
}

export function skillIdFromPath(skillPath: string): string | null {
  const normalized = normalizeSkillPath(skillPath);
  if (!normalized) return null;
  const parts = normalized.split("/").filter(Boolean);
  const parent = parts.at(-2)?.trim();
  return parent || null;
}

function collectPathLikeStrings(value: unknown, output: Set<string>, depth = 0): void {
  if (depth > 5 || output.size >= 100) return;
  if (typeof value === "string") {
    const source = value.slice(0, MAX_STRING_SCAN_LENGTH);
    for (const match of source.matchAll(SKILL_PATH_PATTERN)) {
      const candidate = normalizeSkillPath(match[1] ?? "");
      if (candidate) output.add(candidate);
    }
    if (!/\s/.test(source)) {
      const whole = normalizeSkillPath(source);
      if (whole) output.add(whole);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, MAX_ARRAY_SCAN_ITEMS)) {
      collectPathLikeStrings(item, output, depth + 1);
    }
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value).slice(0, MAX_OBJECT_SCAN_KEYS)) {
    if (/content|output|transcript|message/i.test(key)) {
      continue;
    }
    collectPathLikeStrings(child, output, depth + 1);
  }
}

function findFirstRecord(...values: unknown[]): JsonRecord | undefined {
  return values.find(isRecord);
}

function resolveSourceTool(payload: JsonRecord): string {
  return (
    cleanString(payload.toolName) ??
    cleanString(payload.tool_name) ??
    cleanString(payload.tool) ??
    cleanString(findFirstRecord(payload.tool)?.name) ??
    "unknown"
  );
}

function resolveEventName(payload: JsonRecord): string {
  return (
    cleanString(payload.event) ??
    cleanString(payload.hook_event_name) ??
    cleanString(payload.hookEventName) ??
    cleanString(payload.type) ??
    "PostToolUse"
  );
}

function resolveOccurredAt(payload: JsonRecord): number {
  const direct = payload.timestamp ?? payload.occurredAt ?? payload.occurred_at;
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;
  const parsed = Date.parse(cleanString(direct, 80) ?? "");
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function resolveMetadata(payload: JsonRecord): {
  sessionId?: string;
  turnId?: string;
  projectPath?: string;
} {
  const session = findFirstRecord(payload.session);
  const turn = findFirstRecord(payload.turn);
  return {
    sessionId:
      cleanString(payload.sessionId) ??
      cleanString(payload.session_id) ??
      cleanString(session?.id) ??
      cleanString(session?.key),
    turnId: cleanString(payload.turnId) ?? cleanString(payload.turn_id) ?? cleanString(turn?.id),
    projectPath:
      cleanString(payload.cwd, 500) ??
      cleanString(payload.projectPath, 500) ??
      cleanString(payload.project_path, 500),
  };
}

function buildStepKey(params: {
  skillPath: string;
  sourceTool: string;
  sessionId?: string;
  turnId?: string;
  occurredAt: number;
}): string {
  const timeBucket = Math.floor(params.occurredAt / 1000);
  return [
    "skill-invocation",
    params.sourceTool,
    params.sessionId ?? "session",
    params.turnId ?? "turn",
    params.skillPath,
    String(timeBucket),
  ]
    .join(":")
    .replace(/\s+/g, "-")
    .slice(0, 500);
}

export function parseSkillInvocationsFromPayload(
  payload: unknown,
  now = Date.now(),
): SkillInvocationCandidate[] {
  if (!isRecord(payload)) return [];
  const eventName = resolveEventName(payload);
  if (eventName && !/post.*tool.*use/i.test(eventName)) return [];

  const paths = new Set<string>();
  collectPathLikeStrings(payload, paths);
  if (paths.size === 0) return [];

  const sourceTool = resolveSourceTool(payload);
  const occurredAt = resolveOccurredAt(payload) || now;
  const metadata = resolveMetadata(payload);
  const rows: SkillInvocationCandidate[] = [];

  for (const skillPath of [...paths].sort()) {
    const skillId = skillIdFromPath(skillPath);
    if (!skillId) continue;
    rows.push({
      skillId,
      skillPath,
      sourceTool,
      sourceEvent: "PostToolUse",
      label: "Read skill MD",
      sessionId: metadata.sessionId,
      turnId: metadata.turnId,
      projectPath: metadata.projectPath,
      occurredAt,
      stepKey: buildStepKey({
        skillPath,
        sourceTool,
        sessionId: metadata.sessionId,
        turnId: metadata.turnId,
        occurredAt,
      }),
    });
  }

  return rows;
}

export function parseSkillInvocationsFromStdin(
  stdin: string,
  now = Date.now(),
): SkillInvocationCandidate[] {
  try {
    return parseSkillInvocationsFromPayload(JSON.parse(stdin), now);
  } catch {
    return [];
  }
}

export type PublishSkillInvocationOptions = {
  endpointBaseUrl?: string;
  telemetryToken?: string;
  fetchImpl?: typeof fetch;
};

function readDotenvValue(filePath: string, key: string): string | undefined {
  let text: string;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch {
    return undefined;
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || match[1] !== key) continue;
    return match[2]
      .replace(/\s+#.*$/, "")
      .trim()
      .replace(/^['"]|['"]$/g, "");
  }
  return undefined;
}

export async function publishSkillInvocations(
  candidates: SkillInvocationCandidate[],
  options: PublishSkillInvocationOptions = {},
): Promise<{ attempted: number; published: number; skipped: boolean }> {
  const endpointBaseUrl = options.endpointBaseUrl?.replace(/\/+$/, "");
  if (!endpointBaseUrl || candidates.length === 0) {
    return { attempted: candidates.length, published: 0, skipped: true };
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  let published = 0;
  for (const candidate of candidates) {
    const response = await fetchImpl(`${endpointBaseUrl}/telemetry/hooks`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(options.telemetryToken ? { "x-farplane-telemetry-token": options.telemetryToken } : {}),
      },
      body: JSON.stringify(buildSkillInvocationTelemetryEnvelope(candidate)),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `skill_invocation_ingest_failed:${response.status}${detail ? `:${detail.slice(0, 120)}` : ""}`,
      );
    }
    published += 1;
  }
  return { attempted: candidates.length, published, skipped: false };
}

export function resolveDefaultEndpointBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
  searchDirs: string[] = [],
): string {
  const envValue = (env.FARPLANE_CONVEX_SITE_URL || env.CONVEX_SITE_URL || "").trim();
  if (envValue) return envValue;
  for (const dir of searchDirs) {
    const value =
      readDotenvValue(path.join(dir, ".env.local"), "FARPLANE_CONVEX_SITE_URL") ??
      readDotenvValue(path.join(dir, ".env.local"), "CONVEX_SITE_URL");
    if (value) return value.trim();
  }
  return "";
}

export function resolveDefaultTelemetryToken(
  env: NodeJS.ProcessEnv = process.env,
  searchDirs: string[] = [],
): string {
  const envValue = (env.FARPLANE_TELEMETRY_TOKEN || "").trim();
  if (envValue) return envValue;
  for (const dir of searchDirs) {
    const value = readDotenvValue(path.join(dir, ".env.local"), "FARPLANE_TELEMETRY_TOKEN");
    if (value) return value.trim();
  }
  return "";
}

export function resolveHookCommand(repoRoot: string): string {
  const normalizedRepo = path.resolve(repoRoot);
  return `"${path.join(normalizedRepo, "node_modules/.bin/tsx")}" "${path.join(
    normalizedRepo,
    "hooks/skill-invocation-listener/run.ts",
  )}"`;
}
