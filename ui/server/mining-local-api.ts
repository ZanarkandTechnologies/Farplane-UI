import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mergeFilesystemThreadsIntoThreadList } from "../codex-thread-summaries";
import {
  assertSafeMiningFileId,
  fileEventToMiningSource,
  isSafeMiningFileId,
  normalizeCodexThreadSource,
  normalizeStoredMiningSource,
  normalizeStringList,
  safeMiningId,
  threadSourceToMiningSource,
  ticketCompletionEventToMiningSource,
  type JsonObject,
  type MiningThreadSource,
} from "./mining-sources";
import { isDirectory, pathExists, readJsonFile, writeJsonFile } from "./mining-files";
import { buildDryRunOutput, buildParentPrompt, buildReport } from "./mining-output";
import {
  DEFAULT_MINING_PROGRAMS,
  normalizeProgram,
  normalizeRunIndexEntry,
  sortRunIndex,
  type MiningProgram,
  type MiningRunIndexEntry,
} from "./mining-types";

export type MiningLocalApi = {
  listPrograms: () => Promise<MiningProgram[]>;
  saveProgram: (input: unknown) => Promise<MiningProgram[]>;
  listThreadSources: (input: { limit: number; lastDays?: number }) => Promise<MiningThreadSource[]>;
  listRuns: () => Promise<MiningRunIndexEntry[]>;
  createRun: (input: unknown) => Promise<JsonObject | null>;
  readRun: (runId: string) => Promise<JsonObject | null>;
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
  now?: () => Date;
};

