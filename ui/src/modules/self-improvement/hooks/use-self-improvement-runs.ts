"use client";

/** Loads the bounded ticket-backed run index only while its operator panel is open. */
import { useEffect, useMemo, useState } from "react";
import type { ProjectModel } from "@/modules/runtime";
import {
  buildSelfImproveRunSummaries,
  type SelfImprovementRunPacket,
  type SelfImproveRunSummary,
} from "../lib/self-improvement-runs";

type RunsResponse = {
  packets?: SelfImprovementRunPacket[];
  issues?: Array<{ projectId: string; projectName: string; error: string }>;
  partial?: boolean;
  truncated?: boolean;
};

export type SelfImprovementRunsState = {
  status: "idle" | "loading" | "ready" | "error";
  runs: SelfImproveRunSummary[];
  issues: NonNullable<RunsResponse["issues"]>;
  partial: boolean;
  truncated: boolean;
  error?: string;
};

const EMPTY_STATE: SelfImprovementRunsState = {
  status: "idle",
  runs: [],
  issues: [],
  partial: false,
  truncated: false,
};

export function useSelfImprovementRuns(
  enabled: boolean,
  projects: readonly ProjectModel[],
): SelfImprovementRunsState {
  const [state, setState] = useState<SelfImprovementRunsState>(EMPTY_STATE);
  const projectRefs = useMemo(
    () =>
      projects
        .filter(
          (project) =>
            project.status !== "archived" &&
            typeof project.trackingContext === "string" &&
            project.trackingContext.trim().length > 0,
        )
        .map((project) => ({
          projectId: project.id,
          projectName: project.name,
          projectPath: project.trackingContext?.trim() ?? "",
        })),
    [projects],
  );

  useEffect(() => {
    if (!enabled) return;
    if (projectRefs.length === 0) {
      setState({ ...EMPTY_STATE, status: "ready" });
      return;
    }
    let cancelled = false;
    setState({ ...EMPTY_STATE, status: "loading" });
    fetch("/farplane/self-improvement/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projects: projectRefs }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`self_improvement_runs_failed:${response.status}`);
        return (await response.json()) as RunsResponse;
      })
      .then((payload) => {
        if (cancelled) return;
        setState({
          status: "ready",
          runs: buildSelfImproveRunSummaries(payload.packets ?? []),
          issues: payload.issues ?? [],
          partial: payload.partial === true,
          truncated: payload.truncated === true,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          ...EMPTY_STATE,
          status: "error",
          error: error instanceof Error ? error.message : "Self-improvement runs unavailable.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, projectRefs]);

  return state;
}
