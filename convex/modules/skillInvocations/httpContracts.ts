/**
 * SKILL INVOCATION HTTP CONTRACT
 * ==============================
 * Parses compact hook payloads for `/skill-invocations/ingest`.
 */

export type ParsedSkillInvocationPayload = {
  skillId: string;
  skillPath: string;
  sourceTool: string;
  sourceEvent?: string;
  label?: string;
  sessionId?: string;
  turnId?: string;
  projectPath?: string;
  occurredAt?: number;
  stepKey?: string;
  source?: string;
};

function cleanString(value: unknown, limit = 500): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, limit);
}

export function parseSkillInvocationPayload(body: unknown): ParsedSkillInvocationPayload | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const row = body as Record<string, unknown>;
  const skillId = cleanString(row.skillId, 120);
  const skillPath = cleanString(row.skillPath, 1_000);
  const sourceTool = cleanString(row.sourceTool, 120);
  if (!skillId || !skillPath || !sourceTool) return null;
  if (!/(^|[\\/])SKILL\.md$/i.test(skillPath)) return null;

  return {
    skillId,
    skillPath,
    sourceTool,
    sourceEvent: cleanString(row.sourceEvent, 120),
    label: cleanString(row.label, 120),
    sessionId: cleanString(row.sessionId, 160),
    turnId: cleanString(row.turnId, 160),
    projectPath: cleanString(row.projectPath, 500),
    occurredAt: typeof row.occurredAt === "number" ? row.occurredAt : undefined,
    stepKey: cleanString(row.stepKey, 500),
    source: cleanString(row.source, 120),
  };
}
