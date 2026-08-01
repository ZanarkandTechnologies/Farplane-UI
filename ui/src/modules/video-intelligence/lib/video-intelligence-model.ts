import type {
  EvidenceAnchor,
  Story,
  StoryAggregate,
  Tag,
  VideoDossier,
  VideoIngestJob,
  VideoIntelligenceProjection,
} from "../types";

export type TimelineGroup<T> = {
  key: string;
  label: string;
  items: T[];
};

export type VideoLibraryItem = {
  job: VideoIngestJob;
  dossier: VideoDossier | null;
};

export type StoryLibraryItem = {
  story: Story;
  aggregate: StoryAggregate | null;
  tags: Tag[];
};

export type InformationFlowNode = {
  id: string;
  kind: "source" | "story" | "related-story";
  title: string;
  subtitle: string;
  occurredAt: string;
};

export type InformationFlowEdge = {
  id: string;
  fromId: string;
  toId: string;
  label: "contributes" | "related";
};

export type InformationFlow = {
  nodes: InformationFlowNode[];
  edges: InformationFlowEdge[];
};

export function sortedJobs(jobs: VideoIngestJob[], query = ""): VideoIngestJob[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return [...jobs]
    .filter(
      (job) =>
        !normalizedQuery ||
        job.title.toLocaleLowerCase().includes(normalizedQuery) ||
        job.videoId.toLocaleLowerCase().includes(normalizedQuery) ||
        job.status.includes(normalizedQuery),
    )
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function timelineLabel(value: string, now: Date): { key: string; label: string } {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return { key: "unknown", label: "Date unknown" };
  }
  const key = date.toISOString().slice(0, 10);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const candidate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDelta = Math.round((today.getTime() - candidate.getTime()) / 86_400_000);
  if (dayDelta === 0) return { key, label: "Today" };
  if (dayDelta === 1) return { key, label: "Yesterday" };
  return {
    key,
    label: date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  };
}

