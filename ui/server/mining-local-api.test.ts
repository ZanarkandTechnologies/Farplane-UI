import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMiningLocalApi } from "./mining-local-api";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function tempProject(): Promise<{ projectRoot: string; mineRoot: string }> {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), "farplane-core-mine-"));
  tempRoots.push(projectRoot);
  return { projectRoot, mineRoot: path.join(projectRoot, ".farplane", "mine") };
}

function apiWithRunner(mineRoot: string, runCoreMining: (args: readonly string[]) => Promise<unknown>) {
  return createMiningLocalApi({
    mineRoot,
    readFilesystemThreads: async () => [],
    requestCodexThreads: async () => ({ data: [] }),
    runCoreMining,
  });
}

describe("Core mining UI adapter", () => {
  it("projects Core programs and runs without writing default programs", async () => {
    const { projectRoot, mineRoot } = await tempProject();
    const runner = vi.fn(async (args: readonly string[]) =>
      args.includes("programs")
        ? {
            programs: [{ id: "lean", name: "Lean", version: "2", objective: "Report", program_digest: "abc" }],
          }
        : {
            runs: [{ run_id: "run-1", program_ref: { id: "lean", version: "2" }, status: "complete", created_at: "2026-07-01T00:00:00Z", outputs: [{}] }],
          },
    );
    const api = apiWithRunner(mineRoot, runner);

    expect(await api.listPrograms()).toEqual([
      expect.objectContaining({ id: "lean", immutable: true, programDigest: "abc" }),
    ]);
    expect(await api.listRuns()).toEqual([
      expect.objectContaining({ runId: "run-1", programId: "lean", outputCount: 1 }),
    ]);
    await expect(api.saveProgram({ id: "other" })).rejects.toThrow("mining_programs_core_immutable");
    await expect(api.createRun({ programId: "lean" })).rejects.toThrow("mining_run_creation_core_owned");
    expect(runner.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining(["--project-root", projectRoot, "--json"]),
    );
  });

  it("delegates replay and verdict updates to Core", async () => {
    const { mineRoot } = await tempProject();
    const runner = vi.fn(async () => ({
      run: {
        run_id: "run-1",
        program_id: "lean",
        status: "complete",
        created_at: "2026-07-01T00:00:00Z",
        outputs: [{ output_id: "report-1" }],
      },
      program: { id: "lean", name: "Lean", version: "1" },
      input: { input_manifest: [] },
      attempts: [],
      report: { material_findings: [], source_gaps: [] },
      verdicts: { "report-1": { verdict: "promoted" } },
    }));
    const api = apiWithRunner(mineRoot, runner);

    const replayed = await api.replayRun("run-1");
    const updated = await api.updateOutputVerdict({
      runId: "run-1",
      outputId: "report-1",
      verdict: "promoted",
    });

    expect(runner.mock.calls[0]?.[0]).toEqual(expect.arrayContaining(["runs", "replay", "run-1"]));
    expect(runner.mock.calls[1]?.[0]).toEqual(expect.arrayContaining(["runs", "show", "run-1"]));
    expect(runner.mock.calls[2]?.[0]).toEqual(
      expect.arrayContaining(["outputs", "verdict", "run-1", "report-1", "promoted"]),
    );
    expect(runner.mock.calls[3]?.[0]).toEqual(expect.arrayContaining(["runs", "show", "run-1"]));
    for (const detail of [replayed, updated]) {
      expect(detail).toEqual(
        expect.objectContaining({
          replayable: true,
          run: expect.objectContaining({ runId: "run-1", programId: "lean" }),
          outputs: [expect.objectContaining({ id: "report-1", verdict: "promoted" })],
        }),
      );
      expect((detail?.run as Record<string, unknown>).run_id).toBeUndefined();
    }
  });

  it("edits only project route bindings through Core", async () => {
    const { mineRoot } = await tempProject();
    const runner = vi.fn(async (args: readonly string[]) => ({
      routes: args.includes("list")
        ? [{ route_id: "completed", event_name: "farplane.ticket.completed", program_ref: "core:lean@1" }]
        : [],
    }));
    const api = apiWithRunner(mineRoot, runner);

    await api.setRoute({ id: "completed", eventName: "farplane.ticket.completed", programRef: "core:lean@1" });
    await api.removeRoute("completed");

    expect(runner.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining(["routes", "set", "completed", "farplane.ticket.completed", "core:lean@1"]),
    );
    expect(runner.mock.calls[2]?.[0]).toEqual(expect.arrayContaining(["routes", "remove", "completed"]));
  });

  it("keeps historical local runs readable when Core cannot serve them", async () => {
    const { mineRoot } = await tempProject();
    const runRoot = path.join(mineRoot, "runs", "legacy-1");
    await mkdir(path.join(runRoot, "outputs"), { recursive: true });
    const legacyRun = { runId: "legacy-1", programId: "old", status: "complete", createdAt: "2026-01-01T00:00:00Z" };
    await writeFile(path.join(runRoot, "run.json"), JSON.stringify(legacyRun));
    await writeFile(path.join(mineRoot, "runs", "index.json"), JSON.stringify([legacyRun]));
    await writeFile(path.join(runRoot, "sources.json"), "[]");
    await writeFile(path.join(runRoot, "attempts.json"), "[]");
    await writeFile(path.join(runRoot, "outputs", "index.json"), "[]");
    await writeFile(path.join(runRoot, "report.md"), "# Historical report\n");
    const api = apiWithRunner(mineRoot, async () => { throw new Error("not_found"); });

    expect(await api.listRuns()).toEqual([expect.objectContaining({ runId: "legacy-1" })]);
    expect(await api.readRun("legacy-1")).toEqual(
      expect.objectContaining({
        replayable: false,
        replayBlockReason: expect.stringContaining("no reconstructable frozen Core program"),
        reportMarkdown: "# Historical report\n",
      }),
    );
  });

  it("reads legacy event-miner reports without Convex", async () => {
    const { projectRoot, mineRoot } = await tempProject();
    const runRoot = path.join(projectRoot, ".farplane", "event-miner", "runs", "event-1");
    await mkdir(runRoot, { recursive: true });
    await writeFile(path.join(runRoot, "report.json"), JSON.stringify({ summary: "local" }));
    const api = apiWithRunner(mineRoot, async () => null);
    expect(await api.readEventMinerReport("event-1")).toEqual(
      expect.objectContaining({ report: { summary: "local" } }),
    );
  });
});
