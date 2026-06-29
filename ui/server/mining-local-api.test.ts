import { mkdtemp, readFile, rm } from "node:fs/promises";
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
    const mineRoot = await createTempRoot("farplane-mine-api-");
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
          threadId: "thread-ticket",
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
});
