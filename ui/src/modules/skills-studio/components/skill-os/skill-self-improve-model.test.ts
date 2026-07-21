import { describe, expect, it } from "vitest";
import {
  buildSelfImproveProjection,
  hasSelfImproveDirectory,
  parseSelfImproveProgress,
} from "./skill-self-improve-model";

describe("skill self-improve projection", () => {
  it("reads the canonical plan and plots numeric, grade, and unscored entries", () => {
    const projection = buildSelfImproveProjection(
      `# Self-Improve Program: example

## Objective

Make the skill more reliable.

## Metric

- Primary: \`skill_eval_pass_rate\`
- Direction: higher

## Stop Rule

- Stop after five candidates without improvement.
`,
      `# Self-Improve Progress: example

## 2026-07-19 — baseline

- Hypothesis: establish the baseline.
- Primary metric: 0.72
- Decision: accept current best

## 2026-07-20 — clearer routing

- Hypothesis: clearer routing will improve behavior.
- Primary metric: 88%
- Learning: explicit ownership reduced drift.
- Decision: promote

## 2026-07-21 — human artifact

- Hypothesis: visual hierarchy will improve acceptance.
- Grade: A
- Decision: keep local

## 2026-07-22 — follow-up

- Learning: keep the rejected case as a regression fixture.
- Decision: reject
`,
    );

    expect(projection.plan).toEqual({
      objective: "Make the skill more reliable.",
      primaryMetric: "skill_eval_pass_rate",
      direction: "higher",
      stopRule: "Stop after five candidates without improvement.",
    });
    expect(projection.entries.map((entry) => entry.score?.display)).toEqual([
      "72%",
      "88%",
      "A",
      undefined,
    ]);
    expect(projection.entries[1]?.insight).toBe("explicit ownership reduced drift.");
  });

  it("uses the latest result ratio and keeps multiline fields together", () => {
    const entries = parseSelfImproveProgress(`## 2026-07-19 — candidate

- Hypothesis: compare the same suite
  against the current best.
- Result: moved from 7/10 to 9/10 tasks.
- Decision: accept
`);
    expect(entries[0]?.fields[0]?.value).toBe("compare the same suite against the current best.");
    expect(entries[0]?.score).toMatchObject({ display: "90%", normalized: 90 });
  });

  it("does not infer a letter grade from ordinary result prose", () => {
    const entries = parseSelfImproveProgress(`## 2026-07-19 — smoke run

- Result: four tasks loaded in a deterministic custom-harness smoke run.
- Decision: hold
`);
    expect(entries[0]?.score).toBeUndefined();
  });

  it("detects the directory from any self-improve file", () => {
    expect(
      hasSelfImproveDirectory([{ path: "SKILL.md" }, { path: "self-improve/program.md" }]),
    ).toBe(true);
    expect(hasSelfImproveDirectory([{ path: "SKILL.md" }, { path: "evals/evals.json" }])).toBe(
      false,
    );
  });
});
