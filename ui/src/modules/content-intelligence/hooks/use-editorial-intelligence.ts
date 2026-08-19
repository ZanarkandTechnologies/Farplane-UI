/** Retained chronological reads for strictly gated News and revision-backed comparable takes. */
import { usePaginatedQuery, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { isConvexEnabled } from "@/providers/convex-provider";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { canLoadOlderTimeline, mergeTimelinePage, type TimelinePage } from "../lib/timeline-feed";

export type EditorialTimeline<T> = {
  items: T[];
  status: "idle" | "loading" | "ready" | "error";
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
  error: string | null;
};

export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  eventDate: string | null;
  timelineDay: string | null;
  editorialStatus: "developing" | "aggregated";
  tags: string[];
  sourceCount: number;
  claimCount: number;
  whyItMatters: string | null;
  /** Direct original/official/reference evidence; never the featured YouTube URL. */
  referenceUrl: string;
  featuredSource: {
    title: string;
    publisher: string | null;
    canonicalUrl: string;
  } | null;
};

export type NewsFilters = {
  status: "all" | "developing" | "aggregated";
  projectId: string;
  source: string;
  topic: string;
};

export type RelatedCoverageItem = {
  id: string;
  dossierId: string;
  sourceId: string;
  title: string;
  publisher: string | null;
  canonicalUrl: string;
  summary: string;
  relationship: "same_development" | "same_active_discussion";
  rationale: string;
  timelineDay: string;
};

export type NewsDetail = {
  id: string;
  title: string;
  summary: string;
  eventDate: string | null;
  referenceUrl: string;
  editorialStatus: "developing" | "aggregated";
  whyNow: string | null;
  whyItMatters: string | null;
  contributors: {
    id: string;
    dossierId: string;
    sourceTitle: string;
    publisher: string | null;
    frame: string;
    summary: string;
    claimCount: number;
  }[];
};

export function useNewsTimeline(active: boolean): EditorialTimeline<NewsItem> & {
  filters: NewsFilters;
  setFilters: (next: NewsFilters) => void;
} {
  const enabled = isConvexEnabled();
  const [day, setDay] = useState<string | null>(null);
  const [pages, setPages] = useState<TimelinePage<NewsItem>[]>([]);
  const [isChangingDay, setIsChangingDay] = useState(false);
  const [filters, setFilters] = useState<NewsFilters>({
    status: "all",
    projectId: "",
    source: "",
    topic: "",
  });
  const latest = useQuery(
    api.modules.videoIntelligence.editorialProjection.getNewsTimelineAnchor,
    enabled && active ? { direction: "latest" } : "skip",
  );
  useEffect(() => {
    if (active && !day && latest) setDay(latest);
  }, [active, day, latest]);
  const older = useQuery(
    api.modules.videoIntelligence.editorialProjection.getNewsTimelineAnchor,
    enabled && active && day ? { direction: "older", day } : "skip",
  );
  const result = usePaginatedQuery(
    api.modules.videoIntelligence.editorialProjection.getNewsForDay,
    enabled && active && day
      ? {
          day,
          ...(filters.status === "all" ? {} : { statuses: [filters.status] }),
          ...(filters.projectId ? { projectId: filters.projectId } : {}),
          ...(filters.source ? { source: filters.source } : {}),
          ...(filters.topic ? { topic: filters.topic } : {}),
        }
      : "skip",
    { initialNumItems: 24 },
  );
  const pageItems = result.results as NewsItem[];

  useEffect(() => {
    if (!day || result.status === "LoadingFirstPage") return;
    setPages((current) => mergeTimelinePage(current, day, pageItems));
    setIsChangingDay(false);
  }, [day, pageItems, result.status]);

  const loadMore = useCallback(() => {
    if (isChangingDay || result.status === "LoadingMore" || result.status === "LoadingFirstPage")
      return;
    if (result.status === "CanLoadMore") {
      result.loadMore(24);
      return;
    }
    if (result.status === "Exhausted" && older) {
      setIsChangingDay(true);
      setDay(older);
    }
  }, [isChangingDay, older, result]);

  const updateFilters = useCallback((next: NewsFilters) => {
    setPages([]);
    setFilters(next);
  }, []);

  if (active && enabled && latest === null) {
    return {
      ...idleTimeline(),
      status: "ready",
      filters,
      setFilters: updateFilters,
    };
  }
  return {
    ...buildTimeline(active, enabled, day, pages, older, result.status, isChangingDay, loadMore),
    filters,
    setFilters: updateFilters,
  };
}

export function useNewsDetail(storyId: string | null) {
  const enabled = isConvexEnabled();
  return useQuery(
    api.modules.videoIntelligence.editorialProjection.getNewsDetail,
    enabled && storyId ? { storyId: storyId as Id<"videoIntelligenceStories"> } : "skip",
  ) as NewsDetail | null | undefined;
}

export function useDossierRelatedCoverage(dossierId: string | null) {
  const enabled = isConvexEnabled();
  return useQuery(
    api.modules.videoIntelligence.editorialProjection.getDossierRelatedCoverage,
    enabled && dossierId ? { dossierId: dossierId as Id<"videoIntelligenceDossiers"> } : "skip",
  ) as RelatedCoverageItem[] | undefined;
}

function buildTimeline<T extends { id: string }>(
  active: boolean,
  enabled: boolean,
  day: string | null,
  pages: TimelinePage<T>[],
  olderDay: string | null | undefined,
  pageStatus: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted",
  isChangingDay: boolean,
  loadMore: () => void,
): EditorialTimeline<T> {
  if (!active) return idleTimeline();
  if (!enabled) return { ...idleTimeline(), status: "error", error: "Convex is not configured." };
  if (!day || (pageStatus === "LoadingFirstPage" && pages.length === 0))
    return { ...idleTimeline(), status: "loading" };
  return {
    items: pages.flatMap((loadedDay) => loadedDay.items),
    status: "ready",
    hasMore: canLoadOlderTimeline(pageStatus, olderDay),
    isLoadingMore: isChangingDay || pageStatus === "LoadingMore",
    loadMore,
    error: null,
  };
}

function idleTimeline(): EditorialTimeline<never> {
  return {
    items: [],
    status: "idle",
    hasMore: false,
    isLoadingMore: false,
    loadMore: () => {},
    error: null,
  };
}
