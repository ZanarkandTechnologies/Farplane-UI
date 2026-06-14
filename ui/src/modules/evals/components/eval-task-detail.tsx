import { FileCode2 } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Response } from "@/components/ai-elements/response";
import {
  getTaskPass,
  getTaskTags,
  getTaskTitle,
  getTaskVerdict,
  stringifyArtifact,
} from "@/modules/evals/lib/eval-artifacts";
import type { EvalTaskDetail, EvalTaskSummary } from "@/modules/evals/lib/eval-types";

function DetailBlock({ title, children }: { title: string; children: string }): ReactElement | null {
  if (!children.trim()) return null;
  return (
    <section className="rounded-md border p-3">
      <p className="mb-2 text-[11px] uppercase text-muted-foreground">{title}</p>
      <Response className="prose prose-sm max-w-none dark:prose-invert text-sm">{children}</Response>
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
  const answer =
    detail?.agent?.answer_text ?? detail?.agent?.answer ?? detail?.agent?.output ?? "";
  const prompt =
    detail?.task?.prompt ?? detail?.task?.query ?? stringifyArtifact(detail?.task?.input);
  const expected = stringifyArtifact(detail?.task?.expected);
  const artifacts = Object.entries(detail?.artifacts ?? {});
  const referencePoints =
    detail?.judge?.reference_points ?? detail?.judge?.reference_point_results ?? [];
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
          <DetailBlock title="Prompt">{prompt}</DetailBlock>
          <DetailBlock title="Agent Answer">{answer}</DetailBlock>
          <DetailBlock title="Judge Reason">{detail?.judge?.reason ?? task.reason ?? ""}</DetailBlock>
          <DetailBlock title="Rubric">{detail?.task?.rubric ?? ""}</DetailBlock>
          <DetailBlock title="Expected">{expected}</DetailBlock>
          {referencePoints.length ? (
            <section className="rounded-md border p-3">
              <p className="mb-2 text-[11px] uppercase text-muted-foreground">Reference Points</p>
              <div className="space-y-2">
                {referencePoints.map((point, index) => (
                  <div key={`${point.id ?? point.label ?? "point"}-${index}`} className="rounded-md border p-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{point.label ?? point.id ?? `Point ${index + 1}`}</p>
                      <Badge variant={point.status === "fail" ? "destructive" : "secondary"}>
                        {point.status ?? "unknown"}
                      </Badge>
                    </div>
                    {point.reason ? <p className="mt-1 text-xs text-muted-foreground">{point.reason}</p> : null}
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
