import { describe, expect, it } from "vitest";

import {
  buildSelfImproveRunSummaries,
  parseSelfImproveRun,
  type SelfImprovementRunPacket,
} from "./self-improvement-runs";

function packet(overrides: Partial<SelfImprovementRunPacket> = {}): SelfImprovementRunPacket {
  return {
    projectId: "project-one",
    projectName: "Project One",
    ticketId: "TASK-1000",
    ticketTitle: "Improve research",
    ticketUpdatedAt: 0,
    ticketMarkdown:
      "---\nstatus: in_progress\nupdated_at: 2026-08-01T10:00:00Z\nnext_action: Run baseline\n---\n",
    programMarkdown:
      "---\nmode: skill_improvement\nstatus: active\n---\n\n# Self-Improve: research\n",
    progressMarkdown: "",
    ...overrides,
  };
}

describe("SelfImproveRunSummary", () => {
  it("keeps missing score, phase, and evidence fields absent", () => {
    const summary = parseSelfImproveRun(packet());
    expect(summary).toMatchObject({ targetSkill: "research", status: "active", evidenceRefs: [] });
    expect(summary).not.toHaveProperty("currentScore", expect.any(String));
    expect(summary.phase).toBeUndefined();
    expect(summary.scoreDelta).toBeUndefined();
  });

  it("uses only explicit latest progress fields", () => {
    const summary = parseSelfImproveRun(
      packet({
        progressMarkdown: [
          "## 2026-08-02 10:00 +0800 - harden",
          "- `phase:` harden",
          "- `baseline_score:` 3/6",
          "- `current_score:` 5/6",
          "- `target_score:` 6/6",
          "- `score_delta:` +2",
          "- `evidence:` `.farplane/evals/run-1`; `artifacts/review.md`",
          "- `next_action:` Test the next leaf",
        ].join("\n"),
      }),
    );
    expect(summary).toMatchObject({
      phase: "harden",
      baselineScore: "3/6",
      currentScore: "5/6",
      targetScore: "6/6",
      scoreDelta: "+2",
      nextAction: "Test the next leaf",
      evidenceRefs: [".farplane/evals/run-1", "artifacts/review.md"],
    });
  });

  it("extracts the target from the established runtime-skill contract", () => {
    const summary = parseSelfImproveRun(
      packet({
        programMarkdown:
          "---\nstatus: active\n---\n\n# Goal Program\n\n- Runtime skill: `.agents/skills/mineral-prospectivity-analyst/`.\n",
      }),
    );
    expect(summary.targetSkill).toBe("mineral-prospectivity-analyst");
  });

  it("orders summaries by explicit update time without synthesizing values", () => {
    const summaries = buildSelfImproveRunSummaries([
      packet({
        ticketId: "TASK-1000",
        ticketMarkdown: "---\nupdated_at: 2026-08-01T00:00:00Z\n---\n",
      }),
      packet({
        ticketId: "TASK-1001",
        ticketMarkdown: "---\nupdated_at: 2026-08-03T00:00:00Z\n---\n",
      }),
    ]);
    expect(summaries.map((summary) => summary.ticketId)).toEqual(["TASK-1001", "TASK-1000"]);
    expect(summaries.every((summary) => summary.currentScore === undefined)).toBe(true);
  });
});
