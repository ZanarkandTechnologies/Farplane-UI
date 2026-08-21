"use client";

import { useEffect, useMemo, useState } from "react";
import type { CodexCapabilityProfilesResponse } from "@/modules/runtime/lib/codex-app-server/types";

type CapabilityProfileState = {
  profilesByProjectPath: Record<string, CodexCapabilityProfilesResponse>;
  errorByProjectPath: Record<string, string>;
};

export function useProjectCapabilityProfiles(
  projectPaths: readonly string[],
  enabled = true,
): CapabilityProfileState {
  const pathKey = useMemo(
    () =>
      [...new Set(projectPaths.map((path) => path.trim()).filter((path) => path.startsWith("/")))]
        .sort()
        .join("\n"),
    [projectPaths],
  );
  const [state, setState] = useState<CapabilityProfileState>({
    profilesByProjectPath: {},
    errorByProjectPath: {},
  });

  useEffect(() => {
    if (!enabled || !pathKey) {
      setState({ profilesByProjectPath: {}, errorByProjectPath: {} });
      return;
    }
    const controller = new AbortController();
    const paths = pathKey.split("\n");
    void Promise.all(
      paths.map(async (projectPath) => {
        try {
          const query = new URLSearchParams({ projectPath });
          const response = await fetch(`/farplane/capability-profiles?${query}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          const payload = (await response
            .json()
            .catch(() => null)) as CodexCapabilityProfilesResponse | null;
          if (!response.ok || !payload?.ok) throw new Error(`read_failed:${response.status}`);
          return { projectPath, payload, error: "" };
        } catch (reason) {
          return {
            projectPath,
            payload: null,
            error: reason instanceof Error ? reason.message : "read_failed",
          };
        }
      }),
    ).then((results) => {
      if (controller.signal.aborted) return;
      const profilesByProjectPath: Record<string, CodexCapabilityProfilesResponse> = {};
      const errorByProjectPath: Record<string, string> = {};
      for (const result of results) {
        if (result.payload) profilesByProjectPath[result.projectPath] = result.payload;
        if (result.error) errorByProjectPath[result.projectPath] = result.error;
      }
      setState({ profilesByProjectPath, errorByProjectPath });
    });
    return () => controller.abort();
  }, [enabled, pathKey]);

  return state;
}
