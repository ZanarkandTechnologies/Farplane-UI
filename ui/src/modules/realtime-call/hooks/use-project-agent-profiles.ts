/**
 * Ownership: browser client and query lifecycle for project-local realtime agent profiles.
 * Input: absolute project path. Output: loading/error state and validated profile response.
 * Side effect: abortable GET to the Farplane local bridge; never falls back to seed data.
 */
import { useEffect, useState } from "react";
import type { AgentProfilesResponse } from "../types";

export type AgentProfileScope = "office" | "project";

export async function getProjectAgentProfiles(
  projectPath: string | null,
  signal?: AbortSignal,
  scope: AgentProfileScope = "project",
): Promise<AgentProfilesResponse> {
  const query =
    scope === "office"
      ? new URLSearchParams({ scope })
      : new URLSearchParams({ projectPath: projectPath ?? "" });
  const response = await fetch(`/farplane/agent-profiles?${query}`, {
    cache: "no-store",
    signal,
  });
  const body = (await response.json().catch(() => null)) as AgentProfilesResponse | null;
  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || `Could not load call profiles (${response.status}).`);
  }
  if (!body.profiles || typeof body.profiles !== "object") {
    throw new Error("The call profile response was incomplete.");
  }
  return body;
}

export interface ProjectAgentProfilesState {
  data: AgentProfilesResponse | null;
  error: string | null;
  isLoading: boolean;
}

export function useProjectAgentProfiles(
  projectPath: string | null,
  enabled = true,
  scope: AgentProfileScope = "project",
): ProjectAgentProfilesState {
  const [state, setState] = useState<ProjectAgentProfilesState>({
    data: null,
    error: null,
    isLoading: false,
  });

  useEffect(() => {
    if (!enabled || (scope === "project" && !projectPath)) {
      setState({ data: null, error: null, isLoading: false });
      return;
    }
    const controller = new AbortController();
    setState({ data: null, error: null, isLoading: true });
    void getProjectAgentProfiles(projectPath, controller.signal, scope)
      .then((data) => setState({ data, error: null, isLoading: false }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          data: null,
          error: error instanceof Error ? error.message : "Could not load call profiles.",
          isLoading: false,
        });
      });
    return () => controller.abort();
  }, [enabled, projectPath, scope]);

  return state;
}
