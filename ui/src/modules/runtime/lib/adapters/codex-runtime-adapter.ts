"use client";

/**
 * CODEX RUNTIME ADAPTER
 * =====================
 * Default Farplane UI runtime for v0. It treats Codex as one flexible project
 * worker and keeps persistent agent customization disabled until the Codex
 * thread-map adapter exists.
 */

import {
  CODEX_MAIN_AGENT_ID,
  CODEX_PM_PREFIX,
  CODEX_THREAD_PREFIX,
  CodexAppServerClient,
  type CodexProjectReadModelResponse,
  type CodexThread,
  type CodexUiStateResponse,
  codexProjectId,
  findActiveTurnId,
  isCodexPmAgentId,
  normalizeCodexProjectPmThreadIds,
  parseCodexPmProjectId,
  parseCodexThreadId,
  projectPmDisplayName,
  toCodexAgentCards,
  toCodexCompanyModel,
  toCodexLiveStatus,
  toCodexMainLiveStatus,
  toCodexPmAgentId,
  toCodexProjectPmSessionRows,
  toCodexSessionRows,
  toCodexTimeline,
} from "../codex-app-server";
import type { GatewayWsClient } from "../gateway/ws-client";
import type {
  AgentCardModel,
  AgentIdentityResult,
  AgentLiveStatus,
  AgentsListResult,
  ChannelsStatusSnapshot,
  ChatSendRequest,
  CompanyModel,
  CronJob,
  CronStatus,
  OpenClawConfigSnapshot,
  SessionRowModel,
  SessionTimelineModel,
  ToolsCatalogResult,
  UnifiedOfficeModel,
} from "../openclaw";
import { OpenClawAdapter } from "../openclaw";
import type { RuntimeAdapterCapabilities } from "./contract";

function buildCodexWorkload(
  company: UnifiedOfficeModel["company"],
): UnifiedOfficeModel["workload"] {
  return company.projects.map((project) => {
    const tasks = company.tasks.filter((task) => task.projectId === project.id);
    const openTickets = tasks.filter((task) => task.status !== "done").length;
    const closedTickets = tasks.filter((task) => task.status === "done").length;
    const ratio = closedTickets === 0 ? openTickets : openTickets / closedTickets;
    return {
      projectId: project.id,
      openTickets,
      closedTickets,
      queuePressure:
        ratio > 2 ? ("high" as const) : ratio > 1 ? ("medium" as const) : ("low" as const),
    };
  });
}

export function mergeSavedTeamCharacterPolicies(
  projectedCompany: CompanyModel,
  savedCompany: CompanyModel | null,
): CompanyModel {
  const savedCharacterPolicyByProjectId = new Map(
    (savedCompany?.projects ?? [])
      .filter((project) => project.characterPolicy)
      .map((project) => [project.id, project.characterPolicy] as const),
  );
  return {
    ...projectedCompany,
    projects: projectedCompany.projects.map((project) => ({
      ...project,
      characterPolicy: savedCharacterPolicyByProjectId.get(project.id),
    })),
  };
}

const CODEX_CAPABILITIES: RuntimeAdapterCapabilities = {
  persistentAgents: false,
  agentConfigWrite: false,
  agentWorkspaceFiles: false,
  employeeSkillEquip: false,
  globalSkillBrowser: true,
  skillEvalRuns: true,
  harnessGraph: true,
  agentSkillRuntimeControls: false,
  toolPolicy: false,
  channels: false,
  scheduler: false,
  sessionMessaging: true,
  teamAgentProvisioning: false,
  threadListing: true,
  threadRead: true,
  promptSend: true,
  liveEvents: false,
};

