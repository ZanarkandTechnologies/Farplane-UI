import type {
  ThreadDataRunIndexEntry,
  ThreadDataRunOutput,
  ThreadDataRunStatus,
  ThreadDataSource,
} from "@/modules/thread-data/types";

type UnknownRecord = Record<string, unknown>;

export type BackfillEvidenceRow = {
  id: string;
  role: string;
  text: string;
  source: string;
};

export function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function formatBackfillDate(value: string | number | undefined): string {
  if (value === undefined) return "unknown";
  const timestamp = typeof value === "number" ? value * 1000 : Date.parse(value);
  if (!Number.isFinite(timestamp)) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

export function sortBackfillRuns(entries: ThreadDataRunIndexEntry[]): ThreadDataRunIndexEntry[] {
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

export function outputEvidenceRows(outputJson: unknown): BackfillEvidenceRow[] {
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
