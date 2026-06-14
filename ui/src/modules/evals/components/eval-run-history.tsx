import { Clock3 } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatPercent, formatRunDate } from "@/modules/evals/lib/eval-artifacts";
import type { EvalRunIndexEntry } from "@/modules/evals/lib/eval-types";

export function EvalRunHistory({
  runs,
  selectedRunId,
  onSelectRun,
}: {
  runs: EvalRunIndexEntry[];
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
}): ReactElement {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-md border">
      <div className="border-b p-3">
        <div className="flex items-center gap-2">
          <Clock3 className="size-4 text-primary" />
          <p className="font-semibold">Run History</p>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-3">
          {runs.length ? (
            runs.map((run) => (
              <Button
                key={run.job_id}
                type="button"
                variant={run.job_id === selectedRunId ? "secondary" : "ghost"}
                className="h-auto w-full justify-start rounded-md border px-3 py-2 text-left"
                onClick={() => onSelectRun(run.job_id)}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="line-clamp-2 break-words font-medium">{run.label || run.job_id}</span>
                    {run.job_id === selectedRunId ? <Badge variant="secondary">open</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatRunDate(run.created_at ?? run.completed_at)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {run.task_count ?? "--"} tasks / {formatPercent(run.pass_rate)}
                  </p>
                </div>
              </Button>
            ))
          ) : (
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              No local run index.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