const CODEX_BOOTSTRAP_RPC_TIMEOUT_MS = 1500;
// Thread listing can include Vite-side filesystem summary merging before employees are built.
const CODEX_THREAD_LIST_BOOTSTRAP_TIMEOUT_MS = 6000;
// Goal enrichment queries each listed app-server thread over one websocket session.
const CODEX_THREAD_GOAL_LIST_BOOTSTRAP_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, code: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(code)), timeoutMs);
  });
  void promise.catch(() => {
    // The raced request may fail after the UI has already fallen back.
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function codexProjectPathsFromConfig(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const config = (value as { config?: { projects?: unknown } }).config;
  const projects = config?.projects;
  if (!projects || typeof projects !== "object" || Array.isArray(projects)) return [];
  return Object.keys(projects).filter((projectPath) => projectPath.trim().length > 0);
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean),
    ),
  ];
}

function codexProjectPathsFromUiState(value: CodexUiStateResponse): string[] {
  return [
    ...new Set([
      ...normalizeStringList(value.pinnedProjectIds),
      ...normalizeStringList(value.projectOrder),
      ...normalizeStringList(value.savedWorkspaceRoots),
      ...normalizeStringList(value.activeWorkspaceRoots),
    ]),
  ];
}

function mergeCodexUiStateIntoReadModel(
  readModel: Awaited<ReturnType<CodexAppServerClient["readProjectModel"]>>,
  uiState: CodexUiStateResponse,
) {
  const projectlessThreadIds = [
    ...normalizeStringList(readModel.officeVisibility?.projectlessThreadIds),
    ...normalizeStringList(uiState.projectlessThreadIds),
  ];
  return {
    ...readModel,
    officeVisibility: {
      ...readModel.officeVisibility,
      heartbeatThreadIds: normalizeStringList(readModel.officeVisibility?.heartbeatThreadIds),
      projectlessThreadIds: [...new Set(projectlessThreadIds)],
    },
  };
}

function toCodexConfigSnapshot(
  threads: CodexThread[],
  projectPaths: string[] = [],
): OpenClawConfigSnapshot {
  const agents = toCodexAgentCards(threads);
  const company = toCodexCompanyModel(threads, Date.now(), projectPaths);
  return {
    stateVersion: Date.now(),
    config: {
      runtime: { kind: "codex", label: "Codex" },
      company,
      agents: {
        default: agents[0]?.agentId ?? CODEX_MAIN_AGENT_ID,
        mainKey: CODEX_MAIN_AGENT_ID,
        scope: "workspace",
        list: agents.map((agent) => ({
          id: agent.agentId,
          name: agent.displayName,
          workspacePath: agent.workspacePath,
          agentDir: agent.agentDir,
        })),
      },
    },
  };
}

function dedupeAgentsById(agents: AgentCardModel[]): AgentCardModel[] {
  const seen = new Set<string>();
  const deduped: AgentCardModel[] = [];
  for (const agent of agents) {
    if (seen.has(agent.agentId)) continue;
    seen.add(agent.agentId);
    deduped.push(agent);
  }
  return deduped;
}

function isObservedCodexAgentId(value: string): boolean {
  return value.startsWith("codex-observed:");
}

export class CodexRuntimeAdapter extends OpenClawAdapter {
  readonly runtimeKind = "codex" as const;
  readonly runtimeLabel = "Codex";
  readonly capabilities = CODEX_CAPABILITIES;
  private readonly codexClient: CodexAppServerClient;
  private threadsCache: {
    loadedAt: number;
    threads: CodexThread[];
    includesGoals: boolean;
  } | null = null;
  private projectPathsCache: { loadedAt: number; projectPaths: string[] } | null = null;
  private uiStateCache: { loadedAt: number; uiState: CodexUiStateResponse } | null = null;
  private healthCache: { loadedAt: number; available: boolean } | null = null;
  private healthInFlight: Promise<boolean> | null = null;
  private threadsInFlight: Promise<CodexThread[]> | null = null;
  private threadsWithGoalsInFlight: Promise<CodexThread[]> | null = null;
  private projectPathsInFlight: Promise<string[]> | null = null;
  private uiStateInFlight: Promise<CodexUiStateResponse> | null = null;

