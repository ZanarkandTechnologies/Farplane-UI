import type {
  AgentCardModel,
  AgentLiveStatus,
  CompanyModel,
  SessionRowModel,
  SessionTimelineEvent,
  SessionTimelineModel,
} from "@/lib/openclaw-types";
import type { CodexThread, CodexThreadItem, CodexThreadStatus, CodexTurn } from "./types";

export const CODEX_MAIN_AGENT_ID = "codex-main";
export const CODEX_THREAD_PREFIX = "codex-thread:";
const ACTIVE_THREAD_WINDOW_MS = 3 * 60 * 60 * 1000;

const CODEX_MAIN_AGENT: AgentCardModel = {
  agentId: CODEX_MAIN_AGENT_ID,
  displayName: "Codex",
  workspacePath: "~/.codex",
  agentDir: "~/.codex",
  sandboxMode: "codex",
  toolPolicy: { allow: [], deny: [] },
  sessionCount: 0,
};

function safeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function secondsToMs(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.floor(value * 1000) : undefined;
}

function basename(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).pop() ?? filePath;
}

function threadTitle(thread: CodexThread): string {
  return safeText(thread.name) || safeText(thread.preview) || basename(safeText(thread.cwd)) || thread.id;
}

function toThreadAgentId(threadId: string): string {
  return `${CODEX_THREAD_PREFIX}${threadId}`;
}

function projectNameFromCwd(cwd: string): string {
  const name = basename(cwd);
  return name || "Codex";
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "codex";
}

function codexProjectId(cwd: string): string {
  return `codex-proj-${slugify(cwd)}`;
}

function normalizePath(value: string): string {
  return value.replace(/\/+$/, "");
}

function isPathWithinProject(cwd: string, projectPath: string): boolean {
  const normalizedCwd = normalizePath(cwd);
  const normalizedProject = normalizePath(projectPath);
  if (/^\/Users\/[^/]+$/.test(normalizedProject)) {
    return normalizedCwd === normalizedProject;
  }
  return normalizedCwd === normalizedProject || normalizedCwd.startsWith(`${normalizedProject}/`);
}

function findBestProjectPath(cwd: string, projectPaths: string[]): string {
  const matches = projectPaths
    .filter((projectPath) => isPathWithinProject(cwd, projectPath))
    .sort((a, b) => normalizePath(b).length - normalizePath(a).length);
  return matches[0] ?? cwd;
}

function isThreadRecentlyActive(thread: CodexThread, nowMs: number): boolean {
  const updatedAt = secondsToMs(thread.updatedAt);
  if (!updatedAt) return false;
  return nowMs - updatedAt <= ACTIVE_THREAD_WINDOW_MS;
}

export function parseCodexThreadId(value: string): string {
  return value.startsWith(CODEX_THREAD_PREFIX) ? value.slice(CODEX_THREAD_PREFIX.length) : value;
}

export function toCodexAgentCards(threads: CodexThread[]): AgentCardModel[] {
  if (threads.length === 0) return [CODEX_MAIN_AGENT];
  return threads.map((thread) => ({
    agentId: toThreadAgentId(thread.id),
    displayName: thread.agentNickname || threadTitle(thread),
    workspacePath: safeText(thread.cwd) || "~/.codex",
    agentDir: safeText(thread.path) || safeText(thread.cwd) || "~/.codex",
    sandboxMode: "codex",
    toolPolicy: { allow: [], deny: [] },
    sessionCount: 1,
    lastUpdatedAt: secondsToMs(thread.updatedAt),
  }));
}

