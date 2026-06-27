import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { chmod, cp, mkdir, readdir, readFile, rm, writeFile, stat } from "node:fs/promises";
import { promisify } from "node:util";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {
  findLiveLayoutPlacementViolations,
  getOfficeLayoutCandidatePositions,
} from "../cli/office-layout-placement";
import { shuffleOfficeObjects } from "../cli/office-arrange";
import type { OfficeObjectModel, OfficeSettingsModel } from "../cli/sidecar-store";
import { buildNewTeamClusterObject } from "../cli/team-cluster-placement";
import {
  getSkillStudioDetail,
  listSkillStudioCatalog,
  readSkillStudioFile,
  runSkillStudioDemo,
  saveSkillStudioManifest,
  saveSkillStudioFile,
} from "./skill-studio-state";
import {
  mergeFilesystemThreadsIntoThreadList,
  readFilesystemObservedCodexThreads,
} from "./codex-thread-summaries";
import { normalizeBridgeOfficeSettings, type BridgeOfficeSettings as OfficeSettings } from "./office-settings-bridge";
import {
  LOCAL_OBSERVED_CODEX_DISCOVERY_RANGE_MS,
  localFarplaneEventsToObservedCodexWorkers,
} from "./src/providers/local-observed-codex-workers";
import { resolveEvalArtifactsRoot } from "./src/modules/evals/lib/eval-artifacts";

type JsonObject = Record<string, unknown>;
type MemoryEntryType = "discovery" | "decision" | "problem" | "solution" | "pattern" | "warning" | "success" | "refactor" | "bugfix" | "feature";
type TaskProvider = "internal" | "notion" | "vibe" | "linear";
type TaskSyncState = "healthy" | "pending" | "conflict" | "error";
type TeamRole = "builder" | "growth_marketer" | "pm" | "biz_pm" | "biz_executor";
type BusinessType = "affiliate_marketing" | "content_creator" | "saas" | "custom";
type BusinessEquipMode = "replace_minimum" | "append_only";
type TicketStatus = "todo" | "in_progress" | "review" | "blocked" | "done";

const FARPLANE_HOME =
  process.env.FARPLANE_STATE_DIR ||
  process.env.FARPLANE_HOME ||
  path.join(process.env.HOME || "", ".farplane");
const CODEX_HOME = process.env.CODEX_HOME || path.join(process.env.HOME || "", ".codex");
const CODEX_GLOBAL_STATE_PATH = path.join(CODEX_HOME, ".codex-global-state.json");
const OPENCLAW_HOME = process.env.OPENCLAW_STATE_DIR || path.join(process.env.HOME || "", ".openclaw");
const OPENCLAW_CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH || path.join(OPENCLAW_HOME, "openclaw.json");
const REPO_ROOT = path.resolve(__dirname, "..");
const FARPLANE_FRAMEWORK_ROOT =
  process.env.FARPLANE_FRAMEWORK_ROOT ||
  path.resolve(REPO_ROOT, "..", "Farplane");
const SKILLS_ROOT = path.join(REPO_ROOT, "skills");
const PROJECT_CODEX_SKILLS_ROOT = path.join(REPO_ROOT, ".codex", "skills");
const CODEX_SKILLS_ROOT = path.join(CODEX_HOME, "skills");
const CODEX_SKILL_MAINTENANCE_GRAPH_ROOT = path.join(
  CODEX_SKILLS_ROOT,
  "skill-maintenance",
  "graph",
);
const FARPLANE_FRAMEWORK_GRAPH_ROOT = path.join(
  FARPLANE_FRAMEWORK_ROOT,
  "skills",
  "skill-maintenance",
  "graph",
);
const COMPANY_MODEL_PATH = path.join(FARPLANE_HOME, "company.json");
const LOCAL_HOOK_EVENTS_DIR = path.join(FARPLANE_HOME, "events");
const COMPANY_TEMPLATE_PATH = path.resolve(__dirname, "../templates/sidecar/company.template.json");
const FARPLANE_CONFIG_TOML_PATH = path.join(FARPLANE_HOME, "config.toml");
const FARPLANE_CONFIG_JSON_PATH = path.join(FARPLANE_HOME, "config.json");
const FARPLANE_SECRETS_JSON_PATH = path.join(FARPLANE_HOME, "secrets.json");
const OFFICE_OBJECTS_PATH = path.join(FARPLANE_HOME, "office-objects.json");
const OFFICE_SETTINGS_PATH = path.join(FARPLANE_HOME, "office.json");
const CODEX_OFFICE_CONFIG_PATH = path.join(FARPLANE_HOME, "codex-office.json");
const PROJECT_MANAGERS_PATH = path.join(FARPLANE_HOME, "project-managers.json");
const TELEGRAM_GATEWAY_STATE_PATH = path.join(FARPLANE_HOME, "telegram-gateway", "state.json");
const GLOBAL_EVALS_ROOT = path.join(FARPLANE_HOME, "evals");
const PROJECT_EVALS_ROOT = path.join(REPO_ROOT, ".farplane", "evals");
const FRAMEWORK_EVALS_ROOT = path.join(FARPLANE_FRAMEWORK_ROOT, ".farplane", "evals");
const MAX_SKILL_EVAL_QUERY_LENGTH = 160;
const FARPLANE_EVALS_ROOT = resolveEvalArtifactsRoot({
  envRoot: process.env.FARPLANE_EVALS_ROOT,
  frameworkRoot: FRAMEWORK_EVALS_ROOT,
  globalRoot: GLOBAL_EVALS_ROOT,
  projectRoot: PROJECT_EVALS_ROOT,
  hasFrameworkIndex: existsSync(path.join(FRAMEWORK_EVALS_ROOT, "runs", "index.json")),
  hasGlobalIndex: existsSync(path.join(GLOBAL_EVALS_ROOT, "runs", "index.json")),
});
const OFFICE_OBJECTS_TEMPLATE_PATH = path.resolve(
  __dirname,
  "../templates/sidecar/office-objects.template.json",
);
const OFFICE_SETTINGS_TEMPLATE_PATH = path.resolve(
  __dirname,
  "../templates/sidecar/office.template.json",
);
const PENDING_APPROVALS_PATH = path.join(FARPLANE_HOME, "pending-approvals.json");
const PENDING_APPROVALS_TEMPLATE_PATH = path.resolve(__dirname, "../templates/sidecar/pending-approvals.template.json");
const BIZ_PM_HEARTBEAT_TEMPLATE_PATH = path.resolve(__dirname, "../templates/workspace/HEARTBEAT-biz-pm.md");
const BIZ_EXECUTOR_HEARTBEAT_TEMPLATE_PATH = path.resolve(__dirname, "../templates/workspace/HEARTBEAT-biz-executor.md");
const PROJECT_MEMORY_FILES = [
  { path: "docs/MEMORY.md", title: "Memory", kind: "memory" },
  { path: "docs/LESSONS.md", title: "Lessons", kind: "lessons" },
  { path: "docs/TROUBLES.md", title: "Troubles", kind: "troubles" },
  { path: "docs/HISTORY.md", title: "History", kind: "history" },
] as const;
type TemplateTrackingFamilyConfig = {
  familyId: string;
  label: string;
  scope: string;
  source: "manifest" | "frontmatter" | "template-file" | "derived" | "scanner-gap";
  description: string;
  manifestKey?: string;
  paths?: string[];
  notes?: string;
  owner?: string;
};
type TemplateRegistryRow = {
  applies_to?: unknown;
  consumer_scope?: string;
  feature_refs?: unknown;
  kind?: string;
  path?: string;
  template_id?: string;
  template_version?: string;
};
type TemplateInstallTarget =
  | "codex-global"
  | "project-scaffold"
  | "skill-package"
  | "ticket-scaffold"
  | "runtime-template"
  | "source-only"
  | "unknown";
type TemplateHistoryPolicy = "git" | "snapshot" | "none";
const TEMPLATE_TRACKING_FAMILIES: TemplateTrackingFamilyConfig[] = [
  {
    familyId: "farplane-framework",
    label: "Farplane Framework",
    scope: "project",
    source: "manifest",
    description: "Project-level Farplane framework/template version pinned in farplane/manifest.json.",
    manifestKey: "farplane-framework",
    paths: ["farplane/manifest.json"],
    owner: "harness",
  },
  {
    familyId: "farplane-config-index",
    label: "Config Index",
    scope: "project-config",
    source: "frontmatter",
    description: "The farplane/ directory index and tracked config map.",
    paths: ["farplane/README.md"],
    owner: "harness",
  },
  {
    familyId: "project-harness",
    label: "Project Harness",
    scope: "project-config",
    source: "frontmatter",
    description: "Project mission, values, modes, systems, and feedback loops.",
    paths: ["farplane/harness.md"],
    owner: "harness",
  },
  {
    familyId: "goal-portfolio",
    label: "Goal Portfolio",
    scope: "project-config",
    source: "frontmatter",
    description: "North star, KPI axes, milestones, and holds.",
    paths: ["farplane/goals.md"],
    owner: "project-pm-automation",
  },
  {
    familyId: "project-automations",
    label: "Automations",
    scope: "project-config",
    source: "frontmatter",
    description: "Recurring jobs, schedules, reports, and ticket source policy.",
    paths: ["farplane/automations.md"],
    owner: "project-pm-automation",
  },
  {
    familyId: "project-bindings",
    label: "Bindings",
    scope: "project-config",
    source: "frontmatter",
    description: "Non-secret project IDs, URLs, labels, and aliases.",
    paths: ["farplane/bindings.md"],
    owner: "project-pm-automation",
  },
  {
    familyId: "project-evals",
    label: "Project Evals",
    scope: "project-config",
    source: "frontmatter",
    description: "Project-level proof and eval policy.",
    paths: ["farplane/evals.md"],
    owner: "harness",
  },
  {
    familyId: "ticket-template",
    label: "Ticket Template",
    scope: "ticketing",
    source: "template-file",
    description: "Tracked implementation ticket contract.",
    paths: ["tickets/templates/ticket.md"],
    owner: "ticket-loop",
  },
  {
    familyId: "goal-packet",
    label: "Goal Packet",
    scope: "goal-runtime",
    source: "scanner-gap",
    description: "Ticket/program/progress/generated-goal-prompt shape used by native Goal work.",
    paths: ["tickets/TASK-*/program.md", "tickets/TASK-*/progress.md", "tickets/TASK-*/generated-goal-prompt.md"],
    notes: "No central versioned template file is exposed yet.",
    owner: "goal-advisor",
  },
  {
    familyId: "skill-template",
    label: "Skill Template",
    scope: "skills",
    source: "derived",
    description: "Skill package template versions read from skill frontmatter; Skill OS owns per-skill detail.",
    notes: "Detailed skill-template rollout lives in Skill OS.",
    owner: "skill-maintenance",
  },
  {
    familyId: "skill-qa-checklist",
    label: "Skill QA Checklist",
    scope: "skills",
    source: "scanner-gap",
    description: "Reusable skill QA checklist/template versions referenced by skill packages.",
    notes: "Needs a dedicated skill-package manifest scan before counts are authoritative here.",
    owner: "skill-maintenance",
  },
  {
    familyId: "eval-task-template",
    label: "Eval Task Template",
    scope: "evals",
    source: "scanner-gap",
    description: "Reusable eval task and hardcase shapes.",
    paths: ["farplane/evals.md", ".farplane/evals/"],
    notes: "Project eval policy is tracked; eval task manifests need their own scanner.",
    owner: "evals",
  },
  {
    familyId: "workspace-agent-template",
    label: "Workspace Agent",
    scope: "workspace",
    source: "template-file",
    description: "Business PM/executor AGENTS templates.",
    paths: ["templates/workspace/AGENTS-biz-pm.md", "templates/workspace/AGENTS-biz-executor.md"],
    owner: "business-runtime",
  },
  {
    familyId: "workspace-heartbeat-template",
    label: "Workspace Heartbeat",
    scope: "workspace",
    source: "template-file",
    description: "Business PM/executor HEARTBEAT prompt templates.",
    paths: ["templates/workspace/HEARTBEAT-biz-pm.md", "templates/workspace/HEARTBEAT-biz-executor.md"],
    owner: "business-runtime",
  },
  {
    familyId: "workspace-soul-template",
    label: "Workspace Soul",
    scope: "workspace",
    source: "template-file",
    description: "Business PM/executor SOUL templates.",
    paths: ["templates/workspace/SOUL-biz-pm.md", "templates/workspace/SOUL-biz-executor.md"],
    owner: "business-runtime",
  },
  {
    familyId: "sidecar-template",
    label: "Sidecar State",
    scope: "sidecar",
    source: "template-file",
    description: "Company, office, object, Codex office, and pending approval seed files.",
    paths: [
      "templates/sidecar/company.template.json",
      "templates/sidecar/office.template.json",
      "templates/sidecar/office-objects.template.json",
      "templates/sidecar/codex-office.template.json",
      "templates/sidecar/pending-approvals.template.json",
    ],
    owner: "office-runtime",
  },
  {
    familyId: "openclaw-template",
    label: "OpenClaw Config",
    scope: "runtime-adapter",
    source: "template-file",
    description: "Optional OpenClaw runtime and agent list templates.",
    paths: ["templates/openclaw/openclaw.template.json", "templates/openclaw/agents.list.template.json"],
    owner: "runtime-adapter",
  },
];
const PROJECT_DOCUMENT_LIBRARY_MAX_FILES = 80;
const PROJECT_DOCUMENT_LIBRARY_MAX_BYTES = 240_000;
const PROJECT_DOCUMENT_LIBRARY_EXTENSIONS = new Set([".md", ".mdx", ".txt"]);
const DEFAULT_MESH_ASSET_DIR = path.join(FARPLANE_HOME, "assets", "meshes");
const CRON_JOBS_PATH = path.join(OPENCLAW_HOME, "cron", "jobs.json");
const MESH_EXTENSIONS = new Set([".glb", ".gltf"]);
const MESH_PREVIEW_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const CODEX_PET_ASSET_EXTENSIONS = new Set([".json", ".png", ".webp"]);
const SKILL_PACKAGE_FILE_NAMES = ["SKILL.md", "skill.md"] as const;
const MESHY_API_BASE = "https://api.meshy.ai/openapi/v2";
const execFileAsync = promisify(execFile);

function readRootEnvValue(name: string): string {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(REPO_ROOT, fileName);
    if (!existsSync(filePath)) continue;
    const lines = readFileSync(filePath, "utf-8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || match[1] !== name) continue;
      return match[2].replace(/\s+#.*$/, "").trim().replace(/^['"]|['"]$/g, "");
    }
  }
  return "";
}

function readLocalJsonObjectSync(filePath: string): JsonObject {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonObject)
      : {};
  } catch {
    return {};
  }
}

function stripTomlComment(line: string): string {
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && quoted) {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      quoted = !quoted;
      continue;
    }
    if (char === "#" && !quoted) return line.slice(0, index).trimEnd();
  }
  return line.trimEnd();
}

function parseTomlString(rawValue: string): string {
  const value = rawValue.trim();
  if (!value) return "";
  if (value.startsWith("\"") && value.endsWith("\"")) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return typeof parsed === "string" ? parsed.trim() : "";
    } catch {
      return value.slice(1, -1).trim();
    }
  }
  return value.trim();
}

function readLocalTomlObjectSync(filePath: string): JsonObject {
  let current: JsonObject | null = null;
  const root: JsonObject = {};
  try {
    const lines = readFileSync(filePath, "utf-8").split(/\r?\n/);
    for (const rawLine of lines) {
      const line = stripTomlComment(rawLine).trim();
      if (!line) continue;
      const sectionMatch = line.match(/^\[([A-Za-z0-9_.-]+)\]$/);
      if (sectionMatch) {
        current = root;
        for (const part of sectionMatch[1].split(".")) {
          const child = current[part];
          if (!child || typeof child !== "object" || Array.isArray(child)) {
            current[part] = {};
          }
          current = current[part] as JsonObject;
        }
        continue;
      }
      const assignmentMatch = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*(.*)$/);
      if (!assignmentMatch || !current) continue;
      current[assignmentMatch[1]] = parseTomlString(assignmentMatch[2]);
    }
  } catch {
    return {};
  }
  return root;
}

function tomlString(value: unknown): string {
  return JSON.stringify(typeof value === "string" ? value : String(value ?? ""));
}

function serializeTomlSection(name: string, row: unknown): string[] {
  if (!row || typeof row !== "object" || Array.isArray(row)) return [];
  const entries = Object.entries(row as JsonObject)
    .filter(([, value]) => typeof value === "string" && value.trim())
    .sort(([left], [right]) => left.localeCompare(right));
  if (!entries.length) return [];
  return [`[${name}]`, ...entries.map(([key, value]) => `${key} = ${tomlString(value)}`), ""];
}

function serializeFarplaneConfigToml(row: JsonObject): string {
  const lines = [
    "# Managed by Farplane UI Settings. Keep this file local and private.",
    "# Farplane Core treats this as the canonical runtime config.",
    "",
    ...serializeTomlSection("runtime", row.runtime),
    ...serializeTomlSection("convex", row.convex),
    ...serializeTomlSection("integrations", row.integrations),
    ...serializeTomlSection("env", row.env),
  ];
  return `${lines.join("\n").trimEnd()}\n`;
}

function objectStringAt(row: JsonObject, pathParts: string[]): string {
  let current: unknown = row;
  for (const part of pathParts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return "";
    current = (current as JsonObject)[part];
  }
  return typeof current === "string" ? current.trim() : "";
}

function canonicalConfigString(pathParts: string[]): string {
  return objectStringAt(readLocalTomlObjectSync(FARPLANE_CONFIG_TOML_PATH), pathParts);
}

function localConfigString(pathParts: string[]): string {
  return (
    canonicalConfigString(pathParts) ||
    objectStringAt(readLocalJsonObjectSync(FARPLANE_CONFIG_JSON_PATH), pathParts)
  );
}

function localSecretString(pathParts: string[]): string {
  return (
    canonicalConfigString(pathParts) ||
    objectStringAt(readLocalJsonObjectSync(FARPLANE_SECRETS_JSON_PATH), pathParts)
  );
}

function localConfigEnvString(name: string): string {
  return localConfigString(["env", name]);
}

function localSecretEnvString(name: string): string {
  return localSecretString(["env", name]);
}

function firstLocalConfigString(paths: string[][]): string {
  for (const pathParts of paths) {
    const value = localConfigString(pathParts);
    if (value) return value;
  }
  return "";
}

function firstLocalSecretString(paths: string[][]): string {
  for (const pathParts of paths) {
    const value = localSecretString(pathParts);
    if (value) return value;
  }
  return "";
}

function firstEnvValue(names: string[]): string {
  for (const name of names) {
    const value = localConfigEnvString(name) || process.env[name]?.trim() || readRootEnvValue(name);
    if (value) return value;
  }
  return "";
}

function normalizeConvexClientUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return trimmed.replace(/\/$/, "");
  }
}

function convexClientUrlFromSiteUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.hostname.endsWith(".convex.cloud")) return normalizeConvexClientUrl(trimmed);
    if (!url.hostname.endsWith(".convex.site")) return "";
    url.hostname = url.hostname.replace(/\.convex\.site$/, ".convex.cloud");
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function resolveViteConvexUrl(): string {
  const savedViteConvexUrl = localConfigEnvString("VITE_CONVEX_URL");
  if (savedViteConvexUrl) return normalizeConvexClientUrl(savedViteConvexUrl);
  const savedClientUrl = localConfigString(["convex", "clientUrl"]);
  if (savedClientUrl) return normalizeConvexClientUrl(savedClientUrl);
  const savedSiteUrl = localConfigString(["convex", "siteUrl"]);
  const savedSiteClientUrl = convexClientUrlFromSiteUrl(savedSiteUrl);
  if (savedSiteClientUrl) return savedSiteClientUrl;
  const clientUrl = firstEnvValue(["VITE_CONVEX_URL", "CONVEX_URL"]);
  if (clientUrl) return normalizeConvexClientUrl(clientUrl);
  return convexClientUrlFromSiteUrl(
    firstEnvValue(["FARPLANE_CONVEX_SITE_URL", "CONVEX_SITE_URL"]),
  );
}

const VITE_CONVEX_URL = resolveViteConvexUrl();

interface SessionUsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  responseCount: number;
}

