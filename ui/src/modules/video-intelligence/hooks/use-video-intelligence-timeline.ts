/** Narrow, retained Convex reads for server-date-paged videos, Stories, and details. */
import { usePaginatedQuery, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { isConvexEnabled } from "@/providers/convex-provider";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

export type VideoTimelineItem = {
  id: string;
  videoId: string;
  title: string;
  canonicalUrl: string;
  publisher: string | null;
  sourceStatus: "TRANSCRIPT_USED" | "SUMMARY_ONLY" | "TRANSCRIPT_UNAVAILABLE";
  timelineDay: string | null;
  summary: string;
  storyCount: number;
  updatedAt: string;
};

export type StoryTimelineItem = {
  id: string;
  title: string;
  summary: string;
  eventDate: string | null;
  timelineDay: string | null;
  entities: string[];
  tags: { id: string; name: string }[];
  sourceCount: number;
};

export type VideoDossierDetail = {
  id: string;
  videoId: string;
  canonicalUrl: string;
  title: string;
  publisher: string | null;
  publishedAt: string | null;
  sourceStatus: "TRANSCRIPT_USED" | "SUMMARY_ONLY" | "TRANSCRIPT_UNAVAILABLE";
  sourceNote: string;
  timelineDay: string | null;
  summary: string;
  keyPoints: { finding: string; detail: string | null; timestamp: string | null }[];
  stories: { id: string; title: string; summary: string; eventDate: string | null }[];
};

export type VideoStoryDetail = {
  id: string;
  title: string;
  summary: string;
  eventDate: string | null;
  timelineDay: string | null;
  entities: string[];
  tags: { id: string; name: string }[];
  contributions: {
    id: string;
    dossierId: string;
    frame: string;
    summary: string;
    claimCount: number;
    source: { title: string; publisher: string | null; publishedAt: string | null } | null;
  }[];
};

export type VideoTimelineState<T> = {
  day: string | null;
  olderDay: string | null;
  newerDay: string | null;
  items: T[];
  status: "idle" | "loading" | "ready" | "error";
  canLoadMore: boolean;
  loadMore: () => void;
  selectDay: (day: string) => void;
  error: string | null;
};

export function useVideoTimeline(active: boolean): VideoTimelineState<VideoTimelineItem> {
  const enabled = isConvexEnabled();
  const [day, setDay] = useState<string | null>(null);
  const latestDay = useQuery(
    api.modules.videoIntelligence.timelineProjection.getVideoTimelineAnchor,
    enabled && active ? { direction: "latest" } : "skip",
  );
  useEffect(() => {
    if (active && !day && latestDay) setDay(latestDay);
  }, [active, day, latestDay]);
  const olderDay = useQuery(
    api.modules.videoIntelligence.timelineProjection.getVideoTimelineAnchor,
    enabled && active && day ? { direction: "older", day } : "skip",
  );
  const newerDay = useQuery(
    api.modules.videoIntelligence.timelineProjection.getVideoTimelineAnchor,
    enabled && active && day ? { direction: "newer", day } : "skip",
  );
  const result = usePaginatedQuery(
    api.modules.videoIntelligence.timelineProjection.getVideoItemsForDay,
    enabled && active && day ? { day } : "skip",
    { initialNumItems: 24 },
  );
  return buildTimelineState(active, enabled, day, olderDay, newerDay, result, setDay);
}

export function useStoryTimeline(active: boolean): VideoTimelineState<StoryTimelineItem> {
  const enabled = isConvexEnabled();
  const [day, setDay] = useState<string | null>(null);
  const latestDay = useQuery(
    api.modules.videoIntelligence.timelineProjection.getStoryTimelineAnchor,
    enabled && active ? { direction: "latest" } : "skip",
  );
  useEffect(() => {
    if (active && !day && latestDay) setDay(latestDay);
  }, [active, day, latestDay]);
  const olderDay = useQuery(
    api.modules.videoIntelligence.timelineProjection.getStoryTimelineAnchor,
    enabled && active && day ? { direction: "older", day } : "skip",
  );
  const newerDay = useQuery(
    api.modules.videoIntelligence.timelineProjection.getStoryTimelineAnchor,
    enabled && active && day ? { direction: "newer", day } : "skip",
  );
  const result = usePaginatedQuery(
    api.modules.videoIntelligence.timelineProjection.getStoryItemsForDay,
    enabled && active && day ? { day } : "skip",
    { initialNumItems: 24 },
  );
  return buildTimelineState(active, enabled, day, olderDay, newerDay, result, setDay);
}

export function useVideoDossierDetail(dossierId: string | null) {
  const enabled = isConvexEnabled();
  const detail = useQuery(
    api.modules.videoIntelligence.timelineProjection.getVideoDossierDetail,
    enabled && dossierId ? { dossierId: dossierId as Id<"videoIntelligenceDossiers"> } : "skip",
  );
  return detail as VideoDossierDetail | null | undefined;
}

export function useVideoStoryDetail(storyId: string | null) {
  const enabled = isConvexEnabled();
  const detail = useQuery(
    api.modules.videoIntelligence.timelineProjection.getVideoStoryDetail,
    enabled && storyId ? { storyId: storyId as Id<"videoIntelligenceStories"> } : "skip",
  );
  return detail as VideoStoryDetail | null | undefined;
}

function buildTimelineState<T>(
  active: boolean,
  enabled: boolean,
  day: string | null,
  olderDay: string | null | undefined,
  newerDay: string | null | undefined,
  result: {
    results: T[];
    status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
    loadMore: (count: number) => void;
  },
  setDay: (day: string) => void,
): VideoTimelineState<T> {
  if (!active) return idleState();
  if (!enabled) return { ...idleState(), status: "error", error: "Convex is not configured." };
  if (!day || result.status === "LoadingFirstPage")
    return { ...idleState(), day, status: "loading" };
  return {
    day,
    olderDay: olderDay ?? null,
    newerDay: newerDay ?? null,
    items: result.results,
    status: "ready" as const,
    canLoadMore: result.status === "CanLoadMore",
    loadMore: () => result.loadMore(24),
    selectDay: setDay,
    error: null,
  };
}

function idleState(): VideoTimelineState<never> {
  return {
    day: null,
    olderDay: null,
    newerDay: null,
    items: [],
    status: "idle",
    canLoadMore: false,
    loadMore: () => {},
    selectDay: () => {},
    error: null,
  };
}
