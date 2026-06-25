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
  CodexOfficeVisibilityConfig,
  CodexProjectManagerPin,
  CodexProjectPmBinding,
  CodexProjectPmConfig,
  CodexProjectReadModelTask,
  CodexThread,
  CodexThreadItem,
  CodexThreadStatus,
  CodexTurn,
} from "./types";

export const CODEX_MAIN_AGENT_ID = "codex-main";
export const CODEX_THREAD_PREFIX = "codex-thread:";
export const CODEX_PM_PREFIX = "codex-pm:";
const DEFAULT_ACTIVE_THREAD_WINDOW_MINUTES = 180;
const RECENT_IDLE_UPDATE_READY_MS = 60 * 60 * 1000;
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

function safeJsonText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function secondsToMs(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.floor(value * 1000) : undefined;
}

function basename(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).pop() ?? filePath;
}

function threadTitle(thread: CodexThread): string {
  return (
    safeText(thread.name) || safeText(thread.preview) || basename(safeText(thread.cwd)) || thread.id
  );
}

function threadOfficeDisplayName(thread: CodexThread): string {
  return safeText(thread.name) || basename(safeText(thread.cwd)) || thread.id;
}

function toThreadAgentId(threadId: string): string {
  return `${CODEX_THREAD_PREFIX}${threadId}`;
}

export function toCodexPmAgentId(projectId: string): string {
  return `${CODEX_PM_PREFIX}${projectId}`;
}

export function isCodexPmAgentId(agentId: string): boolean {
  return agentId.startsWith(CODEX_PM_PREFIX);
}

export function parseCodexPmProjectId(agentId: string): string {
  return isCodexPmAgentId(agentId) ? agentId.slice(CODEX_PM_PREFIX.length) : "";
}

function projectNameFromCwd(cwd: string): string {
  const name = basename(cwd);
  return name || "Codex";
}

function friendlyProjectName(projectPath: string): string {
  return (
    projectNameFromCwd(projectPath).replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim() || "Project"
  );
}

