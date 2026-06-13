"use client";

/**
 * CODEX RUNTIME ADAPTER
 * =====================
 * Default Farplane UI runtime for v0. It treats Codex as one flexible project
 * worker and keeps persistent agent customization disabled until the Codex
 * thread-map adapter exists.
 */

import { OpenClawAdapter } from "../openclaw";
import {
  CODEX_MAIN_AGENT_ID,
  CodexAppServerClient,
  codexProjectId,
  findActiveTurnId,
  parseCodexThreadId,
  toCodexAgentCards,
  toCodexCompanyModel,
  toCodexLiveStatus,
  toCodexMainLiveStatus,
  toCodexSessionRows,
  toCodexTimeline,
  type CodexThread,
  type CodexUiStateResponse,
} from "../codex-app-server";
import type {
  AgentCardModel,
  AgentLiveStatus,
  AgentIdentityResult,
  AgentsListResult,
  ChatSendRequest,
  ChannelsStatusSnapshot,
  CronJob,
  CronStatus,
  OpenClawConfigSnapshot,
  SessionRowModel,
  SessionTimelineModel,
  ToolsCatalogResult,
  UnifiedOfficeModel,
} from "../openclaw";
import type { GatewayWsClient } from "../gateway/ws-client";
import type { RuntimeAdapterCapabilities } from "./contract";

function buildCodexWorkload(company: UnifiedOfficeModel["company"]): UnifiedOfficeModel["workload"] {
  return company.projects.map((project) => {
    const tasks = company.tasks.filter((task) => task.projectId === project.id);
    const openTickets = tasks.filter((task) => task.status !== "done").length;
    const closedTickets = tasks.filter((task) => task.status === "done").length;
    const ratio = closedTickets === 0 ? openTickets : openTickets / closedTickets;
    return {
      projectId: project.id,
      openTickets,
      closedTickets,
      queuePressure: ratio > 2 ? ("high" as const) : ratio > 1 ? ("medium" as const) : ("low" as const),
    };
  });
}