interface SessionUsageSummary {
  lastResponse?: SessionUsageTotals & {
    provider?: string;
    model?: string;
    timestamp?: number;
  };
  sessionTotals: SessionUsageTotals;
  last24Hours?: SessionUsageTotals;
  last7Days?: SessionUsageTotals;
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function setNestedString(row: JsonObject, pathParts: string[], value: string): void {
  let current = row;
  for (let index = 0; index < pathParts.length - 1; index += 1) {
    const key = pathParts[index];
    const child = current[key];
    if (!child || typeof child !== "object" || Array.isArray(child)) {
      current[key] = {};
    }
    current = current[key] as JsonObject;
  }
  const leaf = pathParts[pathParts.length - 1];
  if (value.trim()) {
    current[leaf] = value.trim();
  } else {
    delete current[leaf];
  }
}

function runtimeSecretStatus(pathParts: string[], envNames: string[]): JsonObject {
  const saved =
    localSecretString(pathParts) ||
    (pathParts[0] === "integrations" && pathParts[1] === "meshyApiKey"
      ? localSecretString(["integrations", "meshy_api_key"])
      : "") ||
    (pathParts[0] === "integrations" && pathParts[1] === "notionApiKey"
      ? localSecretString(["integrations", "notion_api_key"]) ||
        localSecretString(["integrations", "notion_token"])
      : "") ||
    (pathParts[0] === "convex" && pathParts[1] === "telemetryToken"
      ? localSecretString(["convex", "telemetry_token"])
      : "");
  if (saved) {
    return { configured: true, source: "saved" };
  }
  for (const name of envNames) {
    if (process.env[name]?.trim() || readRootEnvValue(name)) {
      return { configured: true, source: "env" };
    }
  }
  return { configured: false, source: "missing" };
}

type RuntimeEnvConfig = {
  name: string;
  label: string;
  group: string;
  description: string;
  secret?: boolean;
  placeholder?: string;
  multiline?: boolean;
};

const RUNTIME_ENV_CATALOG: RuntimeEnvConfig[] = [
  {
    name: "CONVEX_SITE_URL",
    label: "Convex Site URL",
    group: "Convex / telemetry backend",
    description: "Public Convex site URL used by hooks and CLI ingestion.",
    placeholder: "https://example.convex.site",
  },
  {
    name: "FARPLANE_CONVEX_SITE_URL",
    label: "Farplane Convex Site URL",
    group: "Convex / telemetry backend",
    description: "Farplane-specific override for hook and CLI telemetry ingestion.",
    placeholder: "https://example.convex.site",
  },
  {
    name: "FARPLANE_TELEMETRY_TOKEN",
    label: "Telemetry Token",
    group: "Convex / telemetry backend",
    description: "Optional token required by protected telemetry HTTP endpoints.",
    secret: true,
  },
  {
    name: "FARPLANE_FILE_CHANGE_PATTERNS",
    label: "File Change Patterns",
    group: "Codex hook telemetry",
    description: "Comma or newline separated project-relative globs for tracked file summaries.",
    multiline: true,
    placeholder: "docs/**/*.md\nui/src/**/*.tsx",
  },
  {
    name: "FARPLANE_FILE_CHANGE_SUMMARY_MODEL",
    label: "File Summary Model",
    group: "Codex hook telemetry",
    description: "Optional model override for local Codex file-change summaries.",
    placeholder: "gpt-5.4-mini",
  },
  {
    name: "FARPLANE_FILE_CHANGE_HOOK_DEBUG",
    label: "File Hook Debug",
    group: "Codex hook telemetry",
    description: "Enable debug logs for the file-change hook.",
    placeholder: "1",
  },
  {
    name: "FARPLANE_SKILL_HOOK_DEBUG",
    label: "Skill Hook Debug",
    group: "Codex hook telemetry",
    description: "Enable debug logs for the skill invocation hook.",
    placeholder: "1",
  },
  {
    name: "VITE_CONVEX_URL",
    label: "Convex Client URL",
    group: "UI-safe Vite values",
    description: "Browser-safe Convex client URL. Changes apply after restarting the UI.",
    placeholder: "https://example.convex.cloud",
  },
  {
    name: "VITE_FARPLANE_RUNTIME_ADAPTER",
    label: "Runtime Adapter",
    group: "UI-safe Vite values",
    description: "Default runtime adapter for the browser UI.",
    placeholder: "codex",
  },
  {
    name: "VITE_CODEX_APP_SERVER_URL",
    label: "Codex App Server",
    group: "UI-safe Vite values",
    description: "Loopback Codex app-server URL for the Codex runtime bridge.",
    placeholder: "ws://127.0.0.1:47891",
  },
  {
    name: "VITE_GATEWAY_URL",
    label: "Gateway URL",
    group: "UI-safe Vite values",
    description: "OpenClaw gateway URL when the OpenClaw adapter is active.",
    placeholder: "http://127.0.0.1:18789",
  },
  {
    name: "VITE_GATEWAY_TOKEN",
    label: "Gateway Token",
    group: "UI-safe Vite values",
    description: "Optional gateway bearer token. Treated as a local secret by Settings.",
    secret: true,
  },
  {
    name: "FARPLANE_MESHY_API_KEY",
    label: "Farplane Meshy API Key",
    group: "Optional integrations",
    description: "Preferred server-side Meshy key for generated furniture.",
    secret: true,
  },
  {
    name: "MESHY_API_KEY",
    label: "Meshy API Key",
    group: "Optional integrations",
    description: "Fallback Meshy key name used by scripts and integrations.",
    secret: true,
  },
  {
    name: "NOTION_API_KEY",
    label: "Notion API Key",
    group: "Optional integrations",
    description: "Optional Notion integration secret.",
    secret: true,
  },
  {
    name: "FARPLANE_STATE_BASE",
    label: "State Base URL",
    group: "Local automation / review tooling",
    description: "State bridge base URL for scripts and automations.",
    placeholder: "http://127.0.0.1:5173",
  },
  {
    name: "CODEX_REVIEW_MODEL",
    label: "Review Model",
    group: "Local automation / review tooling",
    description: "Override model for the Codex review agent.",
  },
  {
    name: "CODEX_REVIEW_TIMEOUT_MS",
    label: "Review Timeout",
    group: "Local automation / review tooling",
    description: "Abort the review turn after this timeout in milliseconds.",
    placeholder: "180000",
  },
  {
    name: "STRICT_AGENT_REVIEW",
    label: "Strict Agent Review",
    group: "Local automation / review tooling",
    description: "Make pre-push agent review blocking.",
    placeholder: "1",
  },
  {
    name: "FARPLANE_SKIP_AGENT_REVIEW",
    label: "Skip Agent Review",
    group: "Local automation / review tooling",
    description: "Skip advisory Codex agent review during pre-push.",
    placeholder: "1",
  },
];

function runtimeEnvStatus(config: RuntimeEnvConfig): JsonObject {
  const saved = config.secret ? localSecretEnvString(config.name) : localConfigEnvString(config.name);
  if (saved) return { configured: true, source: "saved" };
  if (process.env[config.name]?.trim() || readRootEnvValue(config.name)) {
    return { configured: true, source: "env" };
  }
  return { configured: false, source: "missing" };
}

function runtimeEnvValue(config: RuntimeEnvConfig): string {
  if (config.secret) return "";
  return localConfigEnvString(config.name) || process.env[config.name]?.trim() || readRootEnvValue(config.name);
}

function readRuntimeConfigForUi(): JsonObject {
  return {
    config: {
      codexAppServerUrl:
        localConfigEnvString("CODEX_APP_SERVER_URL") ||
        localConfigEnvString("VITE_CODEX_APP_SERVER_URL") ||
        firstLocalConfigString([
          ["runtime", "codex_app_server_url"],
          ["runtime", "codexAppServerUrl"],
        ]) ||
        process.env.CODEX_APP_SERVER_URL?.trim() ||
        process.env.VITE_CODEX_APP_SERVER_URL?.trim() ||
        process.env.FARPLANE_CODEX_APP_SERVER_URL?.trim() ||
        "",
      stateBase:
        localConfigEnvString("FARPLANE_STATE_BASE") ||
        firstLocalConfigString([
          ["runtime", "state_base"],
          ["runtime", "stateBase"],
        ]) ||
        process.env.FARPLANE_STATE_BASE?.trim() ||
        process.env.VITE_STATE_URL?.trim() ||
        "",
      convexSiteUrl:
        localConfigEnvString("FARPLANE_CONVEX_SITE_URL") ||
        localConfigEnvString("CONVEX_SITE_URL") ||
        firstLocalConfigString([
          ["convex", "site_url"],
          ["convex", "siteUrl"],
        ]) ||
        process.env.FARPLANE_CONVEX_SITE_URL?.trim() ||
        process.env.CONVEX_SITE_URL?.trim() ||
        readRootEnvValue("FARPLANE_CONVEX_SITE_URL") ||
        readRootEnvValue("CONVEX_SITE_URL") ||
        "",
      convexClientUrl:
        localConfigEnvString("VITE_CONVEX_URL") ||
        localConfigEnvString("CONVEX_URL") ||
        firstLocalConfigString([
          ["convex", "client_url"],
          ["convex", "clientUrl"],
        ]) ||
        process.env.VITE_CONVEX_URL?.trim() ||
        process.env.CONVEX_URL?.trim() ||
        readRootEnvValue("VITE_CONVEX_URL") ||
        readRootEnvValue("CONVEX_URL") ||
        "",
    },
    secrets: {
      meshyApiKey: runtimeSecretStatus(
        ["integrations", "meshyApiKey"],
        ["FARPLANE_MESHY_API_KEY", "MESHY_API_KEY"],
      ),
      notionApiKey: runtimeSecretStatus(["integrations", "notionApiKey"], ["NOTION_API_KEY"]),
      telemetryToken: runtimeSecretStatus(["convex", "telemetryToken"], ["FARPLANE_TELEMETRY_TOKEN"]),
    },
    env: RUNTIME_ENV_CATALOG.map((config) => ({
      ...config,
      status: runtimeEnvStatus(config),
      value: runtimeEnvValue(config),
    })),
  };
}

async function saveRuntimeConfigFromUi(input: unknown): Promise<JsonObject> {
  const body = input && typeof input === "object" ? (input as JsonObject) : {};
  const configInput =
    body.config && typeof body.config === "object" && !Array.isArray(body.config)
      ? (body.config as JsonObject)
      : {};
  const secretInput =
    body.secrets && typeof body.secrets === "object" && !Array.isArray(body.secrets)
      ? (body.secrets as JsonObject)
      : {};
  const config = readLocalTomlObjectSync(FARPLANE_CONFIG_TOML_PATH);
  const legacySecrets = await readJsonFile<JsonObject>(FARPLANE_SECRETS_JSON_PATH, {});

  setNestedString(config, ["runtime", "codex_app_server_url"], String(configInput.codexAppServerUrl ?? ""));
  setNestedString(config, ["runtime", "state_base"], String(configInput.stateBase ?? ""));
  setNestedString(config, ["convex", "site_url"], String(configInput.convexSiteUrl ?? ""));
  setNestedString(config, ["convex", "client_url"], String(configInput.convexClientUrl ?? ""));
  setNestedString(config, ["env", "CODEX_APP_SERVER_URL"], String(configInput.codexAppServerUrl ?? ""));
  setNestedString(config, ["env", "FARPLANE_STATE_BASE"], String(configInput.stateBase ?? ""));
  setNestedString(config, ["env", "FARPLANE_CONVEX_SITE_URL"], String(configInput.convexSiteUrl ?? ""));
  setNestedString(config, ["env", "VITE_CONVEX_URL"], String(configInput.convexClientUrl ?? ""));

  const envInput =
    body.env && typeof body.env === "object" && !Array.isArray(body.env)
      ? (body.env as JsonObject)
      : {};
  for (const entry of RUNTIME_ENV_CATALOG) {
    if (!Object.prototype.hasOwnProperty.call(envInput, entry.name)) continue;
    const rawValue = envInput[entry.name];
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    if (entry.secret && !value) continue;
    setNestedString(config, ["env", entry.name], value);
  }

  for (const [key, pathParts] of [
    ["meshyApiKey", ["integrations", "meshy_api_key"]],
    ["notionApiKey", ["integrations", "notion_api_key"]],
    ["telemetryToken", ["convex", "telemetry_token"]],
  ] as const) {
    const value = typeof secretInput[key] === "string" ? secretInput[key].trim() : "";
    if (value) setNestedString(config, [...pathParts], value);
  }
  const secretEnv =
    config.env && typeof config.env === "object" && !Array.isArray(config.env)
      ? (config.env as JsonObject)
      : {};
  const meshyApiKey =
    objectStringAt(secretEnv, ["FARPLANE_MESHY_API_KEY"]) ||
    objectStringAt(secretEnv, ["MESHY_API_KEY"]) ||
    firstLocalSecretString([
      ["integrations", "meshy_api_key"],
      ["integrations", "meshyApiKey"],
    ]);
  const notionApiKey =
    objectStringAt(secretEnv, ["NOTION_API_KEY"]) ||
    objectStringAt(secretEnv, ["NOTION_TOKEN"]) ||
    objectStringAt(legacySecrets, ["integrations", "notionApiKey"]);
  const telemetryToken =
    objectStringAt(secretEnv, ["FARPLANE_TELEMETRY_TOKEN"]) ||
    objectStringAt(legacySecrets, ["convex", "telemetryToken"]);
  if (meshyApiKey) setNestedString(config, ["integrations", "meshy_api_key"], meshyApiKey);
  if (notionApiKey) setNestedString(config, ["integrations", "notion_api_key"], notionApiKey);
  if (telemetryToken) setNestedString(config, ["convex", "telemetry_token"], telemetryToken);

  await mkdir(FARPLANE_HOME, { recursive: true });
  await writeFile(FARPLANE_CONFIG_TOML_PATH, serializeFarplaneConfigToml(config), "utf-8");
  await chmod(FARPLANE_CONFIG_TOML_PATH, 0o600).catch(() => undefined);
  return readRuntimeConfigForUi();
}

type FarplaneHookConfig = {
  enabled: boolean;
  includeManifestTracked: boolean;
  selectedManifestPaths: string[];
  customPatterns: string[];
};

const DEFAULT_HOOK_CONFIG: FarplaneHookConfig = {
  enabled: true,
  includeManifestTracked: true,
  selectedManifestPaths: [],
  customPatterns: [],
};

function uniqueHookPatterns(values: readonly unknown[]): string[] {
  return [...new Set(values
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().replace(/\\/g, "/"))
    .filter(Boolean))];
}

function readManifestTrackedPaths(manifest: JsonObject): string[] {
  const standard = manifest.standard && typeof manifest.standard === "object" ? manifest.standard as JsonObject : {};
  const optional = manifest.optional && typeof manifest.optional === "object" ? manifest.optional as JsonObject : {};
  return uniqueHookPatterns([
    ...(Array.isArray(standard.tracked) ? standard.tracked : []),
    ...(Array.isArray(optional.tracked) ? optional.tracked : []),
  ]).filter((entry) => !entry.endsWith("/"));
}

function normalizeHookConfig(input: unknown, manifestTracked: string[]): FarplaneHookConfig {
  const record = input && typeof input === "object" && !Array.isArray(input) ? input as JsonObject : {};
  const selected = uniqueHookPatterns(
    Array.isArray(record.selectedManifestPaths) ? record.selectedManifestPaths : manifestTracked,
  );
  const custom = uniqueHookPatterns(Array.isArray(record.customPatterns) ? record.customPatterns : []);
  return {
    enabled: typeof record.enabled === "boolean" ? record.enabled : DEFAULT_HOOK_CONFIG.enabled,
    includeManifestTracked:
      typeof record.includeManifestTracked === "boolean"
        ? record.includeManifestTracked
        : DEFAULT_HOOK_CONFIG.includeManifestTracked,
    selectedManifestPaths: selected,
    customPatterns: custom,
  };
}

function hookConfigPath(projectPath: string): string {
  return path.join(projectPath, ".farplane", "hooks", "config.json");
}

async function readProjectHookConfig(projectPath: string): Promise<JsonObject> {
  const root = path.resolve(projectPath);
  const manifestPath = path.join(root, "farplane", "manifest.json");
  const manifest = await readJsonFile<JsonObject>(manifestPath, {});
  const manifestTracked = readManifestTrackedPaths(manifest);
  const config = normalizeHookConfig(await readJsonFile<unknown>(hookConfigPath(root), {}), manifestTracked);
  const activePatterns = config.enabled
    ? uniqueHookPatterns([
      ...(config.includeManifestTracked ? config.selectedManifestPaths : []),
      ...config.customPatterns,
    ])
    : [];
  return {
    ok: true,
    projectPath: root,
    configPath: hookConfigPath(root),
    manifestPath,
    manifestExists: await pathExists(manifestPath),
    manifestTracked,
    config,
    activePatterns,
    installCommand: "npm run hooks:install",
  };
}

async function saveProjectHookConfig(projectPath: string, input: unknown): Promise<JsonObject> {
  const root = path.resolve(projectPath);
  const manifest = await readJsonFile<JsonObject>(path.join(root, "farplane", "manifest.json"), {});
  const config = normalizeHookConfig(input, readManifestTrackedPaths(manifest));
  const filePath = hookConfigPath(root);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return readProjectHookConfig(root);
}

async function installProjectHooks(): Promise<JsonObject> {
  const scriptPath = path.join(REPO_ROOT, "scripts", "install-farplane-hooks.mjs");
  const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath, "--write", "--json"], {
    cwd: REPO_ROOT,
    maxBuffer: 1024 * 1024,
  });
  try {
    return { ...(JSON.parse(stdout) as JsonObject), stderr: stderr.trim() || undefined };
  } catch {
    return { ok: false, error: "hook_install_invalid_json", stdout, stderr };
  }
}

async function runFarplaneFrameworkCli(args: string[], timeoutMs = 20_000): Promise<JsonObject> {
  const cliPath = path.join(FARPLANE_FRAMEWORK_ROOT, "bin", "farplane.py");
  if (!(await pathExists(cliPath))) {
    return {
      ok: false,
      error: "farplane_framework_cli_not_found",
      frameworkRoot: FARPLANE_FRAMEWORK_ROOT,
    };
  }
  try {
    const { stdout, stderr } = await execFileAsync("python3", [cliPath, ...args], {
      cwd: FARPLANE_FRAMEWORK_ROOT,
      maxBuffer: 16 * 1024 * 1024,
      timeout: timeoutMs,
    });
    const parsed = JSON.parse(stdout) as JsonObject;
    return {
      ok: true,
      frameworkRoot: FARPLANE_FRAMEWORK_ROOT,
      stderr: stderr.trim() || undefined,
      payload: parsed,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "farplane_framework_cli_failed",
      frameworkRoot: FARPLANE_FRAMEWORK_ROOT,
    };
  }
}

function isConcreteTemplatePath(relativePath: string): boolean {
  return !relativePath.includes("*") && !relativePath.endsWith("/");
}

function resolveProjectRelativePath(projectRoot: string, relativePath: string): string | null {
  const root = path.resolve(projectRoot);
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) return null;
  return resolved;
}

function readTemplateUses(manifest: JsonObject): Record<string, string> {
  const rawUses = manifest.template_uses;
  if (!rawUses || typeof rawUses !== "object" || Array.isArray(rawUses)) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawUses as JsonObject)) {
    if (typeof value === "string" && value.trim()) result[key] = value.trim();
  }
  return result;
}

function frontMatterTemplateVersion(frontMatter: Record<string, string>): string | undefined {
  return (
    frontMatter.framework_template_version ||
    frontMatter.template_version ||
    frontMatter.skill_template_version ||
    undefined
  );
}

async function readTemplatePathVersion(filePath: string): Promise<string | undefined> {
  if (!filePath.endsWith(".md") && !filePath.endsWith(".mdx")) return undefined;
  const raw = await readFile(filePath, "utf-8").catch(() => "");
  if (!raw) return undefined;
  return frontMatterTemplateVersion(parseSimpleFrontMatter(raw));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

async function readTemplateRegistryRows(frameworkRoot: string): Promise<TemplateRegistryRow[] | null> {
  const registryPath = path.join(frameworkRoot, "docs", "templates", "registry.jsonl");
  const raw = await readFile(registryPath, "utf-8").catch(() => "");
  if (!raw.trim()) return null;
  const rows: TemplateRegistryRow[] = [];
  for (const line of raw.split(/\r?\n/g)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as TemplateRegistryRow;
      if (typeof parsed.template_id === "string" && parsed.template_id.trim()) {
        rows.push(parsed);
      }
    } catch {
      return null;
    }
  }
  return rows.length ? rows : null;
}

function humanizeTemplateId(templateId: string): string {
  return templateId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function inferTemplateOwner(row: TemplateRegistryRow): string {
  const templateId = String(row.template_id ?? "");
  const templatePath = String(row.path ?? "");
  if (templateId.includes("skill") || templatePath.startsWith("docs/skills/")) {
    return "skill-maintenance";
  }
  if (templateId.includes("ticket")) return "ticket-loop";
  if (templateId.includes("goal")) return "goal-advisor";
  if (templateId.includes("harness")) return "harness-creator";
  if (templateId.includes("framework") || templatePath.includes("MANIFEST_TEMPLATE")) {
    return "deep-init-project";
  }
  if (templatePath.startsWith("templates/global/")) return "global-install";
  return "farplane-framework";
}

function inferTemplateInstallTarget(row: TemplateRegistryRow): TemplateInstallTarget {
  const templateId = String(row.template_id ?? "");
  const templatePath = String(row.path ?? "");
  if (templatePath.startsWith("templates/global/")) return "codex-global";
  if (templatePath.startsWith("docs/skills/") || templateId.startsWith("skill-")) {
    return "skill-package";
  }
  if (templatePath.startsWith("tickets/templates/")) return "ticket-scaffold";
  if (templatePath.includes("harness-creator") || templatePath.includes("deep-init-project")) {
    return "project-scaffold";
  }
  if (templatePath.startsWith("templates/")) return "runtime-template";
  return "source-only";
}

function inferTemplateHistoryPolicy(_row: TemplateRegistryRow): TemplateHistoryPolicy {
  return "git";
}

function readRegistryAppliesTo(row: TemplateRegistryRow): string[] {
  return isStringArray(row.applies_to) ? row.applies_to : [];
}

function readRegistryFeatureRefs(row: TemplateRegistryRow): string[] {
  return isStringArray(row.feature_refs) ? row.feature_refs : [];
}

async function buildRegistryTemplateTrackingFamily(
  manifest: JsonObject,
  row: TemplateRegistryRow,
): Promise<JsonObject> {
  const templateUses = readTemplateUses(manifest);
  const templateId = String(row.template_id ?? "").trim();
  const registryPath = typeof row.path === "string" ? row.path.trim() : "";
  const resolvedPath = registryPath ? resolveProjectRelativePath(FARPLANE_FRAMEWORK_ROOT, registryPath) : null;
  const currentVersion = typeof row.template_version === "string" ? row.template_version.trim() : undefined;
  const usedVersion = templateUses[templateId];
  const consumerScope = row.consumer_scope ?? (readRegistryAppliesTo(row).length ? readRegistryAppliesTo(row)[0] : "template");
  const pathExistsInFramework = resolvedPath ? await pathExists(resolvedPath) : false;
  const installTarget = inferTemplateInstallTarget(row);
  const historyPolicy = inferTemplateHistoryPolicy(row);
  const status =
    !pathExistsInFramework
      ? "missing"
      : usedVersion
        ? usedVersion === currentVersion
          ? "tracked"
          : "stale"
        : currentVersion
          ? "tracked"
          : "unversioned";

  return {
    consumerCount: usedVersion ? 1 : 0,
    consumerScope,
    currentVersion,
    description: `Registry-backed template owned by ${inferTemplateOwner(row)}.`,
    featureRefs: readRegistryFeatureRefs(row),
    familyId: templateId,
    historyPolicy,
    installTarget,
    label: humanizeTemplateId(templateId),
    notes: "Registry-backed; source template stays with its owner surface.",
    observedVersion: usedVersion ?? currentVersion,
    owner: inferTemplateOwner(row),
    paths: registryPath ? [registryPath] : [],
    registryPath,
    scope: consumerScope,
    source: "registry",
    status,
    templateVersion: currentVersion,
    usedVersion,
  };
}

async function buildTemplateTrackingFamily(
  projectRoot: string,
  manifest: JsonObject,
  config: TemplateTrackingFamilyConfig,
): Promise<JsonObject> {
  const templateUses = readTemplateUses(manifest);
  const paths = config.paths ?? [];
  const concretePaths = paths.filter(isConcreteTemplatePath);
  const existingPaths: string[] = [];
  let observedVersion: string | undefined;

  for (const relativePath of concretePaths) {
    const resolvedPath = resolveProjectRelativePath(projectRoot, relativePath);
    if (!resolvedPath || !(await pathExists(resolvedPath))) continue;
    existingPaths.push(relativePath);
    if (!observedVersion) {
      observedVersion = await readTemplatePathVersion(resolvedPath);
    }
  }

  if (config.source === "manifest") {
    const currentVersion = config.manifestKey ? templateUses[config.manifestKey] : undefined;
    return {
      consumerCount: currentVersion ? 1 : 0,
      currentVersion,
      description: config.description,
      familyId: config.familyId,
      label: config.label,
      notes: config.notes,
      observedVersion: currentVersion,
      owner: config.owner,
      paths,
      scope: config.scope,
      source: config.source,
      status: currentVersion ? "tracked" : "missing",
    };
  }

  if (config.source === "scanner-gap") {
    return {
      consumerCount: 0,
      description: config.description,
      familyId: config.familyId,
      label: config.label,
      notes: config.notes,
      owner: config.owner,
      paths,
      scope: config.scope,
      source: config.source,
      status: "scanner-gap",
    };
  }

  if (config.source === "derived") {
    return {
      consumerCount: 0,
      description: config.description,
      familyId: config.familyId,
      label: config.label,
      notes: config.notes,
      owner: config.owner,
      paths,
      scope: config.scope,
      source: config.source,
      status: "scanner-gap",
    };
  }

  const status = existingPaths.length === 0
    ? "missing"
    : observedVersion
      ? "tracked"
      : "unversioned";
  return {
    consumerCount: existingPaths.length,
    currentVersion: observedVersion,
    description: config.description,
    familyId: config.familyId,
    label: config.label,
    notes: config.notes,
    observedVersion,
    owner: config.owner,
    paths: existingPaths.length ? existingPaths : paths,
    scope: config.scope,
    source: config.source,
    status,
  };
}

async function buildTemplateTrackingScan(projectRoot: string): Promise<JsonObject> {
  const root = path.resolve(projectRoot);
  const manifest = await readJsonFile<JsonObject>(path.join(root, "farplane", "manifest.json"), {});
  const registryRows = await readTemplateRegistryRows(FARPLANE_FRAMEWORK_ROOT);
  const families = registryRows?.length
    ? await Promise.all(
        registryRows.map((row) => buildRegistryTemplateTrackingFamily(manifest, row)),
      )
    : await Promise.all(
        TEMPLATE_TRACKING_FAMILIES.map((config) => buildTemplateTrackingFamily(root, manifest, config)),
      );
  const counts = families.reduce(
    (acc, family) => {
      const status = String(family.status ?? "missing");
      if (status === "tracked") acc.tracked += 1;
      if (status === "stale") acc.stale += 1;
      if (status === "unversioned") acc.unversioned += 1;
      if (status === "missing") acc.missing += 1;
      if (status === "scanner-gap") acc.scannerGaps += 1;
      return acc;
    },
    { families: families.length, missing: 0, scannerGaps: 0, stale: 0, tracked: 0, unversioned: 0 },
  );
  return {
    counts,
    families,
    generatedAt: new Date().toISOString(),
    registrySource: registryRows?.length ? path.join(FARPLANE_FRAMEWORK_ROOT, "docs", "templates", "registry.jsonl") : null,
    registryStatus: registryRows?.length ? "loaded" : "fallback",
    projectRoot: root,
    schema: "farplane_template_tracking",
    schemaVersion: "1.1.0",
  };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isDirectory();
  } catch {
    return false;
  }
}