export function toCodexCompanyModel(
  threads: CodexThread[],
  nowMs = Date.now(),
  configuredProjectPaths: string[] = [],
): CompanyModel {
  const projectPaths = [...new Set(configuredProjectPaths.map(safeText).filter(Boolean))];
  const projectThreads = threads.filter((thread) => safeText(thread.cwd));
  const threadsByProjectPath = new Map<string, CodexThread[]>();
  for (const projectPath of projectPaths) {
    threadsByProjectPath.set(projectPath, []);
  }
  for (const thread of projectThreads) {
    const cwd = safeText(thread.cwd);
    const projectPath = findBestProjectPath(cwd, projectPaths);
    if (projectPaths.length > 0 && projectPath === cwd && !isThreadRecentlyActive(thread, nowMs)) {
      continue;
    }
    threadsByProjectPath.set(projectPath, [...(threadsByProjectPath.get(projectPath) ?? []), thread]);
  }
  const projectGroups = [...threadsByProjectPath.entries()].sort((a, b) =>
    projectNameFromCwd(a[0]).localeCompare(projectNameFromCwd(b[0])),
  );
  const activeThreads = projectGroups.flatMap(([projectPath, rows]) =>
    rows
      .filter((thread) => isThreadRecentlyActive(thread, nowMs))
      .map((thread) => ({ projectPath, thread })),
  );

  return {
    version: 1,
    departments: [
      {
        id: "dept-codex-projects",
        name: "Codex Projects",
        description: "Local Codex project workspaces grouped by thread cwd.",
        goal: "Show one office team table per Codex project.",
      },
    ],
    projects: projectGroups.map(([projectPath, rows]) => ({
      id: codexProjectId(projectPath),
      departmentId: "dept-codex-projects",
      name: projectNameFromCwd(projectPath),
      githubUrl: "",
      status: "active",
      goal: `Track ${rows.length} Codex thread${rows.length === 1 ? "" : "s"} for ${projectPath}.`,
      kpis: ["recent_active_threads"],
      trackingContext: projectPath,
      accountEvents: [],
      ledger: [],
      experiments: [],
      metricEvents: [],
      resources: [],
      resourceEvents: [],
    })),
    agents: [
      {
        agentId: CODEX_MAIN_AGENT_ID,
        role: "ceo",
        heartbeatProfileId: "hb-codex-main",
        isCeo: true,
        lifecycleState: "active",
      },
      ...activeThreads.map(({ projectPath, thread }) => ({
        agentId: toThreadAgentId(thread.id),
        role: "builder" as const,
        projectId: codexProjectId(projectPath),
        heartbeatProfileId: "hb-codex-thread",
        lifecycleState: "active" as const,
      })),
    ],
    roleSlots: [],
    tasks: [],
    federationPolicies: [],
    providerIndexProfiles: [],
    heartbeatProfiles: [
      {
        id: "hb-codex-main",
        role: "ceo",
        cadenceMinutes: 0,
        teamDescription: "Codex project overview",
        productDetails: "Farplane UI maps Codex projects and recent threads.",
        goal: "Keep project/thread visibility current.",
      },
      {
        id: "hb-codex-thread",
        role: "builder",
        cadenceMinutes: 0,
        teamDescription: "Recent Codex thread worker",
        productDetails: "One temporary employee per recently active Codex thread.",
        goal: "Represent active thread work on the office floor.",
      },
    ],
    channelBindings: [],
    heartbeatRuntime: {
      enabled: false,
      pluginId: "codex-app-server",
      serviceId: "codex-thread-map",
      cadenceMinutes: 0,
      notes: "Codex mode derives projects from thread cwd and employees from recently active threads.",
    },
  };
}

export function toCodexSessionRows(agentId: string, threads: CodexThread[]): SessionRowModel[] {
  const threadId = parseCodexThreadId(agentId);
  const rows = agentId === CODEX_MAIN_AGENT_ID ? threads : threads.filter((thread) => thread.id === threadId);
  return rows.map((thread) => ({
    agentId: toThreadAgentId(thread.id),
    sessionKey: toThreadAgentId(thread.id),
    sessionId: thread.sessionId,
    updatedAt: secondsToMs(thread.updatedAt),
    channel: "codex",
    peerLabel: threadTitle(thread),
    origin: safeText(thread.modelProvider) || "codex",
  }));
}