const CODEX_CAPABILITIES: RuntimeAdapterCapabilities = {
  persistentAgents: false,
  agentConfigWrite: false,
  agentWorkspaceFiles: false,
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

function codexProjectPathsFromConfig(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const config = (value as { config?: { projects?: unknown } }).config;
  const projects = config?.projects;
  if (!projects || typeof projects !== "object" || Array.isArray(projects)) return [];
  return Object.keys(projects).filter((projectPath) => projectPath.trim().length > 0);
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean))];
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
  const heartbeatThreadIds = [
    ...normalizeStringList(readModel.officeVisibility?.heartbeatThreadIds),
    ...normalizeStringList(uiState.pinnedThreadIds),
  ];
  const projectlessThreadIds = [
    ...normalizeStringList(readModel.officeVisibility?.projectlessThreadIds),
    ...normalizeStringList(uiState.projectlessThreadIds),
  ];
  return {
    ...readModel,
    officeVisibility: {
      ...readModel.officeVisibility,
      heartbeatThreadIds: [...new Set(heartbeatThreadIds)],
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

export class CodexRuntimeAdapter extends OpenClawAdapter {
  readonly runtimeKind = "codex" as const;
  readonly runtimeLabel = "Codex";
  readonly capabilities = CODEX_CAPABILITIES;
  private readonly codexClient: CodexAppServerClient;
  private threadsCache: { loadedAt: number; threads: CodexThread[] } | null = null;
  private projectPathsCache: { loadedAt: number; projectPaths: string[] } | null = null;
  private uiStateCache: { loadedAt: number; uiState: CodexUiStateResponse } | null = null;
  private healthCache: { loadedAt: number; available: boolean } | null = null;

  constructor(gatewayUrl: string, stateUrl: string = gatewayUrl, _wsClient?: GatewayWsClient) {
    super(gatewayUrl, stateUrl);
    this.codexClient = new CodexAppServerClient({ stateUrl });
  }

  private async isCodexAppServerAvailable(options: { force?: boolean } = {}): Promise<boolean> {
    const now = Date.now();
    if (!options.force && this.healthCache && now - this.healthCache.loadedAt < 5000) {
      return this.healthCache.available;
    }
    const health = await this.codexClient.readHealth();
    const available = health.ok === true && health.configured !== false;
    this.healthCache = { loadedAt: now, available };
    return available;
  }

  private async listCodexThreads(options: { force?: boolean } = {}): Promise<CodexThread[]> {
    const now = Date.now();
    if (!options.force && this.threadsCache && now - this.threadsCache.loadedAt < 5000) {
      return this.threadsCache.threads;
    }
    if (!(await this.isCodexAppServerAvailable(options))) {
      this.threadsCache = { loadedAt: now, threads: [] };
      return [];
    }
    const response = await this.codexClient.listThreads(80);
    const threads = Array.isArray(response.data) ? response.data.filter((thread) => thread.id) : [];
    this.threadsCache = { loadedAt: now, threads };
    return threads;
  }

  private async listCodexProjectPaths(options: { force?: boolean } = {}): Promise<string[]> {
    const now = Date.now();
    if (
      !options.force &&
      this.projectPathsCache &&
      now - this.projectPathsCache.loadedAt < 30000
    ) {
      return this.projectPathsCache.projectPaths;
    }
    const uiState = await this.readCodexUiState(options).catch(() => null);
    const projectPathsFromUiState = uiState ? codexProjectPathsFromUiState(uiState) : [];
    const projectPaths =
      projectPathsFromUiState.length > 0 || !(await this.isCodexAppServerAvailable(options))
        ? projectPathsFromUiState
        : codexProjectPathsFromConfig(await this.codexClient.readConfig());
    this.projectPathsCache = { loadedAt: now, projectPaths };
    return projectPaths;
  }

  private async readCodexUiState(options: { force?: boolean } = {}): Promise<CodexUiStateResponse> {
    const now = Date.now();
    if (!options.force && this.uiStateCache && now - this.uiStateCache.loadedAt < 30000) {
      return this.uiStateCache.uiState;
    }
    const uiState = await this.codexClient.readUiState();
    this.uiStateCache = { loadedAt: now, uiState };
    return uiState;
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
    const [threads, projectPaths, officeObjects, uiState] = await Promise.all([
      this.listCodexThreads().catch(() => []),
      this.listCodexProjectPaths().catch(() => []),
      this.getOfficeObjects().catch(() => []),
      this.readCodexUiState().catch(() => ({})),
    ]);
    const projectRefs = projectPaths.map((projectPath) => ({
      projectId: codexProjectId(projectPath),
      projectPath,
    }));
    const readModel = mergeCodexUiStateIntoReadModel(
      await this.codexClient.readProjectModel(projectRefs).catch(() => ({})),
      uiState,
    );
    const company = toCodexCompanyModel(threads, Date.now(), projectPaths, readModel);
    const officeAgentIds = new Set(company.agents.map((agent) => agent.agentId));
    const runtimeAgents = dedupeAgentsById(
      [...toCodexAgentCards([]), ...toCodexAgentCards(threads)].filter((agent) =>
        officeAgentIds.has(agent.agentId),
      ),
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
          const response = await this.codexClient.readThread(threadId).catch(() => null);
          return response?.thread ? ([threadId, response.thread] as const) : null;
        }),
      );
      for (const hydrated of hydratedThreads) {
        if (hydrated) byThreadId.set(hydrated[0], hydrated[1]);
      }
      return Object.fromEntries(
        uniqueAgentIds.map((agentId) => {
          if (agentId === CODEX_MAIN_AGENT_ID) return [agentId, toCodexMainLiveStatus()] as const;
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
    try {
      return toCodexSessionRows(agentId, await this.listCodexThreads());
    } catch {
      return [];
    }
  }

  async getSessionTimeline(
    agentId: string,
    sessionKey: string,
    limit = 200,
  ): Promise<SessionTimelineModel> {
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