async function readInstalledSkillDirectories(rootDir: string, scope: "agent" | "shared"): Promise<JsonObject[]> {
  if (!(await isDirectory(rootDir))) return [];
  const entries = await readdir(rootDir, { withFileTypes: true });
  const rows: JsonObject[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(rootDir, entry.name);
    const hasPackageFile = await Promise.all(
      SKILL_PACKAGE_FILE_NAMES.map((fileName) => pathExists(path.join(skillDir, fileName))),
    ).then((results) => results.some(Boolean));
    if (!hasPackageFile) continue;
    rows.push({
      skillId: entry.name,
      sourcePath: skillDir,
      scope,
    });
  }
  return rows.sort((a, b) => String(a.skillId ?? "").localeCompare(String(b.skillId ?? "")));
}

async function resolveRepoSkillDirectory(skillId: string): Promise<string | null> {
  const direct = path.join(SKILLS_ROOT, skillId);
  if (await isDirectory(direct)) return direct;
  const categories = await readdir(SKILLS_ROOT).catch(() => [] as string[]);
  for (const category of categories) {
    const nested = path.join(SKILLS_ROOT, category, skillId);
    if (await isDirectory(nested)) return nested;
  }
  return null;
}

function getSkillStudioRoots(): string[] {
  return [PROJECT_CODEX_SKILLS_ROOT, SKILLS_ROOT, CODEX_SKILLS_ROOT].filter((root, index, roots) => {
    return existsSync(root) && roots.indexOf(root) === index;
  });
}

async function listCombinedSkillStudioCatalog(): Promise<Awaited<ReturnType<typeof listSkillStudioCatalog>>> {
  const seen = new Set<string>();
  const merged: Awaited<ReturnType<typeof listSkillStudioCatalog>> = [];
  for (const root of getSkillStudioRoots()) {
    const rows = await listSkillStudioCatalog(root, REPO_ROOT).catch(() => []);
    for (const row of rows) {
      if (seen.has(row.skillId)) continue;
      seen.add(row.skillId);
      merged.push(row);
    }
  }
  return merged.sort((a, b) => a.skillId.localeCompare(b.skillId));
}

async function resolveSkillStudioRoot(skillId: string): Promise<string | null> {
  for (const root of getSkillStudioRoots()) {
    const detail = await getSkillStudioDetail(root, REPO_ROOT, skillId).catch(() => null);
    if (detail) return root;
  }
  return null;
}

async function getCombinedSkillStudioDetail(
  skillId: string,
  agentId?: string,
): Promise<Awaited<ReturnType<typeof getSkillStudioDetail>>> {
  const root = await resolveSkillStudioRoot(skillId);
  return root ? getSkillStudioDetail(root, REPO_ROOT, skillId, [], agentId) : null;
}

async function resolveAgentWorkspacePath(agentId: string): Promise<string> {
  const config = await readJsonFile<JsonObject>(OPENCLAW_CONFIG_PATH, {});
  const agentsNode =
    config.agents && typeof config.agents === "object" ? (config.agents as JsonObject) : {};
  const list = Array.isArray(agentsNode.list) ? (agentsNode.list as JsonObject[]) : [];
  const match = list.find((entry) => String(entry.id ?? "").trim() === agentId);
  const workspacePath = typeof match?.workspace === "string" ? match.workspace.trim() : "";
  return workspacePath || path.join(OPENCLAW_HOME, "workspace", agentId);
}

function writeJson(res: { setHeader: (k: string, v: string) => void; end: (body: string) => void }, status: number, payload: unknown): void {
  res.setHeader("content-type", "application/json");
  res.setHeader("x-farplane-state-bridge", "vite");
  (res as { statusCode?: number }).statusCode = status;
  res.end(JSON.stringify(payload));
}

function mimeForFile(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

async function writeStaticFile(
  res: { setHeader: (k: string, v: string) => void; end: (body: Buffer) => void },
  rootDir: string,
  requestedPath: string,
): Promise<boolean> {
  const safePath = requestedPath.replace(/\\/g, "/").replace(/^\/+/, "") || "index.html";
  const resolved = path.resolve(rootDir, safePath);
  const relative = path.relative(rootDir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return false;
  if (!(await pathExists(resolved))) return false;
  const bytes = await readFile(resolved);
  res.setHeader("content-type", mimeForFile(resolved));
  res.setHeader("cache-control", "no-store");
  (res as { statusCode?: number }).statusCode = 200;
  res.end(bytes);
  return true;
}

function requestHeader(req: unknown, name: string): string {
  const headers = (req as { headers?: Record<string, string | string[] | undefined> }).headers ?? {};
  const raw = headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] ?? "";
  return typeof raw === "string" ? raw : "";
}

function hasBridgeWriteAccess(req: unknown): boolean {
  const expectedToken = process.env.FARPLANE_STATE_BRIDGE_TOKEN?.trim();
  if (expectedToken) {
    const providedToken = requestHeader(req, "x-farplane-state-bridge-token").trim();
    if (!providedToken || providedToken !== expectedToken) return false;
  }
  const role = requestHeader(req, "x-farplane-actor-role").trim().toLowerCase() || "operator";
  const allowed = requestHeader(req, "x-farplane-allowed-permissions").trim();
  if (!allowed) return role === "operator";
  if (allowed === "*") return true;
  const permissions = new Set(allowed.split(",").map((entry) => entry.trim()).filter(Boolean));
  return permissions.has("state.write");
}

async function readBody(req: { on: (name: string, cb: (chunk?: Buffer) => void) => void }): Promise<unknown> {
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk) => chunks.push(chunk ?? Buffer.alloc(0)));
    req.on("end", () => resolve());
    req.on("error", (error) => reject(error));
  });
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch {
    return {};
  }
}

function clampNumber(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

async function readLocalFarplaneEventRows(options: {
  rangeMs: number;
  now: number;
  maxRows: number;
}): Promise<unknown[]> {
  const cutoff = options.now - options.rangeMs;
  let files: string[] = [];
  try {
    files = await readdir(LOCAL_HOOK_EVENTS_DIR);
  } catch {
    return [];
  }

  const rows: unknown[] = [];
  const jsonlFiles = files
    .filter((fileName) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(fileName))
    .sort()
    .reverse();

  for (const fileName of jsonlFiles) {
    if (rows.length >= options.maxRows) break;
    const filePath = path.join(LOCAL_HOOK_EVENTS_DIR, fileName);
    let content = "";
    try {
      content = await readFile(filePath, "utf-8");
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/).filter(Boolean).reverse();
    for (const line of lines) {
      if (rows.length >= options.maxRows) break;
      try {
        const row = JSON.parse(line) as JsonObject;
        const timestamp = Date.parse(String(row.timestamp ?? row.eventAt ?? ""));
        if (Number.isFinite(timestamp) && timestamp < cutoff) continue;
        rows.push(row);
      } catch {
        // Ignore partial JSONL writes from an in-flight hook.
      }
    }
  }

  return rows;
}

type JsonRpcMessage = {
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
};

function readCodexAppServerUrl(): string {
  return (
    localConfigEnvString("CODEX_APP_SERVER_URL") ||
    localConfigEnvString("VITE_CODEX_APP_SERVER_URL") ||
    localConfigEnvString("FARPLANE_CODEX_APP_SERVER_URL") ||
    firstLocalConfigString([
      ["runtime", "codex_app_server_url"],
      ["runtime", "codexAppServerUrl"],
    ]) ||
    process.env.CODEX_APP_SERVER_URL ||
    process.env.VITE_CODEX_APP_SERVER_URL ||
    process.env.FARPLANE_CODEX_APP_SERVER_URL ||
    ""
  ).trim();
}

async function requestCodexAppServerRpc(method: string, params: unknown): Promise<unknown> {
  const appServerUrl = readCodexAppServerUrl();
  if (!appServerUrl) {
    throw new Error("codex_app_server_url_missing");
  }
  if (!appServerUrl.startsWith("ws://127.0.0.1") && !appServerUrl.startsWith("ws://localhost")) {
    throw new Error("codex_app_server_url_must_be_local");
  }
  const WebSocketCtor = (globalThis as unknown as { WebSocket?: new (url: string) => unknown }).WebSocket;
  if (!WebSocketCtor) {
    throw new Error("websocket_runtime_unavailable");
  }

  const socket = new WebSocketCtor(appServerUrl) as {
    readyState?: number;
    send: (data: string) => void;
    close: () => void;
    addEventListener: (name: string, cb: (event?: unknown) => void, options?: unknown) => void;
    removeEventListener?: (name: string, cb: (event?: unknown) => void) => void;
  };

  const waitForOpen = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("codex_app_server_open_timeout")), 5000);
    socket.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
    socket.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("codex_app_server_unreachable"));
    }, { once: true });
  });

  await waitForOpen;

  let nextId = 1;
  const pending = new Map<
    string | number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();

  const onMessage = (event?: unknown) => {
    const rawData = (event as { data?: unknown } | undefined)?.data;
    const text = typeof rawData === "string" ? rawData : rawData instanceof Buffer ? rawData.toString("utf-8") : "";
    if (!text) return;
    let parsed: JsonRpcMessage;
    try {
      parsed = JSON.parse(text) as JsonRpcMessage;
    } catch {
      return;
    }
    if (parsed.id === undefined) return;
    const waiter = pending.get(parsed.id);
    if (!waiter) return;
    pending.delete(parsed.id);
    if (parsed.error) {
      waiter.reject(new Error(parsed.error.message || `codex_rpc_error:${parsed.error.code ?? "unknown"}`));
      return;
    }
    waiter.resolve(parsed.result);
  };

  socket.addEventListener("message", onMessage);

  const sendRequest = async (requestMethod: string, requestParams: unknown): Promise<unknown> => {
    const id = nextId++;
    const result = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`codex_rpc_timeout:${requestMethod}`));
      }, 15000);
      pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
    });
    socket.send(JSON.stringify({ id, method: requestMethod, params: requestParams }));
    return result;
  };

  try {
    await sendRequest("initialize", {
      clientInfo: {
        name: "farplane-ui",
        title: "Farplane UI",
        version: "0.1.0",
      },
      capabilities: {
        experimentalApi: true,
        requestAttestation: false,
        optOutNotificationMethods: [],
      },
    });
    socket.send(JSON.stringify({ method: "initialized" }));
    return await sendRequest(method, params);
  } finally {
    socket.removeEventListener?.("message", onMessage);
    socket.close();
  }
}

function normalizeOfficeSettings(input: unknown): Required<OfficeSettings> {
  return normalizeBridgeOfficeSettings(input, DEFAULT_MESH_ASSET_DIR);
}

async function readOfficeSettings(): Promise<OfficeSettings> {
  let raw = await readJsonFile<OfficeSettings | null>(OFFICE_SETTINGS_PATH, null);
  if (!raw) {
    raw = await readJsonFile<OfficeSettings>(OFFICE_SETTINGS_TEMPLATE_PATH, {
      meshAssetDir: DEFAULT_MESH_ASSET_DIR,
      officeFootprint: { width: 35, depth: 35 },
      officeLayout: { version: 1, tileSize: 1, tiles: [] },
      decor: {
        floorPatternId: "sandstone_tiles",
        wallColorId: "gallery_cream",
        backgroundId: "shell_haze",
      },
      viewProfile: "free_orbit_3d",
      orbitControlsEnabled: true,
      cameraOrientation: "south_east",
    });
    const seeded = normalizeOfficeSettings(raw);
    await mkdir(path.dirname(OFFICE_SETTINGS_PATH), { recursive: true });
    await writeFile(OFFICE_SETTINGS_PATH, `${JSON.stringify(seeded, null, 2)}\n`, "utf-8");
    return seeded;
  }
  return normalizeOfficeSettings(raw);
}

async function readCompanyModelWithSeed(): Promise<JsonObject> {
  let company = await readJsonFile<JsonObject>(COMPANY_MODEL_PATH, {});
  if (Object.keys(company).length > 0) return company;
  company = await readJsonFile<JsonObject>(COMPANY_TEMPLATE_PATH, {});
  if (Object.keys(company).length > 0) {
    await mkdir(path.dirname(COMPANY_MODEL_PATH), { recursive: true });
    await writeFile(COMPANY_MODEL_PATH, `${JSON.stringify(company, null, 2)}\n`, "utf-8");
  }
  return company;
}

function asMeshPublicPath(fileName: string): string {
  return `/openclaw/assets/meshes/${encodeURIComponent(fileName)}`;
}

function isSafeCodexPetSegment(value: string): boolean {
  return Boolean(value.trim()) && !value.includes("/") && !value.includes("\\") && !value.includes("..");
}

function sanitizeLabelToFileBase(label: string): string {
  const cleaned = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || `mesh-${Date.now()}`;
}

async function toUniqueFilePath(baseDir: string, desiredName: string): Promise<string> {
  const ext = path.extname(desiredName);
  const baseName = path.basename(desiredName, ext);
  let attempt = 0;
  while (attempt < 1000) {
    const suffix = attempt === 0 ? "" : `-${attempt}`;
    const candidate = path.join(baseDir, `${baseName}${suffix}${ext}`);
    try {
      await stat(candidate);
      attempt += 1;
    } catch {
      return candidate;
    }
  }
  return path.join(baseDir, `${baseName}-${Date.now()}${ext}`);
}

async function listMeshAssets(meshAssetDir: string): Promise<JsonObject[]> {
  await mkdir(meshAssetDir, { recursive: true });
  const rows = await readdir(meshAssetDir, { withFileTypes: true });
  const assets = await Promise.all(
    rows
      .filter((row) => row.isFile())
      .map(async (row) => {
        const ext = path.extname(row.name).toLowerCase();
        if (!MESH_EXTENSIONS.has(ext)) return null;
        const filePath = path.join(meshAssetDir, row.name);
        const fileStat = await stat(filePath);
        return {
          assetId: row.name,
          label: path.basename(row.name, ext),
          localPath: filePath,
          publicPath: asMeshPublicPath(row.name),
          fileName: row.name,
          fileSizeBytes: fileStat.size,
          sourceType: "local",
          validated: true,
          addedAt: fileStat.mtimeMs,
        } satisfies JsonObject;
      }),
  );
  return assets.filter((asset): asset is JsonObject => asset !== null);
}

function inferMeshExtensionFromUrl(rawUrl: string): ".glb" | ".gltf" {
  const pathname = new URL(rawUrl).pathname.toLowerCase();
  if (pathname.endsWith(".gltf")) return ".gltf";
  return ".glb";
}

function getMeshyApiKey(): string {
  return (
    localSecretEnvString("FARPLANE_MESHY_API_KEY") ||
    localSecretEnvString("MESHY_API_KEY") ||
    localSecretString(["integrations", "meshyApiKey"]) ||
    process.env.FARPLANE_MESHY_API_KEY?.trim() ||
    process.env.MESHY_API_KEY?.trim() ||
    ""
  );
}

type MeshyTaskStatus = "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED";

type MeshyTaskResponse = {
  status: MeshyTaskStatus;
  progress?: number;
  model_urls?: {
    glb?: string;
  };
  task_error?: {
    message?: string;
  };
};

async function meshyFetch<T>(
  pathName: string,
  options: RequestInit & { body?: JsonObject } = {},
  signal?: AbortSignal,
): Promise<T> {
  const apiKey = getMeshyApiKey();
  if (!apiKey) {
    throw new Error("meshy_api_key_missing");
  }
  const { body, ...rest } = options;
  const response = await fetch(`${MESHY_API_BASE}${pathName}`, {
    ...rest,
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(rest.headers ?? {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const text = await response.text();
    let message = `meshy_request_failed:${response.status}`;
    try {
      const payload = JSON.parse(text) as { message?: string; error?: string };
      message = payload.message ?? payload.error ?? message;
    } catch {
      if (text.trim()) {
        message = text.trim().slice(0, 200);
      }
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

async function waitWithAbort(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw new Error("mesh_generation_cancelled");
  }
  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(resolve, delayMs);
    if (!signal) return;
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeoutId);
        reject(new Error("mesh_generation_cancelled"));
      },
      { once: true },
    );
  });
}

async function createMeshyPreviewTask(prompt: string, signal?: AbortSignal): Promise<string> {
  const payload = await meshyFetch<{ result?: string }>(
    "/text-to-3d",
    {
      method: "POST",
      body: {
        mode: "preview",
        prompt: prompt.slice(0, 600),
        model_type: "standard",
        ai_model: "latest",
      },
    },
    signal,
  );
  if (!payload.result) {
    throw new Error("meshy_preview_task_missing");
  }
  return payload.result;
}

async function createMeshyRefineTask(
  previewTaskId: string,
  stylePrompt: string,
  signal?: AbortSignal,
): Promise<string> {
  const payload = await meshyFetch<{ result?: string }>(
    "/text-to-3d",
    {
      method: "POST",
      body: {
        mode: "refine",
        preview_task_id: previewTaskId,
        texture_prompt: stylePrompt.slice(0, 600),
        enable_pbr: false,
      },
    },
    signal,
  );
  if (!payload.result) {
    throw new Error("meshy_refine_task_missing");
  }
  return payload.result;
}

async function getMeshyTask(taskId: string, signal?: AbortSignal): Promise<MeshyTaskResponse> {
  return meshyFetch<MeshyTaskResponse>(
    `/text-to-3d/${encodeURIComponent(taskId)}`,
    { method: "GET" },
    signal,
  );
}

async function pollMeshyTask(taskId: string, signal?: AbortSignal): Promise<MeshyTaskResponse> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const task = await getMeshyTask(taskId, signal);
    if (task.status === "SUCCEEDED" || task.status === "FAILED") {
      return task;
    }
    await waitWithAbort(2500, signal);
  }
  throw new Error("meshy_task_timed_out");
}

function normalizeAgentsFromConfig(config: JsonObject): JsonObject[] {
  const agents = (config.agents as JsonObject | undefined) ?? {};
  const list = Array.isArray(agents.list) ? (agents.list as JsonObject[]) : [];
  return list;
}

function resolveAgentDir(agent: JsonObject): string {
  const id = String(agent.id ?? "").trim() || "main";
  const configured = String(agent.agentDir ?? "").trim();
  return configured || path.join(OPENCLAW_HOME, "agents", id, "agent");
}

function resolveWorkspace(config: JsonObject, agent: JsonObject): string {
  const configured = String(agent.workspace ?? "").trim();
  if (configured) return configured;
  const defaults = (config.agents as JsonObject | undefined)?.defaults as JsonObject | undefined;
  const fallback = String(defaults?.workspace ?? "").trim();
  if (fallback) return fallback;
  return path.join(OPENCLAW_HOME, "workspace");
}

function isMemoryEntryType(value: string): value is MemoryEntryType {
  return [
    "discovery",
    "decision",
    "problem",
    "solution",
    "pattern",
    "warning",
    "success",
    "refactor",
    "bugfix",
    "feature",
  ].includes(value);
}

function normalizePathForPayload(basePath: string, filePath: string): string {
  const relative = path.relative(basePath, filePath) || path.basename(filePath);
  return relative.split(path.sep).join("/");
}

async function listMarkdownFilesRecursively(targetDir: string): Promise<string[]> {
  const rows = await readdir(targetDir, { withFileTypes: true });
  const files = await Promise.all(
    rows.map(async (row) => {
      const nextPath = path.join(targetDir, row.name);
      if (row.isDirectory()) {
        return listMarkdownFilesRecursively(nextPath);
      }
      return nextPath.endsWith(".md") ? [nextPath] : [];
    }),
  );
  return files.flat();
}

