import { readFileSync } from "node:fs";

/**
 * Non-secret, machine-local settings shared by Farplane tools and the UI.
 *
 * Credentials deliberately do not belong here. They remain environment values
 * supplied by Doppler (or another process-level secret manager).
 */
export type OperatorSettingsObject = Record<string, unknown>;
export type OperatorSettingsTomlUpdate = {
  path: readonly string[];
  value: unknown;
};

export const VIDEO_INTELLIGENCE_REASONING_EFFORTS = [
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

export type VideoIntelligenceReasoningEffort =
  (typeof VIDEO_INTELLIGENCE_REASONING_EFFORTS)[number];

export interface VideoIntelligenceAnalysisSettings {
  model: string;
  reasoningEffort: VideoIntelligenceReasoningEffort;
}

export interface VideoIntelligenceExecutionProfile extends VideoIntelligenceAnalysisSettings {
  definition: "video_intelligence.analysis.v1";
}

export const DEFAULT_VIDEO_INTELLIGENCE_ANALYSIS: VideoIntelligenceAnalysisSettings = {
  model: "gpt-5.6-terra",
  reasoningEffort: "xhigh",
};

/** The small, inspectable setting registry rendered by the Settings UI. */
export const OPERATOR_SETTING_REGISTRY = [
  {
    id: "video_intelligence.analysis",
    label: "Video Intelligence analysis",
    scope: "operator",
    tomlPath: ["features", "video_intelligence", "analysis"],
    secret: false,
  },
] as const;

function objectValue(value: unknown): OperatorSettingsObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as OperatorSettingsObject)
    : {};
}

function stripTomlComment(line: string): string {
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quote) {
      if (quote === '"' && character === "\\" && !escaped) {
        escaped = true;
        continue;
      }
      if (character === quote && !escaped) quote = null;
      escaped = false;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "#") return line.slice(0, index);
  }

  return line;
}

function parseTomlValue(raw: string): unknown {
  const value = raw.trim();
  if (!value) return "";
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (value.startsWith("[") && value.endsWith("]")) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

/** Parse the deliberately small TOML subset used by Farplane operator config. */
export function parseOperatorSettingsToml(raw: string): OperatorSettingsObject {
  const result: OperatorSettingsObject = {};
  let section: string[] = [];

  for (const sourceLine of raw.split(/\r?\n/)) {
    const line = stripTomlComment(sourceLine).trim();
    if (!line) continue;

    const header = /^\[([^\]]+)\]$/.exec(line);
    if (header) {
      section = header[1]
        .split(".")
        .map((part) => part.trim())
        .filter(Boolean);
      continue;
    }

    const assignment = /^([A-Za-z0-9_-]+)\s*=\s*(.*)$/.exec(line);
    if (!assignment) continue;

    let target = result;
    for (const part of section) {
      const next = objectValue(target[part]);
      target[part] = next;
      target = next;
    }
    target[assignment[1]] = parseTomlValue(assignment[2]);
  }

  return result;
}

