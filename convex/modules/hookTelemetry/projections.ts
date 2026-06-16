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

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
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
