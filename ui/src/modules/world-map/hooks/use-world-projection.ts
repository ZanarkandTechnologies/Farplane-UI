/** Loads one project's disposable world projection through the local read-only bridge. */

import { useQuery } from "@tanstack/react-query";
import { parseWorldProjection } from "../lib/world-projection";
import type { WorldBridgePayload } from "../types";

export function useWorldProjection(projectPath: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["farplane-world", projectPath ?? ""],
    enabled: enabled && Boolean(projectPath),
    retry: false,
    staleTime: 15_000,
    queryFn: async () => {
      const params = new URLSearchParams({ projectPath: projectPath ?? "" });
      const response = await fetch(`/farplane/world?${params}`, { cache: "no-store" });
      const payload = (await response.json()) as WorldBridgePayload;
      if (!response.ok || !payload.ok)
        throw new Error(payload.error ?? `world_projection_failed:${response.status}`);
      const projection = payload.projection ? parseWorldProjection(payload.projection) : null;
      return {
        ...payload,
        projection: projection ? { ...projection, stale: projection.stale || payload.stale } : null,
      };
    },
  });
}