async function listWorkspaceFilesRecursively(workspacePath: string, currentDir: string = workspacePath): Promise<JsonObject[]> {
  let rows: import("node:fs").Dirent[] = [];
  try {
    rows = await readdir(currentDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = await Promise.all(
    rows.map(async (row): Promise<JsonObject[]> => {
      const nextPath = path.join(currentDir, row.name);
      if (row.isDirectory()) {
        if (row.name === ".git" || row.name === "node_modules" || row.name === ".cursor") return [];
        return listWorkspaceFilesRecursively(workspacePath, nextPath);
      }
      if (!row.isFile()) return [];
      let size: number | undefined;
      let updatedAtMs: number | undefined;
      try {
        const fileStat = await stat(nextPath);
        size = fileStat.size;
        updatedAtMs = fileStat.mtimeMs;
      } catch {
        // best effort metadata only
      }
      const relativePath = normalizePathForPayload(workspacePath, nextPath);
      return [
        {
          name: relativePath,
          path: relativePath,
          missing: false,
          ...(typeof size === "number" ? { size } : {}),
          ...(typeof updatedAtMs === "number" ? { updatedAtMs } : {}),
        } satisfies JsonObject,
      ];
    }),
  );
  return files.flat();
}

function parseMemoryLine(input: {
  line: string;
  sourcePath: string;
  lineNumber: number;
  agentId: string;
}): JsonObject | null {
  const rawText = input.line.trim();
  if (!rawText || rawText.startsWith("#")) return null;
  const memoryPattern =
    /^(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?\s*[+-]\d{4})?)\s*\|\s*([^|]+)\|\s*([A-Za-z]+-\d+)\s*\|\s*([^|]+)\|\s*(.+)$/;
  const match = rawText.match(memoryPattern);
  const lowerSource = input.sourcePath.toLowerCase();

  if (match) {
    const tsRaw = match[1].trim();
    const typeRaw = match[2].trim().toLowerCase();
    const memId = match[3].trim();
    const tags = match[4]
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const text = match[5].trim();
    const ts = Date.parse(tsRaw);
    return {
      id: `${input.agentId}:${input.sourcePath}:${input.lineNumber}`,
      agentId: input.agentId,
      sourcePath: input.sourcePath,
      lineNumber: input.lineNumber,
      rawText,
      text,
      ts: Number.isFinite(ts) ? ts : undefined,
      timestamp: Number.isFinite(ts) ? ts : undefined,
      type: isMemoryEntryType(typeRaw) ? typeRaw : undefined,
      memId,
      tags,
      metadata: {},
    } satisfies JsonObject;
  }

  // Daily note fallback: preserve non-empty lines from memory/*.md as row entries.
  if (lowerSource.startsWith("memory/")) {
    const dateMatch = input.sourcePath.match(/memory\/(\d{4}-\d{2}-\d{2})\.md$/);
    const ts = dateMatch ? Date.parse(`${dateMatch[1]}T00:00:00Z`) : Number.NaN;
    return {
      id: `${input.agentId}:${input.sourcePath}:${input.lineNumber}`,
      agentId: input.agentId,
      sourcePath: input.sourcePath,
      lineNumber: input.lineNumber,
      rawText,
      text: rawText,
      ts: Number.isFinite(ts) ? ts : undefined,
      timestamp: Number.isFinite(ts) ? ts : undefined,
      type: undefined,
      memId: undefined,
      tags: [],
      metadata: {},
    } satisfies JsonObject;
  }

  return null;
}

async function readAgentMemoryEntries(config: JsonObject, agent: JsonObject): Promise<JsonObject[]> {
  const agentId = String(agent.id ?? "").trim();
  if (!agentId) return [];
  const workspacePath = path.resolve(resolveWorkspace(config, agent));
  const rootMemoryPath = path.join(workspacePath, "MEMORY.md");
  const dailyMemoryDir = path.join(workspacePath, "memory");
  const entries: Array<{ entry: JsonObject; order: number; sourcePath: string; lineNumber: number; ts?: number }> = [];
  const candidateFiles: string[] = [];
  let order = 0;

  if (existsSync(rootMemoryPath)) {
    candidateFiles.push(rootMemoryPath);
  }
  if (existsSync(dailyMemoryDir)) {
    const dailyFiles = await listMarkdownFilesRecursively(dailyMemoryDir);
    candidateFiles.push(...dailyFiles.sort((a, b) => a.localeCompare(b)));
  }

  for (const filePath of candidateFiles) {
    let raw = "";
    try {
      raw = await readFile(filePath, "utf-8");
    } catch {
      // Ignore unreadable files so one bad memory document does not break the whole endpoint.
      continue;
    }
    const sourcePath = normalizePathForPayload(workspacePath, filePath);
    const lines = raw.split(/\r?\n/g);
    for (let index = 0; index < lines.length; index += 1) {
      const parsed = parseMemoryLine({
        line: lines[index],
        sourcePath,
        lineNumber: index + 1,
        agentId,
      });
      if (!parsed) continue;
      const ts = typeof parsed.ts === "number" ? parsed.ts : undefined;
      entries.push({ entry: parsed, order, sourcePath, lineNumber: index + 1, ts });
      order += 1;
    }
  }

  entries.sort((left, right) => {
    const leftHasTs = typeof left.ts === "number";
    const rightHasTs = typeof right.ts === "number";
    if (leftHasTs && rightHasTs) return (right.ts as number) - (left.ts as number);
    if (leftHasTs && !rightHasTs) return -1;
    if (!leftHasTs && rightHasTs) return 1;
    if (left.sourcePath !== right.sourcePath) return left.sourcePath.localeCompare(right.sourcePath);
    if (left.lineNumber !== right.lineNumber) return left.lineNumber - right.lineNumber;
    return left.order - right.order;
  });

  return entries.map((row) => row.entry);
}

async function readAgentSessionsIndex(agentId: string): Promise<Record<string, JsonObject>> {
  const sessionsPath = path.join(OPENCLAW_HOME, "agents", agentId, "sessions", "sessions.json");
  const parsed = await readJsonFile<JsonObject>(sessionsPath, {});
  const rows: Record<string, JsonObject> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!value || typeof value !== "object") continue;
    rows[key] = value as JsonObject;
  }
  return rows;
}

function resolveSessionTranscriptPath(agentId: string, sessionRow: JsonObject): string | null {
  const sessionsDir = path.join(OPENCLAW_HOME, "agents", agentId, "sessions");
  const directTranscriptPath = String(sessionRow.transcriptPath ?? "").trim();
  if (directTranscriptPath) {
    return path.isAbsolute(directTranscriptPath) ? directTranscriptPath : path.join(sessionsDir, directTranscriptPath);
  }
  const sessionId = String(sessionRow.sessionId ?? "").trim();
  if (!sessionId) return null;
  return path.join(sessionsDir, `${sessionId}.jsonl`);
}

function extractTextFromTranscriptMessage(message: JsonObject): string {
  const content = Array.isArray(message.content) ? message.content : [];
  const chunks = content
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const row = item as JsonObject;
      if (typeof row.text === "string") return row.text;
      if (typeof row.content === "string") return row.content;
      return "";
    })
    .filter(Boolean);
  if (chunks.length > 0) return chunks.join("\n");
  if (typeof message.text === "string") return message.text;
  return "";
}

function extractTextFromTranscriptRow(row: JsonObject): string {
  const type = String(row.type ?? "message");
  if (type === "message") {
    const msg = row.message && typeof row.message === "object" ? (row.message as JsonObject) : null;
    if (!msg) return "";
    return extractTextFromTranscriptMessage(msg).trim();
  }
  if (typeof row.text === "string" && row.text.trim()) return row.text.trim();
  if (typeof row.content === "string" && row.content.trim()) return row.content.trim();
  if (type === "tool") {
    const toolName = typeof row.toolName === "string" ? row.toolName.trim() : "";
    const status = typeof row.status === "string" ? row.status.trim() : "";
    const args = row.args ? JSON.stringify(row.args) : "";
    return [toolName || "tool", status, args].filter(Boolean).join(" ").trim();
  }
  return "";
}

function getUsageNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptySessionUsageTotals(): SessionUsageTotals {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
    responseCount: 0,
  };
}

function buildSessionUsageSummary(rows: JsonObject[]): SessionUsageSummary | undefined {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const totals = emptySessionUsageTotals();
  const last24Hours = emptySessionUsageTotals();
  const last7Days = emptySessionUsageTotals();
  let lastResponse: SessionUsageSummary["lastResponse"];
  for (const row of rows) {
    if (String(row.type ?? "") !== "message") continue;
    const message = row.message && typeof row.message === "object" ? (row.message as JsonObject) : null;
    if (!message || String(message.role ?? "") !== "assistant") continue;
    const usage = message.usage && typeof message.usage === "object" ? (message.usage as JsonObject) : null;
    if (!usage) continue;
    const usageSnapshot = {
      inputTokens: Math.max(0, Math.round(getUsageNumber(usage.input))),
      outputTokens: Math.max(0, Math.round(getUsageNumber(usage.output))),
      cacheReadTokens: Math.max(0, Math.round(getUsageNumber(usage.cacheRead))),
      cacheWriteTokens: Math.max(0, Math.round(getUsageNumber(usage.cacheWrite))),
      totalTokens: Math.max(0, Math.round(getUsageNumber(usage.totalTokens))),
      estimatedCostUsd: Math.max(
        0,
        getUsageNumber(
          usage.cost && typeof usage.cost === "object" ? (usage.cost as JsonObject).total : 0,
        ),
      ),
      responseCount: 1,
      provider: typeof message.provider === "string" ? message.provider : undefined,
      model: typeof message.model === "string" ? message.model : undefined,
      timestamp: typeof row.timestamp === "string" ? Date.parse(row.timestamp) : undefined,
    };
    totals.inputTokens += usageSnapshot.inputTokens;
    totals.outputTokens += usageSnapshot.outputTokens;
    totals.cacheReadTokens += usageSnapshot.cacheReadTokens;
    totals.cacheWriteTokens += usageSnapshot.cacheWriteTokens;
    totals.totalTokens += usageSnapshot.totalTokens;
    totals.estimatedCostUsd += usageSnapshot.estimatedCostUsd;
    totals.responseCount += 1;
    if ((usageSnapshot.timestamp ?? 0) >= dayAgo) {
      last24Hours.inputTokens += usageSnapshot.inputTokens;
      last24Hours.outputTokens += usageSnapshot.outputTokens;
      last24Hours.cacheReadTokens += usageSnapshot.cacheReadTokens;
      last24Hours.cacheWriteTokens += usageSnapshot.cacheWriteTokens;
      last24Hours.totalTokens += usageSnapshot.totalTokens;
      last24Hours.estimatedCostUsd += usageSnapshot.estimatedCostUsd;
      last24Hours.responseCount += 1;
    }
    if ((usageSnapshot.timestamp ?? 0) >= weekAgo) {
      last7Days.inputTokens += usageSnapshot.inputTokens;
      last7Days.outputTokens += usageSnapshot.outputTokens;
      last7Days.cacheReadTokens += usageSnapshot.cacheReadTokens;
      last7Days.cacheWriteTokens += usageSnapshot.cacheWriteTokens;
      last7Days.totalTokens += usageSnapshot.totalTokens;
      last7Days.estimatedCostUsd += usageSnapshot.estimatedCostUsd;
      last7Days.responseCount += 1;
    }
    lastResponse = usageSnapshot;
  }
  if (totals.responseCount === 0) return undefined;
  return {
    ...(lastResponse ? { lastResponse } : {}),
    sessionTotals: totals,
    last24Hours,
    last7Days,
  };
}

async function readSessionTimelineData(
  agentId: string,
  sessionKey: string,
  limit: number,
): Promise<{ events: JsonObject[]; usageSummary?: SessionUsageSummary }> {
  const sessions = await readAgentSessionsIndex(agentId);
  const sessionRow = sessions[sessionKey];
  if (!sessionRow) return { events: [] };
  const transcriptPath = resolveSessionTranscriptPath(agentId, sessionRow);
  if (!transcriptPath || !existsSync(transcriptPath)) return { events: [] };
  let raw = "";
  try {
    raw = await readFile(transcriptPath, "utf-8");
  } catch {
    return { events: [] };
  }
  const lines = raw
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
  const events: JsonObject[] = [];
  const transcriptRows: JsonObject[] = [];
  const fallbackBaseTs = typeof sessionRow.updatedAt === "number" ? sessionRow.updatedAt : 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    try {
      const row = JSON.parse(line) as JsonObject;
      transcriptRows.push(row);
      const rowType = String(row.type ?? "status");
      const text = extractTextFromTranscriptRow(row);
      if (!text) continue;
      const tsRaw = typeof row.timestamp === "string" ? Date.parse(row.timestamp) : Number.NaN;
      const role =
        rowType === "message"
          ? String(((row.message as JsonObject | undefined)?.role) ?? "assistant")
          : rowType === "tool"
            ? "tool"
            : "system";
      events.push({
        ts: Number.isFinite(tsRaw) ? tsRaw : fallbackBaseTs + index,
        type: rowType === "tool" ? "tool" : rowType === "message" ? "message" : "status",
        role,
        text,
        source: typeof row.source === "string" ? row.source : undefined,
        eventId: typeof row.id === "string" ? row.id : undefined,
        rawType: rowType,
      });
    } catch {
      // Skip malformed transcript lines.
    }
  }
  return {
    events: events.slice(Math.max(0, events.length - Math.max(1, limit))),
    usageSummary: buildSessionUsageSummary(transcriptRows),
  };
}

function normalizeOfficeObjects(objects: unknown[]): JsonObject[] {
  return objects
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const row = entry as JsonObject;
      const id = String(row.id ?? row._id ?? row.identifier ?? "").trim();
      const identifier = String(row.identifier ?? id).trim();
      const meshType = String(row.meshType ?? "");
      const position = Array.isArray(row.position) ? row.position : [0, 0, 0];
      const rotation = Array.isArray(row.rotation) ? row.rotation : [0, 0, 0];
      const scale = Array.isArray(row.scale) ? row.scale : undefined;
      const metadata = row.metadata && typeof row.metadata === "object" ? (row.metadata as JsonObject) : {};
      if (!id || !identifier || !meshType) return null;
      return {
        id,
        identifier,
        meshType,
        position,
        rotation,
        ...(scale ? { scale } : {}),
        metadata,
      } satisfies JsonObject;
    })
    .filter((entry): entry is JsonObject => entry !== null);
}

function normalizeProvider(value: unknown): TaskProvider {
  const provider = String(value ?? "internal");
  if (provider === "notion" || provider === "vibe" || provider === "linear") return provider;
  return "internal";
}

function normalizeSyncState(value: unknown): TaskSyncState {
  const syncState = String(value ?? "healthy");
  if (syncState === "pending" || syncState === "conflict" || syncState === "error") return syncState;
  return "healthy";
}

function normalizeFederatedTasks(tasks: unknown[]): JsonObject[] {
  return tasks
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const row = entry as JsonObject;
      const id = String(row.id ?? row.taskId ?? "").trim();
      const projectId = String(row.projectId ?? "").trim();
      const title = String(row.title ?? "").trim();
      if (!id || !projectId || !title) return null;
      const status = String(row.status ?? "todo");
      const priority = String(row.priority ?? "medium");
      const provider = normalizeProvider(row.provider ?? row.sourceProvider);
      return {
        id,
        projectId,
        title,
        status: status === "in_progress" || status === "blocked" || status === "done" ? status : "todo",
        ownerAgentId: typeof row.ownerAgentId === "string" ? row.ownerAgentId : undefined,
        priority: priority === "low" || priority === "high" ? priority : "medium",
        provider,
        canonicalProvider: normalizeProvider(row.canonicalProvider ?? provider),
        providerUrl: typeof row.providerUrl === "string" ? row.providerUrl : "",
        syncState: normalizeSyncState(row.syncState),
        syncError: typeof row.syncError === "string" ? row.syncError : undefined,
        updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : Date.now(),
      } satisfies JsonObject;
    })
    .filter((entry): entry is JsonObject => entry !== null);
}

function normalizeTicketStatus(value: unknown): TicketStatus {
  const status = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
  if (status === "in_progress" || status === "doing" || status === "active") return "in_progress";
  if (status === "review" || status === "qa" || status === "demo") return "review";
  if (status === "blocked" || status === "stuck") return "blocked";
  if (status === "done" || status === "closed" || status === "complete" || status === "completed") {
    return "done";
  }
  return "todo";
}

function normalizeTicketPriority(value: unknown): "low" | "medium" | "high" {
  const priority = String(value ?? "").trim().toLowerCase();
  if (priority === "low") return "low";
  if (priority === "high" || priority === "urgent" || priority === "critical") return "high";
  return "medium";
}

function isSafeProjectPath(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const projectPath = value.trim();
  if (!projectPath || projectPath.includes("\0")) return false;
  return path.isAbsolute(projectPath);
}

function parseSimpleFrontMatter(markdown: string): Record<string, string> {
  if (!markdown.startsWith("---")) return {};
  const end = markdown.indexOf("\n---", 3);
  if (end === -1) return {};
  const frontMatter = markdown.slice(3, end).split(/\r?\n/g);
  const parsed: Record<string, string> = {};
  for (const line of frontMatter) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    parsed[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return parsed;
}

function inferTicketTitle(filePath: string, markdown: string, frontMatter: Record<string, string>): string {
  const explicit = frontMatter.title || frontMatter.name || frontMatter.summary;
  if (explicit?.trim()) return explicit.trim();
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading;
  const parent = path.basename(path.dirname(filePath));
  if (path.basename(filePath).toLowerCase() === "ticket.md" && parent) return parent;
  return path.basename(filePath, path.extname(filePath));
}

function inferTicketId(projectId: string, projectPath: string, filePath: string, frontMatter: Record<string, string>): string {
  const explicit = frontMatter.id || frontMatter.ticket || frontMatter.taskId || frontMatter.task_id;
  if (explicit?.trim()) return `ticket:${projectId}:${explicit.trim()}`;
  const relative = path.relative(projectPath, filePath).replace(/\\/g, "/");
  return `ticket:${projectId}:${relative}`;
}

async function listTicketMarkdownFiles(
  dir: string,
  depth = 0,
  files: string[] = [],
): Promise<string[]> {
  if (depth > 4 || files.length >= 200) return files;
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (files.length >= 200) break;
    if (entry.name.startsWith(".")) continue;
    const entryName = entry.name.toLowerCase();
    if (entryName === "archive" || entryName === "artifacts") continue;
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await listTicketMarkdownFiles(entryPath, depth + 1, files);
      continue;
    }
    if (!entry.isFile()) continue;
    if (path.extname(entry.name).toLowerCase() !== ".md") continue;
    if (entry.name.toLowerCase() === "readme.md") continue;
    files.push(entryPath);
  }
  return files;
}

async function readProjectTicketTasks(project: {
  projectId: string;
  projectPath: string;
}): Promise<JsonObject[]> {
  const ticketsDir = path.join(project.projectPath, "tickets");
  if (!(await isDirectory(ticketsDir))) return [];
  const files = await listTicketMarkdownFiles(ticketsDir);
  const tasks: JsonObject[] = [];
  for (const filePath of files) {
    let markdown = "";
    try {
      markdown = await readFile(filePath, "utf-8");
    } catch {
      continue;
    }
    const frontMatter = parseSimpleFrontMatter(markdown);
    const fileStat = await stat(filePath).catch(() => null);
    const relativePath = path.relative(project.projectPath, filePath).replace(/\\/g, "/");
    tasks.push({
      id: inferTicketId(project.projectId, project.projectPath, filePath, frontMatter),
      projectId: project.projectId,
      title: inferTicketTitle(filePath, markdown, frontMatter),
      status: normalizeTicketStatus(frontMatter.status || frontMatter.state || frontMatter.phase),
      ownerAgentId: frontMatter.ownerAgentId || frontMatter.owner || undefined,
      priority: normalizeTicketPriority(frontMatter.priority),
      provider: "internal",
      canonicalProvider: "internal",
      providerUrl: `file://${filePath}`,
      artefactPath: relativePath,
      syncState: "healthy",
      updatedAt: fileStat?.mtimeMs ?? Date.now(),
    });
  }
  return tasks;
}

async function readProjectMemoryFiles(projectPath: string): Promise<JsonObject[]> {
  const rootPath = path.resolve(projectPath);
  const rows: JsonObject[] = [];
  const seenPaths = new Set<string>();
  for (const file of PROJECT_MEMORY_FILES) {
    const absolutePath = path.join(rootPath, file.path);
    let content = "";
    let updatedAtMs = Date.now();
    try {
      const [raw, fileStat] = await Promise.all([readFile(absolutePath, "utf-8"), stat(absolutePath)]);
      content = raw;
      updatedAtMs = fileStat.mtimeMs;
    } catch {
      content = "";
    }
    rows.push({
      id: file.path,
      title: file.title,
      kind: file.kind,
      collection: "memory",
      path: file.path,
      projectPath: rootPath,
      absolutePath,
      content,
      updatedAtMs,
      exists: content.trim().length > 0,
    });
    seenPaths.add(file.path);
  }

  const docsRoot = path.join(rootPath, "docs");
  if (!(await isDirectory(docsRoot))) return rows;

  const pendingDirs = [docsRoot];
  while (pendingDirs.length > 0 && rows.length < PROJECT_DOCUMENT_LIBRARY_MAX_FILES) {
    const currentDir = pendingDirs.shift();
    if (!currentDir) continue;
    const entries = await readdir(currentDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        pendingDirs.push(entryPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const extension = path.extname(entry.name).toLowerCase();
      if (!PROJECT_DOCUMENT_LIBRARY_EXTENSIONS.has(extension)) continue;
      const relativePath = path.relative(rootPath, entryPath).replace(/\\/g, "/");
      if (seenPaths.has(relativePath)) continue;

      const fileStat = await stat(entryPath).catch(() => null);
      if (!fileStat || fileStat.size > PROJECT_DOCUMENT_LIBRARY_MAX_BYTES) continue;
      const content = await readFile(entryPath, "utf-8").catch(() => "");
      const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
      rows.push({
        id: relativePath,
        title: heading || path.basename(entry.name, extension),
        kind: "document",
        collection: "docs",
        path: relativePath,
        projectPath: rootPath,
        absolutePath: entryPath,
        content,
        updatedAtMs: fileStat.mtimeMs,
        exists: true,
      });
      seenPaths.add(relativePath);
      if (rows.length >= PROJECT_DOCUMENT_LIBRARY_MAX_FILES) break;
    }
  }
  return rows;
}

function normalizeProjectManagers(
  raw: unknown,
): Array<{ projectId?: string; projectPath?: string; threadId: string; label?: string }> {
  const rows: Array<{ projectId?: string; projectPath?: string; threadId: string; label?: string }> = [];
  const pushRow = (entry: unknown, key?: string) => {
    if (!entry || typeof entry !== "object") return;
    const row = entry as JsonObject;
    const threadId = String(row.threadId ?? row.managerThreadId ?? row.thread ?? "").trim();
    if (!threadId) return;
    const projectId = String(row.projectId ?? (key?.startsWith("codex-proj-") ? key : "")).trim();
    const projectPath = String(row.projectPath ?? row.path ?? (!projectId && key ? key : "")).trim();
    rows.push({
      ...(projectId ? { projectId } : {}),
      ...(projectPath ? { projectPath } : {}),
      threadId,
      label: typeof row.label === "string" ? row.label.trim() : undefined,
    });
  };
  if (Array.isArray(raw)) {
    raw.forEach((entry) => pushRow(entry));
    return rows;
  }
  if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw as JsonObject)) {
      if (typeof value === "string") {
        rows.push(
          key.startsWith("codex-proj-")
            ? { projectId: key, threadId: value }
            : { projectPath: key, threadId: value },
        );
        continue;
      }
      pushRow(value, key);
    }
  }
  return rows;
}

function mergeProjectManagers(
  rows: Array<{ projectId?: string; projectPath?: string; threadId: string; label?: string }>,
): Array<{ projectId?: string; projectPath?: string; threadId: string; label?: string }> {
  const merged = new Map<string, { projectId?: string; projectPath?: string; threadId: string; label?: string }>();
  for (const row of rows) {
    const key = row.projectId || row.projectPath;
    if (!key) continue;
    merged.set(key, row);
  }
  return Array.from(merged.values());
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => String(entry ?? "").trim()).filter(Boolean))];
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

function projectDisplayNameFromPath(projectPath: string): string {
  const base = path.basename(path.resolve(projectPath)).replace(/[-_]+/g, " ");
  return base.replace(/\s+/g, " ").trim() || "Project";
}

function defaultProjectPmName(projectPath: string): string {
  return `${projectDisplayNameFromPath(projectPath)} PM`;
}

function normalizeProjectPmConfig(raw: unknown, projectPath = ""): JsonObject {
  const config = raw && typeof raw === "object" ? (raw as JsonObject) : {};
  const threads =
    config.threads && typeof config.threads === "object" && !Array.isArray(config.threads)
      ? (config.threads as JsonObject)
      : {};
  const configuredName =
    typeof config.name === "string" && config.name.trim() ? config.name.trim() : "";
  return {
    version: 1,
    name: configuredName && configuredName.toLowerCase() !== "project pm"
      ? configuredName
      : defaultProjectPmName(projectPath),
    role:
      typeof config.role === "string" && config.role.trim()
        ? config.role.trim()
        : "founder_operator",
    threads: {
      chats: Array.isArray(config.threads)
        ? normalizeStringList(config.threads)
        : normalizeStringList(threads.chats),
      automations: normalizeStringList(threads.automations),
    },
  };
}

function projectPmConfigPath(projectPath: string): string {
  return path.join(path.resolve(projectPath), "farplane", "pm.json");
}

