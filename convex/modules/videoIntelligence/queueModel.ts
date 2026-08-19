/** Pure terminal-job decision for canonical Analyze dedupe and retry. */

export function terminalQueueDisposition(
  latestStatus: "ready" | "failed" | "needs_review" | null,
  reAnalyze: boolean,
): "reuse_ready" | "create" {
  return latestStatus === "ready" && !reAnalyze ? "reuse_ready" : "create";
}
