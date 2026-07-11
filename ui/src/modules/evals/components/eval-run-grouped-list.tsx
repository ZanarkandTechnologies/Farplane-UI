import { FileCode2, Search } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SkillCatalogEntry } from "@/modules/evals/lib/eval-aggregate";
import {
  getTaskPass,
  getTaskTags,
  getTaskTitle,
  getTaskVerdict,
} from "@/modules/evals/lib/eval-artifacts";
import { taskTargetsAgentMd, taskTargetsSkill } from "@/modules/evals/lib/eval-skill-health";
import type { EvalTaskDetail, EvalTaskSummary } from "@/modules/evals/lib/eval-types";

type EvalRunGroup = {
  id: string;
  label: string;
  kind: "agent-md" | "skill" | "unassigned";
  tasks: EvalTaskSummary[];
};

const NON_TARGET_TAGS = new Set([
  "skill",
  "agent",
  "agent.md",
  "task",
  "task-quality",
  "workflow",
  "hardcase",
  "eval",
  "regression",
]);

function inferHistoricalSkillId(
  task: EvalTaskSummary,
  detail?: EvalTaskDetail,
): string | undefined {
  return getTaskTags(task, detail).find((tag) => !NON_TARGET_TAGS.has(tag.toLowerCase()));
}

export function groupEvalRunTasks({
  catalog,
  detailsByTaskId,
  tasks,
}: {
  catalog: SkillCatalogEntry[];
  detailsByTaskId: Record<string, EvalTaskDetail>;
  tasks: EvalTaskSummary[];
}): EvalRunGroup[] {
  const groups = new Map<string, EvalRunGroup>();
  for (const task of tasks) {
    const detail = detailsByTaskId[task.task_id];
    const skill = catalog.find((entry) => {
      const skillId = entry.skillId ?? entry.name;
      return skillId ? taskTargetsSkill(skillId, task, detail) : false;
    });
    const skillId = skill?.skillId ?? skill?.name ?? inferHistoricalSkillId(task, detail);
    const key = taskTargetsAgentMd(task, detail)
      ? "agent.md"
      : skillId
        ? `skill:${skillId}`
        : "unassigned";
    const current = groups.get(key) ?? {
      id: key,
      label: key === "agent.md" ? "Agent.md" : (skillId ?? "Unassigned evidence"),
      kind: key === "agent.md" ? "agent-md" : skillId ? "skill" : "unassigned",
      tasks: [],
    };
    current.tasks.push(task);
    groups.set(key, current);
  }
  return Array.from(groups.values()).sort((left, right) => {
    if (left.kind === "agent-md") return -1;
    if (right.kind === "agent-md") return 1;
    if (left.kind === "unassigned") return 1;
    if (right.kind === "unassigned") return -1;
    return left.label.localeCompare(right.label);
  });
}

export function EvalRunGroupedList({
  catalog,
  detailsByTaskId,
  onSelectTask,
  tasks,
}: {
  catalog: SkillCatalogEntry[];
  detailsByTaskId: Record<string, EvalTaskDetail>;
  onSelectTask: (taskId: string) => void;
  tasks: EvalTaskSummary[];
}): ReactElement {
  const [query, setQuery] = useState("");
  const groups = useMemo(
    () => groupEvalRunTasks({ catalog, detailsByTaskId, tasks }),
    [catalog, detailsByTaskId, tasks],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      tasks: group.tasks.filter((task) => {
        const detail = detailsByTaskId[task.task_id];
        return [group.label, task.task_id, task.title, task.reason, detail?.judge?.reason]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    }))
    .filter((group) => group.tasks.length > 0);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-md border" data-testid="eval-run-groups">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
        <div>
          <p className="text-sm font-semibold">Run evidence</p>
          <p className="text-xs text-muted-foreground">
            {groups.length} target{groups.length === 1 ? "" : "s"} · {tasks.length} cases
          </p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search this run"
            aria-label="Search run evidence"
          />
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-3">
          {visibleGroups.map((group) => {
            const failedCount = group.tasks.filter(
              (task) => getTaskPass(task, detailsByTaskId[task.task_id]) === false,
            ).length;
            return (
              <section key={group.id} className="overflow-hidden rounded-md border bg-card/40">
                <div className="flex items-center justify-between gap-3 border-b bg-muted/20 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-semibold">{group.label}</p>
                    <Badge variant="outline">
                      {group.kind === "agent-md" ? "global contract" : group.kind}
                    </Badge>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {group.tasks.length} cases · {failedCount} failing
                  </p>
                </div>
                <div className="divide-y">
                  {group.tasks.map((task) => {
                    const detail = detailsByTaskId[task.task_id];
                    const pass = getTaskPass(task, detail);
                    const artifactCount = Object.keys(detail?.artifacts ?? {}).length;
                    return (
                      <button
                        key={task.task_id}
                        type="button"
                        className="grid w-full min-w-0 gap-2 px-3 py-3 text-left transition hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                        onClick={() => onSelectTask(task.task_id)}
                      >
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate text-sm font-medium">
                              {getTaskTitle(detail ?? task)}
                            </p>
                            <Badge
                              variant={
                                pass === false
                                  ? "destructive"
                                  : pass === true
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {getTaskVerdict(task, detail)}
                            </Badge>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {task.reason || detail?.judge?.reason || "No judge reason loaded."}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                          {artifactCount ? (
                            <span className="flex items-center gap-1">
                              <FileCode2 className="size-3.5" />
                              {artifactCount}
                            </span>
                          ) : null}
                          <span className="font-medium text-primary">Open →</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {!visibleGroups.length ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No evidence matches this search.
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
