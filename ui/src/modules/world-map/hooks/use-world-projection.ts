/** Loads one project's disposable world projection through the local read-only bridge. */

import { queryOptions, useQuery } from "@tanstack/react-query";
import { parseWorldProjection } from "../lib/world-projection";
import type { WorldBridgePayload } from "../types";

export async function fetchWorldProjection(
  projectPath: string,
): Promise<WorldBridgePayload & { projection: ReturnType<typeof parseWorldProjection> | null }> {
  const params = new URLSearchParams({ projectPath });
  const response = await fetch(`/farplane/world?${params}`, { cache: "no-store" });
  const payload = (await response.json()) as WorldBridgePayload;
  if (!response.ok || !payload.ok)
    throw new Error(payload.error ?? `world_projection_failed:${response.status}`);
  const projection = payload.projection ? parseWorldProjection(payload.projection) : null;
  return {
    ...payload,
    projection: projection
      ? { ...projection, stale: projection.stale || payload.stale === true }
      : null,
  };
}

export function worldProjectionQuery(projectPath: string) {
  return queryOptions({
    queryKey: ["farplane-world", projectPath] as const,
    retry: false,
    staleTime: 15_000,
    queryFn: () => fetchWorldProjection(projectPath),
  });
}

export function useWorldProjection(projectPath: string | undefined, enabled: boolean) {
  return useQuery({
    ...worldProjectionQuery(projectPath ?? ""),
    enabled: enabled && Boolean(projectPath),
  });
}
