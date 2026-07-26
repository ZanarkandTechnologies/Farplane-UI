import { FileCode2 } from "lucide-react";
import type { ReactElement } from "react";
import { Response } from "@/components/ai-elements/response";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getTaskPass,
  getTaskTags,
  getTaskTitle,
  getTaskVerdict,
  stringifyArtifact,
} from "@/modules/evals/lib/eval-artifacts";
import type { EvalTaskDetail, EvalTaskSummary } from "@/modules/evals/lib/eval-types";

function formatTiming(duration?: number | null, tokens?: number | null): string {
  const parts: string[] = [];
  if (typeof duration === "number") parts.push(`${Math.round(duration).toLocaleString()} ms`);
  if (typeof tokens === "number") parts.push(`${Math.round(tokens).toLocaleString()} tokens`);
  return parts.join(" / ");
}

function DetailBlock({
  title,
  children,
}: {
  title: string;
  children: string;
}): ReactElement | null {
  if (!children.trim()) return null;
  return (
    <section className="rounded-md border p-3">
      <p className="mb-2 text-[11px] uppercase text-muted-foreground">{title}</p>
      <Response className="prose prose-sm max-w-none dark:prose-invert text-sm">
        {children}
      </Response>
    </section>
  );
}

export function EvalTaskDetailPanel({
  task,
  detail,
}: {
  task: EvalTaskSummary | null;
  detail?: EvalTaskDetail;
}): ReactElement {
  if (!task) {
    return (
      <div className="grid h-full place-items-center rounded-md border border-dashed text-sm text-muted-foreground">
        Select an eval task.
      </div>
    );
  }
  const pass = getTaskPass(task, detail);
  const candidate = detail?.candidate;
  const baseline = detail?.baseline;
  const answer =
    candidate?.agent?.answer_text ??
    candidate?.agent?.answer ??
    candidate?.agent?.output ??
    detail?.agent?.answer_text ??
    detail?.agent?.answer ??
    detail?.agent?.output ??
    "";
  const prompt =
    detail?.task?.prompt ?? detail?.task?.query ?? stringifyArtifact(detail?.task?.input);
  const expected = stringifyArtifact(detail?.task?.expected);
  const artifacts = Object.entries(detail?.artifacts ?? {});
  const referencePoints =
    candidate?.judge?.reference_points ??
    candidate?.judge?.reference_point_results ??
    detail?.judge?.reference_points ??
    detail?.judge?.reference_point_results ??
    [];
  const assertions = candidate?.grading?.assertion_results ?? [];
  const candidateTiming = formatTiming(
    candidate?.timing?.duration_ms,
    candidate?.timing?.total_tokens,
  );
  const baselineTiming = formatTiming(
    baseline?.timing?.duration_ms,
    baseline?.timing?.total_tokens,
  );
  return (
    <div className="flex h-full min-h-0 flex-col rounded-md border">
      <div className="border-b p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{getTaskTitle(detail ?? task)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{task.task_id}</p>
          </div>
          <Badge variant={pass === false ? "destructive" : pass === true ? "secondary" : "outline"}>
            {getTaskVerdict(task, detail)}
          </Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {getTaskTags(task, detail).map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-4">
          {candidate || baseline ? (
            <section className="rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase text-muted-foreground">
                  {baseline ? "Candidate vs baseline" : "Candidate evidence"}
                </p>
                {detail?.comparison?.delta ? (
                  <Badge
                    variant={
                      detail.comparison.delta === "candidate_wins"
                        ? "secondary"
                        : detail.comparison.delta === "baseline_skipped"
                          ? "outline"
                          : "destructive"
                    }
                  >
                    {detail.comparison.delta === "candidate_wins"
                      ? "skill adds value"
                      : detail.comparison.delta === "baseline_skipped"
                        ? "baseline skipped"
                        : "no measured lift"}
                  </Badge>
                ) : null}
              </div>
              <div className={`grid gap-2 ${baseline ? "sm:grid-cols-2" : ""}`}>
                <div className="rounded-md bg-muted/40 p-2">
                  <p className="text-xs font-medium">Candidate</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {candidateTiming || candidate?.judge?.reason || "No timing recorded"}
                  </p>
                </div>
                {baseline ? (
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-xs font-medium">Baseline</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {baseline.skipped
                        ? (baseline.reason ?? "Skipped")
                        : baselineTiming || baseline.judge?.reason || "No timing recorded"}
                    </p>
                  </div>
                ) : null}
              </div>
              {detail?.comparison?.delta ? (
                <p className="mt-2 text-xs text-muted-foreground">{detail.comparison.delta}</p>
              ) : null}
            </section>
          ) : null}
          <DetailBlock title="Prompt">{prompt}</DetailBlock>
          <DetailBlock title="Agent Answer">{answer}</DetailBlock>
          <DetailBlock title="Judge Reason">
            {candidate?.judge?.reason ?? detail?.judge?.reason ?? task.reason ?? ""}
          </DetailBlock>
          <DetailBlock title="Rubric">{detail?.task?.rubric ?? ""}</DetailBlock>
          <DetailBlock title="Expected">{expected}</DetailBlock>
          {assertions.length ? (
            <section className="rounded-md border p-3">
              <p className="mb-2 text-[11px] uppercase text-muted-foreground">Assertions</p>
              <div className="space-y-2">
                {assertions.map((assertion, index) => (
                  <div
                    key={`${assertion.text ?? "assertion"}-${index}`}
                    className="rounded-md border p-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm">{assertion.text ?? `Assertion ${index + 1}`}</p>
                      <Badge variant={assertion.passed === false ? "destructive" : "secondary"}>
                        {assertion.passed === true
                          ? "pass"
                          : assertion.passed === false
                            ? "fail"
                            : "unknown"}
                      </Badge>
                    </div>
                    {assertion.evidence ? (
                      <p className="mt-1 text-xs text-muted-foreground">{assertion.evidence}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          <DetailBlock title="Behavior Trace">
            {stringifyArtifact(candidate?.behavior_trace ?? detail?.behavior_trace)}
          </DetailBlock>
          {referencePoints.length ? (
            <section className="rounded-md border p-3">
              <p className="mb-2 text-[11px] uppercase text-muted-foreground">Reference Points</p>
              <div className="space-y-2">
                {referencePoints.map((point, index) => (
                  <div
                    key={`${point.id ?? point.label ?? "point"}-${index}`}
                    className="rounded-md border p-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">
                        {point.label ?? point.id ?? `Point ${index + 1}`}
                      </p>
                      <Badge variant={point.status === "fail" ? "destructive" : "secondary"}>
                        {point.status ?? "unknown"}
                      </Badge>
                    </div>
                    {point.reason ? (
                      <p className="mt-1 text-xs text-muted-foreground">{point.reason}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {artifacts.length ? (
            <section className="rounded-md border p-3">
              <div className="mb-2 flex items-center gap-2">
                <FileCode2 className="size-4 text-primary" />
                <p className="text-[11px] uppercase text-muted-foreground">Artifacts</p>
              </div>
              <div className="space-y-2">
                {artifacts.map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[112px_minmax(0,1fr)] gap-2 text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <code className="truncate rounded bg-muted px-2 py-1">{value}</code>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {!detail ? (
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              Detail JSON has not been loaded for this task.
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
