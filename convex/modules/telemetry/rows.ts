// Pure mappings between `events` rows and the row shapes the readers were built on, so the projections in
// hookTelemetry, agentActivity, runtimeTelemetry and skillInvocations keep their inputs unchanged.
import type { HookEvent, RuntimeEvent } from "./validators";

type Stored<T> = T & { _id: string; _creationTime?: number };

/** A hook row as `hookTelemetryEvents` stored it (and the hook projections read it). */
export type LegacyHookRow = {
  _id: string;
  _creationTime?: number;
  hookName: string;
  hookType: string;
  projectId?: string;
  sessionId?: string;
  payload?: unknown;
  eventAt: number;
  eventKey?: string;
};

/** A runtime row as `agentEvents` stored it (and the activity feeds read it). */
export type LegacyAgentEventRow = {
  _id: string;
  _creationTime?: number;
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
  occurredAt: number;
};

export function hookEventToRow(doc: Stored<HookEvent>): LegacyHookRow {
  return {
    _id: doc._id,
    _creationTime: doc._creationTime,
    hookName: doc.hookName,
    hookType: doc.hookType,
    projectId: doc.projectId,
    sessionId: doc.sessionId,
    payload: doc.payload,
    eventAt: doc.eventAt,
    eventKey: doc.eventKey,
  };
}

export function runtimeEventToRow(doc: Stored<RuntimeEvent>): LegacyAgentEventRow {
  return {
    _id: doc._id,
    _creationTime: doc._creationTime,
    teamId: doc.teamId,
    projectId: doc.projectId,
    agentId: doc.agentId,
    eventType: doc.eventType,
    activityType: doc.activityType,
    actorType: doc.actorType,
    label: doc.label,
    detail: doc.detail,
    state: doc.state,
    skillId: doc.skillId,
    source: doc.origin,
    stepKey: doc.stepKey,
    sessionKey: doc.sessionId,
    beatId: doc.beatId,
    taskId: doc.taskId,
    occurredAt: doc.eventAt,
  };
}

/** The `events` row for an old `hookTelemetryEvents` row (copy migration). */
export function legacyHookRowToEvent(row: LegacyHookRow): HookEvent {
  return {
    source: "hook",
    hookName: row.hookName,
    hookType: row.hookType,
    projectId: row.projectId,
    sessionId: row.sessionId,
    payload: row.payload,
    eventAt: row.eventAt,
    eventKey: row.eventKey,
    legacyId: String(row._id),
  };
}

/** The `events` row for an old `agentEvents` row (copy migration). */
export function legacyAgentEventRowToEvent(row: LegacyAgentEventRow): RuntimeEvent {
  return {
    source: "runtime",
    teamId: row.teamId,
    projectId: row.projectId,
    agentId: row.agentId,
    eventType: row.eventType,
    activityType: row.activityType,
    actorType: row.actorType,
    label: row.label,
    detail: row.detail,
    state: row.state,
    skillId: row.skillId,
    origin: row.source,
    stepKey: row.stepKey,
    sessionId: row.sessionKey,
    beatId: row.beatId,
    taskId: row.taskId,
    eventAt: row.occurredAt,
    legacyId: String(row._id),
  };
}
