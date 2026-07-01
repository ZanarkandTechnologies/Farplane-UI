/**
 * PROJECT HOOK CONFIG
 * ===================
 * Ownership: Farplane hook runtime.
 * Inputs: ~/.farplane/config.toml hook config, Farplane manifest, env overrides.
 * Outputs: watched file patterns for hook filters.
 * Side effects: read-only filesystem access.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  readFarplaneConfigObject,
  readFarplaneConfigValue,
  resolveFarplaneHome,
} from "../../cli/runtime-config";
import { DEFAULT_FILE_CHANGE_SUMMARY_DEBOUNCE_MS } from "./file-change-summary-settings";

export type ProjectHookConfig = {
  enabled: boolean;
  summaryEnabled: boolean;
  summaryDebounceMs: number;
  includeManifestTracked: boolean;
  selectedManifestPaths: string[];
  customPatterns: string[];
};

export type ResolvedProjectHookConfig = ProjectHookConfig & {
  projectPath: string;
  configPath: string;
  manifestPath: string;
  manifestTracked: string[];
  patterns: string[];
};

const DEFAULT_TRACKED_PATH_PATTERNS = [
  "progress.md",
  "goals.md",
  "tickets/*/ticket.md",
  "tickets/*/progress.md",
  "tickets/*/program.md",
  "farplane/*.md",
  "farplane/*.json",
  "docs/*.md",
  "docs/**/*.md",
  "evals/**",
  "skills/*/memory.md",
] as const;

export function defaultTrackedPathPatterns(): string[] {
  return [...DEFAULT_TRACKED_PATH_PATTERNS];
}

export function codexProjectIdFromPath(projectPath: string): string {
  const slug =
    path
      .resolve(projectPath)
      .replace(/\/+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "codex";
  return `codex-proj-${slug}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function uniquePatterns(values: readonly string[]): string[] {
  return [...new Set(values.map((entry) => entry.trim().replace(/\\/g, "/")).filter(Boolean))];
}

function parsePatternList(value: string | undefined): string[] | undefined {
  const patterns = value
    ?.split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  return patterns && patterns.length > 0 ? uniquePatterns(patterns) : undefined;
}

function positiveNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Math.floor(value);
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : undefined;
}

function booleanFlag(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

function readJsonFile(filePath: string): unknown {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return undefined;
  }
}

function normalizeConfig(value: unknown, manifestTracked: string[]): ProjectHookConfig {
  const record = asRecord(value);
  const selected = Array.isArray(record.selectedManifestPaths)
    ? record.selectedManifestPaths.filter((entry): entry is string => typeof entry === "string")
    : manifestTracked;
  const custom = Array.isArray(record.customPatterns)
    ? record.customPatterns.filter((entry): entry is string => typeof entry === "string")
    : [];
  return {
    enabled: typeof record.enabled === "boolean" ? record.enabled : true,
    summaryEnabled: typeof record.summaryEnabled === "boolean" ? record.summaryEnabled : false,
    summaryDebounceMs:
      positiveNumber(record.summaryDebounceMs) ?? DEFAULT_FILE_CHANGE_SUMMARY_DEBOUNCE_MS,
    includeManifestTracked:
      typeof record.includeManifestTracked === "boolean" ? record.includeManifestTracked : true,
    selectedManifestPaths: uniquePatterns(selected),
    customPatterns: uniquePatterns(custom),
  };
}

export function readFarplaneManifestTracked(projectPath: string): string[] {
  const manifestPath = path.join(projectPath, "farplane", "manifest.json");
  const manifest = asRecord(readJsonFile(manifestPath));
  const standard = asRecord(manifest.standard);
  const optional = asRecord(manifest.optional);
  const tracked = [
    ...(Array.isArray(standard.tracked) ? standard.tracked : []),
    ...(Array.isArray(optional.tracked) ? optional.tracked : []),
  ].filter((entry): entry is string => typeof entry === "string");
  return uniquePatterns(tracked).filter((entry) => !entry.endsWith("/"));
}

export function resolveProjectHookConfig(
  projectPath: string,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedProjectHookConfig {
  const root = path.resolve(projectPath);
  const configPath = path.join(resolveFarplaneHome(env), "config.toml");
  const manifestPath = path.join(root, "farplane", "manifest.json");
  const manifestTracked = readFarplaneManifestTracked(root);
  const config = normalizeConfig(
    readFarplaneConfigObject(["hooks", "file_change"], { env }),
    manifestTracked,
  );
  const envPatterns = parsePatternList(
    readFarplaneConfigValue("FARPLANE_FILE_CHANGE_PATTERNS", { env }),
  );
  const envDebounceMs = positiveNumber(
    readFarplaneConfigValue("FARPLANE_FILE_CHANGE_SUMMARY_DEBOUNCE_MS", { env }),
  );
  const envSummaryEnabled = booleanFlag(
    readFarplaneConfigValue("FARPLANE_FILE_CHANGE_SUMMARY_ENABLED", { env }),
  );
  const manifestPatterns = config.includeManifestTracked ? config.selectedManifestPaths : [];
  const patterns =
    envPatterns ??
    uniquePatterns([
      ...defaultTrackedPathPatterns(),
      ...manifestPatterns,
      ...config.customPatterns,
    ]);
  return {
    ...config,
    summaryEnabled: envSummaryEnabled ?? config.summaryEnabled,
    summaryDebounceMs: envDebounceMs ?? config.summaryDebounceMs,
    projectPath: root,
    configPath,
    manifestPath,
    manifestTracked,
    patterns: patterns.length > 0 ? patterns : defaultTrackedPathPatterns(),
  };
}
