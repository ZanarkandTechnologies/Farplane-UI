import { describe, expect, it } from "vitest";
import {
  artifactPreview,
  defaultOutputViewMode,
  displayEvidenceSource,
  filterOutputs,
  filterThreads,
  outputEvidenceRows,
  scorecardSummary,
  selectedThreadIds,
  sortMiningRuns,
} from "@/modules/thread-data/lib/mining-artifacts";
import type {
  ThreadDataRunIndexEntry,
  ThreadDataRunOutput,
  ThreadDataSource,
} from "@/modules/thread-data/types";

const threads: ThreadDataSource[] = [
  {
    id: "thread-a",
    name: "Decision telemetry",
    preview: "projection and stop hook design",
    updatedAt: 10,
  },
  {
    id: "thread-b",
    name: "Historical mining",
    preview: "programs over old sessions",
    updatedAt: 20,
  },
];

const outputs: ThreadDataRunOutput[] = [
  {
    id: "thread-a",
    sessionId: "session-a",
    threadId: "thread-a",
    sourceTitle: "Decision telemetry",
    status: "complete",
    verdict: "unreviewed",
    redactionStatus: "clean",
    summary: "Captured key decisions",
    outputMarkdownPath: "output.md",
    outputJsonPath: "output.json",
  },
];

describe("mining artifact helpers", () => {
  it("sorts runs newest first", () => {
    const runs: ThreadDataRunIndexEntry[] = [
      {
        runId: "old",
        programId: "decision-v1",
        programVersion: "1.0.0",
        label: "old",
        status: "complete",
        createdAt: "2026-01-01T00:00:00.000Z",
        sourceCount: 1,
        outputCount: 1,
        reviewedCount: 0,
        promotedCount: 0,
        rejectedCount: 0,
      },
      {
        runId: "new",
        programId: "decision-v1",
        programVersion: "1.0.0",
        label: "new",
        status: "complete",
        createdAt: "2026-06-01T00:00:00.000Z",
        sourceCount: 1,
        outputCount: 1,
        reviewedCount: 0,
        promotedCount: 0,
        rejectedCount: 0,
      },
    ];

    expect(sortMiningRuns(runs).map((run) => run.runId)).toEqual(["new", "old"]);
  });

  it("filters thread and output search text", () => {
    expect(filterThreads(threads, "stop hook").map((thread) => thread.id)).toEqual(["thread-a"]);
    expect(filterOutputs(outputs, "decisions").map((output) => output.id)).toEqual(["thread-a"]);
  });

  it("defaults selected threads to the first ten when none are checked", () => {
    expect(selectedThreadIds(threads, new Set())).toEqual(["thread-a", "thread-b"]);
    expect(selectedThreadIds(threads, new Set(["thread-b"]))).toEqual(["thread-b"]);
  });

  it("redacts local user prefixes from evidence sources", () => {
    expect(
      displayEvidenceSource(
        "/Users/example/Zanarkand Technologies/projects/Farplane/.farplane/state/session.json",
      ),
    ).toBe("~/Zanarkand Technologies/projects/Farplane/.farplane/state/session.json");
  });

  it("extracts evidence rows while dropping empty or malformed spans", () => {
    expect(
      outputEvidenceRows({
        evidenceSpans: [
          {
            id: "span-1",
            role: "user",
            text: " choose the projection path ",
            sourcePath: "/Users/example/project/thread.json",
            jsonPointer: "/messages/0",
          },
          {
            id: "span-2",
            role: "assistant",
            text: "   ",
            sourcePath: "/Users/example/project/thread.json",
          },
          null,
        ],
      }),
    ).toEqual([
      {
        id: "span-1",
        role: "user",
        text: "choose the projection path",
        source: "~/project/thread.json/messages/0",
      },
    ]);
  });

  it("chooses ticket-completion scorecard summaries before raw evidence", () => {
    expect(
      defaultOutputViewMode(
        {
          createdAt: "2026-06-01T00:00:00.000Z",
          label: "ticket",
          miningMode: "ticket_completion",
          outputCount: 1,
          programId: "ticket-completion-audit-v1",
          programVersion: "0.1.0",
          promotedCount: 0,
          rejectedCount: 0,
          reviewedCount: 0,
          runId: "run-1",
          sourceCount: 1,
          status: "complete",
        },
        outputs[0],
      ),
    ).toBe("summary");
  });

  it("extracts tolerant scorecard summaries and artifact previews", () => {
    expect(
      scorecardSummary({
        scorecard: {
          overall: "good",
          proof_quality: "medium",
          scope_followed: "high",
          skipped_steps: "visual qa",
        },
      }),
    ).toEqual({
      overall: "good",
      proofQuality: "medium",
      scopeFollowed: "high",
      skippedSteps: "visual qa",
    });
    expect(
      artifactPreview({
        id: "input",
        kind: "json",
        label: "input.json",
        path: "/tmp/input.json",
      }),
    ).toBe("input.json\n/tmp/input.json");
  });
});
