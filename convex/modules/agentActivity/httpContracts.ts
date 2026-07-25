/**
 * STATUS HTTP CONTRACT
 * ====================
 * Shared HTTP payload parsing for status ingest/report endpoints.
 */

export type ParsedIngestPayload = {
  teamId?: string;
  projectId?: string;
  agentId: string;
  eventType: string;
  activityType?: string;
  actorType?: string;
  label: string;
  detail?: string;
  state?: string;
  skillId?: string;
  source?: string;
  stepKey?: string;
  sessionKey?: string;
  beatId?: string;
  taskId?: string;
  occurredAt?: number;
};

export type ParsedStatusReportPayload = {
  teamId?: string;
  agentId: string;
  state: string;
  statusText: string;
  stepKey: string;
  skillId?: string;
  sessionKey?: string;
  beatId?: string;
  source?: string;
  occurredAt?: number;
};

export type ParsedTeamActivityQueryPayload = {
  teamId: string;
  projectId?: string;
  limit?: number;
  agentId?: string;
};

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function hasTelemetryToken(headers: Headers, expectedToken: string | undefined): boolean {
  const expected = expectedToken?.trim();
  if (!expected) return true;
  const headerToken = headers.get("x-farplane-telemetry-token")?.trim();
  const auth = headers.get("authorization")?.trim();
  const bearer = auth?.toLowerCase().startsWith("bearer ")
    ? auth.slice("bearer ".length).trim()
    : "";
  return Boolean((headerToken && headerToken === expected) || (bearer && bearer === expected));
}

export function parseIngestPayload(body: unknown): ParsedIngestPayload | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  const agentId = asTrimmedString(row.agentId);
  const eventType = asTrimmedString(row.eventType);
  const label = asTrimmedString(row.label);
  if (!agentId || !eventType || !label) return null;
  return {
    teamId: typeof row.teamId === "string" ? row.teamId : undefined,
    projectId: typeof row.projectId === "string" ? row.projectId : undefined,
    agentId,
    eventType,
    activityType: typeof row.activityType === "string" ? row.activityType : undefined,
    actorType: typeof row.actorType === "string" ? row.actorType : undefined,
    label,
    detail: typeof row.detail === "string" ? row.detail : undefined,
    state: typeof row.state === "string" ? row.state : undefined,
    skillId: typeof row.skillId === "string" ? row.skillId : undefined,
    source: typeof row.source === "string" ? row.source : undefined,
    stepKey: typeof row.stepKey === "string" ? row.stepKey : undefined,
    sessionKey: typeof row.sessionKey === "string" ? row.sessionKey : undefined,
    beatId: typeof row.beatId === "string" ? row.beatId : undefined,
    taskId: typeof row.taskId === "string" ? row.taskId : undefined,
    occurredAt: typeof row.occurredAt === "number" ? row.occurredAt : undefined,
  };
}

export function parseStatusReportPayload(body: unknown): ParsedStatusReportPayload | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  const agentId = asTrimmedString(row.agentId);
  const state = asTrimmedString(row.state);
  const statusText = asTrimmedString(row.statusText);
  const stepKey = asTrimmedString(row.stepKey);
  if (!agentId || !state || !statusText || !stepKey) return null;
  return {
    teamId: typeof row.teamId === "string" ? row.teamId : undefined,
    agentId,
    state,
    statusText,
    stepKey,
    skillId: typeof row.skillId === "string" ? row.skillId : undefined,
    sessionKey: typeof row.sessionKey === "string" ? row.sessionKey : undefined,
    beatId: typeof row.beatId === "string" ? row.beatId : undefined,
    source: typeof row.source === "string" ? row.source : undefined,
    occurredAt: typeof row.occurredAt === "number" ? row.occurredAt : undefined,
  };
}

export function parseTeamActivityQueryPayload(
  body: unknown,
): ParsedTeamActivityQueryPayload | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const row = body as Record<string, unknown>;
  const teamId = asTrimmedString(row.teamId);
  if (!teamId) return null;
  const projectId = asTrimmedString(row.projectId);
  const agentId = asTrimmedString(row.agentId);
  const limit =
    typeof row.limit === "number" && Number.isFinite(row.limit) ? Math.trunc(row.limit) : undefined;
  return {
    teamId,
    projectId: projectId || undefined,
    agentId: agentId || undefined,
    limit,
  };
}
