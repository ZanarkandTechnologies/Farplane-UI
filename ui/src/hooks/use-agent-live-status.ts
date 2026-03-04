import { useMemo } from "react";
import { useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import type { AgentLiveStatus } from "@/lib/openclaw-types";
import { coerceLiveState } from "@/lib/live-status";
import { isConvexEnabled } from "@/providers/convex-provider";

type ConvexBubble = {
  id: string;
  label: string;
  weight: number;
};

type ConvexStatusRow = {
  agentId: string;
  state: string;
  statusText: string;
  bubbles: ConvexBubble[];
  sessionKey?: string;
  updatedAt?: number;
};

export function useAgentLiveStatuses(agentIds: string[]): Record<string, AgentLiveStatus> | undefined {
  const convexEnabled = isConvexEnabled();
  if (!convexEnabled) return undefined;

  const rows = useQuery(api.status.getMultipleAgentStatuses, agentIds.length > 0 ? { agentIds } : "skip");

  return useMemo(() => {
    if (!rows) return undefined;
    const recordRows = rows as Record<string, ConvexStatusRow>;
    return Object.entries(recordRows).reduce<Record<string, AgentLiveStatus>>((acc, [agentId, row]) => {
      const state = coerceLiveState(row.state);
      acc[agentId] = {
        agentId: row.agentId,
        sessionKey: row.sessionKey,
        state,
        statusText: row.statusText,
        updatedAt: row.updatedAt,
        bubbles: Array.isArray(row.bubbles) ? row.bubbles : [],
      };
      return acc;
    }, {});
  }, [rows]);
}
