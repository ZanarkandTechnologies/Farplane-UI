import type { ContentIntelligenceItem, ContentJob } from "../types";

/** Primary places to read; recurring Topics remain dossier-scoped context. */
export const contentIntelligencePrimaryTabs = ["content", "news", "concepts", "world"] as const;
export type ContentIntelligencePrimaryTab = (typeof contentIntelligencePrimaryTabs)[number];

export type ContentDateGroup = {
  date: string;
  items: ContentIntelligenceItem[];
};

export type ContentJobProgressView = {
  jobId: string;
  status: "queued" | "active" | "ready" | "failed" | "needs_review";
  statusLabel: string;
  stageLabel: string;
  message: string;
  freshnessLabel: string;
  updatedAt: string;
  action: { kind: "open_source"; label: string } | null;
};

/**
 * Analysis is the primary Content lifecycle. A newer Save or Feed Scout job
 * must never hide the latest YouTube analysis state.
 */
export function latestAnalyzeYoutubeJob(
  item: Pick<ContentIntelligenceItem, "jobs">,
): ContentJob | undefined {
  return item.jobs
    .filter((job) => job.kind === "analyze_youtube")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
}

/** Derives honest UI state from persisted lifecycle data; percentages are intentionally absent. */
export function contentJobProgressView(
  item: Pick<ContentIntelligenceItem, "jobs">,
  nowMs: number,
): ContentJobProgressView | null {
  const job = latestAnalyzeYoutubeJob(item);
  if (!job) return null;

  const updatedAt = job.progress?.updatedAt ?? job.updatedAt;
  const fallback = fallbackProgress(job.status);
  const action =
    job.status === "failed" || job.status === "needs_review"
      ? { kind: "open_source" as const, label: "Open source to retry" }
      : null;

  return {
    jobId: job.id,
    status: job.status === "analyzing" ? "active" : job.status === "ready" ? "ready" : job.status,
    statusLabel:
      job.status === "analyzing"
        ? "In progress"
        : job.status === "needs_review"
          ? "Needs review"
          : sentenceCase(job.status),
    stageLabel: sentenceCase(job.progress?.stage ?? fallback.stage),
    message: job.progress?.message.trim() || job.error?.trim() || fallback.message,
    freshnessLabel: progressFreshness(updatedAt, nowMs),
    updatedAt,
    action,
  };
}

export type ContentConcept = { name: string; sources: number };

export function dossierBackLabel(context: {
  fromStoryId?: string;
  fromDossierId?: string;
  fromDossierTitle?: string;
  fromTab?: ContentIntelligencePrimaryTab;
}): string {
  if (context.fromStoryId) return "Back to story";
  if (context.fromDossierId) return `Back to ${context.fromDossierTitle ?? "related dossier"}`;
  return context.fromTab === "news" ? "Back to News" : "Back to content";
}

/** Counts each normalized discovery/dossier concept at most once per source. */
export function projectContentConcepts(
  items: Pick<ContentIntelligenceItem, "concepts" | "latestDiscovery">[],
): ContentConcept[] {
  const concepts = new Map<string, { name: string; sources: number }>();
  for (const item of items) {
    const sourceConcepts = new Map<string, string>();
    for (const raw of [...(item.concepts ?? []), ...(item.latestDiscovery?.tags ?? [])]) {
      const name = raw.trim();
      const key = name.toLocaleLowerCase();
      if (name && !sourceConcepts.has(key)) sourceConcepts.set(key, name);
    }
    for (const [key, name] of sourceConcepts) {
      const current = concepts.get(key);
      concepts.set(key, { name: current?.name ?? name, sources: (current?.sources ?? 0) + 1 });
    }
  }
  return [...concepts.values()].sort(
    (left, right) => right.sources - left.sources || left.name.localeCompare(right.name),
  );
}

/**
 * Renders a stable newest-first timeline even when differently updated source records share one page.
 * Cursor paging remains server-owned; this only orders the records already visible to the operator.
 */
export function groupContentByObservedDate(items: ContentIntelligenceItem[]): ContentDateGroup[] {
  const groups = new Map<string, ContentIntelligenceItem[]>();

  for (const item of items) {
    const date = item.lastObservedAt.slice(0, 10);
    const current = groups.get(date);
    if (current) {
      current.push(item);
    } else {
      groups.set(date, [item]);
    }
  }

  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([date, groupedItems]) => ({
      date,
      items: groupedItems.sort((left, right) =>
        right.lastObservedAt.localeCompare(left.lastObservedAt),
      ),
    }));
}

/** Uses only safe, predictable YouTube thumbnail URLs; other sources keep an explicit visual fallback. */
export function contentThumbnailUrl(
  item: Pick<ContentIntelligenceItem, "canonicalRef" | "sourceKind">,
): string | undefined {
  if (item.sourceKind !== "video") return undefined;
  const videoId = youtubeVideoId(item.canonicalRef);
  return videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : undefined;
}

function youtubeVideoId(value: string): string | undefined {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const candidate =
      host === "youtu.be"
        ? url.pathname.split("/")[1]
        : host === "youtube.com"
          ? url.pathname === "/watch"
            ? (url.searchParams.get("v") ?? undefined)
            : url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1]
          : undefined;
    return candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : undefined;
  } catch {
    return undefined;
  }
}

function fallbackProgress(status: ContentJob["status"]): { stage: string; message: string } {
  switch (status) {
    case "queued":
      return { stage: "queued", message: "Waiting for analysis to start." };
    case "analyzing":
      return { stage: "analysis", message: "Analysis is running." };
    case "ready":
      return { stage: "complete", message: "Dossier is ready." };
    case "failed":
      return { stage: "failed", message: "Analysis stopped before a dossier was ready." };
    case "needs_review":
      return { stage: "needs_review", message: "Analysis needs another pass." };
  }
}

function sentenceCase(value: string): string {
  const words = value.replaceAll("_", " ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

function progressFreshness(updatedAt: string, nowMs: number): string {
  const updatedAtMs = Date.parse(updatedAt);
  if (!Number.isFinite(updatedAtMs)) return "Update time unavailable";
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - updatedAtMs) / 1_000));
  if (elapsedSeconds < 60) return "Updated just now";
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `Updated ${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `Updated ${elapsedHours}h ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return `Updated ${elapsedDays}d ago`;
}
