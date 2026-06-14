/**
 * SKILL INVOCATIONS TYPES
 * =======================
 * Ownership: Skill Invocations UI module.
 * Inputs: Convex skill invocation dashboard query payloads.
 * Outputs: UI-local contracts and formatting helpers.
 * Side effects: none.
 * Invariants: no raw hook payload fields are modeled.
 */

export type SkillInvocationBreakdown = {
  key: string;
  displayName: string;
  count: number;
  lastSeenAt: number | null;
};

export type SkillInvocationEvent = {
  _id?: string;
  skillId: string;
  skillPath: string;
  sourceTool: string;
  sourceEvent: string;
  label: string;
  sessionId?: string;
  turnId?: string;
  projectPath?: string;
  occurredAt: number;
  stepKey?: string;
  source: string;
  receivedAt: number;
};

export type SkillInvocationDashboard = {
  totals: {
    invocationCount: number;
    skillCount: number;
    sourceToolCount: number;
    lastSeenAt: number | null;
  };
  bySkill: SkillInvocationBreakdown[];
  bySourceTool: SkillInvocationBreakdown[];
  recentEvents: SkillInvocationEvent[];
};

export function formatInvocationTime(value: number | null): string {
  if (!value) return "never";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function compactSkillPath(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  const marker = "/skills/";
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex >= 0) return normalized.slice(markerIndex + 1);
  const parts = normalized.split("/").filter(Boolean);
  return parts.slice(-3).join("/");
}
