/** Convex-backed paginated Content Intelligence read hook. */
import { usePaginatedQuery } from "convex/react";
import { isConvexEnabled } from "@/providers/convex-provider";
import { api } from "../../../../../convex/_generated/api";
import type { ContentIntelligenceItem } from "../types";

type LoadState = {
  items: ContentIntelligenceItem[];
  status: "idle" | "loading" | "ready" | "error";
  canLoadMore: boolean;
  loadMore: () => void;
  error: string | null;
};

export function useContentIntelligence(open: boolean): LoadState {
  const enabled = isConvexEnabled();
  const query = usePaginatedQuery(
    api.modules.content.intelligenceProjection.getContentIntelligenceProjection,
    enabled && open ? {} : "skip",
    { initialNumItems: 24 },
  );
  if (!open)
    return { items: [], status: "idle", canLoadMore: false, loadMore: () => {}, error: null };
  if (!enabled) {
    return {
      items: [],
      status: "error",
      canLoadMore: false,
      loadMore: () => {},
      error: "Convex is not configured for this UI session.",
    };
  }
  return {
    items: query.results as ContentIntelligenceItem[],
    status: query.status === "LoadingFirstPage" ? "loading" : "ready",
    canLoadMore: query.status === "CanLoadMore",
    loadMore: () => query.loadMore(24),
    error: null,
  };
}