async function readProjectPmConfig(projectPath: string): Promise<JsonObject | null> {
  const filePath = projectPmConfigPath(projectPath);
  if (!(await pathExists(filePath))) return null;
  const raw = await readJsonFile<unknown>(filePath, {});
  return normalizeProjectPmConfig(raw, projectPath);
}

async function saveProjectPmConfig(projectPath: string, input: unknown): Promise<JsonObject> {
  const filePath = projectPmConfigPath(projectPath);
  const normalized = normalizeProjectPmConfig(input, projectPath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf-8");
  return normalized;
}

function normalizeCodexOfficeConfig(raw: unknown): JsonObject {
  const config = raw && typeof raw === "object" ? (raw as JsonObject) : {};
  const leadershipPins =
    config.leadershipPins && typeof config.leadershipPins === "object"
      ? (config.leadershipPins as JsonObject)
      : {};
  const ceoThreadId = String(config.ceoThreadId ?? leadershipPins.ceoThreadId ?? "").trim();
  const projectManagers = normalizeProjectManagers(
    Array.isArray(config.projectManagers) ? config.projectManagers : leadershipPins.projectManagers,
  );
  const recentThreadWindowMinutes = normalizePositiveNumber(config.recentThreadWindowMinutes, 180);
  const heartbeatThreadIds = normalizeStringList(config.heartbeatThreadIds);
  const projectlessThreadIds = normalizeStringList(config.projectlessThreadIds);
  const miscPathIncludes = normalizeStringList(config.miscPathIncludes);
  const leadershipPinsOut: JsonObject = {
    ...(ceoThreadId ? { ceoThreadId } : {}),
    ...(projectManagers.length > 0 ? { projectManagers } : {}),
  };
  return {
    recentThreadWindowMinutes,
    alwaysShowHeartbeatThreads: config.alwaysShowHeartbeatThreads !== false,
    showAutomationThreadsAsHeartbeat: config.showAutomationThreadsAsHeartbeat !== false,
    ...(ceoThreadId ? { ceoThreadId } : {}),
    ...(projectManagers.length > 0 ? { projectManagers } : {}),
    ...(Object.keys(leadershipPinsOut).length > 0 ? { leadershipPins: leadershipPinsOut } : {}),
    heartbeatThreadIds,
    projectlessThreadIds,
    miscProjectName: typeof config.miscProjectName === "string" && config.miscProjectName.trim()
      ? config.miscProjectName.trim()
      : "Misc",
    miscPathIncludes: miscPathIncludes.length > 0 ? miscPathIncludes : ["Documents/Codex"],
  };
}

function normalizeCodexUiState(raw: unknown): JsonObject {
  const state = raw && typeof raw === "object" ? (raw as JsonObject) : {};
  return {
    savedWorkspaceRoots: normalizeStringList(state["electron-saved-workspace-roots"]),
    activeWorkspaceRoots: normalizeStringList(state["active-workspace-roots"]),
    projectOrder: normalizeStringList(state["project-order"]),
    pinnedProjectIds: normalizeStringList(state["pinned-project-ids"]),
    pinnedThreadIds: normalizeStringList(state["pinned-thread-ids"]),
    projectlessThreadIds: normalizeStringList(state["projectless-thread-ids"]),
  };
}

async function readCodexUiState(): Promise<JsonObject> {
  const raw = await readJsonFile<unknown>(CODEX_GLOBAL_STATE_PATH, {});
  return normalizeCodexUiState(raw);
}

async function readFilesystemObservedCodexThreadsForUiState(limit: number): Promise<JsonObject[]> {
  const uiState = await readCodexUiState();
  return readFilesystemObservedCodexThreads({
    projectPaths: projectPathsFromCodexUiState(uiState),
    limit,
    readProjectPmConfig,
    codexHome: CODEX_HOME,
  });
}

function codexThreadListLimit(params: unknown): number {
  const record = params && typeof params === "object" ? (params as JsonObject) : {};
  const raw = record.limit;
  const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return 80;
  return Math.min(Math.floor(parsed), 500);
}

async function mergeCodexThreadListWithFilesystem(
  result: unknown,
  limit: number,
): Promise<JsonObject> {
  return mergeFilesystemThreadsIntoThreadList({
    result,
    filesystemRows: await readFilesystemObservedCodexThreadsForUiState(limit),
    limit,
  });
}

async function saveCodexOfficeConfig(input: unknown): Promise<JsonObject> {
  const normalized = normalizeCodexOfficeConfig(input);
  const settings = await readOfficeSettings();
  await mkdir(path.dirname(OFFICE_SETTINGS_PATH), { recursive: true });
  await writeFile(
    OFFICE_SETTINGS_PATH,
    `${JSON.stringify({ ...settings, codex: normalized }, null, 2)}\n`,
    "utf-8",
  );
  await writeFile(CODEX_OFFICE_CONFIG_PATH, `${JSON.stringify(normalized, null, 2)}\n`, "utf-8");
  return normalized;
}

async function readCodexOfficeConfig(): Promise<JsonObject> {
  const settings = await readOfficeSettings();
  const legacy = await readJsonFile<unknown>(CODEX_OFFICE_CONFIG_PATH, {});
  return normalizeCodexOfficeConfig({
    ...(legacy && typeof legacy === "object" ? (legacy as JsonObject) : {}),
    ...(settings.codex && typeof settings.codex === "object" ? settings.codex : {}),
  });
}

async function buildProjectReadModel(input: unknown): Promise<JsonObject> {
  const body = input && typeof input === "object" ? (input as JsonObject) : {};
  const projects = Array.isArray(body.projects) ? body.projects : [];
  const normalizedProjects = projects
    .filter((entry): entry is JsonObject => Boolean(entry && typeof entry === "object"))
    .map((entry) => ({
      projectId: String(entry.projectId ?? "").trim(),
      projectPath: String(entry.projectPath ?? "").trim(),
    }))
    .filter((entry) => entry.projectId && isSafeProjectPath(entry.projectPath));
  const ticketTaskLists = await Promise.all(normalizedProjects.map((project) => readProjectTicketTasks(project)));
  const projectPms = await Promise.all(
    normalizedProjects.map(async (project) => {
      const pm = await readProjectPmConfig(project.projectPath);
      return pm
        ? {
            projectId: project.projectId,
            projectPath: project.projectPath,
            pm,
          }
        : null;
    }),
  );
  const managersRaw = await readJsonFile<unknown>(PROJECT_MANAGERS_PATH, {});
  const officeVisibility = await readCodexOfficeConfig();
  const officeManagers = normalizeProjectManagers(
    Array.isArray(officeVisibility.projectManagers)
      ? officeVisibility.projectManagers
      : typeof officeVisibility.leadershipPins === "object" && officeVisibility.leadershipPins
        ? (officeVisibility.leadershipPins as JsonObject).projectManagers
        : [],
  );
  return {
    generatedAt: Date.now(),
    ticketTasks: ticketTaskLists.flat(),
    projectPms: projectPms.filter(Boolean),
    projectManagers: mergeProjectManagers([...normalizeProjectManagers(managersRaw), ...officeManagers]),
    officeVisibility,
  };
}

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeKpiList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<string>();
  for (const row of input) {
    if (typeof row !== "string") continue;
    const trimmed = row.trim();
    if (trimmed) out.add(trimmed);
  }
  return [...out];
}

function normalizeTeamRoles(input: unknown): TeamRole[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<TeamRole>();
  for (const row of input) {
    if (row === "builder" || row === "growth_marketer" || row === "pm" || row === "biz_pm" || row === "biz_executor") out.add(row);
  }
  return [...out];
}

function normalizeBusinessType(input: unknown): BusinessType | null {
  if (
    input === "affiliate_marketing" ||
    input === "content_creator" ||
    input === "saas" ||
    input === "custom"
  ) {
    return input;
  }
  return null;
}

function projectIdFromTeamId(teamId: string): string {
  return teamId.startsWith("team-") ? teamId.slice("team-".length) : teamId;
}

function roleSuffix(role: TeamRole): string {
  if (role === "growth_marketer") return "growth";
  if (role === "biz_pm") return "pm";
  if (role === "biz_executor") return "executor";
  return role;
}

function defaultHeartbeatProfileIdForRole(role: TeamRole): string {
  if (role === "builder") return "hb-builder";
  if (role === "growth_marketer") return "hb-growth";
  if (role === "biz_pm") return "hb-biz-pm";
  if (role === "biz_executor") return "hb-biz-executor";
  return "hb-pm";
}

function defaultBusinessConfig(
  type: BusinessType,
  overrides?: { measure?: string; execute?: string; distribute?: string },
): JsonObject {
  return {
    type,
    slots: {
      measure: {
        skillId: overrides?.measure?.trim() || "amazon-affiliate-metrics",
        category: "measure",
        config: type === "affiliate_marketing" ? { platform: "amazon_associates" } : {},
      },
      execute: {
        skillId: overrides?.execute?.trim() || "video-generator",
        category: "execute",
        config: {},
      },
      distribute: {
        skillId: overrides?.distribute?.trim() || "tiktok-poster",
        category: "distribute",
        config: {},
      },
    },
  } satisfies JsonObject;
}

function defaultProjectResources(projectId: string): JsonObject[] {
  return [
    {
      id: `${projectId}:cash`,
      projectId,
      type: "cash_budget",
      name: "Cash Budget",
      unit: "usd_cents",
      remaining: 5000,
      limit: 5000,
      reserved: 0,
      trackerSkillId: "resource-cash-tracker",
      refreshCadenceMinutes: 15,
      policy: {
        advisoryOnly: true,
        softLimit: 1500,
        hardLimit: 0,
        whenLow: "deprioritize_expensive_tasks",
      },
      metadata: { currency: "USD" },
    } satisfies JsonObject,
    {
      id: `${projectId}:api`,
      projectId,
      type: "api_quota",
      name: "API Quota",
      unit: "requests",
      remaining: 1000,
      limit: 1000,
      reserved: 0,
      trackerSkillId: "resource-api-quota-tracker",
      refreshCadenceMinutes: 15,
      policy: {
        advisoryOnly: true,
        softLimit: 200,
        hardLimit: 0,
        whenLow: "warn",
      },
    } satisfies JsonObject,
    {
      id: `${projectId}:distribution`,
      projectId,
      type: "distribution_slots",
      name: "Distribution Slots",
      unit: "posts_per_day",
      remaining: 10,
      limit: 10,
      reserved: 0,
      trackerSkillId: "resource-distribution-tracker",
      refreshCadenceMinutes: 60,
      policy: {
        advisoryOnly: true,
        softLimit: 2,
        hardLimit: 0,
        whenLow: "ask_pm_review",
      },
      metadata: { platform: "tiktok" },
    } satisfies JsonObject,
  ];
}

function parseSkillList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function uniqueSkills(skills: string[]): string[] {
  return [...new Set(skills.map((entry) => entry.trim()).filter(Boolean))];
}

function applyAgentSkillsByMode(currentSkills: string[], targetSkills: string[], mode: BusinessEquipMode): string[] {
  if (mode === "append_only") return uniqueSkills([...currentSkills, ...targetSkills]);
  return uniqueSkills(targetSkills);
}

function buildTeamBusinessSkillTargets(project: JsonObject): { pmSkills: string[]; executorSkills: string[] } {
  const businessConfig = project.businessConfig && typeof project.businessConfig === "object" ? (project.businessConfig as JsonObject) : {};
  const slots = businessConfig.slots && typeof businessConfig.slots === "object" ? (businessConfig.slots as JsonObject) : {};
  const measureSlot = slots.measure && typeof slots.measure === "object" ? (slots.measure as JsonObject) : {};
  const executeSlot = slots.execute && typeof slots.execute === "object" ? (slots.execute as JsonObject) : {};
  const distributeSlot = slots.distribute && typeof slots.distribute === "object" ? (slots.distribute as JsonObject) : {};
  const slotSkills = uniqueSkills([
    ...parseSkillList(typeof measureSlot.skillId === "string" ? measureSlot.skillId : ""),
    ...parseSkillList(typeof executeSlot.skillId === "string" ? executeSlot.skillId : ""),
    ...parseSkillList(typeof distributeSlot.skillId === "string" ? distributeSlot.skillId : ""),
  ]);
  const resources = Array.isArray(project.resources) ? (project.resources as JsonObject[]) : [];
  const trackerSkills = uniqueSkills(
    resources
      .map((resource) => (typeof resource.trackerSkillId === "string" ? resource.trackerSkillId : ""))
      .filter(Boolean),
  );
  const sharedCore = ["farplane-team-cli", "status-self-reporter"];
  const pmCore = ["farplane-kanban-ops", "ledger-manager", "experiment-runner"];
  return {
    pmSkills: uniqueSkills([...sharedCore, ...pmCore, ...slotSkills, ...trackerSkills]),
    executorSkills: uniqueSkills([...sharedCore, ...slotSkills]),
  };
}

function ensureBusinessHeartbeatProfiles(company: JsonObject): JsonObject {
  const heartbeatProfiles = Array.isArray(company.heartbeatProfiles) ? [...company.heartbeatProfiles] : [];
  const hasBizPm = heartbeatProfiles.some(
    (entry) => entry && typeof entry === "object" && String((entry as JsonObject).id ?? "") === "hb-biz-pm",
  );
  const hasBizExecutor = heartbeatProfiles.some(
    (entry) => entry && typeof entry === "object" && String((entry as JsonObject).id ?? "") === "hb-biz-executor",
  );
  if (!hasBizPm) {
    heartbeatProfiles.push({
      id: "hb-biz-pm",
      role: "biz_pm",
      cadenceMinutes: 5,
      teamDescription: "Business PM loop",
      productDetails: "Track KPIs and profitability, manage kanban",
      goal: "Keep business net-positive with clear execution priorities",
    } satisfies JsonObject);
  }
  if (!hasBizExecutor) {
    heartbeatProfiles.push({
      id: "hb-biz-executor",
      role: "biz_executor",
      cadenceMinutes: 5,
      teamDescription: "Business execution loop",
      productDetails: "Execute highest-value tasks and report measurements",
      goal: "Create and distribute growth assets every heartbeat",
    } satisfies JsonObject);
  }
  return {
    ...company,
    heartbeatProfiles,
  };
}

async function upsertBusinessCronJobsBridge(projectId: string, agentIds: string[]): Promise<void> {
  let jobsRaw = await readJsonFile<unknown>(CRON_JOBS_PATH, []);
  if (!Array.isArray(jobsRaw)) jobsRaw = [];
  const jobsById = new Map<string, JsonObject>();
  for (const row of jobsRaw) {
    if (!row || typeof row !== "object") continue;
    const obj = row as JsonObject;
    const id = typeof obj.id === "string" ? obj.id : "";
    if (!id) continue;
    jobsById.set(id, obj);
  }

  const now = Date.now();
  for (const agentId of agentIds) {
    const isPm = /-pm$/.test(agentId);
    const jobId = `biz-heartbeat-${projectId}-${isPm ? "pm" : "executor"}`;
    jobsById.set(jobId, {
      id: jobId,
      agentId,
      name: `Business heartbeat (${isPm ? "PM" : "Executor"}) ${projectId}`,
      enabled: true,
      createdAtMs: now,
      updatedAtMs: now,
      schedule: { kind: "every", everyMs: 180000 },
      sessionTarget: "isolated",
      wakeMode: "next-heartbeat",
      payload: {
        kind: "agentTurn",
        message: isPm
          ? "Read HEARTBEAT.md, review KPIs and P&L, reprioritize kanban tasks, and return HEARTBEAT_OK."
          : "Read HEARTBEAT.md, execute the highest-priority business task, and return HEARTBEAT_OK.",
      },
      delivery: { mode: "none" },
    } satisfies JsonObject);
  }
  await mkdir(path.dirname(CRON_JOBS_PATH), { recursive: true });
  await writeFile(CRON_JOBS_PATH, `${JSON.stringify([...jobsById.values()], null, 2)}\n`, "utf-8");
}

function resourcesSnapshot(project: JsonObject): string {
  const resources = Array.isArray(project.resources) ? (project.resources as JsonObject[]) : [];
  if (resources.length === 0) return "none";
  return resources
    .map((resource) => {
      const name = String(resource.name ?? "resource");
      const remaining = Number(resource.remaining ?? 0);
      const limit = Number(resource.limit ?? 0);
      const unit = String(resource.unit ?? "units");
      return `${name}=${remaining}/${limit} ${unit}`;
    })
    .join(" | ");
}

function resourceAdvisories(project: JsonObject): string {
  const resources = Array.isArray(project.resources) ? (project.resources as JsonObject[]) : [];
  const advisories: string[] = [];
  for (const resource of resources) {
    const policy = resource.policy && typeof resource.policy === "object" ? (resource.policy as JsonObject) : {};
    const name = String(resource.name ?? "resource");
    const remaining = Number(resource.remaining ?? 0);
    const softLimit = Number(policy.softLimit ?? Number.NaN);
    const hardLimit = Number(policy.hardLimit ?? Number.NaN);
    const whenLow = String(policy.whenLow ?? "warn");
    if (Number.isFinite(hardLimit) && remaining <= hardLimit) {
      advisories.push(`${name}: hard-limit reached -> ${whenLow}`);
      continue;
    }
    if (Number.isFinite(softLimit) && remaining <= softLimit) {
      advisories.push(`${name}: low -> ${whenLow}`);
    }
  }
  return advisories.length > 0 ? advisories.join("; ") : "none";
}

function renderHeartbeatTemplate(rawTemplate: string, project: JsonObject): string {
  const businessConfig = project.businessConfig && typeof project.businessConfig === "object" ? (project.businessConfig as JsonObject) : {};
  const slots = businessConfig.slots && typeof businessConfig.slots === "object" ? (businessConfig.slots as JsonObject) : {};
  const measure = slots.measure && typeof slots.measure === "object" ? (slots.measure as JsonObject) : {};
  const execute = slots.execute && typeof slots.execute === "object" ? (slots.execute as JsonObject) : {};
  const distribute = slots.distribute && typeof slots.distribute === "object" ? (slots.distribute as JsonObject) : {};
  const ledger = Array.isArray(project.ledger) ? (project.ledger as JsonObject[]) : [];
  const revenue = ledger
    .filter((entry) => String(entry.type ?? "") === "revenue")
    .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
  const costs = ledger
    .filter((entry) => String(entry.type ?? "") === "cost")
    .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
  const profit = revenue - costs;
  const experiments = Array.isArray(project.experiments) ? (project.experiments as JsonObject[]) : [];
  const metrics = Array.isArray(project.metricEvents) ? (project.metricEvents as JsonObject[]) : [];
  let rendered = rawTemplate;
  const replacements: Record<string, string> = {
    "{projectName}": String(project.name ?? ""),
    "{businessType}": String(businessConfig.type ?? "custom"),
    "{projectGoal}": String(project.goal ?? ""),
    "{totalRevenue}": String(revenue),
    "{totalCosts}": String(costs),
    "{profit}": String(profit),
    "{experimentsSummary}":
      experiments.length > 0
        ? experiments
            .slice(-3)
            .map((entry) => `${String(entry.hypothesis ?? "")} (${String(entry.status ?? "running")})`)
            .join("; ")
        : "none",
    "{recentMetrics}": metrics.length > 0 ? JSON.stringify((metrics[metrics.length - 1] as JsonObject).metrics ?? {}) : "none",
    "{openTasks}": "0",
    "{inProgressTasks}": "0",
    "{blockedTasks}": "0",
    "{resourcesSnapshot}": resourcesSnapshot(project),
    "{resourceAdvisories}": resourceAdvisories(project),
    "{measureSkillId}": String(measure.skillId ?? "not-set"),
    "{executeSkillId}": String(execute.skillId ?? "not-set"),
    "{distributeSkillId}": String(distribute.skillId ?? "not-set"),
    "{measureConfig}": JSON.stringify(measure.config ?? {}),
    "{executeConfig}": JSON.stringify(execute.config ?? {}),
    "{distributeConfig}": JSON.stringify(distribute.config ?? {}),
    "{tasksList}": "[]",
  };
  for (const [needle, value] of Object.entries(replacements)) {
    rendered = rendered.split(needle).join(value);
  }
  return rendered;
}

type EvalRunIndexEntry = {
  job_id: string;
  label?: string;
  created_at?: string;
  completed_at?: string;
  summary_path?: string;
  task_count?: number;
  pass_rate?: number;
};

type EvalTaskSummary = {
  task_id: string;
  title?: string;
  pass?: boolean;
  verdict?: string;
  reason?: string;
  detail_path?: string;
};

type EvalSummary = {
  job_id: string;
  label?: string;
  created_at?: string;
  completed_at?: string;
  harness?: string;
  judge_harness?: string;
  suite?: string;
  task_count?: number;
  pass_rate?: number;
  verdict_counts?: Record<string, number>;
  tasks: EvalTaskSummary[];
};

function isSafeEvalId(value: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(value) && !value.includes("..");
}

function normalizeEvalRunIndexEntry(value: unknown): EvalRunIndexEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as JsonObject;
  const jobId = String(entry.job_id ?? entry.jobId ?? "").trim();
  if (!jobId) return null;
  return {
    job_id: jobId,
    label: typeof entry.label === "string" ? entry.label : undefined,
    created_at: typeof entry.created_at === "string" ? entry.created_at : undefined,
    completed_at: typeof entry.completed_at === "string" ? entry.completed_at : undefined,
    summary_path: typeof entry.summary_path === "string" ? entry.summary_path : undefined,
    task_count: typeof entry.task_count === "number" ? entry.task_count : undefined,
    pass_rate: typeof entry.pass_rate === "number" ? entry.pass_rate : undefined,
  };
}

function normalizeEvalSummary(value: unknown): EvalSummary | null {
  if (!value || typeof value !== "object") return null;
  const row = value as JsonObject;
  const jobId = String(row.job_id ?? row.jobId ?? "").trim();
  const rawTasks = Array.isArray(row.tasks) ? row.tasks : [];
  if (!jobId) return null;
  const tasks = rawTasks
    .map((task): EvalTaskSummary | null => {
      if (!task || typeof task !== "object") return null;
      const taskRow = task as JsonObject;
      const taskId = String(taskRow.task_id ?? taskRow.taskId ?? "").trim();
      if (!taskId) return null;
      return {
        task_id: taskId,
        title: typeof taskRow.title === "string" ? taskRow.title : undefined,
        pass: typeof taskRow.pass === "boolean" ? taskRow.pass : undefined,
        verdict: typeof taskRow.verdict === "string" ? taskRow.verdict : undefined,
        reason: typeof taskRow.reason === "string" ? taskRow.reason : undefined,
        detail_path: typeof taskRow.detail_path === "string" ? taskRow.detail_path : undefined,
      };
    })
    .filter((task): task is EvalTaskSummary => Boolean(task));
  return {
    job_id: jobId,
    label: typeof row.label === "string" ? row.label : undefined,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    completed_at: typeof row.completed_at === "string" ? row.completed_at : undefined,
    harness: typeof row.harness === "string" ? row.harness : undefined,
    judge_harness: typeof row.judge_harness === "string" ? row.judge_harness : undefined,
    suite: typeof row.suite === "string" ? row.suite : undefined,
    task_count: typeof row.task_count === "number" ? row.task_count : tasks.length,
    pass_rate: typeof row.pass_rate === "number" ? row.pass_rate : undefined,
    verdict_counts:
      row.verdict_counts && typeof row.verdict_counts === "object"
        ? (row.verdict_counts as Record<string, number>)
        : undefined,
    tasks,
  };
}

