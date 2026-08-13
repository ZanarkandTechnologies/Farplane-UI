import { useEffect, useState } from "react";
import type { ProjectConfigurationFile } from "./configuration-catalog";

type ProjectConfigurationPayload = {
  ok: boolean;
  files: ProjectConfigurationFile[];
  error?: string;
};

export type ConfigurationCatalogState = "idle" | "loading" | "ready" | "error";

export function useConfigurationCatalog(enabled: boolean): {
  files: ProjectConfigurationFile[];
  state: ConfigurationCatalogState;
  error: string | null;
} {
  const [files, setFiles] = useState<ProjectConfigurationFile[]>([]);
  const [state, setState] = useState<ConfigurationCatalogState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setState("loading");
    setError(null);
    fetch("/farplane/project-config", { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as ProjectConfigurationPayload;
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "config_load_failed");
        }
        setFiles(payload.files);
        setState("ready");
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) return;
        setState("error");
        setError(fetchError instanceof Error ? fetchError.message : "config_load_failed");
      });
    return () => controller.abort();
  }, [enabled]);

  return { files, state, error };
}
