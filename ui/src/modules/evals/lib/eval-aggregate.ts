/**
 * Eval aggregate helpers
 * Inputs: loaded eval run summaries, task details, and optional skill catalog ids.
 * Outputs: synthetic aggregate summary plus scorecard metrics for the Eval OS dashboard.
 * Side effects: none.
 */

import { getTaskScope } from "@/modules/evals/lib/eval-artifacts";
import type {
  EvalRunIndexEntry,
  EvalSummary,
  EvalTaskDetail,
} from "@/modules/evals/lib/eval-types";

export const AGGREGATE_RUN_ID = "__aggregate_latest__";

export type SkillCatalogEntry = {
  skillId?: string;
  name?: string;
  displayName?: string;
  description?: string;
  tier?: number;
};

export type SkillCatalogResponse = {
  skills?: SkillCatalogEntry[];
};

export type AggregateMetrics = {
  coverageLabel: string;
  coverageRate: number | undefined;
  evaluatedSkillCount: number;
  evalQuality: number | undefined;
  failingCount: number;
  harnessScore: number | undefined;
  noEvalCount: number | undefined;
  priorityItems: string[];
  totalSkillCount: number | undefined;
};

export function buildAggregateSummary({
  detailsByTaskId,
  runs,
  tasks,
}: {
  detailsByTaskId: Record<string, EvalTaskDetail>;
  runs: EvalRunIndexEntry[];
  tasks: EvalSummary["tasks"];
}): EvalSummary {
  const passedTasks = tasks.filter((task) => task.pass === true).length;
  const verdictCounts = tasks.reduce<Record<string, number>>((counts, task) => {
    const verdict = String(
      task.verdict ?? detailsByTaskId[task.task_id]?.judge?.verdict ?? "unknown",
    );
    counts[verdict] = (counts[verdict] ?? 0) + 1;
    return counts;
  }, {});

  return {
    job_id: AGGREGATE_RUN_ID,
    label: "Aggregate: latest per eval",
    created_at: runs[0]?.created_at ?? runs[0]?.completed_at,
    harness: "all runs",
    judge_harness: "latest result per task",
    suite: "aggregate",
    task_count: tasks.length,
    pass_rate: tasks.length ? passedTasks / tasks.length : undefined,
    verdict_counts: verdictCounts,
    tasks,
  };
}

export function formatScorePercent(score: number): string {
  if (!Number.isFinite(score)) return "--";
  return `${Math.round(score * 100)}%`;
}

export function getSkillCatalogIds(skills: SkillCatalogEntry[]): string[] {
  return Array.from(
    new Set(
      skills
        .map((skill) => skill.skillId ?? skill.name)
        .filter((skillId): skillId is string => Boolean(skillId?.trim()))
        .map((skillId) => skillId.trim()),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function verdictScore(verdict: string | undefined): number {
  if (verdict === "A") return 4;
  if (verdict === "B") return 3;
  if (verdict === "C") return 2;
  if (verdict === "D") return 1;
  return 0;
}

function taskSearchText(task: EvalSummary["tasks"][number], detail?: EvalTaskDetail): string {
  return [
    task.task_id,
    task.title,
    task.reason,
    ...(task.tags ?? []),
    detail?.task_id,
    detail?.task?.id,
    detail?.task?.title,
    detail?.task?.prompt,
    detail?.task?.query,
    ...(detail?.task?.tags ?? []),
    detail?.judge?.reason,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function computeAggregateMetrics({
  detailsByTaskId,
  skillCatalogIds,
  summary,
}: {
  detailsByTaskId: Record<string, EvalTaskDetail>;
  skillCatalogIds: string[];
  summary: EvalSummary | null;
}): AggregateMetrics {
  const tasks = summary?.tasks ?? [];
  const evaluatedSkillIds = new Set<string>();
  const skillIds = skillCatalogIds.map((skillId) => skillId.toLowerCase());

  for (const task of tasks) {
    const detail = detailsByTaskId[task.task_id];
    const haystack = taskSearchText(task, detail);
    skillCatalogIds.forEach((skillId, index) => {
      if (haystack.includes(skillIds[index] ?? "")) evaluatedSkillIds.add(skillId);
    });
    if (!skillCatalogIds.length && getTaskScope(task, detail) === "skill") {
      evaluatedSkillIds.add(detail?.task?.id ?? task.task_id);
    }
  }

  const totalSkillCount = skillCatalogIds.length || undefined;
  const evaluatedSkillCount = totalSkillCount
    ? evaluatedSkillIds.size
    : evaluatedSkillIds.size || tasks.length;
  const scoredTotal = tasks.reduce((total, task) => {
    const detail = detailsByTaskId[task.task_id];
    return total + verdictScore(String(task.verdict ?? detail?.judge?.verdict ?? ""));
  }, 0);
  const evalQuality = tasks.length ? scoredTotal / (4 * tasks.length) : undefined;
  const harnessScore = totalSkillCount ? scoredTotal / (4 * totalSkillCount) : evalQuality;
  const coverageRate = totalSkillCount ? evaluatedSkillCount / totalSkillCount : undefined;
  const noEvalCount = totalSkillCount
    ? Math.max(totalSkillCount - evaluatedSkillCount, 0)
    : undefined;
  const failingCount = tasks.filter((task) => task.pass === false || task.verdict === "D").length;
  const priorityItems = [
    failingCount ? `Inspect ${failingCount} failing eval${failingCount === 1 ? "" : "s"}` : null,
    noEvalCount
      ? `Add evals for ${noEvalCount} uncovered skill${noEvalCount === 1 ? "" : "s"}`
      : null,
    tasks.length ? `Refresh stale latest results as needed` : "Run or import evals",
  ].filter((item): item is string => Boolean(item));

  return {
    coverageLabel: totalSkillCount
      ? `${evaluatedSkillCount} / ${totalSkillCount}`
      : `${evaluatedSkillCount} eval target${evaluatedSkillCount === 1 ? "" : "s"}`,
    coverageRate,
    evaluatedSkillCount,
    evalQuality,
    failingCount,
    harnessScore,
    noEvalCount,
    priorityItems,
    totalSkillCount,
  };
}