  constructor(gatewayUrl: string, stateUrl: string = gatewayUrl, _wsClient?: GatewayWsClient) {
    super(gatewayUrl, stateUrl);
    this.codexClient = new CodexAppServerClient({ stateUrl });
  }

  private async isCodexAppServerAvailable(options: { force?: boolean } = {}): Promise<boolean> {
    const now = Date.now();
    if (!options.force && this.healthCache && now - this.healthCache.loadedAt < 5000) {
      return this.healthCache.available;
    }
    if (!options.force && this.healthInFlight) return this.healthInFlight;
    const run = (async (): Promise<boolean> => {
      const health = await this.codexClient.readHealth();
      const available = health.ok === true && health.configured !== false;
      this.healthCache = { loadedAt: Date.now(), available };
      return available;
    })();
    this.healthInFlight = run;
    try {
      return await run;
    } finally {
      if (this.healthInFlight === run) this.healthInFlight = null;
    }
  }

  private async listCodexThreads(
    options: { force?: boolean; includeGoals?: boolean } = {},
  ): Promise<CodexThread[]> {
    const now = Date.now();
    if (
      !options.force &&
      this.threadsCache &&
      now - this.threadsCache.loadedAt < 5000 &&
      (!options.includeGoals || this.threadsCache.includesGoals)
    ) {
      return this.threadsCache.threads;
    }
    if (!options.force) {
      if (options.includeGoals && this.threadsWithGoalsInFlight) {
        return this.threadsWithGoalsInFlight;
      }
      if (!options.includeGoals && (this.threadsWithGoalsInFlight || this.threadsInFlight)) {
        const inFlight = this.threadsWithGoalsInFlight ?? this.threadsInFlight;
        if (inFlight) return inFlight;
      }
    }
    const run = (async (): Promise<CodexThread[]> => {
      if (!(await this.isCodexAppServerAvailable(options))) {
        this.threadsCache = { loadedAt: Date.now(), threads: [], includesGoals: false };
        return [];
      }
      const response = await withTimeout(
        options.includeGoals
          ? this.codexClient.listThreadsWithGoals(80).catch(() => this.codexClient.listThreads(80))
          : this.codexClient.listThreads(80),
        options.includeGoals
          ? CODEX_THREAD_GOAL_LIST_BOOTSTRAP_TIMEOUT_MS
          : CODEX_THREAD_LIST_BOOTSTRAP_TIMEOUT_MS,
        "codex_thread_list_bootstrap_timeout",
      );
      const threads = Array.isArray(response.data)
        ? response.data.filter((thread) => thread.id)
        : [];
      const nextCache = {
        loadedAt: Date.now(),
        threads,
        includesGoals: options.includeGoals === true && threads.some((thread) => "goal" in thread),
      };
      if (nextCache.includesGoals || !this.threadsCache?.includesGoals) {
        this.threadsCache = nextCache;
      }
      return threads;
    })();
    if (options.includeGoals) this.threadsWithGoalsInFlight = run;
    else this.threadsInFlight = run;
    try {
      return await run;
    } finally {
      if (this.threadsWithGoalsInFlight === run) this.threadsWithGoalsInFlight = null;
      if (this.threadsInFlight === run) this.threadsInFlight = null;
    }
  }

  private async listCodexProjectPaths(options: { force?: boolean } = {}): Promise<string[]> {
    const now = Date.now();
    if (!options.force && this.projectPathsCache && now - this.projectPathsCache.loadedAt < 30000) {
      return this.projectPathsCache.projectPaths;
    }
    if (!options.force && this.projectPathsInFlight) return this.projectPathsInFlight;
    const run = (async (): Promise<string[]> => {
      const uiState = await this.readCodexUiState(options).catch(() => null);
      const projectPathsFromUiState = uiState ? codexProjectPathsFromUiState(uiState) : [];
      const projectPaths =
        projectPathsFromUiState.length > 0 || !(await this.isCodexAppServerAvailable(options))
          ? projectPathsFromUiState
          : codexProjectPathsFromConfig(
              await withTimeout(
                this.codexClient.readConfig(),
                CODEX_BOOTSTRAP_RPC_TIMEOUT_MS,
                "codex_config_read_bootstrap_timeout",
              ),
            );
      this.projectPathsCache = { loadedAt: Date.now(), projectPaths };
      return projectPaths;
    })();
    this.projectPathsInFlight = run;
    try {
      return await run;
    } finally {
      if (this.projectPathsInFlight === run) this.projectPathsInFlight = null;
    }
  }

