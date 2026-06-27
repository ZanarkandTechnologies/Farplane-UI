import { describe, expect, it } from "vitest";
import {
  displayEvidenceSource,
  filterOutputs,
  filterThreads,
  outputEvidenceRows,
  selectedThreadIds,
  sortBackfillRuns,
} from "@/modules/thread-data/lib/backfill-artifacts";
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
    name: "Backfill mining",
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

describe("backfill artifact helpers", () => {
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

    expect(sortBackfillRuns(runs).map((run) => run.runId)).toEqual(["new", "old"]);
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
});
