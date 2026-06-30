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
  | "file.change.summary"
  | "thread.started"
  | "thread.stopped"
  | "thread.forked"
  | "thread.created";

export type AgentBubbleMessage = {
  threadId: string;
  message: string;
  eventAt: number;
};

export type ObservedCodexWorker = {
  workerId: string;
  sourceInstanceId: string;
  machineId?: string;
  machineName?: string;
  sessionKey: string;
  threadId?: string;
  parentThreadId?: string;
  projectId: string;
  projectPath?: string;
  displayName: string;
  state: "running" | "idle" | "done";
  statusText: string;
  currentSkillId?: string;
  isEphemeral?: boolean;
  lastSeenAt: number;
  controllable: false;
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

export type ThreadLineageNode = {
  id: string;
  kind: "thread" | "pending" | "unknown-parent";
  label: string;
  projectPath?: string;
  lastSeenAt: number;
};

export type ThreadLineageEdge = {
  id: string;
  source: string;
  target: string;
  kind: "created" | "forked";
  eventAt: number;
  sourceTool: string;
  title?: string;
};

export type ThreadLineageGraph = {
  nodes: ThreadLineageNode[];
  edges: ThreadLineageEdge[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    forkCount: number;
    createCount: number;
    orphanCount: number;
  };
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

function safeIdPart(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "unknown"
  );
}

function codexProjectIdFromPath(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const slug =
    trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "codex";
  return `codex-proj-${slug}`;
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

function turnIdFromPayload(payload: JsonRecord): string | undefined {
  return cleanText(payload.turnId, 200) ?? cleanText(payload.turn_id, 200);
}

function observedParentThreadIdFromPayload(payload: JsonRecord): string | undefined {
  return (
    cleanText(payload.parentThreadId, 200) ??
    cleanText(payload.parent_thread_id, 200) ??
    cleanText(payload.parentSessionId, 200) ??
    cleanText(payload.parent_session_id, 200) ??
    cleanText(payload.sourceThreadId, 200) ??
    cleanText(payload.source_thread_id, 200)
  );
}

function machineIdFromPayload(payload: JsonRecord): string | undefined {
  return (
    cleanText(payload.machineId, 160) ??
    cleanText(payload.machine_id, 160) ??
    cleanText(payload.runtimeInstanceId, 160) ??
    cleanText(payload.runtime_instance_id, 160) ??
    cleanText(payload.sourceInstanceId, 160) ??
    cleanText(payload.source_instance_id, 160) ??
    cleanText(payload.hostId, 160) ??
    cleanText(payload.hostname, 160)
  );
}

function machineNameFromPayload(payload: JsonRecord): string | undefined {
  return (
    cleanText(payload.machineName, 160) ??
    cleanText(payload.machine_name, 160) ??
    cleanText(payload.hostname, 160) ??
    cleanText(payload.hostName, 160)
  );
}

function projectPathFromPayload(payload: JsonRecord): string | undefined {
  return (
    cleanText(payload.cwd, 300) ??
    cleanText(payload.projectPath, 300) ??
    cleanText(payload.projectDirectory, 300)
  );
}

function projectIdFromRow(row: HookTelemetryRow, payload: JsonRecord): string | undefined {
  return (
    row.projectId ??
    cleanText(payload.projectId, 160) ??
    cleanText(payload.project_id, 160) ??
    codexProjectIdFromPath(projectPathFromPayload(payload))
  );
}

function observedStatusText(row: HookTelemetryRow, payload: JsonRecord): string {
  const explicit =
    cleanText(payload.statusText, 120) ??
    cleanText(payload.summary, 120) ??
    cleanText(payload.message, 120) ??
    cleanText(payload.title, 120);
  if (explicit) return explicit;
  if (row.hookType === "UserPromptSubmit" || row.hookType === "TurnStart")
    return "Codex turn running";
  if (row.hookType === "Stop" || row.hookType === "TurnEnd") return "Codex turn completed";
  if (row.hookType === "SubagentStart") return "Delegated Codex worker running";
  if (row.hookType === "SubagentStop") return "Delegated Codex worker completed";
  if (row.hookType === "PostToolUse") {
    const skillId = cleanText(payload.skillId, 120);
    if (skillId) return `Calling ${compactLabel(skillId)}`;
    return "Codex tool activity";
  }
  return "Codex activity observed";
}

function observedState(row: HookTelemetryRow): ObservedCodexWorker["state"] {
  if (row.hookType === "Stop" || row.hookType === "TurnEnd" || row.hookType === "SubagentStop")
    return "done";
  if (
    row.hookType === "SessionStart" ||
    row.hookType === "UserPromptSubmit" ||
    row.hookType === "TurnStart" ||
    row.hookType === "PreToolUse" ||
    row.hookType === "PostToolUse" ||
    row.hookType === "PermissionRequest" ||
    row.hookType === "SubagentStart"
  ) {
    return "running";
  }
  return "idle";
}

function isObservedStartHook(row: HookTelemetryRow): boolean {
  return (
    row.hookType === "SessionStart" ||
    row.hookType === "UserPromptSubmit" ||
    row.hookType === "TurnStart" ||
    row.hookType === "SubagentStart"
  );
}

function isObservedStopHook(row: HookTelemetryRow): boolean {
  return row.hookType === "Stop" || row.hookType === "TurnEnd" || row.hookType === "SubagentStop";
}

function observedCurrentSkillId(payload: JsonRecord): string | undefined {
  return cleanText(payload.skillId, 160) ?? cleanText(payload.skill_id, 160);
}

function observedDisplayName(input: {
  payload: JsonRecord;
  machineName?: string;
  threadId?: string;
  projectId: string;
  currentDisplayName?: string;
}): string {
  return (
    cleanText(input.payload.agentName, 80) ??
    cleanText(input.payload.threadTitle, 80) ??
    cleanText(input.payload.title, 80) ??
    input.currentDisplayName ??
    (input.machineName ? `Codex on ${input.machineName}` : undefined) ??
    (input.threadId ? `Codex ${input.threadId.slice(0, 8)}` : undefined) ??
    `Codex ${input.projectId.slice(0, 8)}`
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

function lineageEventName(
  row: HookTelemetryRow,
  payload: JsonRecord,
): "thread.created" | "thread.forked" | undefined {
  const eventName = hookEventName(row, payload);
  if (eventName === "thread.created" || eventName === "thread.forked") return eventName;
  return undefined;
}

function childThreadIdFromPayload(payload: JsonRecord): string | undefined {
  return (
    cleanText(payload.childThreadId, 200) ??
    cleanText(payload.child_thread_id, 200) ??
    cleanText(payload.createdThreadId, 200) ??
    cleanText(payload.created_thread_id, 200) ??
    cleanText(payload.forkedThreadId, 200) ??
    cleanText(payload.forked_thread_id, 200)
  );
}

function pendingWorktreeIdFromPayload(payload: JsonRecord): string | undefined {
  return cleanText(payload.pendingWorktreeId, 200) ?? cleanText(payload.pending_worktree_id, 200);
}

function parentThreadIdFromPayload(row: HookTelemetryRow, payload: JsonRecord): string | undefined {
  return (
    cleanText(payload.parentThreadId, 200) ??
    cleanText(payload.parent_thread_id, 200) ??
    cleanText(payload.parentSessionId, 200) ??
    cleanText(payload.parent_session_id, 200) ??
    cleanText(row.sessionId, 200)
  );
}

function lineageTitle(payload: JsonRecord): string | undefined {
  return (
    cleanText(payload.title, 120) ??
    cleanText(payload.threadTitle, 120) ??
    cleanText(payload.thread_title, 120)
  );
}

function threadLabel(id: string, title?: string): string {
  if (title) return title;
  if (id.startsWith("pending:"))
    return `Pending ${id.slice("pending:".length, "pending:".length + 8)}`;
  if (id === "unknown-parent") return "Unknown parent";
  return `Thread ${id.slice(0, 8)}`;
}

function upsertLineageNode(nodes: Map<string, ThreadLineageNode>, node: ThreadLineageNode): void {
  const current = nodes.get(node.id);
  if (!current || current.lastSeenAt <= node.lastSeenAt) {
    nodes.set(node.id, { ...current, ...node });
  }
}

function hookEventName(row: HookTelemetryRow, payload: JsonRecord): HookEventName | undefined {
  const explicit =
    cleanText(payload.eventName, 120) ??
    cleanText(payload.eventType, 120) ??
    cleanText(payload.type, 120);
  if (
    explicit === "skill.invoked" ||
    explicit === "file.change.summary" ||
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

export function hookTelemetryRowsToSkillInvocationRows(
  rows: HookTelemetryRow[],
): SkillInvocationRow[] {
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
      if (row.hookName === "codex-event-miner") return null;
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

export function hookTelemetryRowsToObservedCodexWorkers(
  rows: HookTelemetryRow[],
): ObservedCodexWorker[] {
  const byWorkerId = new Map<string, ObservedCodexWorker>();
  const lifecycleByWorkerId = new Map<string, { latestStartAt?: number; latestStopAt?: number }>();
  for (const row of rows) {
    const payload = asRecord(row.payload);
    const projectId = projectIdFromRow(row, payload);
    if (!projectId) continue;
    const threadId = threadIdFromRow(row, payload);
    const parentThreadId = observedParentThreadIdFromPayload(payload);
    const turnId = turnIdFromPayload(payload);
    const sessionKey = threadId ?? turnId ?? cleanText(row.sessionId, 200);
    if (!sessionKey) continue;

    const machineId = machineIdFromPayload(payload);
    const machineName = machineNameFromPayload(payload);
    const sourceInstanceId = machineId ?? machineName ?? row.hookName;
    const workerId = [
      "codex-observed",
      safeIdPart(sourceInstanceId),
      safeIdPart(projectId),
      safeIdPart(sessionKey),
    ].join(":");
    const current = byWorkerId.get(workerId);
    const lifecycle = lifecycleByWorkerId.get(workerId) ?? {};
    if (isObservedStartHook(row)) {
      lifecycle.latestStartAt = Math.max(lifecycle.latestStartAt ?? -Infinity, row.eventAt);
    }
    if (isObservedStopHook(row)) {
      lifecycle.latestStopAt = Math.max(lifecycle.latestStopAt ?? -Infinity, row.eventAt);
    }
    lifecycleByWorkerId.set(workerId, lifecycle);
    const state = observedState(row);
    const currentSkillId =
      observedCurrentSkillId(payload) ??
      (state === "running" ? current?.currentSkillId : undefined);
    const isEphemeral = row.hookType === "SubagentStart" || row.hookType === "SubagentStop";
    if (current && current.lastSeenAt >= row.eventAt) {
      if (!current.parentThreadId && parentThreadId) {
        byWorkerId.set(workerId, { ...current, parentThreadId });
      }
      continue;
    }

    byWorkerId.set(workerId, {
      workerId,
      sourceInstanceId,
      machineId,
      machineName,
      sessionKey,
      threadId,
      parentThreadId: parentThreadId ?? current?.parentThreadId,
      projectId,
      projectPath: projectPathFromPayload(payload),
      displayName: observedDisplayName({
        payload,
        machineName,
        threadId,
        projectId,
        currentDisplayName: current?.displayName,
      }),
      state,
      statusText: observedStatusText(row, payload),
      currentSkillId,
      isEphemeral: isEphemeral ? true : current?.isEphemeral,
      lastSeenAt: row.eventAt,
      controllable: false,
    });
  }
  return [...byWorkerId.values()]
    .map((worker): ObservedCodexWorker => {
      const lifecycle = lifecycleByWorkerId.get(worker.workerId);
      if (
        lifecycle?.latestStartAt !== undefined &&
        (lifecycle.latestStopAt === undefined || lifecycle.latestStartAt > lifecycle.latestStopAt)
      ) {
        return {
          ...worker,
          state: "running",
          statusText:
            worker.statusText === "Codex activity observed"
              ? "Codex turn running"
              : worker.statusText,
        };
      }
      if (
        lifecycle?.latestStopAt !== undefined &&
        (lifecycle.latestStartAt === undefined || lifecycle.latestStopAt >= lifecycle.latestStartAt)
      ) {
        return {
          ...worker,
          state: "done",
        };
      }
      return worker;
    })
    .sort(
      (left, right) =>
        right.lastSeenAt - left.lastSeenAt || left.workerId.localeCompare(right.workerId),
    );
}

export function hookTelemetryRowsToAgentBubbleMessages(
  rows: HookTelemetryRow[],
): AgentBubbleMessage[] {
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

      if (eventName === "file.change.summary") {
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

export function hookTelemetryRowsToThreadLineageGraph(
  rows: HookTelemetryRow[],
): ThreadLineageGraph {
  const nodes = new Map<string, ThreadLineageNode>();
  const edgeById = new Map<string, ThreadLineageEdge>();
  let orphanCount = 0;

  for (const row of rows) {
    const payload = asRecord(row.payload);
    const eventName = lineageEventName(row, payload);
    if (!eventName) continue;
    const parentId = parentThreadIdFromPayload(row, payload) ?? "unknown-parent";
    const childThreadId = childThreadIdFromPayload(payload);
    const pendingWorktreeId = pendingWorktreeIdFromPayload(payload);
    const childId =
      childThreadId ?? (pendingWorktreeId ? `pending:${pendingWorktreeId}` : undefined);
    if (!childId) continue;
    const title = lineageTitle(payload);
    const kind = eventName === "thread.forked" ? "forked" : "created";
    const projectPath = projectPathFromPayload(payload);
    if (parentId === "unknown-parent") orphanCount += 1;

    upsertLineageNode(nodes, {
      id: parentId,
      kind: parentId === "unknown-parent" ? "unknown-parent" : "thread",
      label: threadLabel(parentId),
      projectPath,
      lastSeenAt: row.eventAt,
    });
    upsertLineageNode(nodes, {
      id: childId,
      kind: childThreadId ? "thread" : "pending",
      label: threadLabel(childId, title),
      projectPath,
      lastSeenAt: row.eventAt,
    });
    const edgeId = row.eventKey ?? `${kind}:${parentId}:${childId}:${row.eventAt}`;
    edgeById.set(edgeId, {
      id: edgeId,
      source: parentId,
      target: childId,
      kind,
      eventAt: row.eventAt,
      sourceTool: cleanText(payload.toolName, 120) ?? cleanText(payload.sourceTool, 120) ?? kind,
      title,
    });
  }

  const edges = [...edgeById.values()].sort(
    (left, right) => right.eventAt - left.eventAt || left.id.localeCompare(right.id),
  );
  const nodeRows = [...nodes.values()].sort(
    (left, right) => right.lastSeenAt - left.lastSeenAt || left.id.localeCompare(right.id),
  );
  return {
    nodes: nodeRows,
    edges,
    stats: {
      nodeCount: nodeRows.length,
      edgeCount: edges.length,
      forkCount: edges.filter((edge) => edge.kind === "forked").length,
      createCount: edges.filter((edge) => edge.kind === "created").length,
      orphanCount,
    },
  };
}

export function hookTelemetryRowsToOfficeTravelIntents(
  rows: HookTelemetryRow[],
): OfficeTravelIntent[] {
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
