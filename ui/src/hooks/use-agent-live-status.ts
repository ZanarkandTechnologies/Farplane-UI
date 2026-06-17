import { useQuery } from "convex/react";
import { useMemo, useRef } from "react";

import { coerceLiveState } from "@/modules/runtime";
import type { AgentBubbleMessage, AgentLiveStatus, OfficeTravelIntent } from "@/modules/runtime";
import { isConvexEnabled } from "@/providers/convex-provider";
import { api } from "../../../convex/_generated/api";

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
  currentSkillId?: string;
  recentEvents?: Array<{
    eventType: string;
    label: string;
    detail?: string;
    skillId?: string;
    occurredAt: number;
  }>;
  sessionKey?: string;
  updatedAt?: number;
};

type HookBubbleQueryResult = {
  messages?: AgentBubbleMessage[];
  travelIntents?: OfficeTravelIntent[];
};

const EVENT_STICKY_MS = 10_000;
const HOOK_BUBBLE_RANGE_MS = 30_000;

function codexThreadIdFromAgentId(agentId: string): string | undefined {
  const prefix = "codex-thread:";
  if (!agentId.startsWith(prefix)) return undefined;
  return agentId.slice(prefix.length).trim() || undefined;
}

function statusFromBubbleMessage(
  agentId: string,
  message: AgentBubbleMessage,
  travelIntent?: OfficeTravelIntent,
): AgentLiveStatus {
  return {
    agentId,
    sessionKey: `codex-thread:${message.threadId}`,
    state: "running",
    statusText: message.message,
    updatedAt: message.eventAt,
    bubbles: [{ id: `hook-bubble:${message.threadId}:${message.eventAt}`, label: message.message, weight: 100 }],
    currentSkillId:
      travelIntent?.target.kind === "skill" ? travelIntent.target.id.trim() || undefined : undefined,
    bubbleMessages: [message],
    officeTravelIntent: travelIntent,
  };
}

function overlayHookBubbleStatus(
  base: AgentLiveStatus | undefined,
  agentId: string,
  message: AgentBubbleMessage | undefined,
  travelIntent?: OfficeTravelIntent,
): AgentLiveStatus | undefined {
  if (!message) return base;
  const overlay = statusFromBubbleMessage(agentId, message, travelIntent);
  if (!base) return overlay;
  return {
    ...base,
    statusText: message.message,
    updatedAt: Math.max(base.updatedAt ?? 0, message.eventAt),
    bubbles: overlay.bubbles,
    currentSkillId: overlay.currentSkillId ?? base.currentSkillId,
    bubbleMessages: [message, ...(base.bubbleMessages ?? []).filter((entry) => entry.threadId !== message.threadId)],
    officeTravelIntent: overlay.officeTravelIntent ?? base.officeTravelIntent,
  };
}

export function useAgentLiveStatuses(
  agentIds: string[],
): Record<string, AgentLiveStatus> | undefined {
  const convexEnabled = isConvexEnabled();
  const stickyEventRef = useRef<
    Record<string, { statusText: string; label: string; expiresAt: number }>
  >({});

  const rows = useQuery(
    api.status.getMultipleAgentStatuses,
    convexEnabled && agentIds.length > 0
      ? {
          agentIds,
          recentWindowMs: EVENT_STICKY_MS,
          recentLimit: 8,
        }
      : "skip",
  );
  const threadIds = useMemo(
    () => [...new Set(agentIds.map(codexThreadIdFromAgentId).filter((entry): entry is string => Boolean(entry)))],
    [agentIds],
  );
  const hookBubbles = useQuery(
    api.modules.hookTelemetry.queries.getRecentBubbleMessages,
    convexEnabled && threadIds.length > 0
      ? {
          sessionIds: threadIds,
          rangeMs: HOOK_BUBBLE_RANGE_MS,
          limit: 100,
        }
      : "skip",
  ) as HookBubbleQueryResult | undefined;
  return useMemo(() => {
    if (!convexEnabled) return undefined;
    if (!rows && !hookBubbles) return undefined;
    const now = Date.now();
    const recordRows = (rows ?? {}) as Record<string, ConvexStatusRow>;
    const latestMessageByThreadId = new Map<string, AgentBubbleMessage>();
    for (const message of hookBubbles?.messages ?? []) {
      const existing = latestMessageByThreadId.get(message.threadId);
      if (!existing || existing.eventAt < message.eventAt) {
        latestMessageByThreadId.set(message.threadId, message);
      }
    }
    const latestTravelByThreadId = new Map<string, OfficeTravelIntent>();
    for (const intent of hookBubbles?.travelIntents ?? []) {
      const existing = latestTravelByThreadId.get(intent.threadId);
      if (!existing || existing.eventAt < intent.eventAt) {
        latestTravelByThreadId.set(intent.threadId, intent);
      }
    }
    const result = Object.entries(recordRows).reduce<Record<string, AgentLiveStatus>>(
      (acc, [agentId, row]) => {
        const state = coerceLiveState(row.state);
        const latestEvent =
          Array.isArray(row.recentEvents) && row.recentEvents.length > 0
            ? row.recentEvents[0]
            : undefined;
        const liveEventStatusText = (() => {
          if (!latestEvent) return "";
          const detail = latestEvent.detail?.trim();
          if (!detail) return latestEvent.label;
          return `${latestEvent.label}: ${detail}`;
        })();
        if (latestEvent && liveEventStatusText) {
          stickyEventRef.current[agentId] = {
            statusText: liveEventStatusText,
            label: latestEvent.label,
            expiresAt: now + EVENT_STICKY_MS,
          };
        }
        const stickyEvent = stickyEventRef.current[agentId];
        const stickyStatusText =
          stickyEvent && stickyEvent.expiresAt > now ? stickyEvent.statusText : "";
        const stickyLabel = stickyEvent && stickyEvent.expiresAt > now ? stickyEvent.label : "";
        if (stickyEvent && stickyEvent.expiresAt <= now) {
          delete stickyEventRef.current[agentId];
        }
        const mergedBubbles = (() => {
          const statusBubbles = Array.isArray(row.bubbles) ? row.bubbles : [];
          const primaryLabel =
            latestEvent?.label?.trim() || stickyLabel || (statusBubbles[0]?.label?.trim() ?? "");
          if (!primaryLabel) return [];
          return [{ id: `primary:${agentId}:${primaryLabel}`, label: primaryLabel, weight: 100 }];
        })();
        acc[agentId] = {
          agentId: row.agentId,
          sessionKey: row.sessionKey,
          state,
          statusText: liveEventStatusText || stickyStatusText || row.statusText,
          updatedAt: row.updatedAt,
          bubbles: mergedBubbles,
          currentSkillId: latestEvent?.skillId?.trim() || row.currentSkillId?.trim() || undefined,
        };
        return acc;
      },
      {},
    );

    for (const agentId of agentIds) {
      const threadId = codexThreadIdFromAgentId(agentId);
      if (!threadId) continue;
      const message = latestMessageByThreadId.get(threadId);
      result[agentId] =
        overlayHookBubbleStatus(result[agentId], agentId, message, latestTravelByThreadId.get(threadId)) ??
        result[agentId];
    }

    return result;
  }, [agentIds, convexEnabled, hookBubbles, rows]);
}
