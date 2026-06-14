import type { EvalSummary, EvalTaskDetail } from "@/modules/evals/lib/eval-types";

export type EvalHealth = {
  score: number;
  passRate: number;
  taskCount: number;
  failureCount: number;
  loadedDetailCount: number;
  verdict: string;
};

export function computeEvalHealth(
  summary: EvalSummary | null,
  detailsByTaskId: Record<string, EvalTaskDetail> = {},
): EvalHealth {
  if (!summary) {
    return {
      score: 0,
      passRate: 0,
      taskCount: 0,
      failureCount: 0,
      loadedDetailCount: 0,
      verdict: "no runs",
    };
  }
  const tasks = summary.tasks ?? [];
  const taskCount = summary.task_count ?? tasks.length;
  const passCount = tasks.filter((task) => task.pass === true).length;
  const explicitFailures = tasks.filter((task) => task.pass === false).length;
  const passRate =
    typeof summary.pass_rate === "number" ? summary.pass_rate : taskCount ? passCount / taskCount : 0;
  const failureCount = explicitFailures || Math.max(taskCount - passCount, 0);
  const hardFailures = Number(summary.verdict_counts?.D ?? 0);
  const score = Math.max(0, Math.min(100, Math.round(passRate * 100 - hardFailures * 5)));
  const verdict = score >= 90 ? "healthy" : score >= 75 ? "watch" : score >= 50 ? "risk" : "blocked";
  return {
    score,
    passRate,
    taskCount,
    failureCount,
    loadedDetailCount: Object.keys(detailsByTaskId).length,
    verdict,
  };
}
