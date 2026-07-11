import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { mergeFilesystemThreadsIntoThreadList } from "../codex-thread-summaries";
import {
  fileEventToMiningSource,
  isSafeMiningFileId,
  normalizeCodexThreadSource,
  normalizeStoredMiningSource,
  type JsonObject,
  type MiningThreadSource,
} from "./mining-sources";
import { isDirectory, readJsonFile } from "./mining-files";
import {
  normalizeProgram,
  normalizeRunIndexEntry,
  sortRunIndex,
  type MiningProgram,
  type MiningRunIndexEntry,
} from "./mining-types";

const execFileAsync = promisify(execFile);

export type CoreMiningRunner = (args: readonly string[]) => Promise<unknown>;

export type MiningLocalApi = {
  listPrograms: () => Promise<MiningProgram[]>;
  listRoutes: () => Promise<JsonObject[]>;
  setRoute: (input: unknown) => Promise<JsonObject[]>;
  removeRoute: (routeId: string) => Promise<JsonObject[]>;
  saveProgram: (input: unknown) => Promise<MiningProgram[]>;
  listThreadSources: (input: { limit: number; lastDays?: number }) => Promise<MiningThreadSource[]>;
  listRuns: () => Promise<MiningRunIndexEntry[]>;
  createRun: (input: unknown) => Promise<JsonObject | null>;
  readRun: (runId: string) => Promise<JsonObject | null>;
  readEventMinerReport: (runId: string, projectPath?: string) => Promise<JsonObject | null>;
  replayRun: (runId: string) => Promise<JsonObject | null>;
  updateOutputVerdict: (input: {
    runId: string;
    outputId: string;
    verdict: "unreviewed" | "promoted" | "rejected";
  }) => Promise<JsonObject | null>;
  runsExist: () => Promise<boolean>;
};

export type MiningLocalApiDeps = {
  mineRoot: string;
  requestCodexThreads: (limit: number) => Promise<unknown>;
  readFilesystemThreads: (limit: number) => Promise<JsonObject[]>;
  runCoreMining?: CoreMiningRunner;
};

function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function arrayPayload(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  for (const key of keys) {
    if (Array.isArray(value[key])) return value[key] as unknown[];
  }
  if (isRecord(value.data)) return arrayPayload(value.data, keys);
  return [];
}

function objectPayload(value: unknown, keys: string[]): JsonObject | null {
  if (!isRecord(value)) return null;
  for (const key of keys) {
    if (isRecord(value[key])) return value[key] as JsonObject;
  }
  if (isRecord(value.data)) return objectPayload(value.data, keys) ?? value.data;
  return value;
}

