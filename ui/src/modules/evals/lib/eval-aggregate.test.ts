import { describe, expect, it } from "vitest";
import {
  buildAggregateSummary,
  computeAggregateMetrics,
  formatScorePercent,
  getSkillCatalogIds,
} from "./eval-aggregate";
import type { EvalSummary, EvalTaskDetail } from "./eval-types";

const tasks: EvalSummary["tasks"] = [
  { task_id: "skill-a", pass: true, verdict: "A" },
  { task_id: "skill-b", pass: true, verdict: "B" },
  { task_id: "skill-c", pass: false, verdict: "D" },
];

const detailsByTaskId: Record<string, EvalTaskDetail> = {
  "skill-a": { task_id: "skill-a", task: { id: "skill-a", tags: ["skill"] } },
  "skill-b": { task_id: "skill-b", task: { id: "skill-b", tags: ["skill"] } },
  "skill-c": { task_id: "skill-c", task: { id: "skill-c", tags: ["skill"] } },
};

describe("Eval aggregate helpers", () => {
  it("builds a synthetic latest-per-eval summary", () => {
    expect(
      buildAggregateSummary({
        detailsByTaskId,
        runs: [{ job_id: "run-new", created_at: "2026-07-01T00:00:00Z" }],
        tasks,
      }),
    ).toMatchObject({
      job_id: "__aggregate_latest__",
      label: "Aggregate: latest per eval",
      pass_rate: 2 / 3,
      verdict_counts: { A: 1, B: 1, D: 1 },
      task_count: 3,
    });
  });

  it("scores eval quality and coverage-adjusted harness health", () => {
    const metrics = computeAggregateMetrics({
      detailsByTaskId,
      skillCatalogIds: ["skill-a", "skill-b", "skill-c", "skill-d"],
      summary: { job_id: "__aggregate_latest__", tasks },
    });

    expect(metrics.evaluatedSkillCount).toBe(3);
    expect(metrics.noEvalCount).toBe(1);
    expect(metrics.evalQuality).toBe(8 / 12);
    expect(metrics.harnessScore).toBe(8 / 16);
    expect(metrics.coverageLabel).toBe("3 / 4");
    expect(metrics.failingCount).toBe(1);
  });

  it("normalizes catalog ids and score labels", () => {
    expect(getSkillCatalogIds([{ skillId: "b" }, { name: "a" }, { skillId: "b" }])).toEqual([
      "a",
      "b",
    ]);
    expect(formatScorePercent(0.875)).toBe("88%");
    expect(formatScorePercent(Number.NaN)).toBe("--");
  });
});
