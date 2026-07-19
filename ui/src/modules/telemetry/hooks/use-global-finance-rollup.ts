/**
 * GLOBAL FINANCE ROLL-UP HOOK
 * ===========================
 * Ownership: telemetry module bridge reads for the office finance HUD.
 * Inputs: registered Farplane project paths and the root project config endpoint.
 * Outputs: a cached portfolio finance roll-up with loading/error state.
 * Side effects: read-only HTTP requests through the existing project-config bridge.
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  buildGlobalFinanceRollup,
  type FinanceProjectConfig,
  type GlobalFinanceRollup,
} from "../lib/finance-metric-rollup";

export type FinanceRollupProject = {
  id: string;
  name: string;
  trackingContext?: string;
};

export type ProjectConfigPayload = {
  [key: string]: unknown;
  ok?: boolean;
  projectPath?: string;
  error?: string;
};

async function readProjectConfig(projectPath?: string): Promise<ProjectConfigPayload> {
  const params = new URLSearchParams();
  if (projectPath) params.set("projectPath", projectPath);
  const response = await fetch(
    `/farplane/project-config${params.toString() ? `?${params.toString()}` : ""}`,
  );
  const payload = (await response.json()) as ProjectConfigPayload;
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error ?? "finance_metrics_unavailable");
  }
  return payload;
}

export async function loadGlobalFinanceRollup(
  projectEntries: Array<readonly [string, FinanceRollupProject]>,
  reader: (projectPath?: string) => Promise<ProjectConfigPayload> = readProjectConfig,
): Promise<GlobalFinanceRollup> {
  const rootConfig = await reader();
  const rootPath = rootConfig.projectPath ?? "__root__";
  const configs = new Map<string, FinanceProjectConfig>();
  configs.set(rootPath, {
    projectId: "global",
    projectName: "Farplane",
    config: rootConfig,
    isGlobal: true,
  });
  const projectConfigs = await Promise.all(
    projectEntries
      .filter(([projectPath]) => projectPath !== rootPath)
      .map(async ([projectPath, project]) => ({
        projectPath,
        project,
        config: await reader(projectPath).catch(() => null),
      })),
  );
  let unavailableProjectCount = 0;
  for (const entry of projectConfigs) {
    if (!entry.config) {
      unavailableProjectCount += 1;
      continue;
    }
    const resolvedPath = entry.config.projectPath ?? entry.projectPath;
    configs.set(resolvedPath, {
      projectId: entry.project.id,
      projectName: entry.project.name,
      config: entry.config,
    });
  }
  return {
    ...buildGlobalFinanceRollup([...configs.values()]),
    unavailableProjectCount,
  };
}

export function useGlobalFinanceRollup(projects: FinanceRollupProject[]): {
  rollup: GlobalFinanceRollup | null;
  isLoading: boolean;
  error: string | null;
} {
  const projectEntries = useMemo(() => {
    const byPath = new Map<string, FinanceRollupProject>();
    for (const project of projects) {
      const projectPath = project.trackingContext?.trim() ?? "";
      if (projectPath.startsWith("/")) byPath.set(projectPath, project);
    }
    return [...byPath.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [projects]);
  const projectPathKey = projectEntries.map(([projectPath]) => projectPath).join("|");

  const query = useQuery({
    queryKey: ["global-finance-rollup", projectPathKey],
    queryFn: () => loadGlobalFinanceRollup(projectEntries),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  return {
    rollup: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