export function readOperatorSettingsTomlFile(filePath: string): OperatorSettingsObject {
  try {
    return parseOperatorSettingsToml(readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function tomlScalarForPatch(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") return tomlString(value);
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (
    Array.isArray(value) &&
    value.every((item) => ["string", "number", "boolean"].includes(typeof item))
  ) {
    return `[${value.map((item) => tomlScalarForPatch(item)).join(", ")}]`;
  }
  throw new Error("operator_settings_unsupported_toml_value");
}

function tomlSectionPath(line: string): string[] | null {
  const header = /^\s*\[([^\]]+)\]\s*$/.exec(stripTomlComment(line).trim());
  if (!header) return null;
  return header[1]
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
}

function tomlAssignmentKey(line: string): string | null {
  const assignment = /^\s*([A-Za-z0-9_-]+)\s*=/.exec(stripTomlComment(line));
  return assignment?.[1] ?? null;
}

function lineSpanForTomlValue(lines: string[], start: number, end: number): number {
  const first = lines[start].slice(lines[start].indexOf("=") + 1);
  if (!first.trimStart().startsWith("[")) return start + 1;

  let depth = 0;
  let quote: '"' | "'" | null = null;
  let escaped = false;
  for (let index = start; index < end; index += 1) {
    for (const character of lines[index]) {
      if (quote) {
        if (quote === '"' && character === "\\" && !escaped) {
          escaped = true;
          continue;
        }
        if (character === quote && !escaped) quote = null;
        escaped = false;
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
      } else if (character === "[") {
        depth += 1;
      } else if (character === "]") {
        depth -= 1;
      }
    }
    if (depth <= 0) return index + 1;
  }
  return end;
}

/**
 * Patch only UI-owned TOML assignments. Unlike a parse/serialize cycle this
 * keeps every unknown table, value syntax, and comment byte-for-byte intact.
 */
export function patchOperatorSettingsToml(
  source: string,
  updates: readonly OperatorSettingsTomlUpdate[],
): string {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const hadTrailingNewline = source.endsWith("\n");
  const lines = source ? source.split(/\r?\n/) : [];
  if (hadTrailingNewline) lines.pop();

  const bySection = new Map<string, Array<{ key: string; value: string | null }>>();
  for (const update of updates) {
    if (update.path.length === 0) continue;
    const key = update.path.at(-1);
    if (!key) continue;
    const section = update.path.slice(0, -1);
    const sectionKey = section.join("\u0000");
    const entries = bySection.get(sectionKey) ?? [];
    entries.push({ key, value: tomlScalarForPatch(update.value) });
    bySection.set(sectionKey, entries);
  }

  for (const [sectionKey, entries] of bySection) {
    const section = sectionKey ? sectionKey.split("\u0000") : [];
    let start = -1;
    let end = lines.length;
    for (let index = 0; index < lines.length; index += 1) {
      const path = tomlSectionPath(lines[index]);
      if (!path) continue;
      if (start >= 0) {
        end = index;
        break;
      }
      if (path.join("\u0000") === sectionKey) start = index + 1;
    }

    if (start < 0) {
      const additions = entries
        .filter((entry) => entry.value !== null)
        .map((entry) => `${entry.key} = ${entry.value}`);
      if (additions.length === 0) continue;
      if (lines.length > 0 && lines.at(-1)?.trim()) lines.push("");
      lines.push(`[${section.join(".")}]`, ...additions);
      continue;
    }

    let insertionPoint = end;
    for (const entry of entries) {
      let assignmentStart = -1;
      for (let index = start; index < end; index += 1) {
        if (tomlAssignmentKey(lines[index]) === entry.key) {
          assignmentStart = index;
          break;
        }
      }
      if (assignmentStart >= 0) {
        const assignmentEnd = lineSpanForTomlValue(lines, assignmentStart, end);
        if (entry.value === null) {
          lines.splice(assignmentStart, assignmentEnd - assignmentStart);
          const removed = assignmentEnd - assignmentStart;
          end -= removed;
          insertionPoint = Math.min(insertionPoint, assignmentStart);
        } else {
          lines.splice(
            assignmentStart,
            assignmentEnd - assignmentStart,
            `${entry.key} = ${entry.value}`,
          );
          const delta = 1 - (assignmentEnd - assignmentStart);
          end += delta;
          insertionPoint = Math.min(insertionPoint, assignmentStart + 1);
        }
      } else if (entry.value !== null) {
        lines.splice(insertionPoint, 0, `${entry.key} = ${entry.value}`);
        insertionPoint += 1;
        end += 1;
      }
    }
  }

  return `${lines.join(newline)}${hadTrailingNewline || lines.length > 0 ? newline : ""}`;
}

function isSecretConfigKey(key: string): boolean {
  return (
    /^(?:token|secret|password|credential)$/i.test(key) ||
    /[_-]token$/i.test(key) ||
    /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|bearer[_-]?token|bot[_-]?token|telemetry[_-]?token|client[_-]?secret|private[_-]?key|oauth|password|credential)/i.test(
      key,
    )
  );
}

/** Remove legacy credential assignments without normalizing unrelated TOML. */
export function stripSecretsFromOperatorSettingsToml(source: string): string {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const hadTrailingNewline = source.endsWith("\n");
  const lines = source ? source.split(/\r?\n/) : [];
  if (hadTrailingNewline) lines.pop();
  for (let index = 0; index < lines.length; index += 1) {
    const key = tomlAssignmentKey(lines[index]);
    if (!key || !isSecretConfigKey(key)) continue;
    const end = lineSpanForTomlValue(lines, index, lines.length);
    lines.splice(index, end - index);
    index -= 1;
  }
  return `${lines.join(newline)}${hadTrailingNewline || lines.length > 0 ? newline : ""}`;
}

export function operatorSettingsAt(value: OperatorSettingsObject, path: string[]): unknown {
  let current: unknown = value;
  for (const part of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as OperatorSettingsObject)[part];
  }
  return current;
}

export function setOperatorSettingsValue(
  value: OperatorSettingsObject,
  path: string[],
  next: unknown,
): void {
  if (path.length === 0) return;
  let current = value;
  for (const part of path.slice(0, -1)) {
    const child = objectValue(current[part]);
    current[part] = child;
    current = child;
  }
  const leaf = path[path.length - 1];
  if (next === undefined || next === null || next === "") delete current[leaf];
  else current[leaf] = next;
}

function normalizedModel(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_VIDEO_INTELLIGENCE_ANALYSIS.model;
  const model = value.trim();
  return model.length > 0 && model.length <= 120
    ? model
    : DEFAULT_VIDEO_INTELLIGENCE_ANALYSIS.model;
}

function normalizedReasoningEffort(value: unknown): VideoIntelligenceReasoningEffort {
  return VIDEO_INTELLIGENCE_REASONING_EFFORTS.includes(value as VideoIntelligenceReasoningEffort)
    ? (value as VideoIntelligenceReasoningEffort)
    : DEFAULT_VIDEO_INTELLIGENCE_ANALYSIS.reasoningEffort;
}

/** Resolve the effective profile without allowing malformed local config to break ingestion. */
export function resolveVideoIntelligenceAnalysisProfile(
  config: OperatorSettingsObject,
): VideoIntelligenceExecutionProfile {
  const analysis = objectValue(
    operatorSettingsAt(config, ["features", "video_intelligence", "analysis"]),
  );
  return {
    definition: "video_intelligence.analysis.v1",
    model: normalizedModel(analysis.model),
    reasoningEffort: normalizedReasoningEffort(
      analysis.reasoning_effort ?? analysis.reasoningEffort,
    ),
  };
}
