"use client";

/**
 * Project timeline page hook.
 * Owns TanStack Query paging for day-windowed Team Workspace timeline rows.
 */

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { TeamTimelineRow } from "@/modules/team-workspace/components/team-timeline";
import {
  DEFAULT_TIMELINE_REPORT_PATTERNS,
  type ProjectTimelinePage,
  type ProjectTimelineSource,
  type TimelineReportPatternConfig,
} from "./timeline-page-types";

type TimelinePageParam = {
  cursor?: string;
  day: string;
};

type UseProjectTimelinePagesInput = {
  enabled: boolean;
  initialDay?: string;
  limit?: number;
  projectPath?: string | null;
  reportPatterns?: TimelineReportPatternConfig;
  sources?: ProjectTimelineSource[];
};

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function timelineQueryKey(input: UseProjectTimelinePagesInput): readonly unknown[] {
  return [
    "project-timeline",
    input.projectPath ?? "",
    input.initialDay ?? todayString(),
    input.limit ?? 80,
    input.sources ?? ["reports", "memory"],
    input.reportPatterns ?? DEFAULT_TIMELINE_REPORT_PATTERNS,
  ] as const;
}

async function fetchProjectTimelinePage(
  input: UseProjectTimelinePagesInput,
  pageParam: TimelinePageParam,
): Promise<ProjectTimelinePage> {
  const params = new URLSearchParams();
  if (input.projectPath?.trim()) params.set("projectPath", input.projectPath.trim());
  params.set("day", pageParam.day);
  if (pageParam.cursor) params.set("cursor", pageParam.cursor);
  if (input.limit) params.set("limit", String(input.limit));
  if (input.sources?.length) params.set("sources", input.sources.join(","));
  const patterns = input.reportPatterns ?? DEFAULT_TIMELINE_REPORT_PATTERNS;
  if (patterns.include.length) params.set("reportInclude", patterns.include.join(","));
  if (patterns.exclude.length) params.set("reportExclude", patterns.exclude.join(","));
  const response = await fetch(`/farplane/project-timeline?${params.toString()}`);
  const payload = (await response.json()) as ProjectTimelinePage | { ok: false; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error("error" in payload && payload.error ? payload.error : "timeline_load_failed");
  }
  return payload;
}

export function useProjectTimelinePages(input: UseProjectTimelinePagesInput): {
  error: Error | null;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  pages: ProjectTimelinePage[];
  rows: TeamTimelineRow[];
  sourceCounts: ProjectTimelinePage["sourceCounts"];
} {
  const initialDay = input.initialDay ?? todayString();
  const query = useInfiniteQuery({
    enabled: input.enabled,
    initialPageParam: { day: initialDay } satisfies TimelinePageParam,
    queryFn: ({ pageParam }) => fetchProjectTimelinePage(input, pageParam),
    queryKey: timelineQueryKey({ ...input, initialDay }),
    getNextPageParam: (lastPage): TimelinePageParam | undefined => {
      if (lastPage.nextCursor) return { day: lastPage.day, cursor: lastPage.nextCursor };
      if (lastPage.previousDay) return { day: lastPage.previousDay };
      return undefined;
    },
  });
  const pages = query.data?.pages ?? [];
  const rows = useMemo(
    () =>
      pages.flatMap((page) => page.rows).sort((left, right) => right.occurredAt - left.occurredAt),
    [pages],
  );
  const sourceCounts = useMemo(
    () =>
      pages.reduce<ProjectTimelinePage["sourceCounts"]>((counts, page) => {
        for (const [source, count] of Object.entries(page.sourceCounts)) {
          counts[source as keyof ProjectTimelinePage["sourceCounts"]] =
            (counts[source as keyof ProjectTimelinePage["sourceCounts"]] ?? 0) + count;
        }
        return counts;
      }, {}),
    [pages],
  );

  return {
    error: query.error,
    fetchNextPage: () => {
      void query.fetchNextPage();
    },
    hasNextPage: Boolean(query.hasNextPage),
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    pages,
    rows,
    sourceCounts,
  };
}
