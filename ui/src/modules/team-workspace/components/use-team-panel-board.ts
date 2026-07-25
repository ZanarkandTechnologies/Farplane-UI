"use client";

/**
 * TEAM PANEL BOARD STATE
 * ======================
 * Ownership: Team Workspace task and communication projections.
 * Inputs: filesystem-backed provider tasks plus the active team scope.
 * Outputs: canonical read-only tasks and retained agent-event communication rows.
 * Side effects: read-only Convex status query when realtime activity is configured.
 */

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { isConvexEnabled } from "@/providers/convex-provider";
import { api } from "../../../../../convex/_generated/api";
import type { CommunicationRow, PanelTask } from "./team-panel-types";

type TeamActivityFeedEvent = {
  id: string;
  sourceType: "agent_event";
  occurredAt: number;
  agentId?: string;
  eventType?: string;
  activityType?: string;
  label: string;
  detail?: string;
  taskId?: string;
};

type TeamActivityFeedPage = {
  events: TeamActivityFeedEvent[];
};

interface UseTeamPanelBoardStateInput {
  teamScopeId: string | null;
  providerTasks?: PanelTask[];
}

export function useTeamPanelBoardState({
  teamScopeId,
  providerTasks = [],
}: UseTeamPanelBoardStateInput): {
  convexEnabled: boolean;
  projectTasks: PanelTask[];
  communicationRows: CommunicationRow[];
} {
  const convexEnabled = isConvexEnabled();
  const activityFeed = useQuery(
    api.status.getTeamActivityFeed,
    convexEnabled && teamScopeId
      ? {
          teamId: teamScopeId,
          limit: 60,
        }
      : "skip",
  ) as TeamActivityFeedPage | undefined;

  const communicationRows = useMemo(
    (): CommunicationRow[] =>
      (activityFeed?.events ?? []).map((row) => ({
        id: row.id,
        agentId: row.agentId ?? "system",
        activityType: row.activityType ?? row.eventType ?? "activity",
        label: row.label,
        detail: row.detail,
        occurredAt: row.occurredAt,
        taskId: row.taskId,
      })),
    [activityFeed?.events],
  );

  return {
    convexEnabled,
    projectTasks: providerTasks,
    communicationRows,
  };
}
