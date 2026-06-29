import type {
  ThreadDataArtifact,
  ThreadDataRunIndexEntry,
  ThreadDataRunOutput,
  ThreadDataRunStatus,
  ThreadDataSource,
} from "@/modules/thread-data/types";

type UnknownRecord = Record<string, unknown>;

export type MiningEvidenceRow = {
  id: string;
  role: string;
  text: string;
  source: string;
};

export type ScorecardSummary = {
  scopeFollowed?: string;
  proofQuality?: string;
  skippedSteps?: string;
  overall?: string;
};

export function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function formatMiningDate(value: string | number | undefined): string {
  if (value === undefined) return "unknown";
  const timestamp = typeof value === "number" ? value * 1000 : Date.parse(value);
  if (!Number.isFinite(timestamp)) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

export function sortMiningRuns(entries: ThreadDataRunIndexEntry[]): ThreadDataRunIndexEntry[] {
  return [...entries].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt);
    const rightTime = Date.parse(right.createdAt);
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
  });
}

export function runStatusTone(
  status: ThreadDataRunStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "complete") return "default";
  if (status === "failed") return "destructive";
  if (status === "running") return "secondary";
  return "outline";
}

export function filterThreads(threads: ThreadDataSource[], query: string): ThreadDataSource[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return threads;
  return threads.filter((thread) =>
    [thread.id, thread.sessionId, thread.name, thread.preview, thread.cwd, thread.sourceKind]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}

export function filterOutputs(
  outputs: ThreadDataRunOutput[],
  query: string,
): ThreadDataRunOutput[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return outputs;
  return outputs.filter((output) =>
    [
      output.id,
      output.sessionId,
      output.threadId,
      output.sourceTitle,
      output.summary,
      output.verdict,
      output.redactionStatus,
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}

export function selectedThreadIds(threads: ThreadDataSource[], selected: Set<string>): string[] {
  if (!selected.size) return threads.slice(0, 10).map((thread) => thread.id);
  return threads.filter((thread) => selected.has(thread.id)).map((thread) => thread.id);
}

export function displayEvidenceSource(value: string): string {
  return value.replace(/^\/Users\/[^/]+/, "~");
}

export function outputEvidenceRows(outputJson: unknown): MiningEvidenceRow[] {
  if (!isRecord(outputJson)) return [];
  const rawSpans = outputJson.evidenceSpans;
  if (!Array.isArray(rawSpans)) return [];
  return rawSpans
    .filter(isRecord)
    .map((span, index) => ({
      id: String(span.id ?? `span-${index + 1}`),
      role: String(span.role ?? "unknown"),
      text: String(span.text ?? "").trim(),
      source: displayEvidenceSource(
        `${String(span.sourcePath ?? "")}${String(span.jsonPointer ?? "")}`,
      ),
    }))
    .filter((span) => span.text);
}

export function defaultOutputViewMode(
  run: ThreadDataRunIndexEntry | undefined,
  output: ThreadDataRunOutput | null | undefined,
): "summary" | "decisions" | "evidence" {
  if (run?.programId === "ticket-completion-audit-v1" || run?.miningMode === "ticket_completion") {
    return "summary";
  }
  if (output?.outputDecisions) return "decisions";
  return "evidence";
}

export function artifactPreview(artifact: ThreadDataArtifact | null | undefined): string {
  if (!artifact) return "No artifact selected.";
  return artifact.content ?? `${artifact.label}\n${artifact.path}`;
}

export function artifactTone(
  kind: ThreadDataArtifact["kind"],
): "default" | "secondary" | "outline" {
  if (kind === "json") return "secondary";
  if (kind === "markdown") return "default";
  return "outline";
}

export function scorecardSummary(outputJson: unknown): ScorecardSummary | null {
  if (!isRecord(outputJson)) return null;
  const rawScorecard = isRecord(outputJson.scorecard) ? outputJson.scorecard : outputJson;
  const scopeFollowed =
    String(rawScorecard.scopeFollowed ?? rawScorecard.scope_followed ?? "").trim() || undefined;
  const proofQuality =
    String(rawScorecard.proofQuality ?? rawScorecard.proof_quality ?? "").trim() || undefined;
  const skippedSteps =
    String(rawScorecard.skippedSteps ?? rawScorecard.skipped_steps ?? "").trim() || undefined;
  const overall = String(rawScorecard.overall ?? rawScorecard.summary ?? "").trim() || undefined;
  if (!scopeFollowed && !proofQuality && !skippedSteps && !overall) return null;
  return { overall, proofQuality, scopeFollowed, skippedSteps };
}
