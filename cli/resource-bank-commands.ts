/**
 * RESOURCE BANK COMMANDS
 * ======================
 * Ownership: Farplane UI module CLI.
 * Inputs: operator-friendly Tasty Pack flags.
 * Outputs: JSON or compact text from the existing Convex Resource Bank query.
 * Side effects: shells out to `npx convex run`; does not mutate Resource Bank data.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import { cliDim, cliSection, formatOutput, type OutputMode } from "./cli-utils.js";

const TASTY_PACK_FUNCTION = "modules/resourceBank/retrieval:createTastyPack";
const TIMEFRAMES = new Set(["past_day", "past_week", "past_month", "past_90_days", "all"]);

type TastyPackTimeframe = "past_day" | "past_week" | "past_month" | "past_90_days" | "all";

type TastyPackArgs = {
  idea?: string;
  timeframe?: TastyPackTimeframe;
  startAtMs?: number;
  endAtMs?: number;
  tags?: string[];
  outputType?: string;
  outputTypes?: string[];
  audience?: string;
  audiences?: string[];
  ageRanges?: string[];
  industry?: string;
  industries?: string[];
  customerRole?: string;
  customerRoles?: string[];
  projectId?: string;
  taskId?: string;
  kinds?: string[];
  limit?: number;
};

type TastyPackElement = {
  kind?: string;
  title?: string;
  description?: string;
  anchor?: string;
};

type TastyPackCapture = {
  source?: {
    title?: string;
    tastinessScore?: number;
    sourceHandle?: string;
    attribution?: {
      sourceUrl?: string;
      canonicalUrl?: string;
    };
  };
  analysis?: {
    summary?: string[];
    whySaved?: string[];
    extractionLimits?: string[];
  };
  elements?: TastyPackElement[];
};

type TastyPackResult = {
  request?: {
    idea?: string;
    timeframe?: string;
    startAtMs?: number;
    endAtMs?: number;
  };
  captures?: TastyPackCapture[];
  meta?: {
    captureCount?: number;
    timeframe?: string;
  };
};

type TastyPackOptions = TastyPackArgs & {
  envFile?: string;
  json?: boolean;
  previewName?: string;
  prod?: boolean;
  push?: boolean;
  repoRoot?: string;
  deploymentName?: string;
};

type SpawnFn = typeof spawn;
type SpawnedConvexProcess = {
  stdout: NodeJS.ReadableStream;
  stderr: NodeJS.ReadableStream;
  on(event: "error", listener: (error: Error) => void): unknown;
  on(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): unknown;
};

function npxCommand(): string {
  return process.platform === "win32" ? "npx.cmd" : "npx";
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

function collectOption(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function splitList(values: string[] | undefined): string[] | undefined {
  const normalized = (values ?? [])
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

function cleanText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseNumberOption(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`invalid_number:${value}`);
  return parsed;
}

function parseLimit(value: string): number {
  const parsed = Math.floor(parseNumberOption(value));
  if (parsed < 1) throw new Error(`invalid_limit:${value}`);
  return parsed;
}

function parseTimeframe(value: string): TastyPackTimeframe {
  if (!TIMEFRAMES.has(value)) throw new Error(`invalid_timeframe:${value}`);
  return value as TastyPackTimeframe;
}

export function buildTastyPackArgs(options: TastyPackOptions): TastyPackArgs {
  return {
    idea: cleanText(options.idea),
    timeframe: options.timeframe,
    startAtMs: options.startAtMs,
    endAtMs: options.endAtMs,
    tags: splitList(options.tags),
    outputType: cleanText(options.outputType),
    outputTypes: splitList(options.outputTypes),
    audience: cleanText(options.audience),
    audiences: splitList(options.audiences),
    ageRanges: splitList(options.ageRanges),
    industry: cleanText(options.industry),
    industries: splitList(options.industries),
    customerRole: cleanText(options.customerRole),
    customerRoles: splitList(options.customerRoles),
    projectId: cleanText(options.projectId),
    taskId: cleanText(options.taskId),
    kinds: splitList(options.kinds),
    limit: options.limit,
  };
}

function compactArgs(input: TastyPackArgs): TastyPackArgs {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (value === undefined) return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    }),
  ) as TastyPackArgs;
}

export function buildConvexRunArgs(options: TastyPackOptions): string[] {
  const args = ["convex", "run"];
  if (options.push) args.push("--push");
  if (options.prod) args.push("--prod");
  if (options.previewName) args.push("--preview-name", options.previewName);
  if (options.deploymentName) args.push("--deployment-name", options.deploymentName);
  if (options.envFile) args.push("--env-file", options.envFile);
  args.push(TASTY_PACK_FUNCTION, JSON.stringify(compactArgs(buildTastyPackArgs(options))));
  return args;
}

function parseConvexJson(stdout: string): TastyPackResult {
  const trimmed = stdout.trim();
  if (!trimmed) throw new Error("resource_bank_tasty_pack_empty_response");
  try {
    return JSON.parse(trimmed) as TastyPackResult;
  } catch {
    throw new Error(`resource_bank_tasty_pack_invalid_json:${trimmed.slice(0, 200)}`);
  }
}

export async function runTastyPackQuery(
  options: TastyPackOptions,
  spawnImpl: SpawnFn = spawn,
): Promise<TastyPackResult> {
  const cwd = normalizeProjectPath(options.repoRoot ?? resolveRepoRoot());
  const args = buildConvexRunArgs(options);

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    const child = spawnImpl(npxCommand(), args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    }) as SpawnedConvexProcess;

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`resource_bank_tasty_pack_interrupted:${signal}`));
        return;
      }
      if ((code ?? 1) !== 0) {
        const stderrText = Buffer.concat(stderrChunks).toString("utf-8").trim();
        reject(new Error(`resource_bank_tasty_pack_failed:${code ?? 1}:${stderrText}`));
        return;
      }
      resolve();
    });
  });

  return parseConvexJson(Buffer.concat(stdoutChunks).toString("utf-8"));
}

function lineList(items: string[] | undefined, fallback: string): string {
  if (!items || items.length === 0) return fallback;
  return items.slice(0, 3).join("; ");
}

function elementList(items: TastyPackElement[] | undefined, fallback: string): string {
  if (!items || items.length === 0) return fallback;
  return items
    .slice(0, 3)
    .map((item) => {
      const kind = item.kind ? `${item.kind}: ` : "";
      const anchor = item.anchor ? ` (${item.anchor})` : "";
      return `${kind}${item.title ?? item.description ?? "untitled"}${anchor}`;
    })
    .join("; ");
}

export function renderTastyPackText(pack: TastyPackResult): string {
  const captures = pack.captures ?? [];
  const lines = [
    cliSection("Resource Bank Tasty Pack"),
    cliDim(`Timeframe: ${pack.meta?.timeframe ?? pack.request?.timeframe ?? "past_week"}`),
    pack.request?.idea ? cliDim(`Idea: ${pack.request.idea}`) : undefined,
    cliDim(`Captures: ${pack.meta?.captureCount ?? captures.length}`),
    "",
    captures.length === 0 ? "No saved captures matched the supplied filters." : undefined,
  ].filter((line): line is string => line !== undefined);

  captures.slice(0, 20).forEach((capture, index) => {
    const sourceRef = capture.source;
    const score =
      typeof sourceRef?.tastinessScore === "number" ? ` score=${sourceRef.tastinessScore.toFixed(2)}` : "";
    const source =
      sourceRef?.sourceHandle ?? sourceRef?.attribution?.canonicalUrl ?? sourceRef?.attribution?.sourceUrl;
    lines.push(`${index + 1}. ${sourceRef?.title ?? "Untitled capture"}${score}`);
    if (source) lines.push(`   ${cliDim(source)}`);
    lines.push(`   why: ${lineList(capture.analysis?.whySaved, "no analysis")}`);
    lines.push(`   elements: ${elementList(capture.elements, "no creative elements")}`);
  });

  return lines.join("\n");
}

export function registerResourceBankCommands(program: Command): void {
  const resourceBank = program
    .command("resource-bank")
    .alias("bank")
    .description("Fetch saved Resource Bank creative references");

  resourceBank
    .command("tasty-pack [idea]")
    .alias("pack")
    .description("Create a Tasty Pack from saved Resource Bank assets")
    .option("--idea <text>", "Idea lens; overrides the positional idea")
    .option("--timeframe <value>", "past_day|past_week|past_month|past_90_days|all", parseTimeframe)
    .option("--start-at-ms <ms>", "Custom inclusive lower timestamp in milliseconds", parseNumberOption)
    .option("--end-at-ms <ms>", "Custom inclusive upper timestamp in milliseconds", parseNumberOption)
    .option("--tag <tag>", "Tag filter; can be repeated or comma-separated", collectOption, [])
    .option("--output-type <type>", "Single output type facet")
    .option("--output-types <types>", "Comma-separated output type facets", collectOption, [])
    .option("--audience <audience>", "Single audience facet")
    .option("--audiences <audiences>", "Comma-separated audience facets", collectOption, [])
    .option("--age-ranges <ranges>", "Comma-separated age range facets", collectOption, [])
    .option("--industry <industry>", "Single industry facet")
    .option("--industries <industries>", "Comma-separated industry facets", collectOption, [])
    .option("--customer-role <role>", "Single customer role facet")
    .option("--customer-roles <roles>", "Comma-separated customer role facets", collectOption, [])
    .option("--project-id <id>", "Project id facet")
    .option("--task-id <id>", "Task id facet")
    .option("--kinds <kinds>", "Creative element kind filters; can be repeated or comma-separated", collectOption, [])
    .option("--limit <n>", "Maximum references to return", parseLimit)
    .option("--push", "Push Convex code before running the query", false)
    .option("--prod", "Run against the production Convex deployment", false)
    .option("--preview-name <name>", "Run against a Convex preview deployment")
    .option("--deployment-name <name>", "Run against a named Convex deployment")
    .option("--env-file <path>", "Convex env file")
    .option("--json", "Print JSON output", false)
    .action(async (positionalIdea: string | undefined, opts: TastyPackOptions) => {
      const mode: OutputMode = opts.json ? "json" : "text";
      const pack = await runTastyPackQuery({
        ...opts,
        idea: opts.idea ?? positionalIdea,
      });
      formatOutput(mode, pack, renderTastyPackText(pack));
    });
}
