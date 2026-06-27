import type {
  EvalRunIndexEntry,
  EvalTaskDetail,
  EvalTaskFilter,
  EvalTaskScopeFilter,
  EvalTaskSummary,
  EvalSummary,
} from "@/modules/evals/lib/eval-types";

type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isEvalSummary(value: unknown): value is EvalSummary {
  return isRecord(value) && typeof value.job_id === "string" && Array.isArray(value.tasks);
}

export function isEvalTaskDetail(value: unknown): value is EvalTaskDetail {
  return isRecord(value) && (typeof value.task_id === "string" || isRecord(value.task));
}

export function resolveEvalArtifactsRoot({
  envRoot,
  frameworkRoot,
  globalRoot,
  projectRoot,
  hasFrameworkIndex,
  hasGlobalIndex,
}: {
  envRoot?: string;
  frameworkRoot: string;
  globalRoot: string;
  projectRoot: string;
  hasFrameworkIndex: boolean;
  hasGlobalIndex: boolean;
}): string {
  const explicitRoot = envRoot?.trim();
  if (explicitRoot) return explicitRoot;
  if (hasGlobalIndex) return globalRoot;
  return hasFrameworkIndex ? frameworkRoot : projectRoot;
}

export function getTaskId(task: EvalTaskSummary | EvalTaskDetail): string {
  if ("task_id" in task && typeof task.task_id === "string") return task.task_id;
  if ("summary" in task && typeof task.summary?.task_id === "string") return task.summary.task_id;
  if ("task" in task && typeof task.task?.id === "string") return task.task.id;
  return "unknown-task";
}

export function getTaskTitle(task: EvalTaskSummary | EvalTaskDetail): string {
  if ("title" in task && typeof task.title === "string") return task.title;
  if ("summary" in task && typeof task.summary?.title === "string") return task.summary.title;
  if ("task" in task && typeof task.task?.title === "string") return task.task.title;
  return getTaskId(task);
}

export function getTaskPass(task: EvalTaskSummary, detail?: EvalTaskDetail): boolean | undefined {
  return task.pass ?? detail?.judge?.pass;
}

export function getTaskVerdict(task: EvalTaskSummary, detail?: EvalTaskDetail): string {
  return String(task.verdict ?? detail?.judge?.verdict ?? "unknown");
}

export function getTaskTags(task: EvalTaskSummary, detail?: EvalTaskDetail): string[] {
  const tags = [...(task.tags ?? []), ...(detail?.task?.tags ?? [])];
  if (detail?.task?.hardcase) tags.push("hardcase");
  return Array.from(new Set(tags));
}

export function getTaskScope(task: EvalTaskSummary, detail?: EvalTaskDetail): EvalTaskScopeFilter {
  const tags = getTaskTags(task, detail).map((tag) => tag.toLowerCase());
  const haystack = [task.task_id, task.title, detail?.task?.title, ...tags]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (tags.includes("agent") || tags.includes("agent.md") || haystack.includes("agent.md")) {
    return "agent-md";
  }
  if (tags.includes("task") || tags.includes("task-quality") || tags.includes("regression")) {
    return "task";
  }
  if (tags.includes("skill") || haystack.includes("skill")) {
    return "skill";
  }
  return "task";
}

function stringifySearchValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(stringifySearchValue).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(stringifySearchValue).join(" ");
  return "";
}

export function formatPercent(value: number | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return `${Math.round(value * 100)}%`;
}

export function formatRunDate(value: string | undefined): string {
  if (!value) return "unknown";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

export function sortRunIndex(entries: EvalRunIndexEntry[]): EvalRunIndexEntry[] {
  return [...entries].sort((left, right) => {
    const leftTime = Date.parse(left.created_at ?? left.completed_at ?? "");
    const rightTime = Date.parse(right.created_at ?? right.completed_at ?? "");
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
  });
}

export function filterEvalTasks(
  tasks: EvalTaskSummary[],
  detailsByTaskId: Record<string, EvalTaskDetail>,
  query: string,
  filter: EvalTaskFilter,
  scopeFilter: EvalTaskScopeFilter = "all",
): EvalTaskSummary[] {
  const normalizedQuery = query.trim().toLowerCase();
  return tasks.filter((task) => {
    const detail = detailsByTaskId[task.task_id];
    const haystack = [
      task.task_id,
      task.title,
      task.reason,
      task.detail_path,
      detail?.task?.id,
      detail?.task?.title,
      detail?.task?.prompt,
      detail?.task?.query,
      stringifySearchValue(detail?.task?.expected),
      stringifySearchValue(detail?.task?.rubric),
      stringifySearchValue(detail?.task?.context),
      stringifySearchValue(detail?.task?.notes),
      stringifySearchValue(detail?.task?.reference_points),
      detail?.judge?.reason,
      stringifySearchValue(detail?.judge?.reference_points),
      stringifySearchValue(detail?.judge?.reference_point_results),
      stringifySearchValue(detail?.artifacts),
      ...getTaskTags(task, detail),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (normalizedQuery && !haystack.includes(normalizedQuery)) return false;
    if (scopeFilter !== "all" && getTaskScope(task, detail) !== scopeFilter) return false;
    if (filter === "all") return true;
    if (filter === "pass") return getTaskPass(task, detail) === true;
    if (filter === "fail") return getTaskPass(task, detail) === false;
    if (filter === "hardcase") return getTaskTags(task, detail).includes("hardcase");
    return getTaskVerdict(task, detail) === filter;
  });
}

export function stringifyArtifact(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return "";
  return JSON.stringify(value, null, 2);
}
