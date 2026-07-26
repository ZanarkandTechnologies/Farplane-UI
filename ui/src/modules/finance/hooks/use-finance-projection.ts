"use client";

import { useQuery } from "@tanstack/react-query";
import type { FinanceProjection, FinanceProjectionResponse } from "../lib/finance-types";

function normalizeFinanceProjection(projection: FinanceProjection): FinanceProjection {
  return {
    ...projection,
    latestBalance: projection.latestBalance ?? null,
    balanceHistory: Array.isArray(projection.balanceHistory) ? projection.balanceHistory : [],
    balanceSnapshotCount: Number.isSafeInteger(projection.balanceSnapshotCount)
      ? projection.balanceSnapshotCount
      : 0,
  };
}

export async function loadFinanceProjection(
  reader: typeof fetch = fetch,
): Promise<FinanceProjection> {
  const response = await reader("/farplane/finance");
  const payload = (await response.json()) as FinanceProjectionResponse;
  if (!response.ok || payload.ok === false || !payload.projection) {
    throw new Error(payload.error ?? "finance_projection_unavailable");
  }
  return normalizeFinanceProjection(payload.projection);
}

export function useFinanceProjection(enabled = true): {
  projection: FinanceProjection | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<unknown>;
} {
  const query = useQuery({
    queryKey: ["global-finance-projection"],
    queryFn: () => loadFinanceProjection(),
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
