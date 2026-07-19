/** Loads browser-safe map provider configuration from the canonical local state bridge. */

import { useQuery } from "@tanstack/react-query";
import { parseWorldMapProviderConfig } from "../lib/map-renderer";

type MapConfigResponse = {
  ok?: boolean;
  payload?: unknown;
  error?: string;
};

export function useWorldMapProvider() {
  return useQuery({
    queryKey: ["farplane-world-map-provider"],
    retry: false,
    staleTime: 15_000,
    refetchOnMount: "always",
    queryFn: async () => {
      const response = await fetch("/farplane/map-config", {
        cache: "no-store",
        headers: { accept: "application/json" },
      });
      const body = (await response.json().catch(() => ({}))) as MapConfigResponse;
      if (!response.ok || body.ok === false) {
        throw new Error(body.error ?? `map_config_failed:${response.status}`);
      }
      return parseWorldMapProviderConfig(body.payload);
    },
  });
}
