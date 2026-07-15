/**
 * OFFICE DATA REFRESH HELPERS
 * ===========================
 * Pure helpers for provider refresh signatures, live-status merging, observed
 * Codex workers, and placement-repair persistence decisions.
 *
 * Inputs/outputs stay in runtime/provider model types; side effects are limited
 * to the explicit persistence helper.
 */

import type {
  AgentLiveStatus,
  CompanyModel,
  OfficeRuntimeAdapter,
  OfficeSettingsModel,
  PendingApprovalModel,
  UnifiedOfficeModel,
} from "@/modules/runtime";
import {
  LOCAL_OBSERVED_CODEX_DISCOVERY_RANGE_MS,
  type ObservedCodexWorkerRow,
  observedCodexTitlePriority,
} from "@/providers/local-observed-codex-workers";

type OfficeStructuralSignatureInput = {
  unified: UnifiedOfficeModel;
  officeSettings: OfficeSettingsModel;
  pendingApprovals: PendingApprovalModel[];
  configSnapshot: unknown;
  observedWorkers: ObservedCodexWorkerRow[];
};

type PlacementRepairPersistenceInput = {
  adapter: Pick<OfficeRuntimeAdapter, "saveOfficeObjects" | "saveOfficeSettings">;
  changed: boolean;
  expandedLayout: boolean;
  officeObjects: UnifiedOfficeModel["officeObjects"];
  officeSettings: OfficeSettingsModel;
  readOnly: boolean;
};

type PlacementRepairPersistenceResult =
  | {
      skipped: true;
    }
  | {
      skipped: false;
      objectsResult: Awaited<ReturnType<OfficeRuntimeAdapter["saveOfficeObjects"]>>;
      settingsResult: Awaited<ReturnType<OfficeRuntimeAdapter["saveOfficeSettings"]>>;
    };

export const OBSERVED_CODEX_PRESENCE_RANGE_MS = LOCAL_OBSERVED_CODEX_DISCOVERY_RANGE_MS;

