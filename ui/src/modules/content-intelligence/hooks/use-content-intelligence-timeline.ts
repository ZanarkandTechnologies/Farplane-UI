/** Retained, chronological Content feed assembled from one active Convex day at a time. */
import { usePaginatedQuery, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { isConvexEnabled } from "@/providers/convex-provider";
import { api } from "../../../../../convex/_generated/api";
import { canLoadOlderTimeline, mergeTimelinePage, type TimelinePage } from "../lib/timeline-feed";
import type { ContentIntelligenceItem } from "../types";

export type ContentTimelineState = {
  items: ContentIntelligenceItem[];
  status: "idle" | "loading" | "ready" | "error";
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
  error: string | null;
};

/**
 * `active` becomes true on the first workspace visit and deliberately never
 * follows dialog close; Convex owns the retained reactive result cache.
 */
export function useContentIntelligenceTimeline(active: boolean): ContentTimelineState {
  const enabled = isConvexEnabled();
  const [day, setDay] = useState<string | null>(null);
  const [pages, setPages] = useState<TimelinePage<ContentIntelligenceItem>[]>([]);
  const [isChangingDay, setIsChangingDay] = useState(false);
  const latestDay = useQuery(
    api.modules.content.timelineProjection.getContentTimelineAnchor,
    enabled && active ? { direction: "latest" } : "skip",
  );
  useEffect(() => {
    if (active && !day && latestDay) setDay(latestDay);
  }, [active, day, latestDay]);
  const olderDay = useQuery(
    api.modules.content.timelineProjection.getContentTimelineAnchor,
    enabled && active && day ? { direction: "older", day } : "skip",
  );
  const page = usePaginatedQuery(
    api.modules.content.timelineProjection.getContentItemsForDay,
    enabled && active && day ? { day } : "skip",
    { initialNumItems: 24 },
  );
  const pageItems = page.results as ContentIntelligenceItem[];

  useEffect(() => {
    if (!day || page.status === "LoadingFirstPage") return;
    setPages((current) => mergeTimelinePage(current, day, pageItems));
    setIsChangingDay(false);
  }, [day, page.status, pageItems]);

  const loadMore = useCallback(() => {
    if (isChangingDay || page.status === "LoadingMore" || page.status === "LoadingFirstPage")
      return;
    if (page.status === "CanLoadMore") {
      page.loadMore(24);
      return;
    }
    if (page.status === "Exhausted" && olderDay) {
      setIsChangingDay(true);
      setDay(olderDay);
    }
  }, [isChangingDay, olderDay, page]);

  if (!active) return idleState();
  if (!enabled) return { ...idleState(), status: "error", error: "Convex is not configured." };
  if (latestDay === null) return { ...idleState(), status: "ready" };
  if (!day || (page.status === "LoadingFirstPage" && pages.length === 0)) {
    return { ...idleState(), status: "loading" };
  }
  return {
    items: pages.flatMap((loadedDay) => loadedDay.items),
    status: "ready",
    hasMore: canLoadOlderTimeline(page.status, olderDay),
    isLoadingMore: isChangingDay || page.status === "LoadingMore",
    loadMore,
    error: null,
  };
}

function idleState(): ContentTimelineState {
  return {
    items: [],
    status: "idle",
    hasMore: false,
    isLoadingMore: false,
    loadMore: () => {},
    error: null,
  };
}
