import { ArrowLeft, FileText, Search } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SkillCatalogEntry } from "@/modules/evals/lib/eval-aggregate";
import { formatRunDate, getTaskPass } from "@/modules/evals/lib/eval-artifacts";
import {
  buildAgentMdHealthRow,
  buildEvalSkillHealthRowsFromCatalog,
  type EvalSkillHealthRow,
  type SkillHealthStatus,
  taskTargetsAgentMd,
  taskTargetsSkill,
} from "@/modules/evals/lib/eval-skill-health";
import type { EvalTaskDetail, EvalTaskSummary } from "@/modules/evals/lib/eval-types";

export type EvalHealthTarget = { kind: "agent-md" } | { kind: "skill"; skillId: string };

function statusLabel(status: SkillHealthStatus): string {
  return status === "no-coverage" ? "No coverage" : status;
}

function HealthBadge({ status }: { status: SkillHealthStatus }): ReactElement {
  return (
    <Badge
      variant={
        status === "blocked" ? "destructive" : status === "healthy" ? "secondary" : "outline"
      }
    >
      {statusLabel(status)}
    </Badge>
  );
}

function SkillHealthCard({
  row,
  onOpen,
}: {
  row: EvalSkillHealthRow;
  onOpen: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      className="flex min-h-56 min-w-0 flex-col rounded-md border bg-card p-4 text-left transition hover:border-primary/50 hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate font-semibold">{row.skillId}</p>
        <Badge variant="outline" className="shrink-0">
          T{row.tier ?? 3}
        </Badge>
      </div>
      <div className="mt-5 flex items-end justify-between gap-3">
        <span className="font-mono text-4xl font-semibold tabular-nums">{row.score ?? "—"}</span>
        <HealthBadge status={row.status} />
      </div>
      <p className="mt-4 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">
        {row.description || "Reusable agent workflow."}
      </p>
      <div className="mt-auto space-y-1 pt-4 text-xs text-muted-foreground">
        <p>
          {row.taskCount
            ? `${row.passedCount}/${row.taskCount} passing · ${row.failureCount} failing`
            : "No eval evidence"}
        </p>
        <p>
          {row.evaluatedAt ? `Last evaluated ${formatRunDate(row.evaluatedAt)}` : "Never evaluated"}
        </p>
      </div>
      <span className="mt-3 text-xs font-medium text-primary">
        {row.taskCount ? "Open health →" : "Inspect coverage →"}
      </span>
    </button>
  );
}

function AgentMdCard({
  row,
  onOpen,
}: {
  row: EvalSkillHealthRow;
  onOpen: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      className="grid w-full gap-5 rounded-md border bg-card p-5 text-left transition hover:border-primary/50 hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring md:grid-cols-[minmax(0,1.2fr)_auto_minmax(15rem,0.8fr)] md:items-center"
      onClick={onOpen}
      data-testid="agent-md-health-card"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-primary" />
          <p className="text-lg font-semibold">Agent.md</p>
          <Badge variant="outline">Global contract</Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Shared behavior, autonomy, tool-use, and proof instructions.
        </p>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-mono text-4xl font-semibold tabular-nums">{row.score ?? "—"}</span>
        <HealthBadge status={row.status} />
      </div>
      <div className="space-y-1 text-xs text-muted-foreground md:text-right">
        <p>
          {row.taskCount
            ? `${row.passedCount}/${row.taskCount} passing · ${row.failureCount} failing`
            : "No Agent.md eval evidence"}
        </p>
        <p>
          {row.evaluatedAt ? `Last evaluated ${formatRunDate(row.evaluatedAt)}` : "Never evaluated"}
        </p>
        <p className="font-medium text-primary">Open health →</p>
      </div>
    </button>
  );
}

function EvidenceCard({
  task,
  detail,
  onOpen,
}: {
  task: EvalTaskSummary;
  detail?: EvalTaskDetail;
  onOpen: () => void;
}): ReactElement {
  const pass = getTaskPass(task, detail);
  return (
    <button
      type="button"
      className="flex min-h-44 flex-col rounded-md border bg-card p-4 text-left hover:border-primary/50 hover:bg-muted/30"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="line-clamp-2 font-semibold">{task.title || task.task_id}</p>
        <Badge variant={pass === false ? "destructive" : pass === true ? "secondary" : "outline"}>
          {pass === false ? "Fail" : pass === true ? "Pass" : "Unknown"}
        </Badge>
      </div>
      <p className="mt-3 line-clamp-3 text-xs leading-5 text-muted-foreground">
        {task.reason || detail?.judge?.reason || "No judge reason loaded."}
      </p>
      <span className="mt-auto pt-4 text-xs font-medium text-primary">Open evidence →</span>
    </button>
  );
}

