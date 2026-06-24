/**
 * THREAD COMMANDS
 * ===============
 * Ownership: Farplane UI module CLI.
 * Inputs: Codex app-server thread metadata and Convex hook telemetry endpoint config.
 * Outputs: explicit parentThreadId lineage backfill rows for the existing Threads graph.
 * Side effects: optional HTTP POST to `/telemetry/hooks/batch`; dry-run is side-effect free.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import { cliDim, cliSection, formatOutput, type OutputMode } from "./cli-utils.js";
import { firstFarplaneConfigValue, readFarplaneConfigValue } from "./runtime-config.js";
import type { CodexThread } from "../ui/src/modules/runtime/lib/codex-app-server/types.js";

type HookTelemetryEnvelope = {
  hookName: string;
  hookType: string;
  projectId?: string;
  sessionId?: string;
  payload?: unknown;
  eventAt: number;
  eventKey: string;
};

type CodexThreadListResponse = {
  data?: CodexThread[];
};

type BackfillOptions = {
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
  limit?: number;
  projectPath?: string;
  stateBase?: string;
  siteUrl?: string;
  telemetryToken?: string;
};

type ThreadBackfillJson = {
  ok: boolean;
  dryRun: boolean;
  projectId: string;
  projectPath: string;
  scanned: number;
  emitted: number;
  published: number;
  duplicateCount: number;
  events: HookTelemetryEnvelope[];
};

function cleanString(value: unknown, limit = 500): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, limit) : undefined;
}

function normalizeUrl(raw: string, label: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error(`missing_${label}`);
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`invalid_${label}:${trimmed}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`invalid_${label}_protocol:${parsed.protocol}`);
  }
  return parsed.href.replace(/\/+$/, "");
}

function normalizeProjectPath(projectPath: string): string {
  return path.resolve(projectPath).replace(/\/+$/, "");
}

function resolveRepoRoot(): string {
  const override = process.env.FARPLANE_REPO_ROOT?.trim();
  if (override) return normalizeProjectPath(override);
  const cliDir =
    typeof __dirname === "string" && __dirname.trim()
      ? __dirname
      : path.dirname(fileURLToPath(import.meta.url));
  return normalizeProjectPath(path.resolve(cliDir, ".."));
}

function threadBelongsToProject(thread: CodexThread, projectPath: string): boolean {
  const cwd = cleanString(thread.cwd, 1_000);
  if (!cwd) return false;
  const normalizedCwd = normalizeProjectPath(cwd);
  const normalizedProject = normalizeProjectPath(projectPath);
  return normalizedCwd === normalizedProject || normalizedCwd.startsWith(`${normalizedProject}/`);
}

export function codexProjectIdFromPath(projectPath: string): string {
  const slug =
    normalizeProjectPath(projectPath)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "codex";
  return `codex-proj-${slug}`;
}

function lineageEventKey(input: {
  childThreadId: string;
  kind: "forked";
  parentThreadId: string;
  projectId: string;
}): string {
  return [
    "thread-lineage",
    "v1",
    input.projectId,
    input.parentThreadId,
    input.childThreadId,
    input.kind,
  ]
    .join(":")
    .replace(/\s+/g, "-")
    .slice(0, 500);
}

export function buildThreadLineageBackfillEvents(input: {
  limitProjectPath?: string;
  projectId?: string;
  projectPath: string;
  threads: CodexThread[];
}): HookTelemetryEnvelope[] {
  const projectPath = normalizeProjectPath(input.limitProjectPath ?? input.projectPath);
  const projectId = input.projectId ?? codexProjectIdFromPath(projectPath);
  return input.threads
    .filter((thread) => threadBelongsToProject(thread, projectPath))
    .map((thread): HookTelemetryEnvelope | null => {
      const parentThreadId = cleanString(thread.parentThreadId, 200);
      if (!parentThreadId) return null;
      const childThreadId = cleanString(thread.id, 200);
      if (!childThreadId || childThreadId === parentThreadId) return null;
      const title = cleanString(thread.name, 120) ?? cleanString(thread.preview, 120);
      const cwd = cleanString(thread.cwd, 1_000) ?? projectPath;
      return {
        hookName: "thread-lineage-backfill",
        hookType: "Backfill",
        projectId,
        sessionId: parentThreadId,
        eventAt: typeof thread.updatedAt === "number" && Number.isFinite(thread.updatedAt)
          ? Math.floor(thread.updatedAt * 1000)
          : Date.now(),
        eventKey: lineageEventKey({ projectId, parentThreadId, childThreadId, kind: "forked" }),
        payload: {
          eventName: "thread.forked",
          sourceTool: "backfill",
          parentThreadId,
          childThreadId,
          title,
          cwd,
        },
      };
    })
    .filter((event): event is HookTelemetryEnvelope => event !== null);
}

function resolveStateBase(input?: string): string {
  const configured = input ?? firstFarplaneConfigValue(["FARPLANE_STATE_BASE", "VITE_STATE_URL"]);
  return normalizeUrl(configured || "http://127.0.0.1:5173", "state_base");
}

function resolveSiteUrl(input?: string): string {
  const configured = input ?? firstFarplaneConfigValue(["FARPLANE_CONVEX_SITE_URL", "CONVEX_SITE_URL"]);
  return normalizeUrl(configured || "", "convex_site_url");
}

async function listCodexThreads(input: {
  fetchImpl: typeof fetch;
  limit: number;
  stateBase: string;
}): Promise<CodexThread[]> {
  const response = await input.fetchImpl(`${input.stateBase}/codex/app-server/rpc`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      method: "thread/list",
      params: {
        archived: false,
        limit: input.limit,
        sortDirection: "desc",
        sortKey: "updated_at",
      },
    }),
  });
  if (!response.ok) throw new Error(`codex_thread_list_failed:${response.status}`);
  const body = (await response.json()) as { ok?: boolean; result?: CodexThreadListResponse; error?: string };
  if (body.ok === false) throw new Error(body.error ?? "codex_thread_list_failed");
  return Array.isArray(body.result?.data) ? body.result.data : [];
}

async function publishBackfillEvents(input: {
  events: HookTelemetryEnvelope[];
  fetchImpl: typeof fetch;
  siteUrl: string;
  telemetryToken?: string;
}): Promise<{ count: number; duplicateCount: number }> {
  const response = await input.fetchImpl(`${input.siteUrl}/telemetry/hooks/batch`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(input.telemetryToken ? { "x-farplane-telemetry-token": input.telemetryToken } : {}),
    },
    body: JSON.stringify({ events: input.events }),
  });
  const text = await response.text();
  let body: { count?: number; duplicateCount?: number; error?: string } = {};
  try {
    body = text ? JSON.parse(text) as typeof body : {};
  } catch {
    body = {};
  }
  if (!response.ok) throw new Error(`thread_backfill_publish_failed:${response.status}:${body.error ?? text.slice(0, 120)}`);
  return {
    count: typeof body.count === "number" ? body.count : input.events.length,
    duplicateCount: typeof body.duplicateCount === "number" ? body.duplicateCount : 0,
  };
}

export async function runThreadLineageBackfill(options: BackfillOptions = {}): Promise<ThreadBackfillJson> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const projectPath = normalizeProjectPath(options.projectPath ?? resolveRepoRoot());
  const projectId = codexProjectIdFromPath(projectPath);
  const limit = Math.max(1, Math.min(500, Math.floor(options.limit ?? 100)));
  const stateBase = resolveStateBase(options.stateBase);
  const threads = await listCodexThreads({ fetchImpl, limit, stateBase });
  const events = buildThreadLineageBackfillEvents({ projectId, projectPath, threads });
  if (options.dryRun) {
    return {
      ok: true,
      dryRun: true,
      projectId,
      projectPath,
      scanned: threads.length,
      emitted: events.length,
      published: 0,
      duplicateCount: 0,
      events,
    };
  }
  const published =
    events.length > 0
      ? await publishBackfillEvents({
          events,
          fetchImpl,
          siteUrl: resolveSiteUrl(options.siteUrl),
          telemetryToken:
            options.telemetryToken ??
            readFarplaneConfigValue("FARPLANE_TELEMETRY_TOKEN", { secret: true }),
        })
      : { count: 0, duplicateCount: 0 };
  return {
    ok: true,
    dryRun: false,
    projectId,
    projectPath,
    scanned: threads.length,
    emitted: events.length,
    published: published.count,
    duplicateCount: published.duplicateCount,
    events,
  };
}

function renderBackfillText(result: ThreadBackfillJson): string {
  return [
    cliSection("Thread Lineage Backfill"),
    cliDim(`Project: ${result.projectPath}`),
    `Scanned ${result.scanned} thread${result.scanned === 1 ? "" : "s"}.`,
    `Emitted ${result.emitted} explicit lineage edge${result.emitted === 1 ? "" : "s"}.`,
    result.dryRun
      ? "Dry run: no telemetry was published."
      : `Published ${result.published} row${result.published === 1 ? "" : "s"} (${result.duplicateCount} duplicate).`,
  ].join("\n");
}

export function registerThreadCommands(program: Command): void {
  const threads = program.command("threads").description("Inspect and reconcile Codex thread metadata");

  threads
    .command("backfill")
    .description("Backfill explicit Codex parentThreadId lineage into hook telemetry")
    .option("--dry-run", "Print candidate rows without publishing", false)
    .option("--json", "Print JSON output", false)
    .option("--limit <n>", "Maximum recent threads to scan", (value) => Number(value), 100)
    .option("--project-path <path>", "Project path to scan; defaults to cwd")
    .option("--state-base <url>", "Farplane state bridge URL")
    .option("--site-url <url>", "Convex site URL for /telemetry/hooks/batch")
    .action(
      async (opts: {
        dryRun?: boolean;
        json?: boolean;
        limit?: number;
        projectPath?: string;
        stateBase?: string;
        siteUrl?: string;
      }) => {
        const mode: OutputMode = opts.json ? "json" : "text";
        const result = await runThreadLineageBackfill({
          dryRun: Boolean(opts.dryRun),
          limit: opts.limit,
          projectPath: opts.projectPath,
          stateBase: opts.stateBase,
          siteUrl: opts.siteUrl,
        });
        formatOutput(mode, result, renderBackfillText(result));
      },
    );
}