export function formatCalendarDate(value?: string | null): string {
  if (!value) return "Date unknown";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function groupByTimeline<T>(
  items: T[],
  getDate: (item: T) => string,
  now: Date,
): TimelineGroup<T>[] {
  const groups = new Map<string, TimelineGroup<T>>();
  for (const item of items) {
    const { key, label } = timelineLabel(getDate(item), now);
    const group = groups.get(key) ?? { key, label, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()].sort((left, right) => {
    if (left.key === "unknown") return 1;
    if (right.key === "unknown") return -1;
    return right.key.localeCompare(left.key);
  });
}

export function groupVideosByTimeline(
  projection: VideoIntelligenceProjection,
  query = "",
  now = new Date(),
): TimelineGroup<VideoLibraryItem>[] {
  const latestByVideo = new Map<string, VideoIngestJob>();
  for (const job of sortedJobs(projection.jobs, query)) {
    if (!latestByVideo.has(job.videoId)) latestByVideo.set(job.videoId, job);
  }
  const items = [...latestByVideo.values()].map((job) => ({
    job,
    dossier:
      projection.dossiers.find(
        (dossier) => dossier.id === job.dossierId || dossier.videoId === job.videoId,
      ) ?? null,
  }));
  return groupByTimeline(items, (item) => item.job.updatedAt, now);
}

export function groupStoriesByTimeline(
  projection: VideoIntelligenceProjection,
  query = "",
  tagId: string | null = null,
  now = new Date(),
): TimelineGroup<StoryLibraryItem>[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const tagById = new Map(projection.tags.map((tag) => [tag.id, tag]));
  const items = projection.stories
    .filter((story) => !tagId || story.tagIds.includes(tagId))
    .map((story) => ({
      story,
      aggregate: projection.aggregates.find((aggregate) => aggregate.storyId === story.id) ?? null,
      tags: story.tagIds
        .map((storyTagId) => tagById.get(storyTagId))
        .filter((tag): tag is Tag => Boolean(tag)),
    }))
    .filter(
      (item) =>
        !normalizedQuery ||
        item.story.title.toLocaleLowerCase().includes(normalizedQuery) ||
        item.story.summary.toLocaleLowerCase().includes(normalizedQuery) ||
        item.tags.some(
          (tag) =>
            tag.canonicalName.toLocaleLowerCase().includes(normalizedQuery) ||
            tag.aliases.some((alias) => alias.toLocaleLowerCase().includes(normalizedQuery)),
        ),
    )
    .sort(
      (left, right) =>
        Date.parse(right.story.eventDate ?? right.story.updatedAt) -
        Date.parse(left.story.eventDate ?? left.story.updatedAt),
    );
  return groupByTimeline(items, (item) => item.story.eventDate ?? item.story.updatedAt, now);
}

export function deriveInformationFlow(
  storyId: string,
  projection: VideoIntelligenceProjection,
): InformationFlow {
  const story = projection.stories.find((candidate) => candidate.id === storyId);
  if (!story) return { nodes: [], edges: [] };
  const contributions = projection.contributions.filter(
    (contribution) => contribution.storyId === storyId,
  );
  const nodes = contributions
    .flatMap<InformationFlowNode>((contribution) => {
      const dossier = projection.dossiers.find(
        (candidate) => candidate.id === contribution.dossierId,
      );
      if (!dossier) return [];
      return [
        {
          id: `source:${dossier.id}`,
          kind: "source",
          title: dossier.publisher ?? dossier.title,
          subtitle: dossier.title,
          occurredAt: dossier.publishedAt ?? dossier.createdAt,
        },
      ];
    })
    .sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt));
  const storyNode: InformationFlowNode = {
    id: `story:${story.id}`,
    kind: "story",
    title: story.title,
    subtitle: "Current event",
    occurredAt: story.eventDate ?? story.createdAt,
  };
  nodes.push(storyNode);
  const edges: InformationFlowEdge[] = nodes
    .filter((node) => node.kind === "source")
    .map((node) => ({
      id: `${node.id}->${storyNode.id}`,
      fromId: node.id,
      toId: storyNode.id,
      label: "contributes" as const,
    }));
  for (const relation of projection.relations.filter(
    (candidate) => candidate.fromStoryId === storyId || candidate.toStoryId === storyId,
  )) {
    const relatedId = relation.fromStoryId === storyId ? relation.toStoryId : relation.fromStoryId;
    const related = projection.stories.find((candidate) => candidate.id === relatedId);
    if (!related) continue;
    const relatedNode: InformationFlowNode = {
      id: `story:${related.id}`,
      kind: "related-story",
      title: related.title,
      subtitle: "Related event",
      occurredAt: related.eventDate ?? related.createdAt,
    };
    nodes.push(relatedNode);
    edges.push({
      id: `story:${relation.fromStoryId}->story:${relation.toStoryId}`,
      fromId: `story:${relation.fromStoryId}`,
      toId: `story:${relation.toStoryId}`,
      label: "related",
    });
  }
  return { nodes, edges };
}

export function defaultDossier(
  projection: VideoIntelligenceProjection,
  initialVideoId?: string,
): VideoDossier | null {
  if (initialVideoId) {
    const requested = projection.dossiers.find((dossier) => dossier.videoId === initialVideoId);
    if (requested) return requested;
  }
  for (const job of sortedJobs(projection.jobs)) {
    const dossier = projection.dossiers.find((candidate) => candidate.id === job.dossierId);
    if (dossier) return dossier;
  }
  return projection.dossiers[0] ?? null;
}

export function dossierStory(
  projection: VideoIntelligenceProjection,
  dossier: VideoDossier | null,
  selectedStoryId?: string | null,
): Story | null {
  if (!dossier) return null;
  const storyId =
    (selectedStoryId && dossier.storyIds.includes(selectedStoryId)
      ? selectedStoryId
      : dossier.storyIds[0]) ?? null;
  return projection.stories.find((story) => story.id === storyId) ?? null;
}

export function timestampSeconds(timestamp: string | null): number | null {
  if (!timestamp) return null;
  const parts = timestamp.split(":").map(Number);
  if (
    parts.some((part) => !Number.isFinite(part) || part < 0) ||
    parts.length < 1 ||
    parts.length > 3
  ) {
    return null;
  }
  return parts.reduce((total, part) => total * 60 + part, 0);
}

export function evidenceUrl(evidence: EvidenceAnchor): string {
  const seconds = timestampSeconds(evidence.timestamp);
  return seconds === null ? evidence.sourceUrl : `${evidence.sourceUrl}&t=${seconds}s`;
}

export function statusTone(
  status: VideoIngestJob["status"],
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "failed") return "destructive";
  if (status === "succeeded") return "default";
  if (status === "running") return "secondary";
  return "outline";
}
