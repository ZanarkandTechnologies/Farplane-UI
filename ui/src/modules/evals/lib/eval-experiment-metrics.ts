import { formatPercent } from "@/modules/evals/lib/eval-artifacts";
import type { EvalBenchmarkVariant, EvalSummary } from "@/modules/evals/lib/eval-types";

function mean(
  variant: EvalBenchmarkVariant | undefined,
  key: keyof EvalBenchmarkVariant,
): number | undefined {
  const value = variant?.[key]?.mean;
  return typeof value === "number" ? value : undefined;
}

function formatNumber(value: number | undefined, suffix = ""): string {
  if (value === undefined) return "--";
  return `${Math.round(value).toLocaleString()}${suffix}`;
}

export function buildExperimentMetrics(summary: EvalSummary): Array<{
  label: string;
  baseline: string;
  candidate: string;
}> {
  const runSummary = summary.benchmark?.run_summary;
  return [
    {
      label: "Pass rate",
      baseline: formatPercent(mean(runSummary?.baseline, "pass_rate")),
      candidate: formatPercent(mean(runSummary?.candidate, "pass_rate") ?? summary.pass_rate),
    },
    {
      label: "Duration",
      baseline: formatNumber(mean(runSummary?.baseline, "duration_ms"), " ms"),
      candidate: formatNumber(mean(runSummary?.candidate, "duration_ms"), " ms"),
    },
    {
      label: "Tokens",
      baseline: formatNumber(mean(runSummary?.baseline, "total_tokens")),
      candidate: formatNumber(mean(runSummary?.candidate, "total_tokens")),
    },
  ];
}