function defaultCoreRunner(projectRoot: string): CoreMiningRunner {
  return async (args) => {
    const { stdout } = await execFileAsync("farplane", [...args], {
      cwd: projectRoot,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    const text = stdout.trim();
    return text ? JSON.parse(text) : null;
  };
}

function coreArgs(projectRoot: string, ...args: string[]): string[] {
  return ["mining", ...args, "--project-root", projectRoot, "--json"];
}

export function createMiningLocalApi(deps: MiningLocalApiDeps): MiningLocalApi {
  const projectRoot = path.dirname(path.dirname(deps.mineRoot));
  const runCore = deps.runCoreMining ?? defaultCoreRunner(projectRoot);

  async function listPrograms(): Promise<MiningProgram[]> {
    const payload = await runCore(coreArgs(projectRoot, "programs", "list"));
    return arrayPayload(payload, ["programs", "items"])
      .map(normalizeProgram)
      .filter((program): program is MiningProgram => Boolean(program))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async function saveProgram(): Promise<MiningProgram[]> {
    throw new Error("mining_programs_core_immutable");
  }

  async function listRoutes(): Promise<JsonObject[]> {
    const payload = await runCore(coreArgs(projectRoot, "routes", "list"));
    return arrayPayload(payload, ["routes", "items"]).filter(isRecord);
  }

  async function setRoute(input: unknown): Promise<JsonObject[]> {
    if (!isRecord(input)) throw new Error("mining_route_invalid");
    const routeId = String(input.id ?? input.route_id ?? "").trim();
    const eventName = String(input.eventName ?? input.event_name ?? "").trim();
    const programRef = String(input.programRef ?? input.program_ref ?? "").trim();
    if (!routeId || !eventName || !programRef) throw new Error("mining_route_invalid");
    await runCore(
      coreArgs(
        projectRoot,
        "routes",
        "set",
        routeId,
        eventName,
        programRef,
      ),
    );
    return listRoutes();
  }

  async function removeRoute(routeId: string): Promise<JsonObject[]> {
    if (!isSafeMiningFileId(routeId)) throw new Error("mining_route_invalid");
    await runCore(coreArgs(projectRoot, "routes", "remove", routeId));
    return listRoutes();
  }

  async function listThreadSources(input: {
    limit: number;
    lastDays?: number;
  }): Promise<MiningThreadSource[]> {
    let result: unknown;
    try {
      result = await deps.requestCodexThreads(input.limit);
    } catch {
      result = { data: await deps.readFilesystemThreads(input.limit) };
    }
    const merged = mergeFilesystemThreadsIntoThreadList({
      result,
      filesystemRows: await deps.readFilesystemThreads(input.limit),
      limit: input.limit,
    });
    const rows = Array.isArray(merged.data)
      ? merged.data.map(normalizeCodexThreadSource).filter((row): row is MiningThreadSource => Boolean(row))
      : [];
    const cutoff = input.lastDays
      ? Math.floor(Date.now() / 1000) - input.lastDays * 86_400
      : 0;
    const seen = new Set<string>();
    return rows
      .filter((source) => !cutoff || !source.updatedAt || source.updatedAt >= cutoff)
      .sort((left, right) => Number(right.updatedAt ?? 0) - Number(left.updatedAt ?? 0))
      .filter((source) => {
        if (seen.has(source.id)) return false;
        seen.add(source.id);
        return true;
      })
      .slice(0, input.limit);
  }

  async function listRuns(): Promise<MiningRunIndexEntry[]> {
    let payload: unknown;
    try {
      payload = await runCore(coreArgs(projectRoot, "runs", "list"));
    } catch {
      payload = await readJsonFile<unknown>(path.join(deps.mineRoot, "runs", "index.json"), []);
    }
    return sortRunIndex(
      arrayPayload(payload, ["runs", "items"])
        .map(normalizeRunIndexEntry)
        .filter((entry): entry is MiningRunIndexEntry => Boolean(entry)),
    );
  }

  async function createRun(): Promise<JsonObject | null> {
    throw new Error("mining_run_creation_core_owned");
  }

  function coreDetail(value: unknown): JsonObject | null {
    const envelope = isRecord(value) && isRecord(value.data) ? value.data : value;
    const detail = isRecord(envelope) && isRecord(envelope.run)
      ? envelope
      : objectPayload(envelope, ["detail", "run"]);
    if (!detail) return null;
    const rawRun = isRecord(detail.run) ? detail.run : detail;
    const run = normalizeRunIndexEntry(rawRun);
    if (!run) return null;
    const outputRefs = Array.isArray(detail.outputs)
      ? detail.outputs
      : Array.isArray(rawRun.outputs)
        ? rawRun.outputs
        : [];
    const verdicts = isRecord(detail.verdicts) ? detail.verdicts : {};
    const outputs = outputRefs.map((outputRef, index) => {
      const outputId = typeof outputRef === "string"
        ? outputRef
        : isRecord(outputRef)
          ? String(outputRef.id ?? outputRef.output_id ?? `output-${index + 1}`)
          : `output-${index + 1}`;
      const verdictRow = isRecord(verdicts[outputId]) ? verdicts[outputId] as JsonObject : {};
      const report = outputId === "report.json" ? detail.report ?? detail.lean_report : undefined;
      return {
        ...(isRecord(outputRef) ? outputRef : {}),
        id: outputId,
        sessionId: "",
        threadId: "",
        sourceTitle: String(run.label ?? detail.event_id ?? outputId),
        status: run.status === "failed" ? "failed" : "complete",
        verdict: String(verdictRow.verdict ?? "unreviewed"),
        redactionStatus: "clean",
        summary: isRecord(report)
          ? `${Array.isArray(report.material_findings) ? report.material_findings.length : 0} material findings; ${Array.isArray(report.source_gaps) ? report.source_gaps.length : 0} source gaps`
          : outputId,
        outputMarkdownPath: "",
        outputJsonPath: "",
        outputJson: report ?? (isRecord(outputRef) ? outputRef : null),
      };
    });
    const attempts = Array.isArray(detail.attempts) ? detail.attempts : [];
    const reports = Array.isArray(detail.reports)
      ? detail.reports
      : [detail.report, detail.lean_report, detail.deep_report].filter(Boolean);
    const artifacts = reports.map((report, index) => ({
      id: index === 0 ? "report" : `report-${index + 1}`,
      label: index === 0 ? "report.json" : `report-${index + 1}.json`,
      kind: "json",
      path: "",
      content: JSON.stringify(report, null, 2),
    }));
    const program = normalizeProgram(detail.program);
    const replayable = Boolean(program && isRecord(detail.input));
    return {
      run: {
        ...run,
        root: path.join(deps.mineRoot, "runs", run.runId),
        reportPath: path.join(deps.mineRoot, "runs", run.runId, "report.json"),
        promptPath: "",
      },
      program,
      sources: Array.isArray(detail.input_manifest)
        ? detail.input_manifest
        : isRecord(detail.input) && Array.isArray(detail.input.input_manifest)
          ? detail.input.input_manifest
          : [],
      outputs,
      attempts,
      artifacts,
      inputJson: detail.input ?? detail.input_manifest ?? null,
      sourcesJson: isRecord(detail.input) ? detail.input.input_manifest ?? [] : detail.input_manifest ?? [],
      reportMarkdown: "",
      parentPrompt: "",
      replayable,
      ...(replayable ? {} : { replayBlockReason: "Frozen Core program or input is unavailable." }),
    };
  }

  async function readLegacyRun(runId: string): Promise<JsonObject | null> {
    if (!isSafeMiningFileId(runId)) return null;
    const runRoot = path.join(deps.mineRoot, "runs", runId);
    const rawRun = await readJsonFile<unknown>(path.join(runRoot, "run.json"), null);
    const run = normalizeRunIndexEntry(rawRun);
    if (!run) return null;
    const sourcesJson = await readJsonFile<unknown[]>(path.join(runRoot, "sources.json"), []);
    const attempts = await readJsonFile<JsonObject[]>(path.join(runRoot, "attempts.json"), []);
    const outputIndex = await readJsonFile<JsonObject[]>(path.join(runRoot, "outputs", "index.json"), []);
    const outputs: JsonObject[] = [];
    for (const output of outputIndex) {
      const outputId = String(output.id ?? output.threadId ?? "").trim();
      if (!isSafeMiningFileId(outputId)) continue;
      const outputRoot = path.join(runRoot, "outputs", outputId);
      outputs.push({
        ...output,
        outputMarkdown: await readFile(path.join(outputRoot, "output.md"), "utf8").catch(() => ""),
        outputJson: await readJsonFile<unknown>(path.join(outputRoot, "output.json"), null),
        outputScorecard: await readJsonFile<unknown>(path.join(outputRoot, "scorecard.json"), null),
        scorecardMarkdown: await readFile(path.join(outputRoot, "scorecard.md"), "utf8").catch(() => ""),
        redactionMarkdown: await readFile(path.join(outputRoot, "redaction.md"), "utf8").catch(() => ""),
      });
    }
    const reportMarkdown = await readFile(path.join(runRoot, "report.md"), "utf8").catch(() => "");
    return {
      run: { ...run, root: runRoot, reportPath: path.join(runRoot, "report.md") },
      program: null,
      sources: sourcesJson.map(normalizeStoredMiningSource).filter(Boolean),
      outputs,
      attempts,
      artifacts: [
        {
          id: "report",
          label: "report.md",
          kind: "markdown",
          path: path.join(runRoot, "report.md"),
          content: reportMarkdown,
        },
      ],
      inputJson: await readJsonFile<unknown>(path.join(runRoot, "input.json"), null),
      sourcesJson,
      reportMarkdown,
      parentPrompt: await readFile(path.join(runRoot, "parent-prompt.md"), "utf8").catch(() => ""),
      replayable: false,
      replayBlockReason: "Historical UI run has no reconstructable frozen Core program and input.",
    };
  }

  async function readRun(runId: string): Promise<JsonObject | null> {
    if (!isSafeMiningFileId(runId)) return null;
    try {
      const payload = await runCore(coreArgs(projectRoot, "runs", "show", runId));
      return coreDetail(payload) ?? readLegacyRun(runId);
    } catch {
      return readLegacyRun(runId);
    }
  }

  async function readEventMinerReport(runId: string, requestedProjectRoot?: string): Promise<JsonObject | null> {
    if (!isSafeMiningFileId(runId)) return null;
    const root = path.resolve(requestedProjectRoot ?? projectRoot);
    const runRoot = path.join(root, ".farplane", "event-miner", "runs", runId);
    const report = await readJsonFile<unknown>(path.join(runRoot, "report.json"), null);
    if (!isRecord(report)) return null;
    return {
      runId,
      root: runRoot,
      reportPath: path.join(runRoot, "report.json"),
      inputPath: path.join(runRoot, "input.json"),
      report,
      inputJson: await readJsonFile<unknown>(path.join(runRoot, "input.json"), null),
    };
  }

  async function replayRun(runId: string): Promise<JsonObject | null> {
    if (!isSafeMiningFileId(runId)) return null;
    await runCore(coreArgs(projectRoot, "runs", "replay", runId));
    return readRun(runId);
  }

  async function updateOutputVerdict(input: {
    runId: string;
    outputId: string;
    verdict: "unreviewed" | "promoted" | "rejected";
  }): Promise<JsonObject | null> {
    if (!isSafeMiningFileId(input.runId) || !isSafeMiningFileId(input.outputId)) return null;
    await runCore(
      coreArgs(
        projectRoot,
        "outputs",
        "verdict",
        input.runId,
        input.outputId,
        input.verdict,
      ),
    );
    return readRun(input.runId);
  }

  return {
    createRun,
    listPrograms,
    listRoutes,
    listRuns,
    listThreadSources,
    readEventMinerReport,
    readRun,
    removeRoute,
    replayRun,
    runsExist: async () => {
      try {
        return (await listRuns()).length > 0;
      } catch {
        return isDirectory(path.join(deps.mineRoot, "runs"));
      }
    },
    saveProgram,
    setRoute,
    updateOutputVerdict,
  };
}

export { fileEventToMiningSource };
