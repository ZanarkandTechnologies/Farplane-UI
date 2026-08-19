/** Pure analysis-progress ordering shared by mutations and replay repair. */

export const VIDEO_PROGRESS_STAGES = [
  "queued",
  "preparing",
  "analyzing",
  "persistence",
  "complete",
  "failed",
  "needs_review",
] as const;

export type VideoProgressStage = (typeof VIDEO_PROGRESS_STAGES)[number];

const PROGRESS_RANK: Record<VideoProgressStage, number> = {
  queued: 0,
  preparing: 1,
  analyzing: 2,
  persistence: 3,
  complete: 4,
  failed: 4,
  needs_review: 4,
};

const TERMINAL_STAGES = new Set<VideoProgressStage>(["complete", "failed", "needs_review"]);

export function canAdvanceVideoProgress(
  current: VideoProgressStage,
  next: VideoProgressStage,
): boolean {
  if (TERMINAL_STAGES.has(current)) return current === next;
  return PROGRESS_RANK[next] >= PROGRESS_RANK[current];
}

export function defaultProgressForJobStatus(
  status: "queued" | "analyzing" | "ready" | "failed" | "needs_review",
): { stage: VideoProgressStage; message: string } {
  if (status === "queued") return { stage: "queued", message: "Analysis is queued." };
  if (status === "ready") return { stage: "complete", message: "Analysis is ready." };
  if (status === "failed") return { stage: "failed", message: "Analysis failed." };
  if (status === "needs_review") {
    return { stage: "needs_review", message: "Analysis needs review." };
  }
  return {
    stage: "analyzing",
    message: "Analysis is running; the legacy job did not record a more specific stage.",
  };
}
