"use client";

import { useQuery } from "@tanstack/react-query";
import type { LeverageProjection, LeverageProjectionResponse } from "../lib/leverage-types";

export async function loadLeverageProjection(
  reader: typeof fetch = fetch,
): Promise<LeverageProjection> {
  const response = await reader("/farplane/leverage");
  const payload = (await response.json()) as LeverageProjectionResponse;
  if (!response.ok || payload.ok === false || !payload.projection) {
    throw new Error(payload.error ?? "leverage_projection_unavailable");
  }
  return payload.projection;
}

export function useLeverageProjection(enabled = true): {
  projection: LeverageProjection | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<unknown>;
} {
  const query = useQuery({
    queryKey: ["global-leverage-projection"],
    queryFn: () => loadLeverageProjection(),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  return {
    projection: query.data ?? null,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: query.refetch,
  };
}