  private async readCodexUiState(options: { force?: boolean } = {}): Promise<CodexUiStateResponse> {
    const now = Date.now();
    if (!options.force && this.uiStateCache && now - this.uiStateCache.loadedAt < 30000) {
      return this.uiStateCache.uiState;
    }
    if (!options.force && this.uiStateInFlight) return this.uiStateInFlight;
    const run = (async (): Promise<CodexUiStateResponse> => {
      const uiState = await this.codexClient.readUiState();
      this.uiStateCache = { loadedAt: Date.now(), uiState };
      return uiState;
    })();
    this.uiStateInFlight = run;
    try {
      return await run;
    } finally {
      if (this.uiStateInFlight === run) this.uiStateInFlight = null;
    }
  }

  async listAgents(): Promise<AgentCardModel[]> {
    try {
      const agents = toCodexAgentCards(await this.listCodexThreads());
      if (agents.length > 0) return agents;
    } catch {
      // Codex mode can still render the local office shell before app-server is configured.
    }
    return toCodexAgentCards([]);
  }

  async getConfigSnapshot(): Promise<OpenClawConfigSnapshot> {
    try {
      const [threads, projectPaths] = await Promise.all([
        this.listCodexThreads(),
        this.listCodexProjectPaths().catch(() => []),
      ]);
      return toCodexConfigSnapshot(threads, projectPaths);
    } catch {
      return toCodexConfigSnapshot([]);
    }
  }

  async getAgentsList(): Promise<AgentsListResult> {
    const agents = await this.listAgents();
    return {
      defaultId: agents[0]?.agentId ?? CODEX_MAIN_AGENT_ID,
      mainKey: CODEX_MAIN_AGENT_ID,
      scope: "codex",
      agents: agents.map((agent) => ({
        id: agent.agentId,
        name: agent.displayName,
        identity: { name: agent.displayName, emoji: "C" },
      })),
    };
  }

  async getAgentIdentity(agentId: string): Promise<AgentIdentityResult | null> {
    const agent = (await this.listAgents()).find((entry) => entry.agentId === agentId);
    return {
      agentId,
      name: agent?.displayName ?? agentId,
      avatar: "",
      emoji: "C",
    };
  }

  async getToolsCatalog(agentId: string): Promise<ToolsCatalogResult | null> {
    return {
      agentId,
      profiles: [],
      groups: [],
    };
  }

  async getChannelsStatus(): Promise<ChannelsStatusSnapshot | null> {
    return {
      ts: Date.now(),
      channelOrder: [],
      channelLabels: {},
      channels: {},
      channelAccounts: {},
      channelDefaultAccountId: {},
    };
  }

  async getCronStatus(): Promise<CronStatus | null> {
    return { enabled: false, jobs: 0 };
  }

  async listCronJobs(): Promise<CronJob[]> {
    return [];
  }