export function EvalTargetHealthDetail({
  target,
  tasks,
  detailsByTaskId,
  onBack,
  onOpenTask,
}: {
  target: EvalHealthTarget;
  tasks: EvalTaskSummary[];
  detailsByTaskId: Record<string, EvalTaskDetail>;
  onBack: () => void;
  onOpenTask: (taskId: string) => void;
}): ReactElement {
  const targetTasks = tasks.filter((task) =>
    target.kind === "agent-md"
      ? taskTargetsAgentMd(task, detailsByTaskId[task.task_id])
      : taskTargetsSkill(target.skillId, task, detailsByTaskId[task.task_id]),
  );
  const row =
    target.kind === "agent-md"
      ? buildAgentMdHealthRow({ detailsByTaskId, tasks })
      : buildEvalSkillHealthRowsFromCatalog({
          catalog: [{ skillId: target.skillId }],
          detailsByTaskId,
          tasks,
        })[0];
  const label = target.kind === "agent-md" ? "Agent.md" : target.skillId;
  return (
    <div
      className="flex h-full min-h-0 flex-col rounded-md border"
      data-testid="eval-target-detail"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="ghost" onClick={onBack}>
            <ArrowLeft className="size-4" />
            Evals
          </Button>
          <p className="font-semibold">{label}</p>
          {row ? <HealthBadge status={row.status} /> : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {row?.taskCount ?? 0} eval cases · {row?.failureCount ?? 0} failing
        </p>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
          {targetTasks.map((task) => (
            <EvidenceCard
              key={task.task_id}
              task={task}
              detail={detailsByTaskId[task.task_id]}
              onOpen={() => onOpenTask(task.task_id)}
            />
          ))}
          {!targetTasks.length ? (
            <div className="rounded-md border border-dashed p-8 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
              No eval evidence exists for this target yet.
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

export function EvalHealthCards({
  catalog,
  detailsByTaskId,
  tasks,
  onSelectTarget,
}: {
  catalog: SkillCatalogEntry[];
  detailsByTaskId: Record<string, EvalTaskDetail>;
  tasks: EvalTaskSummary[];
  onSelectTarget: (target: EvalHealthTarget) => void;
}): ReactElement {
  const [query, setQuery] = useState("");
  const rows = useMemo(
    () => buildEvalSkillHealthRowsFromCatalog({ catalog, detailsByTaskId, tasks }),
    [catalog, detailsByTaskId, tasks],
  );
  const agentMd = useMemo(
    () => buildAgentMdHealthRow({ detailsByTaskId, tasks }),
    [detailsByTaskId, tasks],
  );
  const visibleRows = rows.filter((row) => row.skillId.toLowerCase().includes(query.toLowerCase()));
  const healthyCount =
    rows.filter((row) => row.status === "healthy").length + (agentMd.status === "healthy" ? 1 : 0);
  const riskCount =
    rows.filter((row) => row.status === "risk" || row.status === "blocked").length +
    (["risk", "blocked"].includes(agentMd.status) ? 1 : 0);
  const uncoveredCount =
    rows.filter((row) => row.status === "no-coverage").length +
    (agentMd.status === "no-coverage" ? 1 : 0);
  return (
    <ScrollArea className="h-full min-h-0" data-testid="eval-health-cards">
      <div className="space-y-4 pb-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border p-3">
            <p className="text-xl font-semibold">{healthyCount}</p>
            <p className="text-xs text-muted-foreground">healthy</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xl font-semibold">{riskCount}</p>
            <p className="text-xs text-muted-foreground">at risk</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xl font-semibold">{uncoveredCount}</p>
            <p className="text-xs text-muted-foreground">without coverage</p>
          </div>
        </div>
        <AgentMdCard row={agentMd} onOpen={() => onSelectTarget({ kind: "agent-md" })} />
        <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
          <div>
            <p className="font-semibold">Skills</p>
            <p className="text-xs text-muted-foreground">{rows.length} reusable workflows</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search skills"
              aria-label="Search skill health"
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleRows.map((row) => (
            <SkillHealthCard
              key={row.skillId}
              row={row}
              onOpen={() => onSelectTarget({ kind: "skill", skillId: row.skillId })}
            />
          ))}
          {!visibleRows.length ? (
            <div className="rounded-md border border-dashed p-8 text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">
              {rows.length ? "No skills match this search." : "No skill catalog is available."}
            </div>
          ) : null}
        </div>
      </div>
    </ScrollArea>
  );
}
