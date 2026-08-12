/**
 * Content Intelligence CLI edge.
 * Imports already-produced Feed Scout daily JSON through the shared Convex writer; it never analyzes content.
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import { cliDim, cliSection, formatOutput, type OutputMode } from "./cli-utils.js";

const FEED_SCOUT_IMPORT = "modules/content/discoveries:importFeedScoutItem";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type SourceKind = "url" | "video";

export type FeedScoutSyncOptions = {
  projectPath: string;
  date?: string;
  contentProjectId?: string;
  dryRun?: boolean;
  json?: boolean;
  repoRoot?: string;
};

type RawFeedScoutItem = Record<string, unknown>;

export type FeedScoutImportInput = {
  sourceKind: SourceKind;
  sourceRef: string;
  title: string;
  platform: string;
  summary?: string;
  feedScopeKey: string;
  observedDate: string;
  externalKey: string;
  entityGroupId: string;
  feedSourceId: string;
  evidenceRefs: string[];
  tags: string[];
  publishedAt?: string;
  discoveredAt?: string;
  contentProjectId?: string;
};

export type FeedScoutSyncPlan = {
  feedPath: string;
  observedDate: string;
  candidates: FeedScoutImportInput[];
  skipped: { index: number; reason: string }[];
};

export type FeedScoutSyncReceipt = {
  schemaVersion: 1;
  command: "content sync-feed-scout";
  projectPath: string;
  feedPath: string;
  observedDate: string;
  dryRun: boolean;
  contentProjectId?: string;
  created: number;
  reused: number;
  skipped: { index: number; reason: string }[];
  invalid: { index: number; reason: string }[];
  importedAt: string;
  receiptPath: string;
};

export function feedScoutSyncSucceeded(receipt: FeedScoutSyncReceipt): boolean {
  return receipt.invalid.length === 0;
}

type SpawnFn = typeof spawn;
type SpawnedProcess = {
  stdout: NodeJS.ReadableStream;
  stderr: NodeJS.ReadableStream;
  on(event: "error", listener: (error: Error) => void): unknown;
  on(
    event: "exit",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ): unknown;
};

function text(value: unknown, max = 2_000): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.trim().replace(/\s+/g, " ").slice(0, max);
  return clean || undefined;
}

function stringList(value: unknown, max = 120, limit = 30): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => text(item, max)).filter(Boolean) as string[])].slice(
    0,
    limit,
  );
}

function optionalTimestamp(value: unknown): string | undefined {
  const candidate = text(value, 40);
  return candidate && Number.isFinite(Date.parse(candidate)) ? candidate : undefined;
}

function feedField(item: RawFeedScoutItem, snake: string, camel: string): unknown {
  return item[snake] ?? item[camel];
}

function sourceKind(sourceRef: string, kind: string | undefined, platform: string): SourceKind {
  try {
    const host = new URL(sourceRef).hostname.toLowerCase();
    if (
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtu.be"
    ) {
      return "video";
    }
  } catch {
    // The Convex writer validates canonical source identity; invalid URL rows are skipped below.
  }
  return kind?.toLowerCase() === "video" || platform.toLowerCase() === "youtube" ? "video" : "url";
}

export function feedScoutImportInput(
  raw: unknown,
  feedScopeKey: string,
  observedDate: string,
  contentProjectId?: string,
): FeedScoutImportInput | { reason: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { reason: "item_not_object" };
  const item = raw as RawFeedScoutItem;
  const sourceRef = text(feedField(item, "canonical_url", "canonicalUrl"));
  if (!sourceRef) return { reason: "missing_canonical_url" };
  try {
    const url = new URL(sourceRef);
    if (url.protocol !== "https:" && url.protocol !== "http:")
      return { reason: "unsupported_url_protocol" };
  } catch {
    return { reason: "invalid_canonical_url" };
  }
  const title = text(item.title, 300);
  const externalKey = text(feedField(item, "canonical_key", "canonicalKey"), 300);
  const entityGroupId = text(feedField(item, "entity_group_id", "entityGroupId"), 300);
  const feedSourceId = text(feedField(item, "source_id", "sourceId"), 300);
  const platform = text(item.platform, 120) ?? "unknown";
  if (!title) return { reason: "missing_title" };
  if (!externalKey) return { reason: "missing_canonical_key" };
  if (!entityGroupId) return { reason: "missing_entity_group_id" };
  if (!feedSourceId) return { reason: "missing_source_id" };
  const kind = text(item.kind, 80);
  return {
    sourceKind: sourceKind(sourceRef, kind, platform),
    sourceRef,
    title,
    platform,
    summary: text(item.summary, 3_000),
    feedScopeKey,
    observedDate,
    externalKey,
    entityGroupId,
    feedSourceId,
    evidenceRefs: stringList(feedField(item, "evidence_refs", "evidenceRefs"), 1_000, 40),
    tags: stringList(item.tags),
    publishedAt: optionalTimestamp(feedField(item, "published_at", "publishedAt")),
    discoveredAt: optionalTimestamp(feedField(item, "discovered_at", "discoveredAt")),
    contentProjectId: text(contentProjectId, 120),
  };
}

export function feedScoutPath(projectPath: string, date = "latest"): string {
  const normalized = path.resolve(projectPath);
  if (date === "latest")
    return path.join(normalized, ".farplane", "feed-scout", "daily", "latest.json");
  if (!DATE_PATTERN.test(date)) throw new Error(`invalid_feed_scout_date:${date}`);
  return path.join(normalized, ".farplane", "feed-scout", "daily", `feed-${date}.json`);
}

export async function loadFeedScoutSyncPlan(
  options: FeedScoutSyncOptions,
): Promise<FeedScoutSyncPlan> {
  const projectPath = path.resolve(options.projectPath);
  const feedPath = feedScoutPath(projectPath, options.date ?? "latest");
  const parsed = JSON.parse(await readFile(feedPath, "utf8")) as Record<string, unknown>;
  const observedDate = text(parsed.date, 10);
  if (!observedDate || !DATE_PATTERN.test(observedDate)) throw new Error("feed_scout_date_missing");
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const candidates: FeedScoutImportInput[] = [];
  const skipped: { index: number; reason: string }[] = [];
  for (const [index, item] of items.entries()) {
    const input = feedScoutImportInput(item, projectPath, observedDate, options.contentProjectId);
    if ("reason" in input) skipped.push({ index, reason: input.reason });
    else candidates.push(input);
  }
  return { feedPath, observedDate, candidates, skipped };
}

export async function syncFeedScout(
  options: FeedScoutSyncOptions,
  runImport: (input: FeedScoutImportInput) => Promise<{
    sourceCreated: boolean;
    intakeJobCreated: boolean;
    discoveryCreated: boolean;
  }> = (input) => runConvexImport(input, options.repoRoot),
): Promise<FeedScoutSyncReceipt> {
  const projectPath = path.resolve(options.projectPath);
  const plan = await loadFeedScoutSyncPlan({ ...options, projectPath });
  let created = 0;
  let reused = 0;
  const invalid: { index: number; reason: string }[] = [];
  if (!options.dryRun) {
    for (const [index, input] of plan.candidates.entries()) {
      try {
        const result = await runImport(input);
        if (result.sourceCreated || result.intakeJobCreated || result.discoveryCreated)
          created += 1;
        else reused += 1;
      } catch (error) {
        invalid.push({
          index,
          reason: error instanceof Error ? error.message : "convex_import_failed",
        });
      }
    }
  }
  const receiptDir = path.join(projectPath, ".farplane", "content-intelligence");
  const receiptPath = path.join(receiptDir, `feed-scout-sync-${plan.observedDate}.json`);
  const receipt: FeedScoutSyncReceipt = {
    schemaVersion: 1,
    command: "content sync-feed-scout",
    projectPath,
    feedPath: plan.feedPath,
    observedDate: plan.observedDate,
    dryRun: Boolean(options.dryRun),
    contentProjectId: text(options.contentProjectId, 120),
    created: options.dryRun ? plan.candidates.length : created,
    reused,
    skipped: plan.skipped,
    invalid,
    importedAt: new Date().toISOString(),
    receiptPath,
  };
  await mkdir(receiptDir, { recursive: true });
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return receipt;
}

async function runConvexImport(
  input: FeedScoutImportInput,
  repoRoot?: string,
): Promise<{
  sourceCreated: boolean;
  intakeJobCreated: boolean;
  discoveryCreated: boolean;
}> {
  const output = await runCommand(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["convex", "run", FEED_SCOUT_IMPORT, JSON.stringify(input)],
    repoRoot ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  );
  return JSON.parse(output) as {
    sourceCreated: boolean;
    intakeJobCreated: boolean;
    discoveryCreated: boolean;
  };
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  spawnImpl: SpawnFn = spawn,
): Promise<string> {
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    const child = spawnImpl(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    }) as SpawnedProcess;
    child.stdout.on("data", (chunk: Buffer) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) return reject(new Error(`content_feed_scout_interrupted:${signal}`));
      if ((code ?? 1) !== 0)
        return reject(
          new Error(
            `content_feed_scout_failed:${code ?? 1}:${Buffer.concat(stderr).toString("utf8").trim()}`,
          ),
        );
      resolve();
    });
  });
  return Buffer.concat(stdout).toString("utf8").trim();
}

function renderReceipt(receipt: FeedScoutSyncReceipt): string {
  return [
    cliSection("Content Intelligence Feed Scout Sync"),
    cliDim(`Date: ${receipt.observedDate}`),
    cliDim(
      `Created: ${receipt.created}; reused: ${receipt.reused}; skipped: ${receipt.skipped.length}; invalid: ${receipt.invalid.length}`,
    ),
    cliDim(`Receipt: ${receipt.receiptPath}`),
  ].join("\n");
}

export function registerContentIntelligenceCommands(program: Command): void {
  const content = program.command("content").description("Manage Content Intelligence intake");
  content
    .command("sync-feed-scout")
    .description("Import one existing Feed Scout daily feed without launching analysis")
    .requiredOption(
      "--project-path <path>",
      "Project whose .farplane Feed Scout daily JSON is imported",
    )
    .option("--date <date|latest>", "Daily feed date or latest", "latest")
    .option("--content-project-id <id>", "Optional Content Intelligence project association")
    .option("--dry-run", "Validate and write a receipt without calling Convex", false)
    .option("--json", "Print the receipt as JSON", false)
    .action(async (options: FeedScoutSyncOptions) => {
      const receipt = await syncFeedScout(options);
      formatOutput(options.json ? "json" : ("text" as OutputMode), receipt, renderReceipt(receipt));
      if (!options.dryRun && !feedScoutSyncSucceeded(receipt)) {
        process.exitCode = 1;
      }
    });
}