  async getUnifiedOfficeModel(): Promise<UnifiedOfficeModel> {
    const [threads, projectPaths, officeObjects, uiState, savedCompany] = await Promise.all([
      this.listCodexThreads({ includeGoals: true }).catch(() => []),
      this.listCodexProjectPaths().catch(() => []),
      this.getOfficeObjects().catch(() => []),
      this.readCodexUiState().catch(() => ({})),
      super.getCompanyModel().catch(() => null),
    ]);
    const projectRefs = projectPaths.map((projectPath) => ({
      projectId: codexProjectId(projectPath),
      projectPath,
    }));
    const readModel = mergeCodexUiStateIntoReadModel(
      await this.codexClient.readProjectModel(projectRefs).catch(() => ({})),
      uiState,
    );
    const projectedCompany = toCodexCompanyModel(threads, Date.now(), projectPaths, readModel);
    const company = mergeSavedTeamCharacterPolicies(projectedCompany, savedCompany);
    const projectPmNameByAgentId = new Map(
      (readModel.projectPms ?? []).map((entry) => [
        toCodexPmAgentId(entry.projectId),
        projectPmDisplayName(entry.projectPath, entry.pm),
      ]),
    );
    const configuredCeoThreadId = String(readModel.officeVisibility?.ceoThreadId ?? "").trim();
    const configuredCeoAgentId = configuredCeoThreadId
      ? `${CODEX_THREAD_PREFIX}${configuredCeoThreadId}`
      : "";
    const officeAgentIds = new Set(company.agents.map((agent) => agent.agentId));
    const threadAgentIds = new Set(threads.map((thread) => `${CODEX_THREAD_PREFIX}${thread.id}`));
    const runtimeAgents = dedupeAgentsById(
      [
        ...toCodexAgentCards([]),
        ...toCodexAgentCards(threads),
        ...company.agents
          .filter(
            (agent) =>
              agent.agentId.startsWith(CODEX_PM_PREFIX) ||
              (agent.agentId.startsWith("codex-thread:") && !threadAgentIds.has(agent.agentId)),
          )
          .map((agent) => ({
            agentId: agent.agentId,
            displayName: agent.agentId.startsWith(CODEX_PM_PREFIX)
              ? (projectPmNameByAgentId.get(agent.agentId) ?? "Project PM")
              : agent.agentId === configuredCeoAgentId
                ? "Pinned CEO"
                : agent.agentId,
            workspacePath: "~/.codex",
            agentDir: "~/.codex",
            sandboxMode: "codex",
            toolPolicy: { allow: [], deny: [] },
            sessionCount: 0,
            runtimeMetadata: agent.runtimeMetadata,
          })),
      ].filter((agent) => officeAgentIds.has(agent.agentId)),
    );
    return {
      company,
      runtimeAgents,
      configuredAgents: runtimeAgents,
      officeObjects,
      memory: [],
      skills: [],
      warnings: [],
      workload: buildCodexWorkload(company),
      diagnostics: {
        configAgentCount: runtimeAgents.length,
        runtimeAgentCount: runtimeAgents.length,
        sidecarAgentCount: company.agents.length,
        missingRuntimeAgentIds: [],
        unmappedRuntimeAgentIds: [],
        invalidOfficeObjects: [],
        duplicateOfficeObjectIds: [],
        officeObjectCount: officeObjects.length,
        clampedClusterCount: 0,
        outOfBoundsClusterObjectIds: [],
        ceoAnchorMode: "fallback",
        source: "codex",
      },
    };
  }

  async getAgentsLiveStatus(agentIds: string[]): Promise<Record<string, AgentLiveStatus>> {
    try {
      const threads = await this.listCodexThreads();
      const byThreadId = new Map(threads.map((thread) => [thread.id, thread]));
      const uniqueAgentIds = [...new Set(agentIds.map((entry) => entry.trim()).filter(Boolean))];
      const hydratedThreads = await Promise.all(
        uniqueAgentIds.map(async (agentId) => {
          if (agentId === CODEX_MAIN_AGENT_ID) return null;
          const threadId = parseCodexThreadId(agentId);
          const thread = byThreadId.get(threadId);
          if (!thread || thread.status?.type !== "notLoaded") return null;
          const response = await withTimeout(
            this.codexClient.readThread(threadId),
            CODEX_BOOTSTRAP_RPC_TIMEOUT_MS,
            "codex_thread_read_status_timeout",
          ).catch(() => null);
          return response?.thread ? ([threadId, response.thread] as const) : null;
        }),
      );
      for (const hydrated of hydratedThreads) {
        if (hydrated) byThreadId.set(hydrated[0], hydrated[1]);
      }
      return Object.fromEntries(
        uniqueAgentIds.map((agentId) => {
          if (agentId === CODEX_MAIN_AGENT_ID) return [agentId, toCodexMainLiveStatus()] as const;
          if (isCodexPmAgentId(agentId)) {
            return [agentId, { ...toCodexMainLiveStatus(), agentId }] as const;
          }
          const thread = byThreadId.get(parseCodexThreadId(agentId));
          return [agentId, thread ? toCodexLiveStatus(thread) : toCodexMainLiveStatus()] as const;
        }),
      );
    } catch {
      return Object.fromEntries(
        [...new Set(agentIds.map((entry) => entry.trim()).filter(Boolean))].map((agentId) => [
          agentId,
          { ...toCodexMainLiveStatus(), agentId },
        ]),
      );
    }
  }

