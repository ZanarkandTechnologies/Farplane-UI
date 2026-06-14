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
        <div className="divide-y">
          {filteredTasks.map((task) => {
            const detail = detailsByTaskId[task.task_id];
            const pass = getTaskPass(task, detail);
            const selected = selectedTaskId === task.task_id;
            const verdict = getTaskVerdict(task, detail);
            const scope = getTaskScope(task, detail);
            return (
              <button
                key={task.task_id}
                type="button"
                className={`grid w-full grid-cols-[42px_132px_minmax(180px,0.9fr)_minmax(240px,1.5fr)_auto] items-center gap-3 px-3 py-3 text-left text-sm transition hover:bg-muted/50 ${
                  selected ? "bg-primary/5" : "bg-card"
                }`}
                onClick={() => onSelectTask(task.task_id)}
              >
                <Badge
                  variant={pass === false ? "destructive" : pass === true ? "secondary" : "outline"}
                  className="justify-self-start"
                >
                  {verdict}
                </Badge>
                <div className="min-w-0">
                  <p className="truncate text-xs uppercase text-muted-foreground">{scope}</p>
                  <p className="truncate text-xs text-muted-foreground">{task.task_id}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{task.title || task.task_id}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {getTaskTags(task, detail)
                      .slice(0, 3)
                      .map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                  </div>
                </div>
                <p className="line-clamp-2 min-w-0 text-xs text-muted-foreground">
                  {task.reason || detail?.judge?.reason || "No judge reason loaded yet."}
                </p>
                <span className="text-xs text-muted-foreground">Open</span>
              </button>
            );
          })}
          {!filteredTasks.length ? (
            <div className="m-3 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              No eval tasks match the current filters.
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
