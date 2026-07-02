import { useQuery } from "@tanstack/react-query";
import type { ProjectConfigLoadState } from "../project-config";
import {
  parseFeedScoutDailyFeed,
  type FeedScoutDailyFeed,
} from "@/modules/team-workspace/lib/feed-scout/feed-scout";

type FeedScoutBridgeResponse = {
  ok?: boolean;
  exists?: boolean;
  availableDates?: string[];
  path?: string;
  projectPath?: string;
  updatedAtMs?: number;
  feed?: unknown;
  latestReport?: unknown;
  error?: string;
};

const newsFeedQueryKeys = {
  daily: (
    projectPath?: string | null,
    date?: string | null,
  ): readonly ["feed-scout", string, string] => [
    "feed-scout",
    projectPath?.trim() || "framework-root",
    date?.trim() || "latest",
  ],
};

export function useNewsFeed({
  date,
  projectPath,
  enabled,
}: {
  date?: string | null;
  projectPath?: string | null;
  enabled: boolean;
}): {
  availableDates: string[];
  feed: FeedScoutDailyFeed | null;
  state: ProjectConfigLoadState;
  error: string | null;
  exists: boolean;
  path: string | null;
  projectPath: string | null;
  updatedAtMs: number | null;
  refresh: () => void;
} {
  const normalizedProjectPath = projectPath?.trim() ?? "";
  const normalizedDate = date?.trim() || "latest";
  const query = useQuery({
    queryKey: newsFeedQueryKeys.daily(projectPath, normalizedDate),
    enabled,
    staleTime: 30_000,
    refetchInterval: enabled ? 60_000 : false,
    queryFn: async (): Promise<{
      availableDates: string[];
      feed: FeedScoutDailyFeed | null;
      exists: boolean;
      path: string | null;
      projectPath: string | null;
      updatedAtMs: number | null;
    }> => {
      const params = new URLSearchParams();
      if (normalizedProjectPath) params.set("projectPath", normalizedProjectPath);
      params.set("date", normalizedDate);
      const response = await fetch(`/farplane/feed-scout?${params.toString()}`);
      const payload = (await response.json()) as FeedScoutBridgeResponse;
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error ?? "feed_scout_load_failed");
      }
      if (!payload.exists) {
        return {
          availableDates: payload.availableDates ?? [],
          feed: null,
          exists: false,
          path: payload.path ?? null,
          projectPath: payload.projectPath ?? null,
          updatedAtMs: null,
        };
      }
      const feed = parseFeedScoutDailyFeed(payload.feed, payload.latestReport);
      if (!feed) throw new Error("feed_scout_parse_failed");
      return {
        availableDates: payload.availableDates ?? [],
        feed,
        exists: true,
        path: payload.path ?? null,
        projectPath: payload.projectPath ?? null,
        updatedAtMs:
          typeof payload.updatedAtMs === "number" && Number.isFinite(payload.updatedAtMs)
            ? payload.updatedAtMs
            : null,
      };
    },
  });

  return {
    availableDates: query.data?.availableDates ?? [],
    feed: query.data?.feed ?? null,
    state: !enabled ? "idle" : query.isLoading ? "loading" : query.isError ? "error" : "ready",
    error: query.error instanceof Error ? query.error.message : null,
    exists: query.data?.exists ?? false,
    path: query.data?.path ?? null,
    projectPath: query.data?.projectPath ?? null,
    updatedAtMs: query.data?.updatedAtMs ?? null,
    refresh: () => {
      void query.refetch();
    },
  };
}
