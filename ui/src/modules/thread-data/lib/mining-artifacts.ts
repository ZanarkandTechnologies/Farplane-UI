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

const ARTIFACT_JSON_PREVIEW_MAX_BYTES = 1_000_000;
const ARTIFACT_RAW_PREVIEW_MAX_CHARS = 120_000;

export type ScorecardSummary = {
  scopeFollowed?: string;
  proofQuality?: string;
  skippedSteps?: string;
  overall?: string;
  overallScore?: number;
  skillTraceSummary?: string;
  skillTrace?: {
    skillLoaded?: string;
    skillLoadTiming?: string;
    missedTriggers: string[];
    falsePositiveTriggers: string[];
    wastedSteps?: string;
    defaultFollowed?: string;
    referenceLoadCount: number;
    correctionNeeded?: string;
    traceToSkillDeltaCount: number;
    limitations: string[];
  };
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

export function artifactGroup(artifact: ThreadDataArtifact): "debug" | "report" {
  if (
    artifact.id === "input" ||
    artifact.id === "sources" ||
    artifact.id === "attempts" ||
    artifact.id === "outputs-index" ||
    artifact.label.endsWith("index.json")
  ) {
    return "debug";
  }
  return "report";
}

export function artifactPreviewText(artifact: ThreadDataArtifact | null | undefined): string {
  const content = artifactPreview(artifact);
  if (content.length <= ARTIFACT_RAW_PREVIEW_MAX_CHARS) return content;
  return `${content.slice(0, ARTIFACT_RAW_PREVIEW_MAX_CHARS)}\n\n[Preview truncated at ${ARTIFACT_RAW_PREVIEW_MAX_CHARS.toLocaleString()} characters.]`;
}

export function parseArtifactJson(artifact: ThreadDataArtifact | null | undefined): unknown {
  if (!artifact?.content || artifact.kind === "markdown") return null;
  if (artifact.content.length > ARTIFACT_JSON_PREVIEW_MAX_BYTES) return null;
  try {
    return JSON.parse(artifact.content);
  } catch {
    return null;
  }
}

export function preferredArtifactId(artifacts: ThreadDataArtifact[] | undefined): string {
  const ids = new Set((artifacts ?? []).map((artifact) => artifact.id));
  return ["report", "packet-md", "packet", "outputs-index", "input"].find((id) => ids.has(id)) ?? "report";
}

export function shortJsonValue(value: unknown): string {
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (value && typeof value === "object") return `${Object.keys(value).length} fields`;
  if (typeof value === "string") return value.length > 90 ? `${value.slice(0, 90)}...` : value;
  if (value === null) return "null";
  return String(value);
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
  const overallScore =
    typeof rawScorecard.overallScore === "number" ? rawScorecard.overallScore : undefined;
  const skillTraceSummary = String(rawScorecard.skillTraceSummary ?? "").trim() || undefined;
  const skillTrace = scorecardSkillTrace(rawScorecard.skillTraceAssessment);
  if (!scopeFollowed && !proofQuality && !skippedSteps && !overall && !skillTraceSummary && overallScore === undefined) {
    return null;
  }
  return { overall, overallScore, proofQuality, scopeFollowed, skillTrace, skillTraceSummary, skippedSteps };
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry ?? "").trim()).filter(Boolean);
}

function scorecardStatus(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const status = String(value.status ?? "").trim();
  const reason = String(value.reason ?? "").trim();
  return reason ? `${status || "unknown"}: ${reason}` : status || undefined;
}

function scorecardSkillTrace(value: unknown): ScorecardSummary["skillTrace"] | undefined {
  if (!isRecord(value)) return undefined;
  const missedTrigger = isRecord(value.missedTrigger) ? value.missedTrigger : {};
  const falsePositiveTrigger = isRecord(value.falsePositiveTrigger) ? value.falsePositiveTrigger : {};
  const wastedSteps = isRecord(value.wastedSteps) ? value.wastedSteps : {};
  const defaultFollowed = isRecord(value.defaultFollowed) ? value.defaultFollowed : {};
  const correctionNeeded = isRecord(value.correctionNeeded) ? value.correctionNeeded : {};
  const referenceLoads = Array.isArray(value.referenceLoads) ? value.referenceLoads : [];
  const traceToSkillDelta = Array.isArray(value.traceToSkillDelta) ? value.traceToSkillDelta : [];
  const skillLoadTiming = isRecord(value.skillLoadTiming) ? value.skillLoadTiming : {};
  return {
    skillLoaded: scorecardStatus(value.skillLoaded),
    skillLoadTiming: String(skillLoadTiming.value ?? skillLoadTiming.status ?? "").trim() || undefined,
    missedTriggers: stringList(missedTrigger.skillIds),
    falsePositiveTriggers: stringList(falsePositiveTrigger.skillIds),
    wastedSteps: String(wastedSteps.summary ?? wastedSteps.status ?? "").trim() || undefined,
    defaultFollowed: scorecardStatus(defaultFollowed),
    referenceLoadCount: referenceLoads.length,
    correctionNeeded: scorecardStatus(correctionNeeded),
    traceToSkillDeltaCount: traceToSkillDelta.length,
    limitations: stringList(value.limitations),
  };
}
