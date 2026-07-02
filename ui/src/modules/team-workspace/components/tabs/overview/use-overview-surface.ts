import { useQuery } from "@tanstack/react-query";
import type { ProjectConfigLoadState } from "../project-config";
import {
  parseOverviewSurface,
  type OverviewSurface,
} from "@/modules/team-workspace/lib/dashboard-projections/overview-surface";
import { overviewQueryKeys } from "./query-keys";

type OverviewSurfaceResponse = {
  ok?: boolean;
  exists?: boolean;
  surface?: unknown;
  error?: string;
};

export function useOverviewSurface({
  projectPath,
  enabled,
}: {
  projectPath?: string | null;
  enabled: boolean;
}): {
  surface: OverviewSurface | null;
  state: ProjectConfigLoadState;
  error: string | null;
  refresh: () => void;
} {
  const normalizedProjectPath = projectPath?.trim() ?? "";
  const canFetchProjection = enabled && normalizedProjectPath.length > 0;
  const query = useQuery({
    queryKey: overviewQueryKeys.surface(projectPath),
    enabled: canFetchProjection,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<OverviewSurface | null> => {
      const params = new URLSearchParams();
      params.set("projectPath", normalizedProjectPath);
      const response = await fetch(`/farplane/overview-surface?${params.toString()}`);
      const payload = (await response.json()) as OverviewSurfaceResponse;
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error ?? "overview_surface_load_failed");
      }
      if (!payload.exists) return null;
      return parseOverviewSurface(payload.surface) ?? null;
    },
  });

  return {
    surface: query.data ?? null,
    state: !canFetchProjection
      ? "idle"
      : query.isLoading
        ? "loading"
        : query.isError
          ? "error"
          : "ready",
    error: query.error instanceof Error ? query.error.message : null,
    refresh: () => {
      void query.refetch();
    },
  };
}
