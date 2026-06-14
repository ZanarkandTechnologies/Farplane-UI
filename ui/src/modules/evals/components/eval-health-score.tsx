import { Activity, CheckCircle2, XCircle } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatPercent } from "@/modules/evals/lib/eval-artifacts";
import type { EvalHealth } from "@/modules/evals/lib/eval-health";

export function EvalHealthScore({ health }: { health: EvalHealth }): ReactElement {
  return (
    <Card className="rounded-md py-0">
      <CardContent className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 p-4">
        <div className="grid size-24 place-items-center rounded-full border bg-muted/20">
          <div className="text-center">
            <p className="text-3xl font-semibold leading-none">{health.score}</p>
            <p className="mt-1 text-[10px] uppercase text-muted-foreground">health</p>
          </div>
        </div>
        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Eval Health</p>
              <p className="text-xs text-muted-foreground">{health.verdict}</p>
            </div>
            <Badge variant={health.failureCount ? "destructive" : "secondary"}>
              {health.failureCount ? "needs review" : "passing"}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-md border p-2">
              <CheckCircle2 className="mb-1 size-3.5 text-primary" />
              <p className="font-semibold">{formatPercent(health.passRate)}</p>
              <p className="text-muted-foreground">pass rate</p>
            </div>
            <div className="rounded-md border p-2">
              <Activity className="mb-1 size-3.5 text-primary" />
              <p className="font-semibold">{health.taskCount}</p>
              <p className="text-muted-foreground">tasks</p>
            </div>
            <div className="rounded-md border p-2">
              <XCircle className="mb-1 size-3.5 text-destructive" />
              <p className="font-semibold">{health.failureCount}</p>
              <p className="text-muted-foreground">failures</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
