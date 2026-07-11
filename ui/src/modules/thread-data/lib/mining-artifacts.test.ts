import { describe, expect, it } from "vitest";
import {
  artifactPreview,
  artifactPreviewText,
  defaultOutputViewMode,
  displayEvidenceSource,
  filterOutputs,
  filterThreads,
  outputEvidenceRows,
  parseArtifactJson,
  preferredArtifactId,
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

  it("chooses summaries from report shape rather than a hardcoded program id", () => {
    expect(
      defaultOutputViewMode(
        {
          createdAt: "2026-06-01T00:00:00.000Z",
          label: "ticket",
          miningMode: "ticket_completion",
          outputCount: 1,
          programId: "core-report-v2",
          programVersion: "0.1.0",
          promotedCount: 0,
          rejectedCount: 0,
          reviewedCount: 0,
          runId: "run-1",
          sourceCount: 1,
          status: "complete",
        },
        { ...outputs[0], outputScorecard: { overall: "material findings" } },
      ),
    ).toBe("summary");
  });

  it("extracts tolerant scorecard summaries and artifact previews", () => {
    expect(
      scorecardSummary({
        scorecard: {
          overall: "good",
          overallScore: 80,
          proof_quality: "medium",
          scope_followed: "high",
          skipped_steps: "visual qa",
          skillTraceSummary: "Loaded: none observed.",
          skillTraceAssessment: {
            skillLoaded: { status: "not_observed", reason: "No local skill read." },
            skillLoadTiming: { status: "unknown", value: "unknown" },
            missedTrigger: { skillIds: ["pulse-update"] },
            falsePositiveTrigger: { skillIds: [] },
            wastedSteps: { summary: "No detours." },
            defaultFollowed: { status: "unknown", reason: "Needs full trace." },
            referenceLoads: [{ path: "docs/example.md" }],
            correctionNeeded: { status: "not_observed" },
            traceToSkillDelta: [],
            limitations: ["bounded packet only"],
          },
        },
      }),
    ).toEqual({
      overall: "good",
      overallScore: 80,
      proofQuality: "medium",
      scopeFollowed: "high",
      skillTrace: {
        correctionNeeded: "not_observed",
        defaultFollowed: "unknown: Needs full trace.",
        falsePositiveTriggers: [],
        limitations: ["bounded packet only"],
        missedTriggers: ["pulse-update"],
        referenceLoadCount: 1,
        skillLoadTiming: "unknown",
        skillLoaded: "not_observed: No local skill read.",
        traceToSkillDeltaCount: 0,
        wastedSteps: "No detours.",
      },
      skillTraceSummary: "Loaded: none observed.",
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
    expect(
      preferredArtifactId([
        { id: "input", kind: "json", label: "input.json", path: "/tmp/input.json" },
        { id: "report", kind: "markdown", label: "report.md", path: "/tmp/report.md" },
      ]),
    ).toBe("report");
    expect(
      parseArtifactJson({
        content: '{"ok":true}',
        id: "input",
        kind: "json",
        label: "input.json",
        path: "/tmp/input.json",
      }),
    ).toEqual({ ok: true });
    expect(
      parseArtifactJson({
        content: "x".repeat(1_000_001),
        id: "input",
        kind: "json",
        label: "input.json",
        path: "/tmp/input.json",
      }),
    ).toBeNull();
    expect(
      artifactPreviewText({
        content: "x".repeat(120_001),
        id: "input",
        kind: "json",
        label: "input.json",
        path: "/tmp/input.json",
      }),
    ).toContain("Preview truncated");
  });
});
