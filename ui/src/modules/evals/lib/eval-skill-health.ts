/**
 * Ownership: Eval OS projection from skill catalog entries to their latest eval evidence.
 * Inputs: canonical skill ids plus aggregate eval task summaries/details.
 * Outputs: one honest health row per installed skill; missing evidence stays unscored.
 * Side effects: none.
 */

import type { SkillCatalogEntry } from "@/modules/evals/lib/eval-aggregate";
import { getTaskPass, getTaskTags, getTaskVerdict } from "@/modules/evals/lib/eval-artifacts";
import type { EvalTaskDetail, EvalTaskSummary } from "@/modules/evals/lib/eval-types";

export type SkillHealthStatus = "healthy" | "watch" | "risk" | "blocked" | "no-coverage";

export type EvalSkillHealthRow = {
  skillId: string;
  score: number | null;
  status: SkillHealthStatus;
  passedCount: number;
  taskCount: number;
  failureCount: number;
  evaluatedAt?: string;
  runId?: string;
  tier?: number;
  description?: string;
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, "-");
}

function verdictPoints(verdict: string): number {
  if (verdict === "A") return 4;
  if (verdict === "B") return 3;
  if (verdict === "C") return 2;
  if (verdict === "D") return 1;
  return 0;
}

export function taskTargetsSkill(
  skillId: string,
  task: EvalTaskSummary,
  detail?: EvalTaskDetail,
): boolean {
  const normalizedSkillId = normalize(skillId);
  const explicitTags = getTaskTags(task, detail).map(normalize);
  if (explicitTags.includes(normalizedSkillId)) return true;

  const taskId = normalize(detail?.task?.id ?? task.task_id);
  return taskId === normalizedSkillId || taskId.startsWith(`${normalizedSkillId}-`);
}

export function taskTargetsAgentMd(task: EvalTaskSummary, detail?: EvalTaskDetail): boolean {
  const tags = getTaskTags(task, detail).map(normalize);
  const haystack = [task.task_id, task.title, detail?.task?.id, detail?.task?.title]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return tags.includes("agent.md") || tags.includes("agent-md") || haystack.includes("agent.md");
}

function statusForScore(score: number): SkillHealthStatus {
  if (score >= 90) return "healthy";
  if (score >= 75) return "watch";
  if (score >= 50) return "risk";
  return "blocked";
}

export function buildEvalSkillHealthRows({
  detailsByTaskId,
  skillIds,
  tasks,
}: {
  detailsByTaskId: Record<string, EvalTaskDetail>;
  skillIds: string[];
  tasks: EvalTaskSummary[];
}): EvalSkillHealthRow[] {
  return skillIds
    .map((skillId) => {
      const evidence = tasks.filter((task) =>
        taskTargetsSkill(skillId, task, detailsByTaskId[task.task_id]),
      );
      if (!evidence.length) {
        return {
          skillId,
          score: null,
          status: "no-coverage" as const,
          passedCount: 0,
          taskCount: 0,
          failureCount: 0,
        };
      }

      const passedCount = evidence.filter(
        (task) => getTaskPass(task, detailsByTaskId[task.task_id]) === true,
      ).length;
      const failureCount = evidence.filter(
        (task) => getTaskPass(task, detailsByTaskId[task.task_id]) === false,
      ).length;
      const qualityScore =
        (evidence.reduce(
          (total, task) =>
            total + verdictPoints(getTaskVerdict(task, detailsByTaskId[task.task_id])),
          0,
        ) /
          (evidence.length * 4)) *
        100;
      const passScore = (passedCount / evidence.length) * 100;
      const score = Math.round(Math.min(qualityScore, passScore));
      const latestEvidence = evidence
        .filter((task) => task.evaluated_at)
        .sort(
          (left, right) =>
            Date.parse(right.evaluated_at ?? "") - Date.parse(left.evaluated_at ?? ""),
        )[0];

      return {
        skillId,
        score,
        status: statusForScore(score),
        passedCount,
        taskCount: evidence.length,
        failureCount,
        evaluatedAt: latestEvidence?.evaluated_at,
        runId: latestEvidence?.run_id,
      };
    })
    .sort((left, right) => {
      if (left.score === null && right.score !== null) return -1;
      if (left.score !== null && right.score === null) return 1;
      return (left.score ?? 0) - (right.score ?? 0) || left.skillId.localeCompare(right.skillId);
    });
}

export function buildEvalSkillHealthRowsFromCatalog({
  catalog,
  detailsByTaskId,
  tasks,
}: {
  catalog: SkillCatalogEntry[];
  detailsByTaskId: Record<string, EvalTaskDetail>;
  tasks: EvalTaskSummary[];
}): EvalSkillHealthRow[] {
  const rows = buildEvalSkillHealthRows({
    detailsByTaskId,
    skillIds: catalog
      .map((entry) => entry.skillId ?? entry.name)
      .filter((skillId): skillId is string => Boolean(skillId)),
    tasks,
  });
  const catalogById = new Map(
    catalog.map((entry) => [entry.skillId ?? entry.name, entry] as const),
  );
  return rows.map((row) => ({
    ...row,
    tier: catalogById.get(row.skillId)?.tier,
    description: catalogById.get(row.skillId)?.description,
  }));
}

export function buildAgentMdHealthRow({
  detailsByTaskId,
  tasks,
}: {
  detailsByTaskId: Record<string, EvalTaskDetail>;
  tasks: EvalTaskSummary[];
}): EvalSkillHealthRow {
  const evidence = tasks.filter((task) => taskTargetsAgentMd(task, detailsByTaskId[task.task_id]));
  const projected = buildEvalSkillHealthRows({
    detailsByTaskId,
    skillIds: ["agent.md"],
    tasks: evidence.map((task) => ({ ...task, tags: [...(task.tags ?? []), "agent.md"] })),
  })[0];
  return (
    projected ?? {
      skillId: "agent.md",
      score: null,
      status: "no-coverage",
      passedCount: 0,
      taskCount: 0,
      failureCount: 0,
    }
  );
}
