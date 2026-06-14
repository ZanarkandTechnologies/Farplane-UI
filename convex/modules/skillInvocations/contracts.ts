/**
 * SKILL INVOCATION CONTRACTS
 * ==========================
 * Ownership: skillInvocations Convex module.
 * Inputs: compact skill invocation rows from Codex hook ingestion.
 * Outputs: deterministic dashboard summaries for UI rendering.
 * Side effects: none.
 * Invariants: rows represent SKILL.md reads, not raw hook payloads.
 */

export type SkillInvocationRow = {
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

export type SkillInvocationBreakdown = {
  key: string;
  displayName: string;
  count: number;
  lastSeenAt: number | null;
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
  recentEvents: SkillInvocationRow[];
};

function addBreakdown(
  map: Map<string, SkillInvocationBreakdown>,
  key: string,
  occurredAt: number,
): void {
  const displayName = key.trim() || "unknown";
  const existing = map.get(displayName);
  if (!existing) {
    map.set(displayName, {
      key: displayName,
      displayName,
      count: 1,
      lastSeenAt: occurredAt,
    });
    return;
  }
  existing.count += 1;
  existing.lastSeenAt = Math.max(existing.lastSeenAt ?? 0, occurredAt);
}

function sortBreakdown(rows: SkillInvocationBreakdown[]): SkillInvocationBreakdown[] {
  return rows.sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return (right.lastSeenAt ?? 0) - (left.lastSeenAt ?? 0);
  });
}

export function buildSkillInvocationDashboard(
  rows: SkillInvocationRow[],
  options: { limit?: number } = {},
): SkillInvocationDashboard {
  const bySkill = new Map<string, SkillInvocationBreakdown>();
  const bySourceTool = new Map<string, SkillInvocationBreakdown>();
  let lastSeenAt: number | null = null;

  for (const row of rows) {
    addBreakdown(bySkill, row.skillId, row.occurredAt);
    addBreakdown(bySourceTool, row.sourceTool, row.occurredAt);
    lastSeenAt = Math.max(lastSeenAt ?? 0, row.occurredAt);
  }

  const recentEvents = [...rows]
    .sort((left, right) => right.occurredAt - left.occurredAt)
    .slice(0, Math.min(Math.max(options.limit ?? 50, 1), 200));

  return {
    totals: {
      invocationCount: rows.length,
      skillCount: bySkill.size,
      sourceToolCount: bySourceTool.size,
      lastSeenAt,
    },
    bySkill: sortBreakdown([...bySkill.values()]),
    bySourceTool: sortBreakdown([...bySourceTool.values()]),
    recentEvents,
  };
}
