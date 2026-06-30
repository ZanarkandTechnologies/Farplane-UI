import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createMiningLocalApi } from "./mining-local-api";

const tempRoots: string[] = [];
type TestJson = Record<string, unknown>;

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function createTempRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

describe("mining local API", () => {
  it("creates event-triggered ticket completion runs from explicit sources", async () => {
    const projectRoot = await createTempRoot("farplane-mine-project-");
    const mineRoot = path.join(projectRoot, ".farplane", "mine");
    await mkdir(path.join(projectRoot, "tickets", "TASK-0029", "artifacts"), { recursive: true });
    await writeFile(
      path.join(projectRoot, "tickets", "TASK-0029", "ticket.md"),
      [
        "---",
        "ticket_id: TASK-0029",
        "title: Extract mining API",
        "status: done",
        "created_at: 2026-06-28T00:00:00.000Z",
        "updated_at: 2026-06-29T00:00:00.000Z",
        "---",
        "",
        "# TASK-0029: Extract Mining API",
        "",
        "Use $impl-plan and ui/server/mining-local-api.ts as the implementation reference.",
        "",
        "## Done",
        "- API extracted",
      ].join("\n"),
    );
    await writeFile(
      path.join(projectRoot, "tickets", "TASK-0029", "progress.md"),
      "# Progress\n\n- Implemented API extraction.\n- Added tests.\n",
    );
    await mkdir(path.join(projectRoot, ".farplane", "state", "message-windows"), { recursive: true });
    await writeFile(
      path.join(projectRoot, ".farplane", "state", "message-windows", "thread-ticket.json"),
      JSON.stringify({
        rolling_exchanges: [
          {
            user_text: "Please use $impl-plan here.",
            user_captured_at: "2026-06-28T01:00:00.000Z",
            assistant_text: "Using $impl-plan and reading /Users/kenjipcx/.codex/skills/impl-plan/SKILL.md.",
            assistant_captured_at: "2026-06-28T01:01:00.000Z",
          },
          {
            user_text: "wait, why did the first pass miss the ticket eval default?",
            user_captured_at: "2026-06-28T01:02:00.000Z",
            assistant_text: "I will follow the recommended checklist.",
            assistant_captured_at: "2026-06-28T01:03:00.000Z",
          },
        ],
      }),
      "utf-8",
    );
    await writeFile(path.join(projectRoot, "tickets", "TASK-0029", "artifacts", "proof.txt"), "ok\n");
    const api = createMiningLocalApi({
      mineRoot,
      readFilesystemThreads: async () => [],
      requestCodexThreads: async () => {
        throw new Error("thread listing should not be used for event-triggered sources");
      },
      now: () => new Date("2026-06-29T00:00:00.000Z"),
    });

    const detail = await api.createRun({
      mode: "ticket_completion",
      programId: "ticket-completion-audit-v1",
      source: "hook",
      sourceEventKey: "ticket:TASK-0029:completed",
      sources: [
        {
          sourceId: "TASK-0029-complete",
          sourceKind: "ticket_packet",
          name: "TASK-0029 completed",
          preview: "Extract mining API out of Vite.",
          ticketId: "TASK-0029",
          threadId: "thread-ticket",
          sessionId: "thread-ticket",
          updatedAt: 1782691200,
        },
      ],
    });
    const run = detail?.run as TestJson | undefined;
    const sources = detail?.sources as unknown[] | undefined;

    expect(run).toEqual(
      expect.objectContaining({
        miningMode: "ticket_completion",
        outputCount: 1,
        source: "hook",
      }),
    );
    expect(sources).toHaveLength(1);

    const input = JSON.parse(
      await readFile(path.join(mineRoot, "runs", String(run?.runId), "input.json"), "utf-8"),
    );
    expect(input).toEqual(
      expect.objectContaining({
        mode: "ticket_completion",
        source: "hook",
        sourceEventKey: "ticket:TASK-0029:completed",
      }),
    );
    const storedSources = JSON.parse(
      await readFile(path.join(mineRoot, "runs", String(run?.runId), "sources.json"), "utf-8"),
    );
    expect(storedSources).toEqual([
      expect.objectContaining({
        sourceKind: "ticket_packet",
        sourceId: "TASK-0029-complete",
        ticketId: "TASK-0029",
      }),
    ]);
    const packet = JSON.parse(
      await readFile(path.join(mineRoot, "runs", String(run?.runId), "packet.json"), "utf-8"),
    );
    expect(packet).toEqual(
      expect.objectContaining({
        packetKind: "ticket_completion",
        ticketId: "TASK-0029",
        transcript: expect.objectContaining({ fullTranscriptPolicy: "reference_only" }),
      }),
    );
    expect(JSON.stringify(packet)).not.toContain("full transcript");
    const outputIndex = JSON.parse(
      await readFile(path.join(mineRoot, "runs", String(run?.runId), "outputs", "index.json"), "utf-8"),
    );
    expect(outputIndex[0]).toEqual(
      expect.objectContaining({
        scorecardJsonPath: expect.stringContaining("scorecard.json"),
        scorecardMarkdownPath: expect.stringContaining("scorecard.md"),
      }),
    );
    const scorecard = JSON.parse(
      await readFile(
        path.join(mineRoot, "runs", String(run?.runId), "outputs", String(outputIndex[0].id), "scorecard.json"),
        "utf-8",
      ),
    );
    expect(scorecard).toEqual(
      expect.objectContaining({
        ticketId: "TASK-0029",
        runId: run?.runId,
        deterministicMetrics: expect.arrayContaining([
          expect.objectContaining({ id: "token_usage", status: "unknown" }),
          expect.objectContaining({ id: "proof_artifact_count", value: 1 }),
          expect.objectContaining({ id: "skill_loaded_count", value: 1 }),
          expect.objectContaining({ id: "missed_skill_trigger_count", value: 0 }),
        ]),
        skillTraceAssessment: expect.objectContaining({
          skillLoaded: expect.objectContaining({ status: "observed", loadedCount: 1 }),
          intendedSkills: expect.arrayContaining([expect.objectContaining({ skillId: "impl-plan" })]),
          loadedSkills: expect.arrayContaining([expect.objectContaining({ skillId: "impl-plan" })]),
          correctionNeeded: expect.objectContaining({ status: "observed" }),
        }),
      }),
    );
    expect(outputIndex[0].telemetryEvents).toEqual([
      expect.objectContaining({
        eventName: "ticket.audit.scored",
        outputId: outputIndex[0].id,
        runId: run?.runId,
        ticketId: "TASK-0029",
      }),
    ]);

    const duplicate = await api.createRun({
      mode: "ticket_completion",
      programId: "ticket-completion-audit-v1",
      source: "hook",
      sourceEventKey: "ticket:TASK-0029:completed",
      sources: [
        {
          sourceId: "TASK-0029-complete",
          sourceKind: "ticket_packet",
          name: "TASK-0029 completed again",
          preview: "Duplicate delivery.",
        },
      ],
    });
    expect((duplicate?.run as TestJson | undefined)?.runId).toBe(run?.runId);
  });

  it("rejects unsafe message-window ids before reading source files", async () => {
    const mineRoot = await createTempRoot("farplane-mine-api-");
    const api = createMiningLocalApi({
      mineRoot,
      readFilesystemThreads: async () => [],
      requestCodexThreads: async () => ({ data: [] }),
    });

    await expect(
      api.createRun({
        mode: "ticket_completion",
        programId: "ticket-completion-audit-v1",
        sources: [
          {
            sourceId: "../unsafe",
            sourceKind: "message_window",
            name: "Unsafe source",
            preview: "Should not be read",
            cwd: "/tmp/project",
          },
        ],
      }),
    ).rejects.toThrow("unsafe_source_id");
  });

  it("replays from stored inputs and preserves reviewer verdicts", async () => {
    const mineRoot = await createTempRoot("farplane-mine-api-");
    const api = createMiningLocalApi({
      mineRoot,
      readFilesystemThreads: async () => [],
      requestCodexThreads: async () => ({
        data: [
          {
            id: "thread-1",
            name: "Ticket review thread",
            preview: "TASK-0029 should extract the mining API from Vite.",
            source: { kind: "codex-thread" },
            updatedAt: 1_782_688_400,
          },
        ],
      }),
      now: () => new Date("2026-06-29T00:00:00.000Z"),
    });

    const created = await api.createRun({
      filters: { lastDays: 0, limit: 1 },
      programId: "decision-v1",
      threadIds: ["thread-1"],
    });
    const createdRun = created?.run as TestJson | undefined;
    const createdOutputs = created?.outputs as unknown[] | undefined;
    const runId = String(createdRun?.runId);
    expect(createdOutputs).toHaveLength(1);

    const promoted = await api.updateOutputVerdict({
      outputId: "thread-1",
      runId,
      verdict: "promoted",
    });
    expect(promoted?.run).toEqual(expect.objectContaining({ promotedCount: 1, reviewedCount: 1 }));

    const replayed = await api.replayRun(runId);
    const replayedOutputs = replayed?.outputs as TestJson[] | undefined;
    const replayedAttempts = replayed?.attempts as TestJson[] | undefined;
    const replayedArtifacts = replayed?.artifacts as TestJson[] | undefined;
    expect(replayed?.run).toEqual(
      expect.objectContaining({
        outputCount: 1,
        promotedCount: 1,
        reviewedCount: 1,
      }),
    );
    expect(replayedOutputs?.[0]).toEqual(expect.objectContaining({ verdict: "promoted" }));
    expect(replayedAttempts).toHaveLength(2);
    expect(replayedArtifacts?.map((artifact) => artifact.label)).toEqual(
      expect.arrayContaining(["input.json", "sources.json", "attempts.json", "report.md"]),
    );

    const attempts = JSON.parse(await readFile(path.join(mineRoot, "runs", runId, "attempts.json"), "utf-8"));
    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toEqual(expect.objectContaining({ reason: "replayed_from_stored_input" }));
  });

  it("reads event-miner reports by run id", async () => {
    const projectRoot = await createTempRoot("farplane-event-miner-project-");
    const mineRoot = path.join(projectRoot, ".farplane", "mine");
    await mkdir(path.join(projectRoot, ".farplane", "event-miner", "runs", "run-1"), { recursive: true });
    await writeFile(
      path.join(projectRoot, ".farplane", "event-miner", "runs", "run-1", "report.json"),
      JSON.stringify({
        schemaVersion: 1,
        status: "completed",
        observed: 1,
        summary: "Found a ticket workflow decision.",
        ticketId: "TASK-0029",
        events: [{ eventName: "decision.observed", summary: "Use the ticket completion audit." }],
      }),
      "utf-8",
    );
    const api = createMiningLocalApi({
      mineRoot,
      readFilesystemThreads: async () => [],
      requestCodexThreads: async () => ({ data: [] }),
    });

    const detail = await api.readEventMinerReport("run-1");

    expect(detail).toEqual(
      expect.objectContaining({
        runId: "run-1",
        report: expect.objectContaining({
          observed: 1,
          ticketId: "TASK-0029",
        }),
      }),
    );
    await expect(api.readEventMinerReport("../unsafe")).resolves.toBeNull();
  });
});
