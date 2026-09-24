/**
 * FARPLANE EVENT CONTRACT (v1)
 * ============================
 * One typed vocabulary for agent activity, normalized from raw hook telemetry
 * rows at read time. Producers and the raw table stay unchanged; every consumer
 * (projections, office simulation, progression) reads `FarplaneEvent` instead
 * of interpreting `hookType` strings or free-form status text.
 */

import type { HookTelemetryRow } from "./projections";

export type FarplaneRuntime = "codex" | "claude";
export type FarplaneGate = "response-length" | "continuation" | "skill-length";
export type ThreadLink = "created" | "forked" | "spawned";

type FarplaneEventBase = {
  v: 1;
  id: string;
  at: number;
  runtime: FarplaneRuntime;
  project: { id: string; path?: string };
  actor: { sessionId: string; threadId: string; parentThreadId?: string; agentType?: string };
};

export type FarplaneEventBody =
  | { kind: "turn.started" }
  | { kind: "turn.ended" }
  | { kind: "subagent.started" }
  | { kind: "subagent.ended" }
  | { kind: "skill.invoked"; skill: string }
  | { kind: "files.changed"; count: number }
  | { kind: "thread.linked"; link: ThreadLink; parentThreadId: string }
  | { kind: "gate.blocked"; gate: FarplaneGate };

export type FarplaneEvent = FarplaneEventBase & FarplaneEventBody;
export type FarplaneEventKind = FarplaneEventBody["kind"];

const GATES: readonly FarplaneGate[] = ["response-length", "continuation", "skill-length"];
const EVAL_PURPOSES = new Set(["eval", "judge", "baseline"]);

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function str(value: unknown, limit = 200): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed.slice(0, limit) : undefined;
}

function first(payload: JsonRecord, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = str(payload[key]);
    if (value) return value;
  }
  return undefined;
}

export function runtimeFromPayload(payload: JsonRecord): FarplaneRuntime {
  const runtime = str(payload.runtime)?.toLowerCase();
  if (runtime === "claude" || runtime === "codex") return runtime;
  // Rows sent before the runtime field carry it only as the source prefix.
  return str(payload.source)?.startsWith("claude-") ? "claude" : "codex";
}

function explicitEventName(payload: JsonRecord): string | undefined {
  return first(payload, "eventName", "eventType", "type");
}

function bodyFromRow(row: HookTelemetryRow, payload: JsonRecord): FarplaneEventBody | null {
  const eventName = explicitEventName(payload);
  switch (row.hookType) {
    case "UserPromptSubmit":
    case "TurnStart":
      return { kind: "turn.started" };
    case "Stop":
    case "TurnEnd":
      return { kind: "turn.ended" };
    case "SubagentStart":
      return { kind: "subagent.started" };
    case "SubagentStop":
      return { kind: "subagent.ended" };
    case "GateBlocked": {
      const gate = str(payload.gate) as FarplaneGate | undefined;
      return gate && GATES.includes(gate) ? { kind: "gate.blocked", gate } : null;
    }
  }
  if (eventName === "skill.invoked" || row.hookName === "skill-invocation-listener") {
    const skill = first(payload, "skillId", "skill_id");
    return skill ? { kind: "skill.invoked", skill } : null;
  }
  if (eventName === "file.change.summary") {
    const count = typeof payload.fileCount === "number" ? payload.fileCount : 1;
    return { kind: "files.changed", count };
  }
  if (eventName === "thread.created" || eventName === "thread.forked" || eventName === "thread.spawned") {
    const parentThreadId = first(payload, "parentThreadId", "parent_thread_id", "parentSessionId") ?? str(row.sessionId);
    if (!parentThreadId) return null;
    return { kind: "thread.linked", link: eventName.slice("thread.".length) as ThreadLink, parentThreadId };
  }
  return null;
}

/** Normalize one raw row; returns null for unknown, incomplete, or eval traffic. */
export function normalizeFarplaneEvent(row: HookTelemetryRow): FarplaneEvent | null {
  const payload = asRecord(row.payload);
  const purpose = first(payload, "runtimePurpose", "runtime_purpose")?.toLowerCase();
  if (purpose && EVAL_PURPOSES.has(purpose)) return null;

  const body = bodyFromRow(row, payload);
  if (!body) return null;
  const projectId = str(row.projectId) ?? first(payload, "projectId", "project_id");
  const sessionId = str(row.sessionId) ?? first(payload, "sessionId", "session_id");
  if (!projectId || !sessionId) return null;

  const isSubagent = body.kind === "subagent.started" || body.kind === "subagent.ended";
  const threadId =
    (isSubagent ? first(payload, "agentId", "agent_id") : undefined) ??
    first(payload, "threadId", "thread_id") ??
    sessionId;
  const parentThreadId = first(payload, "parentThreadId", "parent_thread_id");
  const agentType = first(payload, "agentType", "agent_type");

  return {
    v: 1,
    id: str(row.eventKey, 300) ?? `${row.hookType}:${sessionId}:${row.eventAt}`,
    at: row.eventAt,
    runtime: runtimeFromPayload(payload),
    project: { id: projectId, path: first(payload, "projectDirectory", "cwd") },
    actor: {
      sessionId,
      threadId,
      ...(parentThreadId && parentThreadId !== threadId ? { parentThreadId } : {}),
      ...(agentType ? { agentType } : {}),
    },
    ...body,
  };
}

/** Normalize, drop unknown rows and duplicate ids, and sort oldest first. */
export function normalizeFarplaneEvents(rows: HookTelemetryRow[]): FarplaneEvent[] {
  const byId = new Map<string, FarplaneEvent>();
  for (const row of rows) {
    const event = normalizeFarplaneEvent(row);
    if (event && !byId.has(event.id)) byId.set(event.id, event);
  }
  return [...byId.values()].sort((left, right) => left.at - right.at || left.id.localeCompare(right.id));
}

export function runtimeLabel(runtime: FarplaneRuntime): string {
  return runtime === "claude" ? "Claude" : "Codex";
}

export function gateLabel(gate: FarplaneGate): string {
  if (gate === "response-length") return "Rewriting: response too long";
  if (gate === "continuation") return "Continuing: work remains";
  return "Fixing: skill file too long";
}
