/**
 * OFFICE PROJECT VISIBILITY
 * =========================
 * Owns the pure Office3D-only stale-project policy. It combines project-level
 * runtime evidence with agent status without mutating persisted company state.
 * Missing timestamps fail open; the fixed seven-day boundary is inclusive.
 */

import type {
  AgentCardModel,
  AgentLiveStatus,
  CompanyAgentModel,
  ProjectModel,
} from "@/modules/runtime";

export const OFFICE_PROJECT_ACTIVITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type OfficeProjectVisibilityReason =
  | "archived"
  | "running"
  | "goal_backed"
  | "recent_heartbeat"
  | "recent_activity"
  | "unknown_activity"
  | "stale_idle";

export interface OfficeProjectVisibilityEvidence {
  companyAgents: CompanyAgentModel[];
  runtimeAgents: AgentCardModel[];
  liveStatusByAgentId: Record<string, AgentLiveStatus | undefined>;
}

export interface OfficeProjectVisibilityResult {
  visibleIds: string[];
  hiddenIds: string[];
  reasons: Record<string, OfficeProjectVisibilityReason>;
  latestActivity: Record<string, number | undefined>;
}

function timestampToMs(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return value < 10_000_000_000 ? value * 1000 : value;
}

function latestTimestamp(values: Array<number | undefined>): number | undefined {
  const timestamps = values
    .map(timestampToMs)
    .filter((value): value is number => value !== undefined);
  return timestamps.length > 0 ? Math.max(...timestamps) : undefined;
}

function isLiveWorkState(state: AgentLiveStatus["state"] | undefined): boolean {
  return state === "running" || state === "planning" || state === "executing";
}

function hasCurrentGoal(agent: CompanyAgentModel | AgentCardModel | undefined): boolean {
  const status = agent?.runtimeMetadata?.codexThreadGoal?.status;
  return Boolean(status && status !== "complete");
}

export function deriveVisibleOfficeProjects(
  projects: ProjectModel[],
  evidence: OfficeProjectVisibilityEvidence,
  nowMs = Date.now(),
): OfficeProjectVisibilityResult {
  const visibleIds: string[] = [];
  const hiddenIds: string[] = [];
  const reasons: Record<string, OfficeProjectVisibilityReason> = {};
  const latestActivity: Record<string, number | undefined> = {};
  const runtimeByAgentId = new Map(
    evidence.runtimeAgents.map((agent) => [agent.agentId, agent] as const),
  );
  const companyAgentsByProjectId = new Map<string, CompanyAgentModel[]>();

  for (const agent of evidence.companyAgents) {
    if (!agent.projectId) continue;
    const projectAgents = companyAgentsByProjectId.get(agent.projectId) ?? [];
    projectAgents.push(agent);
    companyAgentsByProjectId.set(agent.projectId, projectAgents);
  }

  const cutoffMs = nowMs - OFFICE_PROJECT_ACTIVITY_WINDOW_MS;
  for (const project of projects) {
    const projectAgents = companyAgentsByProjectId.get(project.id) ?? [];
    const liveStatuses = projectAgents
      .map((agent) => evidence.liveStatusByAgentId[agent.agentId])
      .filter((status): status is AgentLiveStatus => Boolean(status));
    const runtimeAgents = projectAgents
      .map((agent) => runtimeByAgentId.get(agent.agentId))
      .filter((agent): agent is AgentCardModel => Boolean(agent));
    const heartbeatAt = latestTimestamp(
      liveStatuses.flatMap((status) => [
        status.latestHeartbeat?.startedAt,
        status.latestHeartbeat?.endedAt,
      ]),
    );
    const activityAt = latestTimestamp([
      project.lastActivityAt,
      ...runtimeAgents.map((agent) => agent.lastUpdatedAt),
      ...liveStatuses.map((status) => status.updatedAt),
    ]);
    latestActivity[project.id] = latestTimestamp([activityAt, heartbeatAt]);

    let reason: OfficeProjectVisibilityReason;
    if (project.status === "archived") {
      reason = "archived";
    } else if (liveStatuses.some((status) => isLiveWorkState(status.state))) {
      reason = "running";
    } else if (
      projectAgents.some((agent) => hasCurrentGoal(agent)) ||
      runtimeAgents.some((agent) => hasCurrentGoal(agent))
    ) {
      reason = "goal_backed";
    } else if (heartbeatAt !== undefined && heartbeatAt >= cutoffMs) {
      reason = "recent_heartbeat";
    } else if (activityAt !== undefined && activityAt >= cutoffMs) {
      reason = "recent_activity";
    } else if (latestActivity[project.id] === undefined) {
      reason = "unknown_activity";
    } else {
      reason = "stale_idle";
    }

    reasons[project.id] = reason;
    if (reason === "archived" || reason === "stale_idle") {
      hiddenIds.push(project.id);
    } else {
      visibleIds.push(project.id);
    }
  }

  return { visibleIds, hiddenIds, reasons, latestActivity };
}