export function createMiningLocalApi(deps: MiningLocalApiDeps): MiningLocalApi {
  const now = deps.now ?? (() => new Date());
  const programsIndexPath = () => path.join(deps.mineRoot, "programs", "index.json");
  const runsIndexPath = () => path.join(deps.mineRoot, "runs", "index.json");

  async function ensureProgramDefaults(): Promise<void> {
    const indexPath = programsIndexPath();
    if (await pathExists(indexPath)) return;
    await Promise.all(
      DEFAULT_MINING_PROGRAMS.map((program) =>
        writeJsonFile(path.join(deps.mineRoot, "programs", program.id, "program.json"), program),
      ),
    );
    await writeJsonFile(
      indexPath,
      DEFAULT_MINING_PROGRAMS.map((program) => program.id),
    );
  }

  async function listPrograms(): Promise<MiningProgram[]> {
    await ensureProgramDefaults();
    const raw = await readJsonFile<unknown>(programsIndexPath(), []);
    const ids = Array.isArray(raw)
      ? raw.map((entry) => String(entry ?? "").trim())
      : raw && typeof raw === "object" && Array.isArray((raw as JsonObject).programs)
        ? ((raw as JsonObject).programs as unknown[]).map((entry) => String(entry ?? "").trim())
        : [];
    const programs: MiningProgram[] = [];
    for (const id of ids) {
      if (!isSafeMiningFileId(id)) continue;
      const program = normalizeProgram(
        await readJsonFile<unknown>(path.join(deps.mineRoot, "programs", id, "program.json"), null),
      );
      if (program) programs.push(program);
    }
    return programs.sort((left, right) => left.name.localeCompare(right.name));
  }

  async function saveProgram(input: unknown): Promise<MiningProgram[]> {
    const program = normalizeProgram({
      ...(input && typeof input === "object" && !Array.isArray(input) ? (input as JsonObject) : {}),
      updatedAt: now().toISOString(),
    });
    if (!program) throw new Error("mining_program_invalid");
    const existing = await listPrograms();
    const createdAt = existing.find((row) => row.id === program.id)?.createdAt ?? program.createdAt;
    const nextProgram = { ...program, createdAt };
    await writeJsonFile(path.join(deps.mineRoot, "programs", nextProgram.id, "program.json"), nextProgram);
    const ids = [...new Set([nextProgram.id, ...existing.map((row) => row.id)])].sort();
    await writeJsonFile(programsIndexPath(), ids);
    return listPrograms();
  }

  async function listThreadSources(input: { limit: number; lastDays?: number }): Promise<MiningThreadSource[]> {
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
      ? merged.data
          .map(normalizeCodexThreadSource)
          .filter((row): row is MiningThreadSource => Boolean(row))
      : [];
    const lastDays = typeof input.lastDays === "number" && input.lastDays > 0 ? input.lastDays : 0;
    const cutoff = lastDays ? Math.floor(Date.now() / 1000) - lastDays * 86_400 : 0;
    const uniqueRows: MiningThreadSource[] = [];
    const seenIds = new Set<string>();
    for (const row of rows
      .filter((source) => !cutoff || !source.updatedAt || source.updatedAt >= cutoff)
      .sort((left, right) => Number(right.updatedAt ?? 0) - Number(left.updatedAt ?? 0))) {
      if (seenIds.has(row.id)) continue;
      seenIds.add(row.id);
      uniqueRows.push(row);
    }
    return uniqueRows.slice(0, input.limit);
  }

  async function listRuns(): Promise<MiningRunIndexEntry[]> {
    const raw = await readJsonFile<unknown>(runsIndexPath(), []);
    const rawEntries = Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object" && Array.isArray((raw as JsonObject).runs)
        ? ((raw as JsonObject).runs as unknown[])
        : [];
    return sortRunIndex(
      rawEntries
        .map(normalizeRunIndexEntry)
        .filter((entry): entry is MiningRunIndexEntry => Boolean(entry)),
    );
  }

  async function writeRunIndex(entry: MiningRunIndexEntry): Promise<void> {
    const current = await listRuns();
    await writeJsonFile(
      runsIndexPath(),
      sortRunIndex([entry, ...current.filter((row) => row.runId !== entry.runId)]),
    );
  }

  function normalizeInputSources(value: unknown): MiningThreadSource[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((entry) => normalizeStoredMiningSource(entry))
      .filter((source): source is MiningThreadSource => Boolean(source));
  }

  async function writeOutputs(input: {
    mode: "dry-run" | "worker";
    program: MiningProgram;
    runId: string;
    runRoot: string;
    sources: MiningThreadSource[];
    preserveVerdicts?: Map<string, string>;
  }): Promise<{ outputs: JsonObject[]; privacyIssueCount: number }> {
    const outputs: JsonObject[] = [];
    let privacyIssueCount = 0;
    for (const source of input.sources) {
      const outputId = safeMiningId(source.id, `source-${outputs.length + 1}`);
      assertSafeMiningFileId(outputId, "output");
      const outputRoot = path.join(input.runRoot, "outputs", outputId);
      const output = await buildDryRunOutput({ outputId, program: input.program, runId: input.runId, source });
      if (output.redaction.status !== "clean") privacyIssueCount += 1;
      const preservedVerdict = input.preserveVerdicts?.get(outputId);
      if (
        preservedVerdict === "unreviewed" ||
        preservedVerdict === "promoted" ||
        preservedVerdict === "rejected"
      ) {
        output.json.verdict = preservedVerdict;
      }
      await mkdir(outputRoot, { recursive: true });
      await writeFile(path.join(outputRoot, "output.md"), output.markdown, "utf-8");
      await writeJsonFile(path.join(outputRoot, "output.json"), output.json);
      const decisionsJsonPath =
        input.program.id === "decision-v1" ? path.join(outputRoot, "decisions.json") : undefined;
      if (decisionsJsonPath) await writeJsonFile(decisionsJsonPath, output.json.decisions ?? []);
      await writeFile(path.join(outputRoot, "redaction.md"), output.redaction.markdown, "utf-8");
      await writeJsonFile(path.join(outputRoot, "telemetry.json"), output.json.telemetryEvents ?? []);
      outputs.push({
        id: outputId,
        ...output.json,
        outputMarkdownPath: path.join(outputRoot, "output.md"),
        outputJsonPath: path.join(outputRoot, "output.json"),
        decisionsJsonPath,
        redactionMarkdownPath: path.join(outputRoot, "redaction.md"),
        telemetryJsonPath: path.join(outputRoot, "telemetry.json"),
      });
    }
    return { outputs, privacyIssueCount };
  }

  async function createRun(input: unknown): Promise<JsonObject | null> {
    const body = input && typeof input === "object" && !Array.isArray(input) ? (input as JsonObject) : {};
    const programId = safeMiningId(String(body.programId ?? body.program_id ?? ""), "");
    const programs = await listPrograms();
    const program = programs.find((row) => row.id === programId);
    if (!program) throw new Error("mining_program_not_found");
    const filters = body.filters && typeof body.filters === "object" ? (body.filters as JsonObject) : {};
    const mode = body.mode === "worker" || body.executorMode === "worker" ? "worker" : "dry-run";
    const miningMode =
      body.mode === "event_triggered" || body.mode === "ticket_completion" || body.mode === "manual_selected"
        ? body.mode
        : "historical_backfill";
    const source =
      body.source === "hook" || body.source === "manual" || body.source === "provider" || body.source === "automation"
        ? body.source
        : "backfill";
    const limit = Math.min(Math.max(Math.floor(Number(filters.limit ?? 20) || 20), 1), 200);
    const lastDays = Math.max(Math.floor(Number(filters.lastDays ?? 30) || 30), 0);
    const requestedIds = new Set(normalizeStringList(body.threadIds));
    const inputSources = normalizeInputSources(body.sources);
    const candidateSources =
      miningMode === "historical_backfill"
        ? await listThreadSources({ limit: Math.max(limit, requestedIds.size, 20), lastDays })
        : inputSources;
    const sources = requestedIds.size
      ? candidateSources.filter((candidate) => requestedIds.has(candidate.id))
      : candidateSources.slice(0, limit);
    if (!sources.length) throw new Error("mining_sources_empty");
    const createdAt = now().toISOString();
    const runId = `mine-${Date.now().toString(36)}`;
    const runRoot = path.join(deps.mineRoot, "runs", runId);
    const miningSources = sources.map(threadSourceToMiningSource);
    const runInput = {
      mode: miningMode,
      source,
      programId: program.id,
      threadIds: sources.map((row) => row.id),
      filters: { lastDays, limit },
      executorMode: mode,
      sourceEventKey: typeof body.sourceEventKey === "string" ? body.sourceEventKey : undefined,
      sources: miningSources,
    };
    const attempt = {
      attemptId: `attempt-${Date.now().toString(36)}`,
      executorKind: mode === "worker" ? "codex_exec" : "local_worker",
      startedAt: createdAt,
      completedAt: now().toISOString(),
      status: "complete",
    };
    const { outputs, privacyIssueCount } = await writeOutputs({
      mode,
      program,
      runId,
      runRoot,
      sources,
    });
    const completedAt = now().toISOString();
    const entry: MiningRunIndexEntry = {
      runId,
      miningMode,
      source,
      programId: program.id,
      programVersion: program.version,
      label: `${program.name} (${sources.length} source${sources.length === 1 ? "" : "s"})`,
      mode,
      status: "complete",
      createdAt,
      completedAt,
      sourceCount: sources.length,
      outputCount: outputs.length,
      reviewedCount: 0,
      promotedCount: 0,
      rejectedCount: 0,
      privacyIssueCount,
      duplicateCount: 0,
      rejectedSourceCount: 0,
    };
    await writeJsonFile(path.join(runRoot, "run.json"), {
      ...entry,
      root: runRoot,
      reportPath: path.join(runRoot, "report.md"),
      promptPath: path.join(runRoot, "parent-prompt.md"),
    });
    await writeJsonFile(path.join(runRoot, "input.json"), runInput);
    await writeJsonFile(path.join(runRoot, "sources.json"), miningSources);
    await writeJsonFile(path.join(runRoot, "attempts.json"), [attempt]);
    await writeJsonFile(path.join(runRoot, "outputs", "index.json"), outputs);
    await writeFile(path.join(runRoot, "parent-prompt.md"), buildParentPrompt({ mode, program, runId, runRoot, sources }), "utf-8");
    await writeFile(path.join(runRoot, "report.md"), buildReport({ entry, program }), "utf-8");
    await writeRunIndex(entry);
    return readRun(runId);
  }

  async function readRun(runId: string): Promise<JsonObject | null> {
    if (!isSafeMiningFileId(runId)) return null;
    const runRoot = path.join(deps.mineRoot, "runs", runId);
    const run = normalizeRunIndexEntry(await readJsonFile<unknown>(path.join(runRoot, "run.json"), null));
    if (!run) return null;
    const programs = await listPrograms();
    const inputJson = await readJsonFile<unknown>(path.join(runRoot, "input.json"), null);
    const sourcesJson = await readJsonFile<unknown[]>(path.join(runRoot, "sources.json"), []);
    const attempts = await readJsonFile<JsonObject[]>(path.join(runRoot, "attempts.json"), []);
    const sources = sourcesJson
      .map(normalizeStoredMiningSource)
      .filter((source): source is MiningThreadSource => Boolean(source));
    const outputIndex = await readJsonFile<JsonObject[]>(path.join(runRoot, "outputs", "index.json"), []);
    const outputs = [];
    for (const output of outputIndex) {
      const outputId = String(output.id ?? output.threadId ?? "").trim();
      if (!outputId || !isSafeMiningFileId(outputId)) continue;
      const outputRoot = path.join(runRoot, "outputs", outputId);
      outputs.push({
        ...output,
        outputMarkdown: await readFile(path.join(outputRoot, "output.md"), "utf-8").catch(() => ""),
        outputJson: await readJsonFile<unknown>(path.join(outputRoot, "output.json"), null),
        outputDecisions: await readJsonFile<unknown>(path.join(outputRoot, "decisions.json"), null),
        redactionMarkdown: await readFile(path.join(outputRoot, "redaction.md"), "utf-8").catch(() => ""),
      });
    }
    const reportMarkdown = await readFile(path.join(runRoot, "report.md"), "utf-8").catch(() => "");
    const parentPrompt = await readFile(path.join(runRoot, "parent-prompt.md"), "utf-8").catch(() => "");
    const artifacts = [
      {
        id: "input",
        label: "input.json",
        kind: "json",
        path: path.join(runRoot, "input.json"),
        content: JSON.stringify(inputJson, null, 2),
      },
      {
        id: "sources",
        label: "sources.json",
        kind: "json",
        path: path.join(runRoot, "sources.json"),
        content: JSON.stringify(sourcesJson, null, 2),
      },
      {
        id: "attempts",
        label: "attempts.json",
        kind: "json",
        path: path.join(runRoot, "attempts.json"),
        content: JSON.stringify(attempts, null, 2),
      },
      {
        id: "report",
        label: "report.md",
        kind: "markdown",
        path: path.join(runRoot, "report.md"),
        content: reportMarkdown,
      },
      {
        id: "parent-prompt",
        label: "parent-prompt.md",
        kind: "markdown",
        path: path.join(runRoot, "parent-prompt.md"),
        content: parentPrompt,
      },
      {
        id: "outputs-index",
        label: "outputs/index.json",
        kind: "json",
        path: path.join(runRoot, "outputs", "index.json"),
        content: JSON.stringify(outputIndex, null, 2),
      },
      ...outputs.map((output) => ({
        id: `output-${String(output.id)}`,
        label: `outputs/${String(output.id)}/output.json`,
        kind: "output",
        path: String(output.outputJsonPath ?? ""),
        content: JSON.stringify(output.outputJson ?? null, null, 2),
      })),
    ];
    return {
      run: {
        ...run,
        root: runRoot,
        reportPath: path.join(runRoot, "report.md"),
        promptPath: path.join(runRoot, "parent-prompt.md"),
      },
      program: programs.find((program) => program.id === run.programId) ?? null,
      sources,
      outputs,
      attempts,
      artifacts,
      inputJson,
      sourcesJson,
      reportMarkdown,
      parentPrompt,
    };
  }

  async function replayRun(runId: string): Promise<JsonObject | null> {
    if (!isSafeMiningFileId(runId)) return null;
    const runRoot = path.join(deps.mineRoot, "runs", runId);
    const runPath = path.join(runRoot, "run.json");
    const runRaw = await readJsonFile<JsonObject>(runPath, {});
    const run = normalizeRunIndexEntry(runRaw);
    if (!run) return null;
    const programs = await listPrograms();
    const program = programs.find((row) => row.id === run.programId);
    if (!program) return null;
    const sourcesRaw = await readJsonFile<unknown[]>(path.join(runRoot, "sources.json"), []);
    const sources = sourcesRaw
      .map(normalizeStoredMiningSource)
      .filter((source): source is MiningThreadSource => Boolean(source));
    const existingOutputs = await readJsonFile<JsonObject[]>(path.join(runRoot, "outputs", "index.json"), []);
    const preservedVerdicts = new Map(
      existingOutputs.map((output) => [
        String(output.id ?? ""),
        String(output.verdict ?? "unreviewed"),
      ]),
    );
    const startedAt = now().toISOString();
    const { outputs, privacyIssueCount } = await writeOutputs({
      mode: run.mode ?? "dry-run",
      program,
      runId,
      runRoot,
      sources,
      preserveVerdicts: preservedVerdicts,
    });
    const completedAt = now().toISOString();
    const attemptsPath = path.join(runRoot, "attempts.json");
    const attempts = await readJsonFile<JsonObject[]>(attemptsPath, []);
    const nextAttempt = {
      attemptId: `attempt-${Date.now().toString(36)}`,
      executorKind: run.mode === "worker" ? "codex_exec" : "local_worker",
      startedAt,
      completedAt,
      status: "complete",
      reason: "replayed_from_stored_input",
    };
    const reviewedCount = outputs.filter((output) => String(output.verdict ?? "unreviewed") !== "unreviewed").length;
    const promotedCount = outputs.filter((output) => output.verdict === "promoted").length;
    const rejectedCount = outputs.filter((output) => output.verdict === "rejected").length;
    const nextRun: MiningRunIndexEntry = {
      ...run,
      outputCount: outputs.length,
      reviewedCount,
      promotedCount,
      rejectedCount,
      privacyIssueCount,
      completedAt,
    };
    await writeJsonFile(attemptsPath, [...attempts, nextAttempt]);
    await writeJsonFile(path.join(runRoot, "outputs", "index.json"), outputs);
    await writeJsonFile(runPath, {
      ...runRaw,
      ...nextRun,
      lastReplayAt: completedAt,
      root: runRoot,
      reportPath: path.join(runRoot, "report.md"),
      promptPath: path.join(runRoot, "parent-prompt.md"),
    });
    await writeFile(path.join(runRoot, "report.md"), buildReport({ entry: nextRun, program }), "utf-8");
    await writeRunIndex(nextRun);
    return readRun(runId);
  }

  async function updateOutputVerdict(input: {
    runId: string;
    outputId: string;
    verdict: "unreviewed" | "promoted" | "rejected";
  }): Promise<JsonObject | null> {
    if (!isSafeMiningFileId(input.runId) || !isSafeMiningFileId(input.outputId)) return null;
    const runRoot = path.join(deps.mineRoot, "runs", input.runId);
    const runPath = path.join(runRoot, "run.json");
    const runRaw = await readJsonFile<JsonObject>(runPath, {});
    const run = normalizeRunIndexEntry(runRaw);
    if (!run) return null;
    const outputIndexPath = path.join(runRoot, "outputs", "index.json");
    const outputIndex = await readJsonFile<JsonObject[]>(outputIndexPath, []);
    const targetOutput = outputIndex.find((output) => String(output.id ?? output.threadId ?? "").trim() === input.outputId);
    if (!targetOutput) return null;
    if (input.verdict === "promoted" && targetOutput.redactionStatus !== "clean") {
      throw new Error("mining_privacy_review_required");
    }
    const nextOutputs = outputIndex.map((output) => {
      const outputId = String(output.id ?? output.threadId ?? "").trim();
      return outputId === input.outputId ? { ...output, verdict: input.verdict } : output;
    });
    const outputJsonPath = path.join(runRoot, "outputs", input.outputId, "output.json");
    const outputJson = await readJsonFile<JsonObject>(outputJsonPath, {});
    await writeJsonFile(outputJsonPath, { ...outputJson, verdict: input.verdict });
    await writeJsonFile(outputIndexPath, nextOutputs);
    const reviewedCount = nextOutputs.filter((output) => String(output.verdict ?? "unreviewed") !== "unreviewed").length;
    const promotedCount = nextOutputs.filter((output) => output.verdict === "promoted").length;
    const rejectedCount = nextOutputs.filter((output) => output.verdict === "rejected").length;
    const privacyIssueCount = nextOutputs.filter((output) => output.redactionStatus === "needs_review").length;
    const nextRun: MiningRunIndexEntry = {
      ...run,
      reviewedCount,
      promotedCount,
      rejectedCount,
      privacyIssueCount,
    };
    const programs = await listPrograms();
    await writeJsonFile(runPath, {
      ...runRaw,
      ...nextRun,
      root: runRoot,
      reportPath: path.join(runRoot, "report.md"),
      promptPath: path.join(runRoot, "parent-prompt.md"),
    });
    await writeFile(
      path.join(runRoot, "report.md"),
      buildReport({ entry: nextRun, program: programs.find((program) => program.id === nextRun.programId) ?? null }),
      "utf-8",
    );
    await writeRunIndex(nextRun);
    return readRun(input.runId);
  }

  return {
    createRun,
    listPrograms,
    listRuns,
    listThreadSources,
    readRun,
    replayRun,
    runsExist: () => isDirectory(path.join(deps.mineRoot, "runs")),
    saveProgram,
    updateOutputVerdict,
  };
}

export { fileEventToMiningSource, ticketCompletionEventToMiningSource };