export function projectPmDisplayName(projectPath: string, pm?: CodexProjectPmConfig): string {
  const configuredName = safeText(pm?.name);
  if (configuredName && configuredName.toLowerCase() !== "project pm") return configuredName;
  return `${friendlyProjectName(projectPath)} PM`;
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

type NormalizedCodexOfficeVisibilityConfig = Required<
  Omit<CodexOfficeVisibilityConfig, "ceoThreadId" | "leadershipPins">
> & {
  ceoThreadId: string;
  leadershipPins: {
    ceoThreadId: string;
    projectManagers: CodexProjectManagerPin[];
  };
};

function normalizeVisibilityConfig(
  config?: CodexOfficeVisibilityConfig,
): NormalizedCodexOfficeVisibilityConfig {
  const ceoThreadId =
    safeText(config?.ceoThreadId) || safeText(config?.leadershipPins?.ceoThreadId);
  const projectManagers = config?.projectManagers ?? config?.leadershipPins?.projectManagers ?? [];
  return {
    recentThreadWindowMinutes:
      typeof config?.recentThreadWindowMinutes === "number" &&
      Number.isFinite(config.recentThreadWindowMinutes)
        ? Math.max(1, config.recentThreadWindowMinutes)
        : DEFAULT_ACTIVE_THREAD_WINDOW_MINUTES,
    alwaysShowHeartbeatThreads: config?.alwaysShowHeartbeatThreads !== false,
    showAutomationThreadsAsHeartbeat: config?.showAutomationThreadsAsHeartbeat !== false,
    ceoThreadId,
    projectManagers,
    leadershipPins: { ceoThreadId, projectManagers },
    heartbeatThreadIds: Array.isArray(config?.heartbeatThreadIds) ? config.heartbeatThreadIds : [],
    projectlessThreadIds: Array.isArray(config?.projectlessThreadIds)
      ? config.projectlessThreadIds
      : [],
    miscProjectName: safeText(config?.miscProjectName) || "Misc",
    miscPathIncludes: Array.isArray(config?.miscPathIncludes)
      ? config.miscPathIncludes
      : ["Documents/Codex"],
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

function threadSearchText(thread: CodexThread): string {
  return [safeText(thread.name), safeText(thread.preview)].filter(Boolean).join("\n");
}

function inferredDelegationParentThreadId(thread: CodexThread): string | undefined {
  const explicit = safeText(thread.parentThreadId);
  if (explicit) return explicit;
  const match = threadSearchText(thread).match(
    /<source_thread_id>\s*([^<\s]+)\s*<\/source_thread_id>/i,
  );
  return match?.[1]?.trim() || undefined;
}

function isDelegatedChildThread(thread: CodexThread): boolean {
  return Boolean(inferredDelegationParentThreadId(thread));
}

function isHeadlessCodexExecThread(thread: CodexThread): boolean {
  const sourceText = safeJsonText(thread.source).toLowerCase();
  if (
    sourceText &&
    /\b(codex[-_\s]?exec|exec)\b/.test(sourceText) &&
    /\b(ephemeral|headless|eval|evaluation)\b/.test(sourceText)
  ) {
    return true;
  }

  const haystack = threadSearchText(thread);
  return (
    /(^|\n)\s*You are judging an agent answer\b/i.test(haystack) ||
    /(^|\n)\s*Context:\s+.+\bis a clean-room toy app\b/i.test(haystack) ||
    /\bclean eval coverage\b/i.test(haystack)
  );
}

function isInternalAuxiliaryThread(thread: CodexThread): boolean {
  const haystack = threadSearchText(thread);
  return (
    isDelegatedChildThread(thread) ||
    isHeadlessCodexExecThread(thread) ||
    /(^|\n)Summarize this project file change as one (tiny employee status bubble label|concise employee status bubble)\b/i.test(
      haystack,
    ) ||
    /(^|\n)# Overview\s+Generate 0 to 3 hyperpersonalized suggestions for what this user can do with Codex\b/i.test(
      haystack,
    )
  );
}

function threadActivityUpdatedAtMs(thread: CodexThread): number | undefined {
  const updatedAt = secondsToMs(thread.updatedAt);
  const completedTurnAt = [...(thread.turns ?? [])]
    .map((turn) => secondsToMs(turn.completedAt))
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => b - a)[0];
  return Math.max(updatedAt ?? 0, completedTurnAt ?? 0) || undefined;
}

function latestTurn(thread: CodexThread): CodexTurn | undefined {
  return [...(thread.turns ?? [])].reverse()[0];
}

function hasRecentOpenTurn(thread: CodexThread, nowMs = Date.now()): boolean {
  const turn = latestTurn(thread);
  if (!turn || turn.completedAt) return false;
  const startedAt = secondsToMs(turn.startedAt);
  const updatedAt = threadActivityUpdatedAtMs(thread);
  const latest = Math.max(startedAt ?? 0, updatedAt ?? 0);
  if (!latest) return false;
  return nowMs - latest <= RECENT_IDLE_UPDATE_READY_MS;
}

function parseAutomationMetadata(thread: CodexThread): { title: string; id: string } | null {
  const haystack = `${safeText(thread.name)}\n${safeText(thread.preview)}`;
  const title = haystack.match(/^Automation:\s*(.+)$/m)?.[1]?.trim() ?? "";
  const id = haystack.match(/^Automation ID:\s*(.+)$/m)?.[1]?.trim() ?? "";
  if (!title && !id) return null;
  return { title, id };
}

function isPersistentAutomationHeartbeatThread(thread: CodexThread): boolean {
  const automation = parseAutomationMetadata(thread);
  if (!automation) return false;
  const haystack = `${automation.id}\n${automation.title}`.toLowerCase();
  if (/\b(ticket|drain|drainer|field-fill|field fill|update)\b/.test(haystack)) return false;
  return /\b(heartbeat|weekly pm|weekly strategy|restrategy|strategy)\b/.test(haystack);
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

function normalizeProjectPmLane(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean);
}

export function normalizeCodexProjectPmThreadIds(pm?: CodexProjectPmConfig): string[] {
  const threads = pm?.threads;
  if (Array.isArray(threads)) return [...new Set(normalizeProjectPmLane(threads))];
  return [
    ...new Set([
      ...normalizeProjectPmLane(threads?.chats),
      ...normalizeProjectPmLane(threads?.automations),
    ]),
  ];
}

function normalizeProjectPms(projectPms?: CodexProjectPmBinding[]): CodexProjectPmBinding[] {
  if (!Array.isArray(projectPms)) return [];
  return projectPms.filter((entry) => {
    return Boolean(safeText(entry.projectId) && safeText(entry.projectPath));
  });
}

export function toCodexAgentCards(threads: CodexThread[]): AgentCardModel[] {
  if (threads.length === 0) return [CODEX_MAIN_AGENT];
  return threads.map((thread) => ({
    agentId: toThreadAgentId(thread.id),
    displayName: safeText(thread.agentNickname) || threadOfficeDisplayName(thread),
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
    projectPms?: CodexProjectPmBinding[];
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
  const projectPathByProjectId = new Map(
    projectPaths.map((projectPath) => [codexProjectId(projectPath), projectPath]),
  );
  const activeThreadWindowMs = visibility.recentThreadWindowMinutes * 60 * 1000;
  const managerPins = [...(readModel.projectManagers ?? []), ...visibility.projectManagers];
  const projectPms = normalizeProjectPms(readModel.projectPms);
  const projectPmByProjectId = new Map(projectPms.map((entry) => [entry.projectId, entry]));
  const projectIdByPmThreadId = new Map<string, string>();
  for (const entry of projectPms) {
    const threadIds = new Set(normalizeCodexProjectPmThreadIds(entry.pm));
    for (const threadId of threadIds) projectIdByPmThreadId.set(threadId, entry.projectId);
  }
  const pmThreadIdsByProjectId = new Map(
    projectPms.map((entry) => [
      entry.projectId,
      new Set(normalizeCodexProjectPmThreadIds(entry.pm)),
    ]),
  );
  const pinnedManagerThreadIds = new Set(
    managerPins.map((pin) => safeText(pin.threadId)).filter(Boolean),
  );
  const pinnedManagerProjectPathByThreadId = new Map<string, string>();
  for (const pin of managerPins) {
    const threadId = safeText(pin.threadId);
    if (!threadId) continue;
    const pinnedProjectPath = safeText(pin.projectPath);
    const projectPath =
      projectPathByProjectId.get(safeText(pin.projectId)) ||
      projectPaths.find(
        (candidate) => normalizePath(candidate) === normalizePath(pinnedProjectPath),
      );
    if (projectPath) pinnedManagerProjectPathByThreadId.set(threadId, projectPath);
  }
  const ceoThreadId = visibility.ceoThreadId;
  const heartbeatThreadIds = new Set(visibility.heartbeatThreadIds.map(safeText).filter(Boolean));
  const projectlessThreadIds = new Set(
    visibility.projectlessThreadIds.map(safeText).filter(Boolean),
  );
  const projectThreads = threads;
  const threadsByProjectPath = new Map<string, CodexThread[]>();
  for (const projectPath of projectPaths) {
    threadsByProjectPath.set(projectPath, []);
  }
  for (const thread of projectThreads) {
    const cwd = safeText(thread.cwd);
    const isPinned = pinnedManagerThreadIds.has(thread.id);
    const isCeoThread = ceoThreadId === thread.id;
    const hasExplicitHeartbeat =
      heartbeatThreadIds.has(thread.id) ||
      (visibility.showAutomationThreadsAsHeartbeat &&
        isPersistentAutomationHeartbeatThread(thread));
    const hasHeartbeat = hasExplicitHeartbeat || isThreadStatusActive(thread);
    if (isInternalAuxiliaryThread(thread) && !isCeoThread && !isPinned && !hasExplicitHeartbeat) {
      continue;
    }
    const isVisible =
      isCeoThread ||
      isPinned ||
      isThreadRecentlyActive(thread, nowMs, activeThreadWindowMs) ||
      (visibility.alwaysShowHeartbeatThreads && hasHeartbeat);
    if (!isVisible) {
      continue;
    }
    const pinnedManagerProjectPath = pinnedManagerProjectPathByThreadId.get(thread.id);
    const pmProjectId = projectIdByPmThreadId.get(thread.id);
    const pmProjectPath = pmProjectId ? projectPathByProjectId.get(pmProjectId) : null;
    const matchedProjectPath =
      pinnedManagerProjectPath ??
      pmProjectPath ??
      (cwd &&
      !projectlessThreadIds.has(thread.id) &&
      !isMiscProjectPath(cwd, visibility.miscPathIncludes)
        ? findBestProjectPath(cwd, projectPaths)
        : null);
    const projectPath =
      matchedProjectPath && !isMiscProjectPath(matchedProjectPath, visibility.miscPathIncludes)
        ? matchedProjectPath
        : CODEX_MISC_PROJECT_PATH;
    threadsByProjectPath.set(projectPath, [
      ...(threadsByProjectPath.get(projectPath) ?? []),
      thread,
    ]);
  }
  const projectNameByPath = new Map<string, string>([
    [CODEX_MISC_PROJECT_PATH, visibility.miscProjectName],
  ]);
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
  const managerThreadIdsByProjectId = new Map<string, Set<string>>();
  for (const pin of managerPins) {
    const threadId = safeText(pin.threadId);
    if (!threadId) continue;
    const projectId =
      safeText(pin.projectId) ||
      (safeText(pin.projectPath)
        ? projectIdByPath.get(normalizePath(safeText(pin.projectPath)))
        : "") ||
      "";
    if (!projectId) continue;
    const current = managerThreadIdsByProjectId.get(projectId) ?? new Set<string>();
    current.add(threadId);
    managerThreadIdsByProjectId.set(projectId, current);
  }
  const visibleThreadAgents = new Map<
    string,
    { projectPath: string; thread: CodexThread; isManager: boolean; presenceExpiresAt?: number }
  >();
  for (const [projectPath, rows] of projectGroups) {
    const projectId = codexProjectId(projectPath);
    const managerThreadIds = managerThreadIdsByProjectId.get(projectId) ?? new Set<string>();
    const pmThreadIds = pmThreadIdsByProjectId.get(projectId) ?? new Set<string>();
    for (const thread of rows) {
      if (pmThreadIds.has(thread.id)) continue;
      const isManager = managerThreadIds.has(thread.id);
      const isCeoThread = ceoThreadId === thread.id;
      const hasExplicitHeartbeat =
        heartbeatThreadIds.has(thread.id) ||
        (visibility.showAutomationThreadsAsHeartbeat &&
          isPersistentAutomationHeartbeatThread(thread));
      const hasHeartbeat = hasExplicitHeartbeat || isThreadStatusActive(thread);
      if (
        isInternalAuxiliaryThread(thread) &&
        !isCeoThread &&
        !isManager &&
        !hasExplicitHeartbeat
      ) {
        continue;
      }
      if (
        !isCeoThread &&
        !isManager &&
        !isThreadRecentlyActive(thread, nowMs, activeThreadWindowMs) &&
        !(visibility.alwaysShowHeartbeatThreads && hasHeartbeat)
      ) {
        continue;
      }
      const activityUpdatedAt = threadActivityUpdatedAtMs(thread);
      const presenceExpiresAt =
        !isCeoThread && !isManager && !hasHeartbeat && activityUpdatedAt
          ? activityUpdatedAt + activeThreadWindowMs
          : undefined;
      visibleThreadAgents.set(thread.id, { projectPath, thread, isManager, presenceExpiresAt });
    }
  }
  const hasConfiguredCeoThread = Boolean(ceoThreadId);
  const hasVisibleCeoThread = Boolean(ceoThreadId && visibleThreadAgents.has(ceoThreadId));
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
      ...(hasConfiguredCeoThread
        ? []
        : [
            {
              agentId: CODEX_MAIN_AGENT_ID,
              role: "ceo" as const,
              heartbeatProfileId: "hb-codex-main",
              isCeo: true,
              lifecycleState: "active" as const,
            },
          ]),
      ...(hasConfiguredCeoThread && !hasVisibleCeoThread
        ? [
            {
              agentId: toThreadAgentId(ceoThreadId),
              role: "ceo" as const,
              heartbeatProfileId: "hb-codex-thread-ceo",
              isCeo: true,
              lifecycleState: "active" as const,
            },
          ]
        : []),
      ...projectGroups
        .map(([projectPath]) => {
          const projectId = codexProjectId(projectPath);
          const pm = projectPmByProjectId.get(projectId);
          if (!pm) return null;
          return {
            agentId: toCodexPmAgentId(projectId),
            role: "pm" as const,
            projectId,
            heartbeatProfileId: "hb-codex-project-pm",
            lifecycleState: "active" as const,
            runtimeMetadata: {
              codexProjectPm: {
                projectId,
                threadIds: normalizeCodexProjectPmThreadIds(pm.pm),
              },
            },
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
      ...[...visibleThreadAgents.values()].map(
        ({ projectPath, thread, isManager, presenceExpiresAt }) => ({
          agentId: toThreadAgentId(thread.id),
          role:
            hasVisibleCeoThread && thread.id === ceoThreadId
              ? ("ceo" as const)
              : isManager
                ? ("pm" as const)
                : ("builder" as const),
          projectId: codexProjectId(projectPath),
          heartbeatProfileId:
            hasVisibleCeoThread && thread.id === ceoThreadId
              ? "hb-codex-thread-ceo"
              : isManager
                ? "hb-codex-manager"
                : "hb-codex-thread",
          isCeo: hasVisibleCeoThread && thread.id === ceoThreadId,
          lifecycleState: "active" as const,
          presenceExpiresAt,
        }),
      ),
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
        id: "hb-codex-thread-ceo",
        role: "ceo",
        cadenceMinutes: 0,
        teamDescription: "Pinned Codex CEO thread",
        productDetails:
          "Long-running strategy thread that replaces the synthetic management table.",
        goal: "Keep office direction visible through the operator-selected CEO thread.",
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
        id: "hb-codex-project-pm",
        role: "pm",
        cadenceMinutes: 0,
        teamDescription: "Project PM thread group",
        productDetails:
          "Project-local farplane/pm.json groups isolated Codex chat and automation sessions under one PM.",
        goal: "Keep project PM sessions grouped while non-PM Codex threads can appear as workers.",
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
      notes:
        "Codex mode derives projects from thread cwd and employees from recently active threads.",
    },
  };
}

export function toCodexSessionRows(agentId: string, threads: CodexThread[]): SessionRowModel[] {
  const threadId = parseCodexThreadId(agentId);
  const rows =
    agentId === CODEX_MAIN_AGENT_ID ? threads : threads.filter((thread) => thread.id === threadId);
  return toCodexSessionRowsForThreads(agentId, rows);
}

export function toCodexProjectPmSessionRows(
  agentId: string,
  threads: CodexThread[],
  threadIds: string[],
): SessionRowModel[] {
  const wanted = new Set(threadIds.map(safeText).filter(Boolean));
  return toCodexSessionRowsForThreads(
    agentId,
    threads.filter((thread) => wanted.has(thread.id)),
  );
}

function toCodexSessionRowsForThreads(agentId: string, threads: CodexThread[]): SessionRowModel[] {
  return threads.map((thread) => ({
    agentId,
    sessionKey: toThreadAgentId(thread.id),
    sessionId: thread.sessionId,
    parentThreadId: inferredDelegationParentThreadId(thread),
    updatedAt: secondsToMs(thread.updatedAt),
    channel: "codex",
    peerLabel: threadTitle(thread),
    origin: safeText(thread.modelProvider) || "codex",
  }));
}

function itemText(item: CodexThreadItem): string {
  if (item.type === "userMessage") {
    return Array.isArray(item.content)
      ? item.content
          .map((part) => safeText(part.text))
          .filter(Boolean)
          .join("\n")
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
  if (
    item.type === "commandExecution" ||
    item.type === "mcpToolCall" ||
    item.type === "dynamicToolCall" ||
    item.type === "fileChange"
  ) {
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

function toTimelineEvent(
  item: CodexThreadItem,
  turn: CodexTurn,
  fallbackTs: number,
  index: number,
): SessionTimelineEvent {
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

export function toCodexTimeline(
  agentId: string,
  sessionKey: string,
  thread: CodexThread,
): SessionTimelineModel {
  const fallbackTs = secondsToMs(thread.updatedAt) ?? Date.now();
  const events = (thread.turns ?? [])
    .flatMap((turn) =>
      (turn.items ?? []).map((item, index) => toTimelineEvent(item, turn, fallbackTs, index)),
    )
    .filter((event) => event.text.trim().length > 0)
    .sort((a, b) => a.ts - b.ts);
  return {
    agentId,
    sessionKey,
    events,
  };
}

function hasRecentIdleUpdate(thread: CodexThread, nowMs = Date.now()): boolean {
  if (thread.status?.type !== "idle" && thread.status?.type !== "notLoaded") return false;
  if (hasRecentOpenTurn(thread, nowMs)) return false;
  const updatedAt = threadActivityUpdatedAtMs(thread);
  if (!updatedAt) return false;
  return nowMs - updatedAt <= RECENT_IDLE_UPDATE_READY_MS;
}

function statusState(
  thread: CodexThread,
  status: CodexThreadStatus | undefined,
  nowMs = Date.now(),
): AgentLiveStatus["state"] {
  if (!status) return "idle";
  if (status.type === "active") return "running";
  if (status.type === "systemError") return "error";
  if (hasRecentOpenTurn(thread, nowMs)) return "running";
  if (hasRecentIdleUpdate(thread, nowMs)) return "done";
  if (status.type === "idle") return "idle";
  return "idle";
}

function statusText(
  thread: CodexThread,
  status: CodexThreadStatus | undefined,
  nowMs = Date.now(),
): string {
  if (!status) return "Codex thread status unavailable.";
  if (status.type === "active") return "Codex turn running.";
  if (status.type === "systemError") return "Codex thread error.";
  if (hasRecentOpenTurn(thread, nowMs)) return "Codex turn running.";
  if (hasRecentIdleUpdate(thread, nowMs)) return "Codex response ready.";
  if (status.type === "notLoaded") return "Codex thread not loaded yet.";
  return "Codex thread idle.";
}

function activeFlagLabel(value: unknown): string {
  if (typeof value === "string") return safeText(value);
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  return (
    safeText(record.label) ||
    safeText(record.name) ||
    safeText(record.type) ||
    safeText(record.kind) ||
    ""
  );
}

function statusBubbles(
  thread: CodexThread,
  status: CodexThreadStatus | undefined,
  nowMs = Date.now(),
): AgentLiveStatus["bubbles"] {
  if (!status) return [];
  if (status.type === "active") {
    const flagBubbles = (status.activeFlags ?? [])
      .map(activeFlagLabel)
      .filter(Boolean)
      .slice(0, 2)
      .map((label, index) => ({
        id: `codex-active-flag-${index}-${slugify(label)}`,
        label,
        weight: 90 - index,
      }));
    return [{ id: "codex-thread-running", label: "Running", weight: 100 }, ...flagBubbles];
  }
  if (status.type === "systemError") {
    return [{ id: "codex-thread-error", label: "Error", weight: 100 }];
  }
  if (hasRecentOpenTurn(thread, nowMs)) {
    return [{ id: "codex-thread-running", label: "Running", weight: 100 }];
  }
  if (hasRecentIdleUpdate(thread, nowMs)) {
    return [{ id: "codex-thread-update-ready", label: "Update ready", weight: 100 }];
  }
  if (status.type === "notLoaded") {
    return [{ id: "codex-thread-not-loaded", label: "Not loaded", weight: 50 }];
  }
  return [];
}

export function toCodexLiveStatus(
  thread: CodexThread,
  options: { nowMs?: number } = {},
): AgentLiveStatus {
  const nowMs = options.nowMs ?? Date.now();
  const state = statusState(thread, thread.status, nowMs);
  return {
    agentId: toThreadAgentId(thread.id),
    sessionKey: toThreadAgentId(thread.id),
    state,
    statusText: statusText(thread, thread.status, nowMs),
    updatedAt: threadActivityUpdatedAtMs(thread),
    bubbles: statusBubbles(thread, thread.status, nowMs),
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
    return (
      status === "running" ||
      status === "in_progress" ||
      status === "inprogress" ||
      status === "active"
    );
  });
  return active?.id ?? null;
}
