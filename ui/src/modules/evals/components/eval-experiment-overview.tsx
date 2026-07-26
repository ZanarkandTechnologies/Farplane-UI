import { ArrowRight } from "lucide-react";
import type { ReactElement } from "react";
import { buildExperimentMetrics } from "@/modules/evals/lib/eval-experiment-metrics";
import type { EvalSummary } from "@/modules/evals/lib/eval-types";

export function EvalExperimentOverview({ summary }: { summary: EvalSummary }): ReactElement | null {
  if (!summary.benchmark && (summary.schema_version ?? 1) < 2) return null;
  const metrics = buildExperimentMetrics(summary);
  const hasBaseline = Boolean(summary.benchmark?.run_summary?.baseline);
  return (
    <section className="rounded-md border bg-card/70 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">
            {hasBaseline ? "Experiment comparison" : "Experiment result"}
          </p>
          <p className="text-xs text-muted-foreground">
            {hasBaseline
              ? "Candidate against the unchanged baseline on the same eval suite."
              : "Candidate metrics for this eval suite."}
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-md border bg-background p-2.5">
            <p className="text-[10px] uppercase text-muted-foreground">{metric.label}</p>
            <div className="mt-1 flex items-center gap-2 text-sm tabular-nums">
              {hasBaseline ? (
                <>
                  <span className="text-muted-foreground">{metric.baseline}</span>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                </>
              ) : null}
              <span className="font-semibold">{metric.candidate}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