  async listSessions(agentId: string): Promise<SessionRowModel[]> {
    if (isObservedCodexAgentId(agentId)) return [];
    try {
      const threads = await this.listCodexThreads();
      if (!isCodexPmAgentId(agentId)) return toCodexSessionRows(agentId, threads);
      const projectId = parseCodexPmProjectId(agentId);
      const projectPaths = await this.listCodexProjectPaths().catch(() => []);
      const projectRefs = projectPaths.map((projectPath) => ({
        projectId: codexProjectId(projectPath),
        projectPath,
      }));
      const readModel: CodexProjectReadModelResponse = await this.codexClient
        .readProjectModel(projectRefs)
        .catch(() => ({}));
      const pm = (readModel.projectPms ?? []).find((entry) => entry.projectId === projectId)?.pm;
      return toCodexProjectPmSessionRows(agentId, threads, normalizeCodexProjectPmThreadIds(pm));
    } catch {
      return [];
    }
  }

  async getSessionTimeline(
    agentId: string,
    sessionKey: string,
    limit = 200,
  ): Promise<SessionTimelineModel> {
    if (isObservedCodexAgentId(agentId) || isObservedCodexAgentId(sessionKey)) {
      return { agentId, sessionKey, events: [] };
    }
    const threadId = parseCodexThreadId(sessionKey || agentId);
    if (!(await this.isCodexAppServerAvailable())) {
      return { agentId, sessionKey, events: [] };
    }
    const response = await this.codexClient.readThread(threadId);
    const thread = response.thread;
    if (!thread) {
      return { agentId, sessionKey, events: [] };
    }
    return toCodexTimeline(agentId, sessionKey, {
      ...thread,
      turns: (thread.turns ?? []).slice(-Math.max(1, limit)),
    });
  }

  async sendMessage(
    input: ChatSendRequest,
  ): Promise<{ ok: boolean; eventId?: string; error?: string }> {
    if (isObservedCodexAgentId(input.agentId) || isObservedCodexAgentId(input.sessionKey)) {
      return { ok: false, error: "codex_observed_worker_read_only" };
    }
    const message = input.message.trim();
    if (!message) return { ok: false, error: "codex_message_empty" };
    try {
      if (!(await this.isCodexAppServerAvailable({ force: true }))) {
        return { ok: false, error: "codex_app_server_unavailable" };
      }
      let threadId = parseCodexThreadId(input.sessionKey || input.agentId);
      if (!threadId || threadId === CODEX_MAIN_AGENT_ID) {
        const started = await this.codexClient.startThread();
        threadId = started.thread?.id ?? "";
      }
      if (!threadId) return { ok: false, error: "codex_thread_missing" };

      const current = await this.codexClient.readThread(threadId).catch(() => null);
      const activeTurnId = current?.thread ? findActiveTurnId(current.thread) : null;
      const result = activeTurnId
        ? await this.codexClient.steerTurn(threadId, activeTurnId, message)
        : await this.codexClient.startTurn(threadId, message);
      this.threadsCache = null;
      return { ok: true, eventId: result.turn?.id };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "codex_send_failed",
      };
    }
  }
}