function isCodexAgentId(agentId: string): boolean {
  return agentId === "codex-main" || agentId.startsWith("codex-thread:");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (!value || typeof value !== "object") {
    return JSON.stringify(value);
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([left], [right]) => left.localeCompare(right),
  );
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
    .join(",")}}`;
}

const VOLATILE_STRUCTURAL_KEYS = new Set([
  "stateVersion",
  "updatedAt",
  "lastUpdatedAt",
  "lastSeenAt",
  "presenceExpiresAt",
  "statusText",
  "status",
  "state",
  "sessionCount",
  "heartbeatAt",
  "observedAt",
]);

function structuralConfigSnapshot(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(structuralConfigSnapshot);
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const snapshot = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(snapshot)
      .filter(([key]) => !VOLATILE_STRUCTURAL_KEYS.has(key))
      .map(([key, entry]) => [key, structuralConfigSnapshot(entry)]),
  );
}

function structuralRuntimeMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(structuralRuntimeMetadata);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !VOLATILE_STRUCTURAL_KEYS.has(key))
      .map(([key, entry]) => [key, structuralRuntimeMetadata(entry)]),
  );
}

function structuralOfficeSettings(settings: OfficeSettingsModel): unknown {
  return {
    ...settings,
    layoutStrategy: settings.layoutStrategy ?? "team_neighborhoods",
    officeLayout: {
      ...settings.officeLayout,
      tiles: [...settings.officeLayout.tiles].sort(),
    },
  };
}

function observedWorkerStructuralKey(worker: ObservedCodexWorkerRow): string {
  return [
    worker.workerId,
    worker.sourceInstanceId,
    worker.machineId ?? "",
    worker.machineName ?? "",
    worker.sessionKey,
    worker.threadId ?? "",
    worker.projectId,
    worker.projectPath ?? "",
    worker.displayName,
    worker.parentThreadId ?? "",
  ].join("|");
}

export function buildOfficeStructuralRefreshSignature(
  input: OfficeStructuralSignatureInput,
): string {
  return stableJson({
    company: {
      departments: input.unified.company.departments,
      projects: input.unified.company.projects,
      agents: input.unified.company.agents.map((agent) => ({
        agentId: agent.agentId,
        role: agent.role,
        projectId: agent.projectId,
        heartbeatProfileId: agent.heartbeatProfileId,
        isCeo: agent.isCeo,
        lifecycleState: agent.lifecycleState,
        runtimeMetadata: structuralRuntimeMetadata(agent.runtimeMetadata),
      })),
      roleSlots: input.unified.company.roleSlots,
      tasks: input.unified.company.tasks,
      federationPolicies: input.unified.company.federationPolicies,
      providerIndexProfiles: input.unified.company.providerIndexProfiles,
      heartbeatProfiles: input.unified.company.heartbeatProfiles,
      channelBindings: input.unified.company.channelBindings,
      heartbeatRuntime: input.unified.company.heartbeatRuntime,
    },
    runtimeAgents: input.unified.runtimeAgents.map((agent) => ({
      agentId: agent.agentId,
      displayName: agent.displayName,
      workspacePath: agent.workspacePath,
      agentDir: agent.agentDir,
      sandboxMode: agent.sandboxMode,
      toolPolicy: agent.toolPolicy,
      runtimeMetadata: structuralRuntimeMetadata(agent.runtimeMetadata),
    })),
    configuredAgents: input.unified.configuredAgents.map((agent) => ({
      agentId: agent.agentId,
      displayName: agent.displayName,
      workspacePath: agent.workspacePath,
      agentDir: agent.agentDir,
      sandboxMode: agent.sandboxMode,
      toolPolicy: agent.toolPolicy,
      runtimeMetadata: structuralRuntimeMetadata(agent.runtimeMetadata),
    })),
    officeObjects: input.unified.officeObjects,
    workload: input.unified.workload,
    warnings: input.unified.warnings,
    officeSettings: structuralOfficeSettings(input.officeSettings),
    pendingApprovals: input.pendingApprovals,
    configSnapshot: structuralConfigSnapshot(input.configSnapshot),
    observedWorkers: input.observedWorkers.map(observedWorkerStructuralKey).sort(),
  });
}

export function buildAgentLiveStatusSignature(
  statuses: Record<string, AgentLiveStatus>,
): string {
  return stableJson(statuses);
}

export function mergeObservedCodexWorkerRows(
  rows: ObservedCodexWorkerRow[],
): ObservedCodexWorkerRow[] {
  const byWorkerId = new Map<string, ObservedCodexWorkerRow>();
  for (const row of rows) {
    const current = byWorkerId.get(row.workerId);
    if (!current) {
      byWorkerId.set(row.workerId, row);
      continue;
    }
    const newest = current.lastSeenAt <= row.lastSeenAt ? row : current;
    const currentTitlePriority = observedCodexTitlePriority(current.titleSource);
    const rowTitlePriority = observedCodexTitlePriority(row.titleSource);
    const preferredTitle =
      rowTitlePriority > currentTitlePriority ||
      (rowTitlePriority === currentTitlePriority && current.lastSeenAt <= row.lastSeenAt)
        ? row
        : current;
    byWorkerId.set(row.workerId, {
      ...newest,
      displayName: preferredTitle.displayName,
      titleSource: preferredTitle.titleSource,
    });
  }
  return [...byWorkerId.values()].sort(
    (left, right) =>
      right.lastSeenAt - left.lastSeenAt || left.workerId.localeCompare(right.workerId),
  );
}

function overlayConvexLiveStatus(
  adapterStatus: AgentLiveStatus,
  convexStatus?: AgentLiveStatus,
): AgentLiveStatus {
  if (!convexStatus?.bubbleMessages?.length && !convexStatus?.officeTravelIntent) {
    return adapterStatus;
  }
  return {
    ...adapterStatus,
    statusText: adapterStatus.statusText,
    updatedAt:
      Math.max(adapterStatus.updatedAt ?? 0, convexStatus.updatedAt ?? 0) ||
      adapterStatus.updatedAt,
    bubbles: convexStatus.bubbles.length > 0 ? convexStatus.bubbles : adapterStatus.bubbles,
    currentSkillId: convexStatus.currentSkillId ?? adapterStatus.currentSkillId,
    bubbleMessages: convexStatus.bubbleMessages,
    officeTravelIntent: convexStatus.officeTravelIntent,
  };
}

export async function persistPlacementRepairIfAllowed(
  input: PlacementRepairPersistenceInput,
): Promise<PlacementRepairPersistenceResult> {
  if (!input.changed || input.readOnly) {
    return { skipped: true };
  }

  const currentObjects = await input.adapter.getOfficeObjects();
  const repairedIds = new Set(input.officeObjects.map((object) => object.id));
  const nonClusterObjectsMissingFromProjection = currentObjects.filter(
    (object) => object.meshType !== "team-cluster" && !repairedIds.has(object.id),
  );
  const repairedObjects = [...input.officeObjects, ...nonClusterObjectsMissingFromProjection];
  const [objectsResult, settingsResult] = await Promise.all([
    input.adapter.saveOfficeObjects(repairedObjects),
    !input.expandedLayout
      ? Promise.resolve<Awaited<ReturnType<OfficeRuntimeAdapter["saveOfficeSettings"]>>>({
          ok: true,
          settings: input.officeSettings,
        })
      : input.adapter.saveOfficeSettings(input.officeSettings),
  ]);

  return {
    skipped: false,
    objectsResult,
    settingsResult,
  };
}

export function mergeAgentLiveStatuses(input: {
  agentIds: string[];
  adapterStatuses?: Record<string, AgentLiveStatus>;
  convexStatuses?: Record<string, AgentLiveStatus>;
  observedStatuses?: Record<string, AgentLiveStatus>;
  runtimeKind?: string;
}): Record<string, AgentLiveStatus> {
  const adapterStatuses = input.adapterStatuses ?? {};
  const convexStatuses = input.convexStatuses ?? {};
  const observedStatuses = input.observedStatuses ?? {};
  const merged: Record<string, AgentLiveStatus> = {
    ...observedStatuses,
    ...convexStatuses,
  };

  if (input.runtimeKind === "codex") {
    for (const agentId of input.agentIds) {
      if (!isCodexAgentId(agentId)) continue;
      const adapterStatus = adapterStatuses[agentId];
      if (adapterStatus)
        merged[agentId] = overlayConvexLiveStatus(adapterStatus, convexStatuses[agentId]);
    }
    return merged;
  }

  if (Object.keys(merged).length > 0) return merged;
  return adapterStatuses;
}

function projectNameFromObservedWorker(worker: ObservedCodexWorkerRow): string {
  const path = worker.projectPath?.trim();
  if (path) return path.split("/").filter(Boolean).at(-1) ?? path;
  return worker.projectId.replace(/^codex-proj-/, "").replace(/[-_]+/g, " ") || "Observed Codex";
}

function createObservedCodexProject(
  worker: ObservedCodexWorkerRow,
): CompanyModel["projects"][number] {
  return {
    id: worker.projectId,
    departmentId: "dept-codex",
    name: projectNameFromObservedWorker(worker),
    githubUrl: "",
    status: "active",
    goal: "Telemetry-observed Codex work",
    kpis: [],
    accountEvents: [],
    ledger: [],
    experiments: [],
    metricEvents: [],
    resources: [],
    resourceEvents: [],
  };
}

function observedCodexMetadata(worker: ObservedCodexWorkerRow) {
  return {
    observedCodex: {
      sourceInstanceId: worker.sourceInstanceId,
      machineId: worker.machineId,
      machineName: worker.machineName,
      projectId: worker.projectId,
      sessionKey: worker.sessionKey,
      threadId: worker.threadId,
      parentThreadId: worker.parentThreadId,
      controllable: false as const,
    },
  };
}

function codexProjectPmThreadIds(row: {
  runtimeMetadata?: { codexProjectPm?: { threadIds?: string[] } };
}): string[] {
  return row.runtimeMetadata?.codexProjectPm?.threadIds ?? [];
}

export function observedCodexWorkersToLiveStatuses(
  workers: ObservedCodexWorkerRow[],
): Record<string, AgentLiveStatus> {
  return Object.fromEntries(
    workers.map((worker) => [
      worker.workerId,
      {
        agentId: worker.workerId,
        sessionKey: worker.sessionKey,
        state: worker.state === "done" ? "done" : worker.state === "running" ? "running" : "idle",
        statusText: worker.statusText,
        updatedAt: worker.lastSeenAt,
        currentSkillId: worker.currentSkillId,
        bubbles: [
          {
            id: `observed:${worker.workerId}:${worker.lastSeenAt}`,
            label: worker.statusText,
            weight: worker.state === "running" ? 100 : 60,
          },
        ],
        bubbleMessages: worker.threadId
          ? [
              {
                threadId: worker.threadId,
                message: worker.statusText,
                eventAt: worker.lastSeenAt,
              },
            ]
          : undefined,
      } satisfies AgentLiveStatus,
    ]),
  );
}

export function mergeObservedCodexWorkersIntoUnifiedOfficeModel(
  unified: UnifiedOfficeModel,
  workers: ObservedCodexWorkerRow[],
  now = Date.now(),
): UnifiedOfficeModel {
  const persistentThreadAgentIds = new Set(
    unified.company.agents
      .filter(
        (agent) =>
          agent.agentId.startsWith("codex-thread:") &&
          (agent.isCeo === true || agent.role === "ceo" || agent.role === "pm"),
      )
      .map((agent) => agent.agentId),
  );
  const keepRosterAgent = (
    agent: Parameters<typeof codexProjectPmThreadIds>[0] & { agentId: string },
  ): boolean =>
    !agent.agentId.startsWith("codex-thread:") ||
    persistentThreadAgentIds.has(agent.agentId) ||
    codexProjectPmThreadIds(agent).length > 0;
  const companyAgents = unified.company.agents.filter(keepRosterAgent);
  const runtimeAgents = unified.runtimeAgents.filter(keepRosterAgent);
  const configuredAgents = unified.configuredAgents.filter(keepRosterAgent);
  const hookCanonicalUnified: UnifiedOfficeModel = {
    ...unified,
    company: { ...unified.company, agents: companyAgents },
    runtimeAgents,
    configuredAgents,
    diagnostics: {
      ...unified.diagnostics,
      configAgentCount: configuredAgents.length,
      runtimeAgentCount: runtimeAgents.length,
      sidecarAgentCount: companyAgents.length,
    },
  };
  const activeWorkers = workers.filter(
    (worker) =>
      worker.workerId.trim() &&
      worker.projectId.trim() &&
      !worker.parentThreadId?.trim() &&
      worker.isEphemeral !== true &&
      worker.lastSeenAt + OBSERVED_CODEX_PRESENCE_RANGE_MS > now,
  );
  if (activeWorkers.length === 0) return hookCanonicalUnified;

  const existingAgentIds = new Set([
    ...hookCanonicalUnified.company.agents.map((agent) => agent.agentId),
    ...hookCanonicalUnified.runtimeAgents.map((agent) => agent.agentId),
    ...hookCanonicalUnified.configuredAgents.map((agent) => agent.agentId),
  ]);
  const existingThreadIds = new Set(
    [
      ...hookCanonicalUnified.company.agents.flatMap((agent) => [
        ...(agent.agentId.startsWith("codex-thread:")
          ? [agent.agentId.slice("codex-thread:".length)]
          : []),
        ...codexProjectPmThreadIds(agent),
      ]),
      ...hookCanonicalUnified.runtimeAgents.flatMap(codexProjectPmThreadIds),
      ...hookCanonicalUnified.configuredAgents.flatMap(codexProjectPmThreadIds),
    ].filter(Boolean),
  );
  const uniqueObservedWorkers = activeWorkers.filter(
    (worker) =>
      !existingAgentIds.has(worker.workerId) &&
      !(worker.threadId && existingThreadIds.has(worker.threadId)),
  );
  if (uniqueObservedWorkers.length === 0) return hookCanonicalUnified;

  const projectIds = new Set(hookCanonicalUnified.company.projects.map((project) => project.id));
  const observedProjects = uniqueObservedWorkers
    .filter((worker) => {
      if (projectIds.has(worker.projectId)) return false;
      projectIds.add(worker.projectId);
      return true;
    })
    .map(createObservedCodexProject);
  const heartbeatProfileId = "hb-observed-codex";
  const heartbeatProfiles = hookCanonicalUnified.company.heartbeatProfiles.some(
    (profile) => profile.id === heartbeatProfileId,
  )
    ? hookCanonicalUnified.company.heartbeatProfiles
    : [
        ...hookCanonicalUnified.company.heartbeatProfiles,
        {
          id: heartbeatProfileId,
          role: "builder" as const,
          cadenceMinutes: 5,
          teamDescription: "Telemetry-observed Codex workers",
          productDetails: "Read-only office presence derived from hook telemetry",
          goal: "Show recent Codex work without requiring an app-server control bridge",
        },
      ];
  const observedAgents = uniqueObservedWorkers.map((worker) => ({
    agentId: worker.workerId,
    role: "builder" as const,
    projectId: worker.projectId,
    heartbeatProfileId,
    lifecycleState: "active" as const,
    presenceExpiresAt: worker.lastSeenAt + OBSERVED_CODEX_PRESENCE_RANGE_MS,
    runtimeMetadata: observedCodexMetadata(worker),
  }));
  const observedRuntimeAgents = uniqueObservedWorkers.map((worker) => ({
    agentId: worker.workerId,
    displayName: worker.displayName,
    workspacePath: worker.projectPath ?? "~/.codex",
    agentDir: worker.projectPath ?? "~/.codex",
    sandboxMode: "codex-observed",
    toolPolicy: {
      allow: [],
      deny: ["send", "thread-read", "office-role-write"],
    },
    sessionCount: worker.state === "running" ? 1 : 0,
    lastUpdatedAt: worker.lastSeenAt,
    runtimeMetadata: observedCodexMetadata(worker),
  }));

  const company = {
    ...hookCanonicalUnified.company,
    projects: [...hookCanonicalUnified.company.projects, ...observedProjects],
    agents: [...hookCanonicalUnified.company.agents, ...observedAgents],
    heartbeatProfiles,
  };
  const mergedRuntimeAgents = [...hookCanonicalUnified.runtimeAgents, ...observedRuntimeAgents];
  const mergedConfiguredAgents = [
    ...hookCanonicalUnified.configuredAgents,
    ...observedRuntimeAgents,
  ];

  return {
    ...hookCanonicalUnified,
    company,
    runtimeAgents: mergedRuntimeAgents,
    configuredAgents: mergedConfiguredAgents,
    workload: buildObservedWorkload(hookCanonicalUnified.workload, observedProjects),
    diagnostics: {
      ...hookCanonicalUnified.diagnostics,
      configAgentCount: mergedConfiguredAgents.length,
      runtimeAgentCount: mergedRuntimeAgents.length,
      sidecarAgentCount: company.agents.length,
    },
  };
}

function buildObservedWorkload(
  workload: UnifiedOfficeModel["workload"],
  projects: CompanyModel["projects"],
): UnifiedOfficeModel["workload"] {
  const existing = new Set(workload.map((entry) => entry.projectId));
  return [
    ...workload,
    ...projects
      .filter((project) => !existing.has(project.id))
      .map((project) => ({
        projectId: project.id,
        openTickets: 0,
        closedTickets: 0,
        queuePressure: "low" as const,
      })),
  ];
}
