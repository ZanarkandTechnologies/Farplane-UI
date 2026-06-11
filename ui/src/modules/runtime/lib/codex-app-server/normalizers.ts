import type {
  AgentCardModel,
  AgentLiveStatus,
  CompanyModel,
  FederatedTaskModel,
  SessionRowModel,
  SessionTimelineEvent,
  SessionTimelineModel,
} from "../openclaw";
import type {
  CodexProjectManagerPin,
  CodexOfficeVisibilityConfig,
  CodexProjectReadModelTask,
  CodexThread,
  CodexThreadItem,
  CodexThreadStatus,
  CodexTurn,
} from "./types";

export const CODEX_MAIN_AGENT_ID = "codex-main";
export const CODEX_THREAD_PREFIX = "codex-thread:";
const DEFAULT_ACTIVE_THREAD_WINDOW_MINUTES = 180;
const CODEX_MISC_PROJECT_PATH = "farplane://codex/misc";
const CODEX_MISC_PROJECT_ID = "codex-proj-misc";

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

export function codexProjectId(cwd: string): string {
  if (cwd === CODEX_MISC_PROJECT_PATH) return CODEX_MISC_PROJECT_ID;
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

function findBestProjectPath(cwd: string, projectPaths: string[]): string | null {
  const matches = projectPaths
    .filter((projectPath) => isPathWithinProject(cwd, projectPath))
    .sort((a, b) => normalizePath(b).length - normalizePath(a).length);
  return matches[0] ?? null;
}

function normalizeVisibilityConfig(config?: CodexOfficeVisibilityConfig): Required<CodexOfficeVisibilityConfig> {
  return {
    recentThreadWindowMinutes:
      typeof config?.recentThreadWindowMinutes === "number" && Number.isFinite(config.recentThreadWindowMinutes)
        ? Math.max(1, config.recentThreadWindowMinutes)
        : DEFAULT_ACTIVE_THREAD_WINDOW_MINUTES,
    alwaysShowHeartbeatThreads: config?.alwaysShowHeartbeatThreads !== false,
    showAutomationThreadsAsHeartbeat: config?.showAutomationThreadsAsHeartbeat !== false,
    heartbeatThreadIds: Array.isArray(config?.heartbeatThreadIds) ? config.heartbeatThreadIds : [],
    miscProjectName: safeText(config?.miscProjectName) || "Misc",
    miscPathIncludes: Array.isArray(config?.miscPathIncludes) ? config.miscPathIncludes : ["Documents/Codex"],
  };
}

function isThreadRecentlyActive(thread: CodexThread, nowMs: number, windowMs: number): boolean {
  const updatedAt = secondsToMs(thread.updatedAt);
  if (!updatedAt) return false;
  return nowMs - updatedAt <= windowMs;
}

function isThreadStatusActive(thread: CodexThread): boolean {
  return thread.status?.type === "active";
}

function isAutomationHeartbeatThread(thread: CodexThread): boolean {
  const haystack = `${safeText(thread.name)}\n${safeText(thread.preview)}`;
  return /^Automation:/m.test(haystack) && /Automation ID:/m.test(haystack);
}

function isMiscProjectPath(value: string, miscPathIncludes: string[]): boolean {
  const normalized = normalizePath(value);
  return miscPathIncludes
    .map(safeText)
    .filter(Boolean)
    .some((pattern) => normalized.includes(normalizePath(pattern)));
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
  readModel: {
    ticketTasks?: CodexProjectReadModelTask[];
    projectManagers?: CodexProjectManagerPin[];
    officeVisibility?: CodexOfficeVisibilityConfig;
  } = {},
): CompanyModel {
  const visibility = normalizeVisibilityConfig(readModel.officeVisibility);
  const projectPaths = [
    ...new Set(
      configuredProjectPaths
        .map(safeText)
        .filter(Boolean)
        .filter((projectPath) => !isMiscProjectPath(projectPath, visibility.miscPathIncludes)),
    ),
  ];
  const activeThreadWindowMs = visibility.recentThreadWindowMinutes * 60 * 1000;
  const pinnedManagerThreadIds = new Set(
    (readModel.projectManagers ?? []).map((pin) => safeText(pin.threadId)).filter(Boolean),
  );
  const heartbeatThreadIds = new Set(visibility.heartbeatThreadIds.map(safeText).filter(Boolean));
  const projectThreads = threads;
  const threadsByProjectPath = new Map<string, CodexThread[]>();
  for (const projectPath of projectPaths) {
    threadsByProjectPath.set(projectPath, []);
  }
  for (const thread of projectThreads) {
    const cwd = safeText(thread.cwd);
    const isPinned = pinnedManagerThreadIds.has(thread.id);
    const hasHeartbeat =
      heartbeatThreadIds.has(thread.id) ||
      isThreadStatusActive(thread) ||
      (visibility.showAutomationThreadsAsHeartbeat && isAutomationHeartbeatThread(thread));
    const isVisible =
      isPinned ||
      isThreadRecentlyActive(thread, nowMs, activeThreadWindowMs) ||
      (visibility.alwaysShowHeartbeatThreads && hasHeartbeat);
    if (!isVisible) {
      continue;
    }
    const matchedProjectPath = cwd && !isMiscProjectPath(cwd, visibility.miscPathIncludes)
      ? findBestProjectPath(cwd, projectPaths)
      : null;
    const projectPath =
      matchedProjectPath && !isMiscProjectPath(matchedProjectPath, visibility.miscPathIncludes)
        ? matchedProjectPath
        : CODEX_MISC_PROJECT_PATH;
    threadsByProjectPath.set(projectPath, [...(threadsByProjectPath.get(projectPath) ?? []), thread]);
  }
  const projectNameByPath = new Map<string, string>([[CODEX_MISC_PROJECT_PATH, visibility.miscProjectName]]);
  const projectGroups = [...threadsByProjectPath.entries()]
    .filter(([projectPath, rows]) => projectPath !== CODEX_MISC_PROJECT_PATH || rows.length > 0)
    .sort((a, b) => {
      if (a[0] === CODEX_MISC_PROJECT_PATH) return 1;
      if (b[0] === CODEX_MISC_PROJECT_PATH) return -1;
      return projectNameFromCwd(a[0]).localeCompare(projectNameFromCwd(b[0]));
    });
  const projectIdByPath = new Map(
    projectGroups.map(([projectPath]) => [normalizePath(projectPath), codexProjectId(projectPath)]),
  );
  const managerPins = readModel.projectManagers ?? [];
  const managerThreadIdsByProjectId = new Map<string, Set<string>>();
  for (const pin of managerPins) {
    const threadId = safeText(pin.threadId);
    if (!threadId) continue;
    const projectId =
      safeText(pin.projectId) ||
      (safeText(pin.projectPath) ? projectIdByPath.get(normalizePath(safeText(pin.projectPath))) : "") ||
      "";
    if (!projectId) continue;
    const current = managerThreadIdsByProjectId.get(projectId) ?? new Set<string>();
    current.add(threadId);
    managerThreadIdsByProjectId.set(projectId, current);
  }
  const visibleThreadAgents = new Map<string, { projectPath: string; thread: CodexThread; isManager: boolean }>();
  for (const [projectPath, rows] of projectGroups) {
    const projectId = codexProjectId(projectPath);
    const managerThreadIds = managerThreadIdsByProjectId.get(projectId) ?? new Set<string>();
    for (const thread of rows) {
      const isManager = managerThreadIds.has(thread.id);
      const hasHeartbeat =
        heartbeatThreadIds.has(thread.id) ||
        isThreadStatusActive(thread) ||
        (visibility.showAutomationThreadsAsHeartbeat && isAutomationHeartbeatThread(thread));
      if (
        !isManager &&
        !isThreadRecentlyActive(thread, nowMs, activeThreadWindowMs) &&
        !(visibility.alwaysShowHeartbeatThreads && hasHeartbeat)
      ) {
        continue;
      }
      visibleThreadAgents.set(thread.id, { projectPath, thread, isManager });
    }
  }
  const tasks: FederatedTaskModel[] = (readModel.ticketTasks ?? []).map((task) => ({
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    status: task.status,
    ownerAgentId: task.ownerAgentId,
    priority: task.priority ?? "medium",
    provider: task.provider ?? "internal",
    canonicalProvider: task.canonicalProvider ?? task.provider ?? "internal",
    providerUrl: task.providerUrl,
    artefactPath: task.artefactPath,
    syncState: task.syncState ?? "healthy",
    syncError: task.syncError,
    updatedAt: task.updatedAt ?? nowMs,
  }));

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
      name: projectNameByPath.get(projectPath) ?? projectNameFromCwd(projectPath),
      githubUrl: "",
      status: "active",
      goal:
        projectPath === CODEX_MISC_PROJECT_PATH
          ? `Track ${rows.length} projectless Codex chat${rows.length === 1 ? "" : "s"}.`
          : `Track ${rows.length} Codex thread${rows.length === 1 ? "" : "s"} and local tickets for ${projectPath}.`,
      kpis: ["recent_active_threads", "ticket_folder_board"],
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
      ...[...visibleThreadAgents.values()].map(({ projectPath, thread, isManager }) => ({
        agentId: toThreadAgentId(thread.id),
        role: isManager ? ("pm" as const) : ("builder" as const),
        projectId: codexProjectId(projectPath),
        heartbeatProfileId: isManager ? "hb-codex-manager" : "hb-codex-thread",
        lifecycleState: "active" as const,
      })),
    ],
    roleSlots: projectGroups.map(([projectPath]) => ({
      projectId: codexProjectId(projectPath),
      role: "pm" as const,
      desiredCount: managerThreadIdsByProjectId.has(codexProjectId(projectPath)) ? 1 : 0,
      spawnPolicy: "manual" as const,
    })),
    tasks,
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
        id: "hb-codex-manager",
        role: "pm",
        cadenceMinutes: 0,
        teamDescription: "Pinned Codex project manager thread",
        productDetails: "Persistent planning context for one Codex project.",
        goal: "Keep the project table visible and provide long-lived planning continuity.",
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