function itemText(item: CodexThreadItem): string {
  if (item.type === "userMessage") {
    return Array.isArray(item.content)
      ? item.content.map((part) => safeText(part.text)).filter(Boolean).join("\n")
      : "";
  }
  if (item.type === "agentMessage" || item.type === "plan") return safeText(item.text);
  if (item.type === "reasoning") {
    const summary = Array.isArray(item.summary) ? item.summary : [];
    const content = Array.isArray(item.content) ? item.content : [];
    return [...summary, ...content].map(safeText).filter(Boolean).join("\n");
  }
  if (item.type === "commandExecution") {
    const output = safeText(item.aggregatedOutput);
    return [`$ ${safeText(item.command)}`, output].filter(Boolean).join("\n");
  }
  if (item.type === "fileChange") return `File changes ${safeText(item.status) || "recorded"}.`;
  if (item.type === "mcpToolCall" || item.type === "dynamicToolCall") {
    const toolName = safeText(item.tool) || safeText(item.namespace) || "tool";
    return `${toolName} ${safeText(item.status) || "recorded"}.`;
  }
  return safeText((item as { text?: unknown }).text) || item.type;
}

function itemEventType(item: CodexThreadItem): SessionTimelineEvent["type"] {
  if (item.type === "commandExecution" || item.type === "mcpToolCall" || item.type === "dynamicToolCall" || item.type === "fileChange") {
    return "tool";
  }
  if (item.type === "plan" || item.type === "reasoning") return "status";
  return "message";
}

function itemRole(item: CodexThreadItem): string {
  if (item.type === "userMessage") return "user";
  if (item.type === "agentMessage") return "assistant";
  if (item.type === "commandExecution") return "tool";
  if (item.type === "mcpToolCall" || item.type === "dynamicToolCall") return "tool";
  return "system";
}

function toTimelineEvent(item: CodexThreadItem, turn: CodexTurn, fallbackTs: number, index: number): SessionTimelineEvent {
  const ts = secondsToMs(turn.startedAt) ?? fallbackTs + index;
  return {
    ts,
    type: itemEventType(item),
    role: itemRole(item),
    text: itemText(item),
    source: item.type === "userMessage" ? "operator" : "ui",
    eventId: item.id || `${turn.id}:${index}`,
    raw: item as Record<string, unknown>,
  };
}

export function toCodexTimeline(agentId: string, sessionKey: string, thread: CodexThread): SessionTimelineModel {
  const fallbackTs = secondsToMs(thread.updatedAt) ?? Date.now();
  const events = (thread.turns ?? [])
    .flatMap((turn) => (turn.items ?? []).map((item, index) => toTimelineEvent(item, turn, fallbackTs, index)))
    .filter((event) => event.text.trim().length > 0)
    .sort((a, b) => a.ts - b.ts);
  return {
    agentId,
    sessionKey,
    events,
  };
}

function statusState(status: CodexThreadStatus | undefined): AgentLiveStatus["state"] {
  if (!status) return "idle";
  if (status.type === "active") return "running";
  if (status.type === "systemError") return "error";
  if (status.type === "idle") return "idle";
  return "idle";
}

export function toCodexLiveStatus(thread: CodexThread): AgentLiveStatus {
  const state = statusState(thread.status);
  return {
    agentId: toThreadAgentId(thread.id),
    sessionKey: toThreadAgentId(thread.id),
    state,
    statusText: state === "running" ? "Codex turn running." : state === "error" ? "Codex thread error." : "Codex thread idle.",
    updatedAt: secondsToMs(thread.updatedAt),
    bubbles: [],
  };
}

export function toCodexMainLiveStatus(): AgentLiveStatus {
  return {
    agentId: CODEX_MAIN_AGENT_ID,
    state: "idle",
    statusText: "Waiting for Codex app-server threads.",
    bubbles: [],
  };
}

export function findActiveTurnId(thread: CodexThread): string | null {
  const active = [...(thread.turns ?? [])].reverse().find((turn) => {
    const status = safeText(turn.status).toLowerCase();
    return status === "running" || status === "in_progress" || status === "inprogress" || status === "active";
  });
  return active?.id ?? null;
}