function sortEvalRuns(entries: EvalRunIndexEntry[]): EvalRunIndexEntry[] {
  return [...entries].sort((left, right) => {
    const leftTime = Date.parse(left.created_at ?? left.completed_at ?? "");
    const rightTime = Date.parse(right.created_at ?? right.completed_at ?? "");
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
  });
}

async function readEvalRunIndex(): Promise<EvalRunIndexEntry[]> {
  const indexPath = path.join(FARPLANE_EVALS_ROOT, "runs", "index.json");
  const raw = await readJsonFile<unknown>(indexPath, []);
  const rawEntries = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as JsonObject).runs)
      ? ((raw as JsonObject).runs as unknown[])
      : [];
  return sortEvalRuns(
    rawEntries
      .map(normalizeEvalRunIndexEntry)
      .filter((entry): entry is EvalRunIndexEntry => Boolean(entry)),
  );
}

async function readEvalSummary(jobId: string): Promise<EvalSummary | null> {
  if (!isSafeEvalId(jobId)) return null;
  const summaryPath = path.join(FARPLANE_EVALS_ROOT, "runs", jobId, "summary.json");
  return normalizeEvalSummary(await readJsonFile<unknown>(summaryPath, null));
}

async function readEvalTaskDetail(jobId: string, taskId: string): Promise<JsonObject | null> {
  if (!isSafeEvalId(jobId) || !isSafeEvalId(taskId)) return null;
  const taskPath = path.join(FARPLANE_EVALS_ROOT, "runs", jobId, "tasks", `${taskId}.json`);
  const raw = await readJsonFile<unknown>(taskPath, null);
  if (!raw || typeof raw !== "object") return null;
  const detail = raw as JsonObject;
  const answerPath = path.join(
    FARPLANE_EVALS_ROOT,
    "runs",
    jobId,
    "tasks",
    taskId,
    "agent_answer.txt",
  );
  if (await pathExists(answerPath)) {
    const agent = detail.agent && typeof detail.agent === "object" ? (detail.agent as JsonObject) : {};
    detail.agent = { ...agent, answer_text: await readFile(answerPath, "utf-8") };
  }
  return detail;
}

async function readEvalRun(
  jobId: string,
): Promise<{ summary: EvalSummary | null; detailsByTaskId: Record<string, JsonObject> }> {
  const summary = await readEvalSummary(jobId);
  const detailsByTaskId: Record<string, JsonObject> = {};
  if (!summary) return { summary, detailsByTaskId };
  for (const task of summary.tasks) {
    const detail = await readEvalTaskDetail(jobId, task.task_id);
    if (detail) detailsByTaskId[task.task_id] = detail;
  }
  return { summary, detailsByTaskId };
}

function stringifyEvalSearchValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(stringifyEvalSearchValue).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(stringifyEvalSearchValue).join(" ");
  return "";
}

function evalTaskMatchesSkill({
  detail,
  skillId,
  task,
}: {
  detail?: JsonObject;
  skillId: string;
  task: EvalTaskSummary;
}): boolean {
  const normalizedSkill = skillId.toLowerCase();
  const detailTask = detail?.task && typeof detail.task === "object" ? (detail.task as JsonObject) : {};
  const detailJudge = detail?.judge && typeof detail.judge === "object" ? (detail.judge as JsonObject) : {};
  return [
    task.task_id,
    task.title,
    task.reason,
    ...(task.tags ?? []),
    detailTask.id,
    detailTask.title,
    detailTask.query,
    detailTask.prompt,
    stringifyEvalSearchValue(detailTask.tags),
    stringifyEvalSearchValue(detailTask.expected),
    stringifyEvalSearchValue(detailJudge.reason),
    stringifyEvalSearchValue(detailJudge.reference_points),
    stringifyEvalSearchValue(detailJudge.reference_point_results),
    stringifyEvalSearchValue(detail?.artifacts),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalizedSkill);
}

async function readEvalRunsForSkill(skillId: string): Promise<JsonObject[]> {
  const runs = await readEvalRunIndex();
  const rows: JsonObject[] = [];
  for (const runIndexEntry of runs) {
    const run = await readEvalRun(runIndexEntry.job_id);
    if (!run.summary) continue;
    const tasks = run.summary.tasks.filter((task) =>
      evalTaskMatchesSkill({
        detail: run.detailsByTaskId[task.task_id],
        skillId,
        task,
      }),
    );
    if (!tasks.length) continue;
    const passedTasks = tasks.filter((task) => task.pass === true).length;
    const failedTasks = tasks.filter((task) => task.pass === false).length;
    rows.push({
      failedTasks,
      jobId: runIndexEntry.job_id,
      label: runIndexEntry.label ?? run.summary.label ?? runIndexEntry.job_id,
      passRate: tasks.length ? passedTasks / tasks.length : null,
      passedTasks,
      runDate: runIndexEntry.created_at ?? runIndexEntry.completed_at,
      tasks,
      totalTasks: tasks.length,
    });
  }
  return rows;
}

