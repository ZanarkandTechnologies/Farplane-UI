import type { ActivityPingRow } from "../runtimeTelemetry/runtimeTelemetry";
import type { SkillInvocationRow } from "../skillInvocations/contracts";

export type HookTelemetryRow = {
  _id?: string;
  hookName: string;
  hookType: string;
  projectId?: string;
  sessionId?: string;
  payload?: unknown;
  eventAt: number;
  eventKey?: string;
};

export type HookEventName =
  | "skill.invoked"
  | "file.changed"
  | "thread.started"
  | "thread.stopped"
  | "thread.forked"
  | "thread.created";

export type AgentBubbleMessage = {
  threadId: string;
  message: string;
  eventAt: number;
};

export type OfficeTarget =
  | { kind: "skill"; id: string }
  | { kind: "object"; id: string }
  | { kind: "zone"; id: string };

export type OfficeTravelIntent = {
  threadId: string;
  target: OfficeTarget;
  eventAt: number;
};

type JsonRecord = Record<string, unknown>;
const MAX_BUBBLE_MESSAGE_LENGTH = 140;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function cleanText(value: unknown, limit = 500): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed.slice(0, limit) : undefined;
}

function compactLabel(value: string): string {
  return value
    .replace(/^[$@#]+/, "")
    .replace(/[_/]+/g, "-")
    .replace(/-+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function threadIdFromRow(row: HookTelemetryRow, payload: JsonRecord): string | undefined {
  return (
    cleanText(payload.threadId, 200) ??
    cleanText(payload.thread_id, 200) ??
    cleanText(payload.codexThreadId, 200) ??
    cleanText(payload.turnThreadId, 200) ??
    cleanText(row.sessionId, 200) ??
    cleanText(payload.sessionId, 200) ??
    cleanText(payload.session_id, 200)
  );
}

function messageFromPayload(payload: JsonRecord): string | undefined {
  return (
    cleanText(payload.message, MAX_BUBBLE_MESSAGE_LENGTH) ??
    cleanText(payload.summary, MAX_BUBBLE_MESSAGE_LENGTH) ??
    cleanText(payload.title, MAX_BUBBLE_MESSAGE_LENGTH) ??
    cleanText(payload.statusText, MAX_BUBBLE_MESSAGE_LENGTH)
  );
}

function hookEventName(row: HookTelemetryRow, payload: JsonRecord): HookEventName | undefined {
  const explicit =
    cleanText(payload.eventName, 120) ??
    cleanText(payload.eventType, 120) ??
    cleanText(payload.type, 120);
  if (
    explicit === "skill.invoked" ||
    explicit === "file.changed" ||
    explicit === "thread.started" ||
    explicit === "thread.stopped" ||
    explicit === "thread.forked" ||
    explicit === "thread.created"
  ) {
    return explicit;
  }
  if (row.hookName === "skill-invocation-listener" && row.hookType === "PostToolUse") {
    return "skill.invoked";
  }
  if (row.hookType === "Stop" || row.hookType === "TurnEnd") return "thread.stopped";
  if (row.hookType === "TurnStart" || row.hookType === "UserPromptSubmit") return "thread.started";
  return undefined;
}

export function projectIdToTeamId(projectId: string | undefined): string | undefined {
  if (!projectId?.trim()) return undefined;
  return projectId.startsWith("team-") ? projectId : `team-${projectId}`.toLowerCase();
}

export function hookTelemetryRowsToSkillInvocationRows(rows: HookTelemetryRow[]): SkillInvocationRow[] {
  return rows
    .map((row): SkillInvocationRow | null => {
      const payload = asRecord(row.payload);
      const skillId = text(payload.skillId);
      const skillPath = text(payload.skillPath);
      if (row.hookType !== "PostToolUse" || !skillId || !skillPath) return null;
      return {
        _id: row._id,
        skillId,
        skillPath,
        sourceTool: text(payload.toolName) ?? text(payload.sourceTool) ?? "unknown",
        sourceEvent: row.hookType,
        label: text(payload.label) ?? "Read skill MD",
        sessionId: row.sessionId ?? text(payload.sessionId),
        turnId: text(payload.turnId),
        projectPath: text(payload.cwd) ?? text(payload.projectPath),
        occurredAt: row.eventAt,
        stepKey: row.eventKey,
        source: row.hookName,
        receivedAt: row.eventAt,
      };
    })
    .filter((row): row is SkillInvocationRow => row !== null);
}

export function hookTelemetryRowsToActivityPingRows(rows: HookTelemetryRow[]): ActivityPingRow[] {
  return rows
    .map((row): ActivityPingRow | null => {
      const payload = asRecord(row.payload);
      const eventType =
        row.hookType === "UserPromptSubmit" || row.hookType === "TurnStart"
          ? "turn_start"
          : row.hookType === "Stop" || row.hookType === "TurnEnd"
            ? "turn_end"
            : row.hookType === "Heartbeat"
              ? "heartbeat"
              : undefined;
      if (!eventType) return null;
      const turnId = text(payload.turnId) ?? text(payload.turn_id);
      if (!turnId) return null;
      return {
        _id: row._id,
        eventType,
        source: row.hookName,
        activeAgentCount: number(payload.activeAgentCount) ?? 1,
        prompt: text(payload.prompt),
        agentName: text(payload.agentName),
        workflowName: text(payload.workflowName),
        machineName: text(payload.machineName),
        projectName: text(payload.projectName),
        projectDirectory: text(payload.cwd) ?? text(payload.projectDirectory),
        projectId: row.projectId ?? text(payload.projectId),
        teamId: projectIdToTeamId(row.projectId ?? text(payload.projectId)),
        sessionId: row.sessionId ?? text(payload.sessionId),
        turnId,
        receivedAt: row.eventAt,
        importKey: row.eventKey,
      };
    })
    .filter((row): row is ActivityPingRow => row !== null);
}

export function hookTelemetryRowsToAgentBubbleMessages(rows: HookTelemetryRow[]): AgentBubbleMessage[] {
  return rows
    .map((row): AgentBubbleMessage | null => {
      const payload = asRecord(row.payload);
      const threadId = threadIdFromRow(row, payload);
      if (!threadId) return null;
      const eventName = hookEventName(row, payload);
      if (!eventName) return null;

      if (eventName === "skill.invoked") {
        const skillId = cleanText(payload.skillId, 120);
        if (!skillId) return null;
        return {
          threadId,
          message: `Calling ${compactLabel(skillId)}`,
          eventAt: row.eventAt,
        };
      }

      if (eventName === "file.changed") {
        const message = messageFromPayload(payload);
        if (!message) return null;
        return { threadId, message, eventAt: row.eventAt };
      }

      if (eventName === "thread.stopped") {
        const message = messageFromPayload(payload) ?? "Update ready";
        return { threadId, message, eventAt: row.eventAt };
      }

      if (eventName === "thread.started") {
        const message = messageFromPayload(payload);
        if (!message) return null;
        return { threadId, message, eventAt: row.eventAt };
      }

      if (eventName === "thread.forked" || eventName === "thread.created") {
        const title = cleanText(payload.title, 80) ?? cleanText(payload.threadTitle, 80);
        const verb = eventName === "thread.forked" ? "Forked thread" : "Created thread";
        return {
          threadId,
          message: title ? `${verb}: ${title}` : verb,
          eventAt: row.eventAt,
        };
      }

      return null;
    })
    .filter((row): row is AgentBubbleMessage => row !== null);
}

export function hookTelemetryRowsToOfficeTravelIntents(rows: HookTelemetryRow[]): OfficeTravelIntent[] {
  return rows
    .map((row): OfficeTravelIntent | null => {
      const payload = asRecord(row.payload);
      const eventName = hookEventName(row, payload);
      if (eventName !== "skill.invoked") return null;
      const threadId = threadIdFromRow(row, payload);
      const skillId = cleanText(payload.skillId, 120);
      if (!threadId || !skillId) return null;
      return {
        threadId,
        target: { kind: "skill", id: skillId },
        eventAt: row.eventAt,
      };
    })
    .filter((row): row is OfficeTravelIntent => row !== null);
}
