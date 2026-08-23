/**
 * OBSERVED SKILL FLOW PROJECTION
 * ==============================
 * Derives a bounded Office overlay from hook telemetry already received by
 * the client. This is deliberately not a workflow planner: it never predicts
 * a next call, creates a delivery edge, or writes a session record.
 */

import type { SkillInvocationEvent } from "@/modules/skill-invocations/skill-invocations-types";

export const OFFICE_SKILL_FLOW_FRESHNESS_MS = 10_000;
export const OFFICE_SKILL_FLOW_MAX_SESSION_GAP_MS = 10 * 60 * 1_000;
const OFFICE_SKILL_FLOW_MAX_VISIBLE_SESSIONS = 8;

export type OfficeSkillFlowFurniture = {
  id: string;
  skillId: string;
  kind: "workstation" | "system-facility";
  departmentId: string;
  position: [number, number, number];
};

export type ObservedSkillFlow = {
  id: string;
  sessionId: string;
  occurredAt: number;
  current: OfficeSkillFlowFurniture;
  /** The real immediately preceding known call in this session, when it is close enough to read as one flow. */
  previous?: OfficeSkillFlowFurniture;
};

type KnownInvocation = {
  event: SkillInvocationEvent;
  id: string;
  sessionId: string;
  furniture: OfficeSkillFlowFurniture;
};

function eventIdentity(event: SkillInvocationEvent, index: number): string {
  return (
    event._id?.trim() ||
    [
      event.sessionId?.trim() || "no-session",
      event.skillId,
      event.occurredAt,
      event.stepKey ?? "",
      index,
    ]
      .join(":")
      .replaceAll(" ", "-")
  );
}

function compareKnownInvocations(left: KnownInvocation, right: KnownInvocation): number {
  return left.event.occurredAt - right.event.occurredAt || left.id.localeCompare(right.id);
}

/**
 * Selects the newest fresh known call per session and its actual predecessor.
 * Events without a session or a mapped furniture skill are invisible: guessing
 * an owner or a destination would turn the Office into a fake process graph.
 */
export function projectObservedSkillFlows(input: {
  events: readonly SkillInvocationEvent[];
  furniture: readonly OfficeSkillFlowFurniture[];
  now: number;
}): ObservedSkillFlow[] {
  const furnitureBySkillId = new Map<string, OfficeSkillFlowFurniture>();
  for (const item of [...input.furniture].sort((left, right) => left.id.localeCompare(right.id))) {
    if (!furnitureBySkillId.has(item.skillId)) furnitureBySkillId.set(item.skillId, item);
  }

  const invocationsBySession = new Map<string, KnownInvocation[]>();
  input.events.forEach((event, index) => {
    const sessionId = event.sessionId?.trim();
    const furniture = furnitureBySkillId.get(event.skillId);
    if (!sessionId || !furniture || event.occurredAt > input.now) return;
    const invocations = invocationsBySession.get(sessionId) ?? [];
    invocations.push({ event, id: eventIdentity(event, index), sessionId, furniture });
    invocationsBySession.set(sessionId, invocations);
  });

  const flows: ObservedSkillFlow[] = [];
  for (const [sessionId, invocations] of invocationsBySession) {
    invocations.sort(compareKnownInvocations);
    const currentIndex = invocations.reduce<number>(
      (latestIndex, invocation, index) =>
        input.now - invocation.event.occurredAt < OFFICE_SKILL_FLOW_FRESHNESS_MS
          ? index
          : latestIndex,
      -1,
    );
    if (currentIndex < 0) continue;
    const current = invocations[currentIndex];
    if (!current) continue;
    const prior = currentIndex > 0 ? invocations[currentIndex - 1] : undefined;
    const hasContiguousPredecessor =
      prior &&
      current.event.occurredAt - prior.event.occurredAt <= OFFICE_SKILL_FLOW_MAX_SESSION_GAP_MS &&
      prior.furniture.id !== current.furniture.id;
    flows.push({
      id: `observed-skill-flow:${sessionId}:${current.id}`,
      sessionId,
      occurredAt: current.event.occurredAt,
      current: current.furniture,
      previous: hasContiguousPredecessor ? prior.furniture : undefined,
    });
  }

  return flows
    .sort((left, right) => right.occurredAt - left.occurredAt || left.id.localeCompare(right.id))
    .slice(0, OFFICE_SKILL_FLOW_MAX_VISIBLE_SESSIONS);
}