function farplaneStateBridge() {
  return {
    name: "farplane-openclaw-state-bridge",
    configureServer(server: {
      middlewares: { use: (cb: (req: { method?: string; url?: string; on: (name: string, cb: (chunk?: Buffer) => void) => void }, res: { setHeader: (k: string, v: string) => void; end: (body: string) => void }, next: () => void) => void) => void };
    }) {
      server.middlewares.use(async (req, res, next) => {
        const method = (req.method || "GET").toUpperCase();
        const url = new URL(req.url || "/", "http://127.0.0.1:5173");
        const pathname = url.pathname;

        const skillMaintenanceGraphMatch = pathname.match(
          /^\/codex\/skill-maintenance-graph\/?(.*)$/,
        );
        const farplaneFrameworkGraphMatch = pathname.match(
          /^\/farplane\/framework-graph\/?(.*)$/,
        );
        if (method === "GET" && farplaneFrameworkGraphMatch) {
          const requestedGraphPath = farplaneFrameworkGraphMatch[1] || "index.html";
          const served = await writeStaticFile(
            res as unknown as {
              setHeader: (k: string, v: string) => void;
              end: (body: Buffer) => void;
            },
            FARPLANE_FRAMEWORK_GRAPH_ROOT,
            requestedGraphPath,
          );
          if (!served) {
            writeJson(res, 404, { ok: false, error: "farplane_framework_graph_asset_not_found" });
          }
          return;
        }
        if (method === "GET" && skillMaintenanceGraphMatch) {
          const requestedGraphPath = skillMaintenanceGraphMatch[1] || "index.html";
          let served = await writeStaticFile(
            res as unknown as {
              setHeader: (k: string, v: string) => void;
              end: (body: Buffer) => void;
            },
            CODEX_SKILL_MAINTENANCE_GRAPH_ROOT,
            requestedGraphPath,
          );
          if (!served) {
            served = await writeStaticFile(
              res as unknown as {
                setHeader: (k: string, v: string) => void;
                end: (body: Buffer) => void;
              },
              FARPLANE_FRAMEWORK_GRAPH_ROOT,
              requestedGraphPath,
            );
          }
          if (!served) {
            writeJson(res, 404, { ok: false, error: "skill_maintenance_graph_asset_not_found" });
          }
          return;
        }

        if (method === "GET" && pathname === "/farplane/harness/adoption-scan") {
          const projectRoot = url.searchParams.get("projectRoot")?.trim() || FARPLANE_FRAMEWORK_ROOT;
          if (!isSafeProjectPath(projectRoot)) {
            writeJson(res, 400, { ok: false, error: "project_root_required" });
            return;
          }
          const result = await runFarplaneFrameworkCli([
            "adoption",
            "scan",
            "--project-root",
            projectRoot,
            "--json",
          ]);
          writeJson(res, result.ok ? 200 : 502, result);
          return;
        }

        if (method === "GET" && pathname === "/farplane/harness/skills-rollout-scan") {
          const result = await runFarplaneFrameworkCli(["skills", "rollout", "scan", "--json"]);
          writeJson(res, result.ok ? 200 : 502, result);
          return;
        }

        if (method === "GET" && pathname === "/farplane/harness/template-tracking-scan") {
          const projectRoot = url.searchParams.get("projectRoot")?.trim() || REPO_ROOT;
          if (!isSafeProjectPath(projectRoot)) {
            writeJson(res, 400, { ok: false, error: "project_root_required" });
            return;
          }
          const payload = await buildTemplateTrackingScan(projectRoot);
          writeJson(res, 200, { ok: true, payload });
          return;
        }

        if (pathname === "/codex/app-server/health") {
          const appServerUrl = readCodexAppServerUrl();
          writeJson(res, 200, {
            ok: Boolean(appServerUrl),
            configured: Boolean(appServerUrl),
            transport: appServerUrl ? "websocket" : "missing",
          });
          return;
        }

        if (method === "GET" && pathname === "/farplane/runtime-config") {
          writeJson(res, 200, { ok: true, payload: readRuntimeConfigForUi() });
          return;
        }

        if (method === "POST" && pathname === "/codex/app-server/rpc") {
          const body = (await readBody(req)) as JsonObject;
          const rpcMethod = String(body.method ?? "").trim();
          if (!rpcMethod) {
            writeJson(res, 400, { ok: false, error: "codex_rpc_method_required" });
            return;
          }
          try {
            const result = await requestCodexAppServerRpc(rpcMethod, body.params ?? {});
            const mergedResult =
              rpcMethod === "thread/list"
                ? await mergeCodexThreadListWithFilesystem(
                    result,
                    codexThreadListLimit(body.params),
                  )
                : result;
            writeJson(res, 200, { ok: true, result: mergedResult });
          } catch (error) {
            if (rpcMethod === "thread/list") {
              const limit = codexThreadListLimit(body.params);
              writeJson(res, 200, {
                ok: true,
                result: {
                  data: await readFilesystemObservedCodexThreadsForUiState(limit),
                  source: "farplane-message-window",
                },
              });
              return;
            }
            writeJson(res, 502, {
              ok: false,
              error: error instanceof Error ? error.message : "codex_rpc_failed",
            });
          }
          return;
        }

        if (method === "POST" && pathname === "/farplane/projects/read-model") {
          const body = await readBody(req);
          const readModel = await buildProjectReadModel(body);
          writeJson(res, 200, readModel);
          return;
        }

        if (method === "POST" && pathname === "/farplane/runtime-config") {
          if (!hasBridgeWriteAccess(req)) {
            writeJson(res, 403, { ok: false, error: "forbidden" });
            return;
          }
          const body = await readBody(req);
          writeJson(res, 200, { ok: true, payload: await saveRuntimeConfigFromUi(body) });
          return;
        }

        if (method === "GET" && pathname === "/farplane/codex-office") {
          writeJson(res, 200, { config: await readCodexOfficeConfig() });
          return;
        }

        if (method === "GET" && pathname === "/farplane/project-pm") {
          const projectPath = url.searchParams.get("projectPath")?.trim() ?? "";
          if (!isSafeProjectPath(projectPath)) {
            writeJson(res, 400, { ok: false, error: "project_path_required" });
            return;
          }
          const pm = await readProjectPmConfig(projectPath);
          writeJson(res, 200, { ok: true, exists: Boolean(pm), pm });
          return;
        }

        if (method === "GET" && pathname === "/farplane/hooks/config") {
          const projectPath = url.searchParams.get("projectPath")?.trim() || REPO_ROOT;
          if (!isSafeProjectPath(projectPath)) {
            writeJson(res, 400, { ok: false, error: "project_path_required" });
            return;
          }
          writeJson(res, 200, await readProjectHookConfig(projectPath));
          return;
        }

        if (method === "GET" && pathname === "/farplane/local-observed-codex-workers") {
          const now = Date.now();
          const rangeMs = clampNumber(
            url.searchParams.get("rangeMs"),
            LOCAL_OBSERVED_CODEX_DISCOVERY_RANGE_MS,
            60_000,
            LOCAL_OBSERVED_CODEX_DISCOVERY_RANGE_MS,
          );
          const limit = clampNumber(url.searchParams.get("limit"), 500, 1, 1000);
          const rows = await readLocalFarplaneEventRows({
            rangeMs,
            now,
            maxRows: Math.max(limit * 8, 500),
          });
          writeJson(res, 200, {
            ok: true,
            source: "local-farplane-events",
            rangeMs,
            workers: localFarplaneEventsToObservedCodexWorkers(rows, { now, rangeMs, limit }),
          });
          return;
        }

        if (method === "GET" && pathname === "/farplane/codex-ui-state") {
          writeJson(res, 200, await readCodexUiState());
          return;
        }

        if (method === "GET" && pathname === "/farplane/telegram-gateway/state") {
          const state = await readJsonFile<JsonObject>(TELEGRAM_GATEWAY_STATE_PATH, {
            updateOffset: 0,
            mappings: [],
            history: [],
          });
          writeJson(res, 200, { ok: true, state, statePath: TELEGRAM_GATEWAY_STATE_PATH });
          return;
        }

        if (method === "GET" && pathname === "/farplane/memory-files") {
          const projectPath = url.searchParams.get("projectPath")?.trim() ?? "";
          if (!isSafeProjectPath(projectPath)) {
            writeJson(res, 400, { error: "project_path_required", files: [] });
            return;
          }
          const files = await readProjectMemoryFiles(projectPath);
          writeJson(res, 200, { projectPath: path.resolve(projectPath), files });
          return;
        }

        if (method === "GET" && pathname === "/farplane/evals/runs") {
          const exists = await isDirectory(FARPLANE_EVALS_ROOT);
          const runs = exists ? await readEvalRunIndex() : [];
          writeJson(res, 200, {
            ok: true,
            evalsRoot: FARPLANE_EVALS_ROOT,
            exists,
            runs,
            latest: runs[0] ?? null,
          });
          return;
        }

        if (method === "GET" && pathname === "/farplane/evals/runs/latest") {
          const exists = await isDirectory(FARPLANE_EVALS_ROOT);
          const runs = exists ? await readEvalRunIndex() : [];
          const latest = runs[0] ?? null;
          if (!latest) {
            writeJson(res, 200, {
              ok: true,
              evalsRoot: FARPLANE_EVALS_ROOT,
              empty: true,
              summary: null,
              detailsByTaskId: {},
            });
            return;
          }
          const run = await readEvalRun(latest.job_id);
          writeJson(res, run.summary ? 200 : 404, {
            ok: Boolean(run.summary),
            evalsRoot: FARPLANE_EVALS_ROOT,
            summary: run.summary,
            detailsByTaskId: run.detailsByTaskId,
            error: run.summary ? undefined : "eval_run_not_found",
          });
          return;
        }

        if (method === "GET" && pathname === "/farplane/evals/skill-runs") {
          const skillId = url.searchParams.get("skill")?.trim() ?? "";
          if (!skillId) {
            writeJson(res, 400, { ok: false, error: "skill_required", rows: [] });
            return;
          }
          if (skillId.length > MAX_SKILL_EVAL_QUERY_LENGTH) {
            writeJson(res, 400, { ok: false, error: "skill_query_too_long", rows: [] });
            return;
          }
          const exists = await isDirectory(FARPLANE_EVALS_ROOT);
          const rows = exists ? await readEvalRunsForSkill(skillId) : [];
          writeJson(res, 200, {
            ok: true,
            evalsRoot: FARPLANE_EVALS_ROOT,
            exists,
            rows,
          });
          return;
        }

        const evalAnswerMatch = pathname.match(
          /^\/farplane\/evals\/runs\/([^/]+)\/tasks\/([^/]+)\/agent_answer\.txt$/,
        );
        if (method === "GET" && evalAnswerMatch) {
          const [, jobId, taskId] = evalAnswerMatch;
          if (!isSafeEvalId(jobId) || !isSafeEvalId(taskId)) {
            writeJson(res, 400, { ok: false, error: "unsafe_eval_id" });
            return;
          }
          const answerPath = path.join(
            FARPLANE_EVALS_ROOT,
            "runs",
            jobId,
            "tasks",
            taskId,
            "agent_answer.txt",
          );
          if (!(await pathExists(answerPath))) {
            writeJson(res, 404, { ok: false, error: "eval_agent_answer_not_found" });
            return;
          }
          res.setHeader("content-type", "text/plain; charset=utf-8");
          res.end(await readFile(answerPath, "utf-8"));
          return;
        }

        const evalTaskMatch = pathname.match(/^\/farplane\/evals\/runs\/([^/]+)\/tasks\/([^/]+)$/);
        if (method === "GET" && evalTaskMatch) {
          const [, jobId, taskId] = evalTaskMatch;
          const detail = await readEvalTaskDetail(jobId, taskId);
          writeJson(res, detail ? 200 : 404, {
            ok: Boolean(detail),
            detail,
            error: detail ? undefined : "eval_task_detail_not_found",
          });
          return;
        }

        const evalRunMatch = pathname.match(/^\/farplane\/evals\/runs\/([^/]+)$/);
        if (method === "GET" && evalRunMatch) {
          const [, jobId] = evalRunMatch;
          const run = await readEvalRun(jobId);
          writeJson(res, run.summary ? 200 : 404, {
            ok: Boolean(run.summary),
            evalsRoot: FARPLANE_EVALS_ROOT,
            summary: run.summary,
            detailsByTaskId: run.detailsByTaskId,
            error: run.summary ? undefined : "eval_run_not_found",
          });
          return;
        }

        if (method === "POST" && pathname === "/farplane/codex-office") {
          const body = await readBody(req);
          const config = await saveCodexOfficeConfig(
            body && typeof body === "object" && "config" in body
              ? (body as JsonObject).config
              : body,
          );
          writeJson(res, 200, { ok: true, config });
          return;
        }

        if (method === "POST" && pathname === "/farplane/project-pm") {
          const body = await readBody(req);
          const projectPath =
            body && typeof body === "object" ? String((body as JsonObject).projectPath ?? "") : "";
          if (!isSafeProjectPath(projectPath)) {
            writeJson(res, 400, { ok: false, error: "project_path_required" });
            return;
          }
          const pm = await saveProjectPmConfig(projectPath, (body as JsonObject).pm);
          writeJson(res, 200, { ok: true, pm });
          return;
        }

        if (method === "POST" && pathname === "/farplane/hooks/config") {
          if (!hasBridgeWriteAccess(req)) {
            writeJson(res, 403, { ok: false, error: "forbidden" });
            return;
          }
          const body = await readBody(req);
          const projectPath =
            body && typeof body === "object" ? String((body as JsonObject).projectPath ?? REPO_ROOT) : REPO_ROOT;
          if (!isSafeProjectPath(projectPath)) {
            writeJson(res, 400, { ok: false, error: "project_path_required" });
            return;
          }
          const config = body && typeof body === "object" ? (body as JsonObject).config : {};
          writeJson(res, 200, await saveProjectHookConfig(projectPath, config));
          return;
        }

        if (method === "POST" && pathname === "/farplane/hooks/install") {
          if (!hasBridgeWriteAccess(req)) {
            writeJson(res, 403, { ok: false, error: "forbidden" });
            return;
          }
          writeJson(res, 200, await installProjectHooks());
          return;
        }

        const isOpenClawRoute = pathname.startsWith("/openclaw/");
        const isFarplaneOfficeObjectRoute = pathname.startsWith("/farplane/office-objects/");
        const isCodexPetRoute = pathname.startsWith("/codex/pets/");
        if (!isOpenClawRoute && !isFarplaneOfficeObjectRoute && !isCodexPetRoute) {
          next();
          return;
        }

        const config = await readJsonFile<JsonObject>(OPENCLAW_CONFIG_PATH, {});
        const configuredAgents = normalizeAgentsFromConfig(config);

        if (method === "GET" && pathname === "/openclaw/config") {
          writeJson(res, 200, { stateVersion: Date.now(), config });
          return;
        }

        if (method === "GET" && pathname === "/openclaw/agents") {
          const agents = await Promise.all(
            configuredAgents.map(async (agent) => {
              const agentId = String(agent.id ?? "").trim();
              const sessions = await readAgentSessionsIndex(agentId);
              return {
                agentId,
                displayName: String((agent.identity as JsonObject | undefined)?.name ?? agent.name ?? agentId),
                workspacePath: resolveWorkspace(config, agent),
                agentDir: resolveAgentDir(agent),
                sandboxMode: String(((agent.sandbox as JsonObject | undefined)?.mode ?? "off")),
                toolPolicy: {
                  allow: Array.isArray((agent.tools as JsonObject | undefined)?.allow) ? ((agent.tools as JsonObject).allow as unknown[]) : [],
                  deny: Array.isArray((agent.tools as JsonObject | undefined)?.deny) ? ((agent.tools as JsonObject).deny as unknown[]) : [],
                },
                sessionCount: Object.keys(sessions).length,
                lastUpdatedAt: Date.now(),
              };
            }),
          );
          writeJson(res, 200, { agents });
          return;
        }

        const sessionsMatch = pathname.match(/^\/openclaw\/agents\/([^/]+)\/sessions$/);
        if (method === "GET" && sessionsMatch) {
          const agentId = decodeURIComponent(sessionsMatch[1]);
          const sessions = await readAgentSessionsIndex(agentId);
          const payload = Object.entries(sessions).map(([sessionKey, row]) => ({
            sessionKey,
            sessionId: typeof row.sessionId === "string" ? row.sessionId : undefined,
            updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : 0,
            channel: typeof (row.deliveryContext as JsonObject | undefined)?.channel === "string" ? String((row.deliveryContext as JsonObject).channel) : undefined,
            peerLabel: typeof row.lastTo === "string" ? row.lastTo : undefined,
            origin: typeof (row.origin as JsonObject | undefined)?.provider === "string" ? String((row.origin as JsonObject).provider) : undefined,
          }));
          writeJson(res, 200, { sessions: payload });
          return;
        }

        const memoryEntriesMatch = pathname.match(/^\/openclaw\/agents\/([^/]+)\/memory-entries$/);
        if (method === "GET" && memoryEntriesMatch) {
          const agentId = decodeURIComponent(memoryEntriesMatch[1]);
          const configuredAgent = configuredAgents.find((agent) => String(agent.id ?? "").trim() === agentId);
          if (!configuredAgent) {
            writeJson(res, 404, { error: "agent_not_found", entries: [] });
            return;
          }
          try {
            const entries = await readAgentMemoryEntries(config, configuredAgent);
            writeJson(res, 200, { entries });
          } catch {
            writeJson(res, 500, { error: "memory_entries_unavailable", entries: [] });
          }
          return;
        }

        const agentFilesListMatch = pathname.match(/^\/openclaw\/agents\/([^/]+)\/files$/);
        if (method === "GET" && agentFilesListMatch) {
          const agentId = decodeURIComponent(agentFilesListMatch[1]);
          const configuredAgent = configuredAgents.find((agent) => String(agent.id ?? "").trim() === agentId);
          if (!configuredAgent) {
            writeJson(res, 404, { error: "agent_not_found", agentId, workspace: "", files: [] });
            return;
          }
          const workspacePath = path.resolve(resolveWorkspace(config, configuredAgent));
          const files = existsSync(workspacePath) ? await listWorkspaceFilesRecursively(workspacePath) : [];
          writeJson(res, 200, { agentId, workspace: workspacePath, files });
          return;
        }

        const agentFilesGetMatch = pathname.match(/^\/openclaw\/agents\/([^/]+)\/files\/get$/);
        if (method === "GET" && agentFilesGetMatch) {
          const agentId = decodeURIComponent(agentFilesGetMatch[1]);
          const requestedName = url.searchParams.get("name") ?? "";
          const safeName = requestedName.replace(/\\/g, "/").replace(/^\/+/, "");
          if (!safeName || safeName.includes("..")) {
            writeJson(res, 400, { error: "invalid_file_name" });
            return;
          }
          const configuredAgent = configuredAgents.find((agent) => String(agent.id ?? "").trim() === agentId);
          if (!configuredAgent) {
            writeJson(res, 404, { error: "agent_not_found" });
            return;
          }
          const workspacePath = path.resolve(resolveWorkspace(config, configuredAgent));
          const filePath = path.resolve(path.join(workspacePath, safeName));
          if (!filePath.startsWith(workspacePath)) {
            writeJson(res, 400, { error: "invalid_file_path" });
            return;
          }
          if (!existsSync(filePath)) {
            writeJson(res, 404, { error: "file_not_found", agentId, workspace: workspacePath, file: { name: safeName, path: safeName, missing: true } });
            return;
          }
          let content = "";
          try {
            content = await readFile(filePath, "utf-8");
          } catch {
            content = "";
          }
          let size: number | undefined;
          let updatedAtMs: number | undefined;
          try {
            const fileStat = await stat(filePath);
            size = fileStat.size;
            updatedAtMs = fileStat.mtimeMs;
          } catch {
            // best effort metadata only
          }
          writeJson(res, 200, {
            agentId,
            workspace: workspacePath,
            file: {
              name: safeName,
              path: safeName,
              missing: false,
              ...(typeof size === "number" ? { size } : {}),
              ...(typeof updatedAtMs === "number" ? { updatedAtMs } : {}),
              content,
            },
          });
          return;
        }

        const agentFilesRawMatch = pathname.match(/^\/openclaw\/agents\/([^/]+)\/files\/raw$/);
        if (method === "GET" && agentFilesRawMatch) {
          const agentId = decodeURIComponent(agentFilesRawMatch[1]);
          const requestedName = url.searchParams.get("name") ?? "";
          const safeName = requestedName.replace(/\\/g, "/").replace(/^\/+/, "");
          if (!safeName || safeName.includes("..")) {
            writeJson(res, 400, { error: "invalid_file_name" });
            return;
          }
          const configuredAgent = configuredAgents.find((agent) => String(agent.id ?? "").trim() === agentId);
          if (!configuredAgent) {
            writeJson(res, 404, { error: "agent_not_found" });
            return;
          }
          const workspacePath = path.resolve(resolveWorkspace(config, configuredAgent));
          const filePath = path.resolve(path.join(workspacePath, safeName));
          if (!filePath.startsWith(workspacePath)) {
            writeJson(res, 400, { error: "invalid_file_path" });
            return;
          }
          if (!existsSync(filePath)) {
            writeJson(res, 404, { error: "file_not_found" });
            return;
          }

          let bytes: Buffer;
          try {
            bytes = await readFile(filePath);
          } catch {
            writeJson(res, 500, { error: "file_read_failed" });
            return;
          }

          const ext = path.extname(filePath).toLowerCase();
          const mimeByExt: Record<string, string> = {
            ".mp4": "video/mp4",
            ".webm": "video/webm",
            ".ogg": "video/ogg",
            ".mov": "video/quicktime",
          };
          const mime = mimeByExt[ext] ?? "application/octet-stream";
          res.setHeader("content-type", mime);
          res.setHeader("cache-control", "no-store");
          (res as { statusCode?: number }).statusCode = 200;
          (res as { end: (body: Buffer) => void }).end(bytes);
          return;
        }

        const eventsMatch = pathname.match(/^\/openclaw\/agents\/([^/]+)\/sessions\/([^/]+)\/events$/);
        if (method === "GET" && eventsMatch) {
          const agentId = decodeURIComponent(eventsMatch[1]);
          const sessionKey = decodeURIComponent(eventsMatch[2]);
          const requestedLimit = Number(url.searchParams.get("limit") ?? "200");
          const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(500, Math.floor(requestedLimit))) : 200;
          const timelineData = await readSessionTimelineData(agentId, sessionKey, limit);
          writeJson(res, 200, {
            timeline: {
              agentId,
              sessionKey,
              events: timelineData.events,
              usageSummary: timelineData.usageSummary,
              tokenUsage: timelineData.usageSummary
                ? {
                    inputTokens: timelineData.usageSummary.sessionTotals.inputTokens,
                    outputTokens: timelineData.usageSummary.sessionTotals.outputTokens,
                    totalTokens: timelineData.usageSummary.sessionTotals.totalTokens,
                    cacheReadTokens: timelineData.usageSummary.sessionTotals.cacheReadTokens,
                    cacheWriteTokens: timelineData.usageSummary.sessionTotals.cacheWriteTokens,
                    estimatedCostUsd: timelineData.usageSummary.sessionTotals.estimatedCostUsd,
                  }
                : undefined,
            },
          });
          return;
        }

        if (method === "POST" && pathname === "/openclaw/chat/send") {
          const body = (await readBody(req)) as JsonObject;
          const agentId = String(body.agentId ?? "").trim();
          const sessionKey = String(body.sessionKey ?? "").trim();
          const message = String(body.message ?? "").trim();
          if (!agentId || !sessionKey || !message) {
            writeJson(res, 400, { ok: false, error: "chat_send_invalid_payload" });
            return;
          }
          const sessions = await readAgentSessionsIndex(agentId);
          const sessionRow = sessions[sessionKey];
          if (!sessionRow) {
            writeJson(res, 404, { ok: false, error: "chat_send_session_not_found" });
            return;
          }
          const transcriptPath = resolveSessionTranscriptPath(agentId, sessionRow);
          if (!transcriptPath) {
            writeJson(res, 404, { ok: false, error: "chat_send_transcript_missing" });
            return;
          }
          const nowIso = new Date().toISOString();
          const eventId = `ui-${Date.now().toString(36)}`;
          const payload = {
            type: "message",
            id: eventId,
            parentId: null,
            timestamp: nowIso,
            source: "ui",
            message: {
              role: "user",
              content: [{ type: "text", text: message }],
              timestamp: Date.now(),
            },
          };
          await mkdir(path.dirname(transcriptPath), { recursive: true });
          const existingTranscript = existsSync(transcriptPath) ? await readFile(transcriptPath, "utf-8") : "";
          const nextTranscript = `${existingTranscript}${existingTranscript.endsWith("\n") || existingTranscript.length === 0 ? "" : "\n"}${JSON.stringify(payload)}\n`;
          await writeFile(transcriptPath, nextTranscript, "utf-8");
          sessions[sessionKey] = {
            ...sessionRow,
            updatedAt: Date.now(),
            lastTo: "Farplane UI",
          };
          const sessionsPath = path.join(OPENCLAW_HOME, "agents", agentId, "sessions", "sessions.json");
          await writeFile(sessionsPath, `${JSON.stringify(sessions, null, 2)}\n`, "utf-8");
          writeJson(res, 200, { ok: true, eventId });
          return;
        }

        if (method === "GET" && pathname === "/openclaw/skills/global-inventory") {
          const sharedSkills = await readInstalledSkillDirectories(
            path.join(OPENCLAW_HOME, "skills"),
            "shared",
          );
          writeJson(res, 200, { sharedSkills });
          return;
        }

        if (method === "GET" && pathname === "/openclaw/skills/agent-inventory") {
          const agentId = String(url.searchParams.get("agentId") ?? "").trim();
          if (!agentId) {
            writeJson(res, 400, { ok: false, error: "agent_id_required" });
            return;
          }
          const workspacePath = await resolveAgentWorkspacePath(agentId);
          const workspaceSkills = await readInstalledSkillDirectories(
            path.join(workspacePath, "skills"),
            "agent",
          );
          const sharedSkills = await readInstalledSkillDirectories(
            path.join(OPENCLAW_HOME, "skills"),
            "shared",
          );
          writeJson(res, 200, { agentId, workspacePath, workspaceSkills, sharedSkills });
          return;
        }

        if (method === "POST" && pathname === "/openclaw/skills/install-workspace") {
          if (!hasBridgeWriteAccess(req)) {
            writeJson(res, 403, { ok: false, error: "forbidden" });
            return;
          }
          const body = (await readBody(req)) as JsonObject;
          const agentId = String(body.agentId ?? "").trim();
          const skillId = String(body.skillId ?? "").trim();
          if (!agentId || !skillId) {
            writeJson(res, 400, { ok: false, error: "skill_install_invalid_payload" });
            return;
          }
          const sourceDir = await resolveRepoSkillDirectory(skillId);
          if (!sourceDir) {
            writeJson(res, 404, { ok: false, error: "skill_source_not_found" });
            return;
          }
          const workspacePath = await resolveAgentWorkspacePath(agentId);
          const destinationDir = path.join(workspacePath, "skills", skillId);
          await mkdir(path.dirname(destinationDir), { recursive: true });
          await cp(sourceDir, destinationDir, { recursive: true, force: true });
          writeJson(res, 200, { ok: true });
          return;
        }

        if (method === "POST" && pathname === "/openclaw/skills/remove-workspace") {
          if (!hasBridgeWriteAccess(req)) {
            writeJson(res, 403, { ok: false, error: "forbidden" });
            return;
          }
          const body = (await readBody(req)) as JsonObject;
          const agentId = String(body.agentId ?? "").trim();
          const skillId = String(body.skillId ?? "").trim();
          if (!agentId || !skillId) {
            writeJson(res, 400, { ok: false, error: "skill_remove_invalid_payload" });
            return;
          }
          const workspacePath = await resolveAgentWorkspacePath(agentId);
          const destinationDir = path.join(workspacePath, "skills", skillId);
          await rm(destinationDir, { recursive: true, force: true });
          writeJson(res, 200, { ok: true });
          return;
        }

        if (method === "GET" && pathname === "/openclaw/skills") {
          const catalog = await listCombinedSkillStudioCatalog();
          writeJson(res, 200, {
            skills: catalog.map((entry) => ({
              name: entry.skillId,
              category: entry.category,
              scope: entry.scope,
              sourcePath: entry.sourcePath,
              updatedAt: entry.updatedAt,
            })),
          });
          return;
        }

        if (method === "GET" && pathname === "/openclaw/skills/catalog") {
          const skills = await listCombinedSkillStudioCatalog();
          writeJson(res, 200, { skills });
          return;
        }

        if (method === "GET" && pathname === "/openclaw/memory") {
          writeJson(res, 200, { memory: [] });
          return;
        }

        const skillDetailMatch = pathname.match(/^\/openclaw\/skills\/([^/]+)$/);
        if (method === "GET" && skillDetailMatch) {
          const skillId = decodeURIComponent(skillDetailMatch[1]);
          const skill = await getCombinedSkillStudioDetail(skillId, url.searchParams.get("agentId") ?? undefined);
          if (!skill) {
            writeJson(res, 404, { error: "skill_not_found" });
            return;
          }
          writeJson(res, 200, { skill });
          return;
        }

        const skillFileMatch = pathname.match(/^\/openclaw\/skills\/([^/]+)\/file$/);
        if (method === "GET" && skillFileMatch) {
          const skillId = decodeURIComponent(skillFileMatch[1]);
          const filePath = url.searchParams.get("path") ?? "";
          if (!filePath.trim()) {
            writeJson(res, 400, { error: "skill_file_path_required" });
            return;
          }
          const skillRoot = await resolveSkillStudioRoot(skillId);
          const file = skillRoot ? await readSkillStudioFile(skillRoot, REPO_ROOT, skillId, filePath) : null;
          if (!file) {
            writeJson(res, 404, { error: "skill_file_not_found" });
            return;
          }
          writeJson(res, 200, { file });
          return;
        }
        if (method === "POST" && skillFileMatch) {
          if (!hasBridgeWriteAccess(req)) {
            writeJson(res, 403, { error: "forbidden" });
            return;
          }
          const skillId = decodeURIComponent(skillFileMatch[1]);
          const body = (await readBody(req)) as JsonObject;
          const filePath = String(body.path ?? "").trim();
          if (!filePath) {
            writeJson(res, 400, { error: "skill_file_path_required" });
            return;
          }
          if (typeof body.content !== "string") {
            writeJson(res, 400, { error: "skill_file_content_required" });
            return;
          }
          const skillRoot = await resolveSkillStudioRoot(skillId);
          const file = skillRoot
            ? await saveSkillStudioFile(skillRoot, REPO_ROOT, skillId, filePath, body.content)
            : null;
          if (!file) {
            writeJson(res, 404, { error: "skill_file_not_writable" });
            return;
          }
          writeJson(res, 200, { file });
          return;
        }

        const skillDemoRunMatch = pathname.match(/^\/openclaw\/skills\/([^/]+)\/demos\/run$/);
        if (method === "POST" && skillDemoRunMatch) {
          const skillId = decodeURIComponent(skillDemoRunMatch[1]);
          const body = (await readBody(req)) as JsonObject;
          const caseId = String(body.caseId ?? "").trim();
          if (!caseId) {
            writeJson(res, 400, { error: "skill_demo_case_required" });
            return;
          }
          const skillRoot = await resolveSkillStudioRoot(skillId);
          const run = skillRoot ? await runSkillStudioDemo(skillRoot, REPO_ROOT, skillId, caseId) : null;
          if (!run) {
            writeJson(res, 404, { error: "skill_demo_not_found" });
            return;
          }
          writeJson(res, 200, { run });
          return;
        }

        const skillConfigMatch = pathname.match(/^\/openclaw\/skills\/([^/]+)\/config$/);
        if (method === "POST" && skillConfigMatch) {
          if (!hasBridgeWriteAccess(req)) {
            writeJson(res, 403, { error: "forbidden" });
            return;
          }
          const skillId = decodeURIComponent(skillConfigMatch[1]);
          const body = (await readBody(req)) as JsonObject;
          const skillRoot = await resolveSkillStudioRoot(skillId);
          const skill = skillRoot
            ? await saveSkillStudioManifest(skillRoot, REPO_ROOT, skillId, {
                manifest:
                  body.manifest && typeof body.manifest === "object"
                    ? (body.manifest as Record<string, unknown> as never)
                    : undefined,
                rawYaml: typeof body.rawYaml === "string" ? body.rawYaml : undefined,
              })
            : null;
          if (!skill) {
            writeJson(res, 404, { error: "skill_not_found" });
            return;
          }
          writeJson(res, 200, { skill });
          return;
        }

        if (method === "GET" && pathname === "/openclaw/company-model") {
          const company = await readCompanyModelWithSeed();
          writeJson(res, 200, { company });
          return;
        }

        if (method === "GET" && pathname === "/openclaw/office-objects") {
          let objects = normalizeOfficeObjects(await readJsonFile<unknown[]>(OFFICE_OBJECTS_PATH, []));
          if (objects.length === 0) {
            const seeded = await readJsonFile<unknown[]>(OFFICE_OBJECTS_TEMPLATE_PATH, []);
            objects = normalizeOfficeObjects(seeded);
            if (objects.length > 0) {
              await mkdir(path.dirname(OFFICE_OBJECTS_PATH), { recursive: true });
              await writeFile(OFFICE_OBJECTS_PATH, `${JSON.stringify(objects, null, 2)}\n`, "utf-8");
            }
          }
          writeJson(res, 200, { objects });
          return;
        }

        if (method === "GET" && pathname === "/openclaw/office-settings") {
          const settings = await readOfficeSettings();
          writeJson(res, 200, { settings });
          return;
        }

        if (method === "POST" && pathname === "/openclaw/office-settings") {
          const body = (await readBody(req)) as JsonObject;
          const settings = normalizeOfficeSettings(body.settings ?? body);
          await mkdir(path.dirname(OFFICE_SETTINGS_PATH), { recursive: true });
          await writeFile(OFFICE_SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`, "utf-8");
          writeJson(res, 200, { ok: true, settings });
          return;
        }

        if (method === "GET" && pathname === "/openclaw/mesh-assets") {
          const settings = await readOfficeSettings();
          const assets = await listMeshAssets(settings.meshAssetDir ?? DEFAULT_MESH_ASSET_DIR);
          writeJson(res, 200, { assets, meshAssetDir: settings.meshAssetDir ?? DEFAULT_MESH_ASSET_DIR });
          return;
        }

        if (method === "POST" && pathname === "/openclaw/mesh-assets/download") {
          const body = (await readBody(req)) as JsonObject;
          const sourceUrl = typeof body.url === "string" ? body.url.trim() : "";
          const label = typeof body.label === "string" ? body.label : "";
          if (!sourceUrl) {
            writeJson(res, 400, { ok: false, error: "mesh_url_required" });
            return;
          }
          let parsedUrl: URL;
          try {
            parsedUrl = new URL(sourceUrl);
          } catch {
            writeJson(res, 400, { ok: false, error: "mesh_url_invalid" });
            return;
          }
          if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
            writeJson(res, 400, { ok: false, error: "mesh_url_protocol_invalid" });
            return;
          }

          const settings = await readOfficeSettings();
          const meshAssetDir = settings.meshAssetDir ?? DEFAULT_MESH_ASSET_DIR;
          await mkdir(meshAssetDir, { recursive: true });
          const ext = inferMeshExtensionFromUrl(sourceUrl);
          const desiredName = `${sanitizeLabelToFileBase(label || path.basename(parsedUrl.pathname, path.extname(parsedUrl.pathname)))}${ext}`;
          const targetPath = await toUniqueFilePath(meshAssetDir, desiredName);

          let response: Response;
          try {
            response = await fetch(sourceUrl);
          } catch {
            writeJson(res, 502, { ok: false, error: "mesh_download_unreachable" });
            return;
          }
          if (!response.ok) {
            writeJson(res, 502, { ok: false, error: `mesh_download_failed:${response.status}` });
            return;
          }
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          await writeFile(targetPath, buffer);
          const fileName = path.basename(targetPath);
          const fileStat = await stat(targetPath);

          writeJson(res, 200, {
            ok: true,
            asset: {
              assetId: fileName,
              label: path.basename(fileName, path.extname(fileName)),
              sourceUrl,
              localPath: targetPath,
              publicPath: asMeshPublicPath(fileName),
              fileName,
              fileSizeBytes: fileStat.size,
              sourceType: "downloaded",
              validated: true,
              addedAt: fileStat.mtimeMs,
            },
          });
          return;
        }

        if (method === "POST" && pathname === "/openclaw/mesh-assets/generate-meshy") {
          const body = (await readBody(req)) as JsonObject;
          const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
          const stylePrompt = typeof body.stylePrompt === "string" ? body.stylePrompt.trim() : "";
          const requestedLabel = typeof body.label === "string" ? body.label.trim() : "";
          if (!prompt) {
            writeJson(res, 400, { ok: false, error: "meshy_prompt_required" });
            return;
          }
          if (!getMeshyApiKey()) {
            writeJson(res, 503, { ok: false, error: "meshy_api_key_missing" });
            return;
          }

          const requestAbortController = new AbortController();
          req.on("close", () => {
            requestAbortController.abort();
          });

          try {
            const previewTaskId = await createMeshyPreviewTask(
              prompt,
              requestAbortController.signal,
            );
            const previewTask = await pollMeshyTask(
              previewTaskId,
              requestAbortController.signal,
            );
            if (previewTask.status !== "SUCCEEDED") {
              writeJson(res, 502, {
                ok: false,
                error: previewTask.task_error?.message ?? "meshy_preview_failed",
              });
              return;
            }

            let modelUrl = previewTask.model_urls?.glb?.trim() ?? "";
            if (stylePrompt && modelUrl) {
              const refineTaskId = await createMeshyRefineTask(
                previewTaskId,
                stylePrompt,
                requestAbortController.signal,
              );
              const refineTask = await pollMeshyTask(
                refineTaskId,
                requestAbortController.signal,
              );
              if (refineTask.status === "SUCCEEDED" && refineTask.model_urls?.glb) {
                modelUrl = refineTask.model_urls.glb.trim();
              }
            }

            if (!modelUrl) {
              writeJson(res, 502, { ok: false, error: "meshy_glb_missing" });
              return;
            }

            const settings = await readOfficeSettings();
            const meshAssetDir = settings.meshAssetDir ?? DEFAULT_MESH_ASSET_DIR;
            await mkdir(meshAssetDir, { recursive: true });
            const label =
              requestedLabel ||
              prompt.slice(0, 40).replace(/[^a-zA-Z0-9\s-]/g, "").trim() ||
              "meshy-model";
            const ext = inferMeshExtensionFromUrl(modelUrl);
            const desiredName = `${sanitizeLabelToFileBase(label)}${ext}`;
            const targetPath = await toUniqueFilePath(meshAssetDir, desiredName);

            const downloadResponse = await fetch(modelUrl, {
              signal: requestAbortController.signal,
            });
            if (!downloadResponse.ok) {
              writeJson(res, 502, {
                ok: false,
                error: `mesh_download_failed:${downloadResponse.status}`,
              });
              return;
            }
            const buffer = Buffer.from(await downloadResponse.arrayBuffer());
            await writeFile(targetPath, buffer);
            const fileName = path.basename(targetPath);
            const fileStat = await stat(targetPath);

            writeJson(res, 200, {
              ok: true,
              asset: {
                assetId: fileName,
                label: path.basename(fileName, path.extname(fileName)),
                localPath: targetPath,
                publicPath: asMeshPublicPath(fileName),
                fileName,
                fileSizeBytes: fileStat.size,
                sourceType: "local",
                validated: true,
                addedAt: fileStat.mtimeMs,
              } satisfies JsonObject,
            });
            return;
          } catch (error) {
            if (requestAbortController.signal.aborted) {
              return;
            }
            writeJson(res, 502, {
              ok: false,
              error: error instanceof Error ? error.message : "mesh_generation_failed",
            });
            return;
          }
        }

        const meshAssetMatch = pathname.match(/^\/openclaw\/assets\/meshes\/([^/]+)$/);
        if (method === "GET" && meshAssetMatch) {
          const fileName = decodeURIComponent(meshAssetMatch[1]);
          if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
            writeJson(res, 400, { ok: false, error: "mesh_asset_path_invalid" });
            return;
          }
          const settings = await readOfficeSettings();
          const meshAssetDir = settings.meshAssetDir ?? DEFAULT_MESH_ASSET_DIR;
          const filePath = path.join(meshAssetDir, fileName);
          const ext = path.extname(fileName).toLowerCase();
          const isMeshFile = MESH_EXTENSIONS.has(ext);
          const isPreviewFile = MESH_PREVIEW_EXTENSIONS.has(ext) && fileName.includes(".preview.");
          const isMetadataFile = ext === ".json" && fileName.endsWith(".meta.json");
          if (!isMeshFile && !isPreviewFile && !isMetadataFile) {
            writeJson(res, 400, { ok: false, error: "mesh_asset_extension_invalid" });
            return;
          }
          try {
            const bytes = await readFile(filePath);
            if (ext === ".gltf") {
              res.setHeader("content-type", "model/gltf+json");
            } else if (ext === ".glb") {
              res.setHeader("content-type", "model/gltf-binary");
            } else if (ext === ".png") {
              res.setHeader("content-type", "image/png");
            } else if (ext === ".jpg" || ext === ".jpeg") {
              res.setHeader("content-type", "image/jpeg");
            } else if (ext === ".webp") {
              res.setHeader("content-type", "image/webp");
            } else if (ext === ".json") {
              res.setHeader("content-type", "application/json");
            }
            (res as { statusCode?: number }).statusCode = 200;
            (res as { end: (body: Buffer) => void }).end(bytes);
          } catch {
            writeJson(res, 404, { ok: false, error: "mesh_asset_not_found" });
          }
          return;
        }

        const codexPetAssetMatch = pathname.match(/^\/codex\/pets\/([^/]+)\/([^/]+)$/);
        if (method === "GET" && codexPetAssetMatch) {
          const petId = decodeURIComponent(codexPetAssetMatch[1]);
          const fileName = decodeURIComponent(codexPetAssetMatch[2]);
          if (!isSafeCodexPetSegment(petId) || !isSafeCodexPetSegment(fileName)) {
            writeJson(res, 400, { ok: false, error: "codex_pet_path_invalid" });
            return;
          }

          const ext = path.extname(fileName).toLowerCase();
          if (!CODEX_PET_ASSET_EXTENSIONS.has(ext)) {
            writeJson(res, 400, { ok: false, error: "codex_pet_extension_invalid" });
            return;
          }
          if (fileName !== "pet.json" && ext === ".json") {
            writeJson(res, 400, { ok: false, error: "codex_pet_json_invalid" });
            return;
          }

          const filePath = path.join(CODEX_HOME, "pets", petId, fileName);
          try {
            const bytes = await readFile(filePath);
            if (ext === ".png") {
              res.setHeader("content-type", "image/png");
            } else if (ext === ".webp") {
              res.setHeader("content-type", "image/webp");
            } else {
              res.setHeader("content-type", "application/json");
            }
            res.setHeader("cache-control", "no-store");
            (res as { statusCode?: number }).statusCode = 200;
            (res as { end: (body: Buffer) => void }).end(bytes);
          } catch {
            writeJson(res, 404, { ok: false, error: "codex_pet_asset_not_found" });
          }
          return;
        }

        if (method === "POST" && pathname === "/openclaw/office-objects") {
          if (!hasBridgeWriteAccess(req)) {
            writeJson(res, 403, { ok: false, error: "forbidden" });
            return;
          }
          const body = (await readBody(req)) as JsonObject;
          const input = Array.isArray(body.objects) ? body.objects : [];
          const objects = normalizeOfficeObjects(input);
          await mkdir(path.dirname(OFFICE_OBJECTS_PATH), { recursive: true });
          await writeFile(OFFICE_OBJECTS_PATH, `${JSON.stringify(objects, null, 2)}\n`, "utf-8");
          writeJson(res, 200, { ok: true, objects });
          return;
        }

        if (method === "POST" && pathname === "/farplane/office-objects/shuffle") {
          if (!hasBridgeWriteAccess(req)) {
            writeJson(res, 403, { ok: false, error: "forbidden" });
            return;
          }
          const body = (await readBody(req)) as JsonObject;
          const currentObjects = normalizeOfficeObjects(
            await readJsonFile<unknown[]>(OFFICE_OBJECTS_PATH, []),
          ) as unknown as OfficeObjectModel[];
          const hasExplicitObjects = Array.isArray(body.objects);
          const inputObjects = hasExplicitObjects ? (body.objects as unknown[]) : currentObjects;
          const objects = normalizeOfficeObjects(inputObjects) as unknown as OfficeObjectModel[];
          const seed =
            typeof body.seed === "string" || typeof body.seed === "number" ? body.seed : Date.now();
          try {
            const officeSettings = (await readOfficeSettings()) as OfficeSettingsModel;
            const candidates = getOfficeLayoutCandidatePositions(officeSettings);
            const canPlaceObject = (
              object: OfficeObjectModel,
              placedObjects: OfficeObjectModel[],
            ) =>
              findLiveLayoutPlacementViolations({
                objects: [...placedObjects, object],
                officeSettings,
              }).length === 0;
            const arranged = shuffleOfficeObjects(objects, {
              seed,
              teamCandidates: candidates,
              decorCandidates: candidates,
              canPlaceObject,
            });
            const placementViolations = findLiveLayoutPlacementViolations({
              objects: arranged.objects,
              officeSettings,
            });
            if (placementViolations.length > 0) {
              writeJson(res, 409, {
                ok: false,
                error: "office_shuffle_layout_invalid",
                placementViolationCount: placementViolations.length,
                placementViolations,
              });
              return;
            }
            const arrangedById = new Map(arranged.objects.map((object) => [object.id, object]));
            const currentIds = new Set(currentObjects.map((object) => object.id));
            const mergedObjects = hasExplicitObjects
              ? [
                  ...currentObjects.map((object) => arrangedById.get(object.id) ?? object),
                  ...arranged.objects.filter((object) => !currentIds.has(object.id)),
                ]
              : arranged.objects;
            await mkdir(path.dirname(OFFICE_OBJECTS_PATH), { recursive: true });
            await writeFile(
              OFFICE_OBJECTS_PATH,
              `${JSON.stringify(mergedObjects, null, 2)}\n`,
              "utf-8",
            );
            writeJson(res, 200, {
              ok: true,
              seed,
              objects: mergedObjects,
              movedCount: arranged.moved.length,
              moved: arranged.moved,
              placementViolationCount: placementViolations.length,
            });
          } catch (error) {
            writeJson(res, 409, {
              ok: false,
              error: error instanceof Error ? error.message : "office_shuffle_failed",
            });
          }
          return;
        }

        if (method === "POST" && pathname === "/openclaw/company-model") {
          if (!hasBridgeWriteAccess(req)) {
            writeJson(res, 403, { ok: false, error: "forbidden" });
            return;
          }
          const body = (await readBody(req)) as JsonObject;
          const company = (body.company as JsonObject | undefined) ?? {};
          const tasks = Array.isArray(company.tasks) ? normalizeFederatedTasks(company.tasks) : [];
          await mkdir(path.dirname(COMPANY_MODEL_PATH), { recursive: true });
          const normalizedCompany = {
            ...company,
            tasks,
            federationPolicies: Array.isArray(company.federationPolicies) ? company.federationPolicies : [],
            providerIndexProfiles: Array.isArray(company.providerIndexProfiles) ? company.providerIndexProfiles : [],
          };
          await writeFile(COMPANY_MODEL_PATH, `${JSON.stringify(normalizedCompany, null, 2)}\n`, "utf-8");
          writeJson(res, 200, { ok: true, company: normalizedCompany });
          return;
        }

        if (method === "POST" && pathname === "/openclaw/team/create") {
          if (!hasBridgeWriteAccess(req)) {
            writeJson(res, 403, { ok: false, error: "forbidden" });
            return;
          }
          const body = (await readBody(req)) as JsonObject;
          const name = typeof body.name === "string" ? body.name.trim() : "";
          const description = typeof body.description === "string" ? body.description.trim() : "";
          const goal = typeof body.goal === "string" ? body.goal.trim() : "";
          const kpis = normalizeKpiList(body.kpis);
          const businessType = normalizeBusinessType(body.businessType);
          const capabilitySkills =
            body.capabilitySkills && typeof body.capabilitySkills === "object"
              ? {
                  measure:
                    typeof (body.capabilitySkills as JsonObject).measure === "string"
                      ? String((body.capabilitySkills as JsonObject).measure)
                      : undefined,
                  execute:
                    typeof (body.capabilitySkills as JsonObject).execute === "string"
                      ? String((body.capabilitySkills as JsonObject).execute)
                      : undefined,
                  distribute:
                    typeof (body.capabilitySkills as JsonObject).distribute === "string"
                      ? String((body.capabilitySkills as JsonObject).distribute)
                      : undefined,
                }
              : undefined;
          const autoRoles = businessType ? (["biz_pm", "biz_executor"] satisfies TeamRole[]) : normalizeTeamRoles(body.autoRoles);
          const registerOpenclawAgents = body.registerOpenclawAgents === true;
          const withCluster = body.withCluster !== false;
          if (!name || !goal) {
            writeJson(res, 400, { ok: false, error: "team_create_invalid_payload" });
            return;
          }

          const slug = toSlug(name) || `team-${Date.now()}`;
          const teamId = typeof body.teamId === "string" && body.teamId.trim() ? body.teamId.trim() : `team-proj-${slug}`;
          const projectId = projectIdFromTeamId(teamId);

          let company = await readCompanyModelWithSeed();
          if (businessType) {
            company = ensureBusinessHeartbeatProfiles(company);
          }
          const projects = Array.isArray(company.projects) ? [...company.projects] : [];
          if (projects.some((entry) => entry && typeof entry === "object" && String((entry as JsonObject).id ?? "").trim() === projectId)) {
            writeJson(res, 409, { ok: false, error: "team_already_exists", teamId, projectId });
            return;
          }
          const departments = Array.isArray(company.departments) ? company.departments : [];
          const deptProducts = departments.find((entry) => entry && typeof entry === "object" && String((entry as JsonObject).id ?? "") === "dept-products");
          const fallbackDepartmentId = String((deptProducts as JsonObject | undefined)?.id ?? (departments[0] && typeof departments[0] === "object" ? String((departments[0] as JsonObject).id ?? "dept-products") : "dept-products"));

          const nextProject = {
            id: projectId,
            departmentId: fallbackDepartmentId,
            name,
            githubUrl: "",
            status: "active",
            goal,
            kpis,
            ...(businessType ? { businessConfig: defaultBusinessConfig(businessType, capabilitySkills) } : {}),
            account: {
              id: `${projectId}:account`,
              projectId,
              currency: "USD",
              balanceCents: 0,
              updatedAt: new Date().toISOString(),
            },
            accountEvents: [],
            ledger: [],
            experiments: [],
            metricEvents: [],
            resources: businessType ? defaultProjectResources(projectId) : [],
            resourceEvents: [],
          } satisfies JsonObject;

          const agents = Array.isArray(company.agents) ? [...company.agents] : [];
          const roleSlots = Array.isArray(company.roleSlots) ? [...company.roleSlots] : [];
          for (const role of autoRoles) {
            const agentId = `${slug}-${roleSuffix(role)}`;
            agents.push({
              agentId,
              role,
              projectId,
              heartbeatProfileId: defaultHeartbeatProfileIdForRole(role),
              lifecycleState: "pending_spawn",
              isCeo: false,
            } satisfies JsonObject);
            roleSlots.push({
              projectId,
              role,
              desiredCount: 1,
              spawnPolicy: "queue_pressure",
            } satisfies JsonObject);
          }

          const nextCompany = {
            ...company,
            projects: [...projects, nextProject],
            agents,
            roleSlots,
            federationPolicies: Array.isArray(company.federationPolicies) ? company.federationPolicies : [],
            providerIndexProfiles: Array.isArray(company.providerIndexProfiles) ? company.providerIndexProfiles : [],
            tasks: Array.isArray(company.tasks) ? normalizeFederatedTasks(company.tasks) : [],
          } satisfies JsonObject;
          await mkdir(path.dirname(COMPANY_MODEL_PATH), { recursive: true });
          await writeFile(COMPANY_MODEL_PATH, `${JSON.stringify(nextCompany, null, 2)}\n`, "utf-8");
          const createdAgentIds = autoRoles.map((role) => `${slug}-${roleSuffix(role)}`);

          if (withCluster) {
            const currentObjects = normalizeOfficeObjects(await readJsonFile<unknown[]>(OFFICE_OBJECTS_PATH, []));
            const clusterId = `team-cluster-${teamId}`;
            const nextObjects = currentObjects.filter((entry) => String(entry.id ?? "") !== clusterId);
            nextObjects.push(
              buildNewTeamClusterObject({
                existingObjects: currentObjects,
                teamId,
                name,
                description,
              }) satisfies JsonObject,
            );
            await mkdir(path.dirname(OFFICE_OBJECTS_PATH), { recursive: true });
            await writeFile(OFFICE_OBJECTS_PATH, `${JSON.stringify(nextObjects, null, 2)}\n`, "utf-8");
          }

          if (registerOpenclawAgents && autoRoles.length > 0) {
            const config = await readJsonFile<JsonObject>(OPENCLAW_CONFIG_PATH, {});
            const agentsNode = config.agents && typeof config.agents === "object" ? { ...(config.agents as JsonObject) } : {};
            const list = Array.isArray(agentsNode.list) ? [...(agentsNode.list as JsonObject[])] : [];
            const existing = new Set(list.map((entry) => String((entry as JsonObject).id ?? "").trim()));
            for (const role of autoRoles) {
              const agentId = `${slug}-${roleSuffix(role)}`;
              if (existing.has(agentId)) continue;
              const workspacePath = path.join(OPENCLAW_HOME, "workspace", "products", agentId);
              list.push({
                id: agentId,
                workspace: workspacePath,
                agentDir: path.join(OPENCLAW_HOME, "agents", agentId, "agent"),
              } satisfies JsonObject);
            }
            const nextConfig = { ...config, agents: { ...agentsNode, list } } satisfies JsonObject;
            await mkdir(path.dirname(OPENCLAW_CONFIG_PATH), { recursive: true });
            await writeFile(OPENCLAW_CONFIG_PATH, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf-8");
          }
          if (businessType) {
            for (const agentId of createdAgentIds) {
              const workspacePath = path.join(OPENCLAW_HOME, "workspace", "products", agentId);
              const templatePath = /-pm$/.test(agentId) ? BIZ_PM_HEARTBEAT_TEMPLATE_PATH : BIZ_EXECUTOR_HEARTBEAT_TEMPLATE_PATH;
              try {
                const template = await readFile(templatePath, "utf-8");
                await mkdir(workspacePath, { recursive: true });
                await writeFile(path.join(workspacePath, "HEARTBEAT.md"), template, "utf-8");
              } catch {
                // best-effort workspace template materialization
              }
            }
            await upsertBusinessCronJobsBridge(projectId, createdAgentIds);
          }

          writeJson(res, 200, {
            ok: true,
            teamId,
            projectId,
            createdAgents: createdAgentIds,
          });
          return;
        }

        if (method === "POST" && pathname === "/openclaw/team/heartbeat/render") {
          const body = (await readBody(req)) as JsonObject;
          const teamId = typeof body.teamId === "string" ? body.teamId.trim() : "";
          const role = body.role === "biz_pm" || body.role === "biz_executor" ? body.role : "";
          if (!teamId || !role) {
            writeJson(res, 400, { ok: false, error: "heartbeat_render_invalid_payload" });
            return;
          }
          const projectId = projectIdFromTeamId(teamId);
          const company = await readCompanyModelWithSeed();
          const projects = Array.isArray(company.projects) ? (company.projects as JsonObject[]) : [];
          const project = projects.find((entry) => String(entry.id ?? "") === projectId);
          if (!project) {
            writeJson(res, 404, { ok: false, error: "heartbeat_render_project_not_found" });
            return;
          }
          const templatePath = role === "biz_pm" ? BIZ_PM_HEARTBEAT_TEMPLATE_PATH : BIZ_EXECUTOR_HEARTBEAT_TEMPLATE_PATH;
          try {
            const rawTemplate = await readFile(templatePath, "utf-8");
            const rendered = renderHeartbeatTemplate(rawTemplate, project);
            writeJson(res, 200, { ok: true, rendered });
            return;
          } catch {
            writeJson(res, 500, { ok: false, error: "heartbeat_render_template_unavailable" });
            return;
          }
        }

        if (method === "POST" && pathname === "/openclaw/team/business/equip-skills") {
          if (!hasBridgeWriteAccess(req)) {
            writeJson(res, 403, { ok: false, error: "forbidden" });
            return;
          }
          const body = (await readBody(req)) as JsonObject;
          const teamId = typeof body.teamId === "string" ? body.teamId.trim() : "";
          const mode = body.mode === "append_only" ? "append_only" : "replace_minimum";
          const dryRun = body.dryRun === true;
          if (!teamId) {
            writeJson(res, 400, { ok: false, error: "team_business_skill_sync_invalid_payload" });
            return;
          }
          const projectId = projectIdFromTeamId(teamId);
          const company = await readCompanyModelWithSeed();
          const projects = Array.isArray(company.projects) ? (company.projects as JsonObject[]) : [];
          const project = projects.find((entry) => String(entry.id ?? "").trim() === projectId);
          if (!project) {
            writeJson(res, 404, { ok: false, error: "team_business_skill_sync_project_not_found" });
            return;
          }
          const companyAgents = Array.isArray(company.agents) ? (company.agents as JsonObject[]) : [];
          const pmAgent = companyAgents.find(
            (entry) => String(entry.projectId ?? "").trim() === projectId && String(entry.role ?? "").trim() === "biz_pm",
          );
          const executorAgent = companyAgents.find(
            (entry) => String(entry.projectId ?? "").trim() === projectId && String(entry.role ?? "").trim() === "biz_executor",
          );
          if (!pmAgent || !executorAgent) {
            writeJson(res, 404, { ok: false, error: "team_business_skill_sync_agents_missing" });
            return;
          }
          const pmAgentId = String(pmAgent.agentId ?? "").trim();
          const executorAgentId = String(executorAgent.agentId ?? "").trim();
          if (!pmAgentId || !executorAgentId) {
            writeJson(res, 404, { ok: false, error: "team_business_skill_sync_agents_invalid" });
            return;
          }
          const targets = buildTeamBusinessSkillTargets(project);
          const targetByAgentId = new Map<string, string[]>([
            [pmAgentId, targets.pmSkills],
            [executorAgentId, targets.executorSkills],
          ]);
          const config = await readJsonFile<JsonObject>(OPENCLAW_CONFIG_PATH, {});
          const agentsNode = config.agents && typeof config.agents === "object" ? { ...(config.agents as JsonObject) } : {};
          const list = Array.isArray(agentsNode.list) ? [...(agentsNode.list as JsonObject[])] : [];
          const touchedAgents: string[] = [];
          const missingAgents: string[] = [];
          const preview: JsonObject[] = [];
          const nextList = list.map((entry) => {
            const id = String(entry.id ?? "").trim();
            if (!id || !targetByAgentId.has(id)) return entry;
            const beforeSkills = Array.isArray(entry.skills)
              ? (entry.skills as unknown[]).filter((item): item is string => typeof item === "string")
              : [];
            const afterSkills = applyAgentSkillsByMode(beforeSkills, targetByAgentId.get(id) ?? [], mode);
            touchedAgents.push(id);
            preview.push({
              agentId: id,
              role: id === pmAgentId ? "biz_pm" : "biz_executor",
              mode,
              beforeSkills,
              afterSkills,
            });
            return {
              ...entry,
              skills: afterSkills,
            } satisfies JsonObject;
          });
          for (const id of [pmAgentId, executorAgentId]) {
            if (!touchedAgents.includes(id)) missingAgents.push(id);
          }
          if (!dryRun) {
            const nextConfig = {
              ...config,
              agents: {
                ...agentsNode,
                list: nextList,
              },
            } satisfies JsonObject;
            await mkdir(path.dirname(OPENCLAW_CONFIG_PATH), { recursive: true });
            await writeFile(OPENCLAW_CONFIG_PATH, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf-8");
          }
          writeJson(res, 200, {
            ok: true,
            teamId,
            projectId,
            mode,
            dryRun,
            touchedAgents,
            missingAgents,
            preview,
          });
          return;
        }

        if (method === "POST" && pathname === "/openclaw/config/preview") {
          const body = (await readBody(req)) as JsonObject;
          const nextConfig = (body.nextConfig as JsonObject | undefined) ?? {};
          writeJson(res, 200, {
            summary: "preview generated by local state bridge",
            diffText: JSON.stringify(nextConfig, null, 2),
          });
          return;
        }

        if (method === "POST" && pathname === "/openclaw/config/apply") {
          const body = (await readBody(req)) as JsonObject;
          const nextConfig = (body.nextConfig as JsonObject | undefined) ?? {};
          await mkdir(path.dirname(OPENCLAW_CONFIG_PATH), { recursive: true });
          await writeFile(OPENCLAW_CONFIG_PATH, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf-8");
          writeJson(res, 200, { ok: true });
          return;
        }

        if (method === "POST" && pathname === "/openclaw/config/rollback") {
          const backupPath = `${OPENCLAW_CONFIG_PATH}.bak`;
          if (!existsSync(backupPath)) {
            writeJson(res, 200, { ok: false, error: "rollback_backup_missing" });
            return;
          }
          const backupContent = await readFile(backupPath, "utf-8");
          await writeFile(OPENCLAW_CONFIG_PATH, backupContent, "utf-8");
          writeJson(res, 200, { ok: true });
          return;
        }

        if (method === "GET" && pathname === "/openclaw/pending-approvals") {
          let approvals = await readJsonFile<unknown[]>(PENDING_APPROVALS_PATH, []);
          if (!Array.isArray(approvals)) approvals = [];
          if (approvals.length === 0) {
            const seeded = await readJsonFile<unknown[]>(PENDING_APPROVALS_TEMPLATE_PATH, []);
            if (Array.isArray(seeded) && seeded.length > 0) {
              approvals = seeded;
              await mkdir(path.dirname(PENDING_APPROVALS_PATH), { recursive: true });
              await writeFile(PENDING_APPROVALS_PATH, `${JSON.stringify(approvals, null, 2)}\n`, "utf-8");
            }
          }
          const pending = approvals.filter(
            (entry) => entry && typeof entry === "object" && (entry as JsonObject).status === "pending",
          );
          writeJson(res, 200, { approvals: pending });
          return;
        }

        if (method === "POST" && pathname === "/openclaw/pending-approvals/resolve") {
          if (!hasBridgeWriteAccess(req)) {
            writeJson(res, 403, { ok: false, error: "forbidden" });
            return;
          }
          const body = (await readBody(req)) as JsonObject;
          const approvalId = String(body.id ?? "").trim();
          const decision = String(body.decision ?? "").trim();
          if (!approvalId || (decision !== "approved" && decision !== "rejected")) {
            writeJson(res, 400, { ok: false, error: "invalid_request: need id and decision (approved|rejected)" });
            return;
          }
          let approvals = await readJsonFile<unknown[]>(PENDING_APPROVALS_PATH, []);
          if (!Array.isArray(approvals)) approvals = [];
          let found = false;
          const updated = approvals.map((entry) => {
            if (entry && typeof entry === "object" && (entry as JsonObject).id === approvalId) {
              found = true;
              return { ...(entry as JsonObject), status: decision, resolvedAt: Date.now() };
            }
            return entry;
          });
          if (!found) {
            writeJson(res, 404, { ok: false, error: "approval_not_found" });
            return;
          }
          await mkdir(path.dirname(PENDING_APPROVALS_PATH), { recursive: true });
          await writeFile(PENDING_APPROVALS_PATH, `${JSON.stringify(updated, null, 2)}\n`, "utf-8");
          writeJson(res, 200, { ok: true });
          return;
        }

        writeJson(res, 404, { ok: false, error: `state_bridge_route_not_found:${pathname}` });
      });
    },
  };
}

export default defineConfig({
  root: __dirname,
  define: {
    "import.meta.env.VITE_CONVEX_URL": JSON.stringify(VITE_CONVEX_URL),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      react: path.resolve(REPO_ROOT, "node_modules/react"),
      "react/jsx-dev-runtime": path.resolve(REPO_ROOT, "node_modules/react/jsx-dev-runtime.js"),
      "react/jsx-runtime": path.resolve(REPO_ROOT, "node_modules/react/jsx-runtime.js"),
      "react-dom": path.resolve(REPO_ROOT, "node_modules/react-dom"),
      "react-dom/client": path.resolve(REPO_ROOT, "node_modules/react-dom/client.js"),
      three: path.resolve(REPO_ROOT, "node_modules/three"),
    },
    dedupe: ["react", "react-dom", "three", "@react-three/fiber", "@react-three/drei"],
  },
  optimizeDeps: {
    include: [
      "react",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-dom",
      "react-dom/client",
      "three",
    ],
  },
  plugins: [farplaneStateBridge(), tailwindcss(), react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
