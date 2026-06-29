import { useEffect, useState } from "react";
import type { FarplaneProjectConfig, ProjectConfigLoadState } from "./config-types";

export function useFarplaneProjectConfig({
  projectPath,
  enabled,
}: {
  projectPath?: string | null;
  enabled: boolean;
}): {
  config: FarplaneProjectConfig | null;
  state: ProjectConfigLoadState;
  error: string | null;
} {
  const [config, setConfig] = useState<FarplaneProjectConfig | null>(null);
  const [state, setState] = useState<ProjectConfigLoadState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (projectPath?.trim()) params.set("projectPath", projectPath.trim());
    setState("loading");
    setError(null);
    fetch(`/farplane/project-config${params.toString() ? `?${params.toString()}` : ""}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as FarplaneProjectConfig & { error?: string };
        if (!response.ok || !payload.ok) throw new Error(payload.error ?? "config_load_failed");
        setConfig(payload);
        setState("ready");
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) return;
        setError(fetchError instanceof Error ? fetchError.message : "config_load_failed");
        setState("error");
      });
    return () => controller.abort();
  }, [enabled, projectPath]);

  return { config, state, error };
}
