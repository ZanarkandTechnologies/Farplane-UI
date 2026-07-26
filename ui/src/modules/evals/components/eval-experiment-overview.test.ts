import { describe, expect, it } from "vitest";
import { buildExperimentMetrics } from "../lib/eval-experiment-metrics";

describe("eval experiment overview", () => {
  it("formats candidate and baseline benchmark metrics", () => {
    expect(
      buildExperimentMetrics({
        schema_version: 2,
        job_id: "run-2",
        pass_rate: 0.75,
        tasks: [],
        benchmark: {
          run_summary: {
            baseline: { pass_rate: { mean: 0.5 }, duration_ms: { mean: 2000 } },
            candidate: { pass_rate: { mean: 0.75 }, duration_ms: { mean: 1500 } },
          },
        },
      }),
    ).toEqual([
      { label: "Pass rate", baseline: "50%", candidate: "75%" },
      { label: "Duration", baseline: "2,000 ms", candidate: "1,500 ms" },
      { label: "Tokens", baseline: "--", candidate: "--" },
    ]);
  });
});
