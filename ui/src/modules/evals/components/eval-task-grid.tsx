import { Search } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  filterEvalTasks,
  getTaskPass,
  getTaskScope,
  getTaskTags,
  getTaskVerdict,
} from "@/modules/evals/lib/eval-artifacts";
import type {
  EvalTaskDetail,
  EvalTaskFilter,
  EvalTaskScopeFilter,
  EvalTaskSummary,
} from "@/modules/evals/lib/eval-types";

const FILTERS: EvalTaskFilter[] = ["all", "pass", "fail", "A", "B", "C", "D", "hardcase"];
const SCOPE_FILTERS: EvalTaskScopeFilter[] = ["all", "skill", "task", "agent-md"];

export function EvalTaskGrid({
  tasks,
  detailsByTaskId,
  selectedTaskId,
  query,
  filter,
  scopeFilter,
  onQueryChange,
  onFilterChange,
  onScopeFilterChange,
  onSelectTask,
}: {
  tasks: EvalTaskSummary[];
  detailsByTaskId: Record<string, EvalTaskDetail>;
  selectedTaskId: string | null;
  query: string;
  filter: EvalTaskFilter;
  scopeFilter: EvalTaskScopeFilter;
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: EvalTaskFilter) => void;
  onScopeFilterChange: (filter: EvalTaskScopeFilter) => void;
  onSelectTask: (taskId: string) => void;
}): ReactElement {
  const filteredTasks = filterEvalTasks(tasks, detailsByTaskId, query, filter, scopeFilter);
  return (
    <div className="flex h-full min-h-0 flex-col rounded-md border" data-testid="eval-task-nav">
      <div className="space-y-2 border-b p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[280px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-9"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search eval tasks"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {SCOPE_FILTERS.map((entry) => (
              <button
                key={entry}
                type="button"
                className={`h-8 rounded-md border px-2.5 text-xs ${
                  scopeFilter === entry ? "bg-secondary text-secondary-foreground" : "hover:bg-muted"
                }`}
                onClick={() => onScopeFilterChange(entry)}
              >
                {entry === "agent-md" ? "agent.md" : entry}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((entry) => (
            <button
              key={entry}
              type="button"
              className={`h-7 rounded-md border px-2.5 text-xs ${
                filter === entry ? "bg-secondary text-secondary-foreground" : "hover:bg-muted"
              }`}
              onClick={() => onFilterChange(entry)}
            >
              {entry}
            </button>
          ))}
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredTasks.map((task) => {
            const detail = detailsByTaskId[task.task_id];
            const pass = getTaskPass(task, detail);
            const selected = selectedTaskId === task.task_id;
            const verdict = getTaskVerdict(task, detail);
            const scope = getTaskScope(task, detail);
            const tags = getTaskTags(task, detail);
            return (
              <button
                key={task.task_id}
                type="button"
                className={`flex min-h-[190px] min-w-0 flex-col rounded-md border p-3 text-left text-sm transition hover:border-primary/50 hover:bg-muted/40 ${
                  selected ? "border-primary bg-primary/5" : "bg-card"
                }`}
                onClick={() => onSelectTask(task.task_id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] uppercase text-muted-foreground">{scope}</p>
                    <p className="mt-1 line-clamp-2 font-semibold">{task.title || task.task_id}</p>
                  </div>
                  <Badge
                    variant={pass === false ? "destructive" : pass === true ? "secondary" : "outline"}
                    className="shrink-0"
                  >
                    {verdict}
                  </Badge>
                </div>

                <p className="mt-2 truncate text-xs text-muted-foreground">{task.task_id}</p>

                <p className="mt-3 line-clamp-3 min-h-[48px] text-xs leading-5 text-muted-foreground">
                  {task.reason || detail?.judge?.reason || "No judge reason loaded yet."}
                </p>

                <div className="mt-3 flex flex-wrap gap-1">
                  {tags.slice(0, 4).map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                  {tags.length > 4 ? <Badge variant="outline">+{tags.length - 4}</Badge> : null}
                </div>

                <div className="mt-auto flex items-center justify-between pt-3">
                  <span className="text-xs text-muted-foreground">
                    {detail ? "details loaded" : "summary only"}
                  </span>
                  <span className="text-xs font-medium text-primary">Open</span>
                </div>
              </button>
            );
          })}
          {!filteredTasks.length ? (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">
              No eval tasks match the current filters.
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
