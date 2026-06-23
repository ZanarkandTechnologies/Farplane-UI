"use client";

/**
 * OFFICE DATA PROVIDER
 * ====================
 * React provider that loads, refreshes, and stabilizes the office snapshot for UI consumers.
 *
 * KEY CONCEPTS:
 * - Owns adapter wiring and provider state transitions.
 * - Delegates pure office-data derivation to `office-data-mapper.ts`.
 * - Applies stability guards so live-status updates do not rebroadcast unchanged office trees.
 *
 * USAGE:
 * - Wrap office surfaces with `OfficeDataProvider`.
 * - Read derived office state through `useOfficeDataContext()`.
 *
 * MEMORY REFERENCES:
 * - MEM-0175
 * - MEM-0176
 * - MEM-0194
 */

import React, {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery } from "convex/react";
import { useShallow } from "zustand/react/shallow";
import { useAgentLiveStatuses } from "@/hooks/use-agent-live-status";
import type {
  AgentLiveStatus,
  CompanyModel,
  FederatedTaskProvider,
  FederationProjectPolicy,
  OfficeSettingsModel,
  PendingApprovalModel,
  ProviderIndexProfile,
  UnifiedOfficeModel,
} from "@/modules/runtime";
import {
  areStringArraysEqual,
  fallbackData,
  repairTeamClusterPlacements,
  toOfficeData,
  type OfficeDataContextValue,
} from "@/providers/office-data-mapper";
import {
  selectOfficeWorldContextData,
  useOfficeWorldStore,
  type OfficeWorldChangedKey,
  type OfficeWorldRefreshReason,
  type OfficeWorldSnapshot,
} from "@/modules/office/store";
import { useOfficeRuntimeAdapter, type OfficeRuntimeAdapter } from "@/modules/runtime";
import { useOfficeAccessMode } from "@/providers/office-access-mode-provider";
import { isConvexEnabled } from "@/providers/convex-provider";
import { api } from "../../../convex/_generated/api";

const OfficeDataContext = createContext<OfficeDataContextValue | undefined>(undefined);

export type { OfficeDataContextValue };

type OfficeDataRefreshReason = OfficeWorldRefreshReason;
type OfficeDataActions = Pick<
  OfficeDataContextValue,
  | "refresh"
  | "applyOfficeSettings"
  | "manualResync"
  | "upsertFederationPolicy"
  | "upsertProviderIndexProfile"
>;

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

export type ObservedCodexWorkerRow = {
  workerId: string;
  sourceInstanceId: string;
  machineId?: string;
  machineName?: string;
  sessionKey: string;
  threadId?: string;
  projectId: string;
  projectPath?: string;
  displayName: string;
  state: "running" | "idle" | "done";
  statusText: string;
  lastSeenAt: number;
  controllable: false;
};

type ObservedCodexWorkersQueryResult = {
  workers?: ObservedCodexWorkerRow[];
  rangeMs?: number;
};

const OBSERVED_CODEX_PRESENCE_RANGE_MS = 15 * 60 * 1000;

function isCodexAgentId(agentId: string): boolean {
  return agentId === "codex-main" || agentId.startsWith("codex-thread:");
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
    statusText: convexStatus.statusText || adapterStatus.statusText,
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

  const [objectsResult, settingsResult] = await Promise.all([
    input.adapter.saveOfficeObjects(input.officeObjects),
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
  const merged: Record<string, AgentLiveStatus> = { ...observedStatuses, ...convexStatuses };

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
        bubbles: [
          {
            id: `observed:${worker.workerId}:${worker.lastSeenAt}`,
            label: worker.statusText,
            weight: worker.state === "running" ? 100 : 60,
          },
        ],
        bubbleMessages: worker.threadId
          ? [{ threadId: worker.threadId, message: worker.statusText, eventAt: worker.lastSeenAt }]
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
  const activeWorkers = workers.filter(
    (worker) => worker.workerId.trim() && worker.projectId.trim(),
  );
  if (activeWorkers.length === 0) return unified;

  const existingAgentIds = new Set([
    ...unified.company.agents.map((agent) => agent.agentId),
    ...unified.runtimeAgents.map((agent) => agent.agentId),
    ...unified.configuredAgents.map((agent) => agent.agentId),
  ]);
  const existingThreadIds = new Set(
    [
      ...unified.company.agents.flatMap((agent) => [
        ...(agent.agentId.startsWith("codex-thread:")
          ? [agent.agentId.slice("codex-thread:".length)]
          : []),
        ...codexProjectPmThreadIds(agent),
      ]),
      ...unified.runtimeAgents.flatMap(codexProjectPmThreadIds),
      ...unified.configuredAgents.flatMap(codexProjectPmThreadIds),
    ].filter(Boolean),
  );
  const uniqueObservedWorkers = activeWorkers.filter(
    (worker) =>
      !existingAgentIds.has(worker.workerId) &&
      !(worker.threadId && existingThreadIds.has(worker.threadId)),
  );
  if (uniqueObservedWorkers.length === 0) return unified;

  const projectIds = new Set(unified.company.projects.map((project) => project.id));
  const observedProjects = uniqueObservedWorkers
    .filter((worker) => {
      if (projectIds.has(worker.projectId)) return false;
      projectIds.add(worker.projectId);
      return true;
    })
    .map(createObservedCodexProject);
  const heartbeatProfileId = "hb-observed-codex";
  const heartbeatProfiles = unified.company.heartbeatProfiles.some(
    (profile) => profile.id === heartbeatProfileId,
  )
    ? unified.company.heartbeatProfiles
    : [
        ...unified.company.heartbeatProfiles,
        {
          id: heartbeatProfileId,
          role: "builder" as const,
          cadenceMinutes: 15,
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
    presenceExpiresAt: now + OBSERVED_CODEX_PRESENCE_RANGE_MS,
    runtimeMetadata: observedCodexMetadata(worker),
  }));
  const observedRuntimeAgents = uniqueObservedWorkers.map((worker) => ({
    agentId: worker.workerId,
    displayName: worker.displayName,
    workspacePath: worker.projectPath ?? "~/.codex",
    agentDir: worker.projectPath ?? "~/.codex",
    sandboxMode: "codex-observed",
    toolPolicy: { allow: [], deny: ["send", "thread-read", "office-role-write"] },
    sessionCount: worker.state === "running" ? 1 : 0,
    lastUpdatedAt: worker.lastSeenAt,
    runtimeMetadata: observedCodexMetadata(worker),
  }));

  const company = {
    ...unified.company,
    projects: [...unified.company.projects, ...observedProjects],
    agents: [...unified.company.agents, ...observedAgents],
    heartbeatProfiles,
  };
  const runtimeAgents = [...unified.runtimeAgents, ...observedRuntimeAgents];
  const configuredAgents = [...unified.configuredAgents, ...observedRuntimeAgents];

  return {
    ...unified,
    company,
    runtimeAgents,
    configuredAgents,
    workload: buildObservedWorkload(unified.workload, observedProjects),
    diagnostics: {
      ...unified.diagnostics,
      configAgentCount: configuredAgents.length,
      runtimeAgentCount: runtimeAgents.length,
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

declare global {
  interface Window {
    __FARPLANE_OFFICE_DATA__?: OfficeDataContextValue;
  }
}

function shouldLogOfficeRefresh(): boolean {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  return window.localStorage.getItem("farplane.debug.officeRefresh") === "1";
}

function logOfficeRefresh(event: string, details: Record<string, unknown> = {}): void {
  if (!shouldLogOfficeRefresh()) return;
  console.debug("[farplane:office-refresh]", event, details);
}

function toOfficeWorldSnapshot(
  data: OfficeDataContextValue,
  liveStatusByAgentId: Record<string, AgentLiveStatus>,
  error?: string,
): OfficeWorldSnapshot {
  return {
    company: data.company,
    teams: data.teams,
    employees: data.employees,
    desks: data.desks,
    officeObjects: data.officeObjects,
    officeAreas: data.officeAreas,
    officeSettings: data.officeSettings,
    companyModel: data.companyModel,
    workload: data.workload,
    warnings: data.warnings,
    liveStatusByAgentId,
    isLoading: data.isLoading,
    error,
  };
}

function applyOfficeWorldSnapshot(
  snapshot: OfficeWorldSnapshot,
  reason: OfficeDataRefreshReason,
): OfficeWorldChangedKey[] {
  return useOfficeWorldStore.getState().applySnapshot(snapshot, reason);
}

export function OfficeDataProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const sharedAdapter = useOfficeRuntimeAdapter();
  const { isReadOnly } = useOfficeAccessMode();
  const worldContextData = useOfficeWorldStore(useShallow(selectOfficeWorldContextData));
  const [actions, setActions] = useState<OfficeDataActions>(() => {
    const fallback = fallbackData();
    return {
      refresh: fallback.refresh,
      applyOfficeSettings: fallback.applyOfficeSettings,
      manualResync: fallback.manualResync,
      upsertFederationPolicy: fallback.upsertFederationPolicy,
      upsertProviderIndexProfile: fallback.upsertProviderIndexProfile,
    };
  });
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const observedCodexPresence = useQuery(
    api.modules.hookTelemetry.queries.getObservedCodexWorkers,
    isConvexEnabled() && sharedAdapter.runtimeKind === "codex"
      ? {
          rangeMs: OBSERVED_CODEX_PRESENCE_RANGE_MS,
          limit: 500,
        }
      : "skip",
  ) as ObservedCodexWorkersQueryResult | undefined;
  const observedCodexWorkers = useMemo(
    () => observedCodexPresence?.workers ?? [],
    [observedCodexPresence?.workers],
  );
  const observedCodexStatuses = useMemo(
    () => observedCodexWorkersToLiveStatuses(observedCodexWorkers),
    [observedCodexWorkers],
  );
  const adapterRef = useRef<OfficeRuntimeAdapter | null>(null);
  const cancelledRef = useRef(false);
  const loadGenerationRef = useRef(0);
  const inFlightLoadRef = useRef<Promise<void> | null>(null);
  const latestUnifiedRef = useRef<UnifiedOfficeModel | null>(null);
  const latestApprovalsRef = useRef<PendingApprovalModel[]>([]);
  const latestLiveStatusSignatureRef = useRef("");
  const latestAdapterLiveStatusRef = useRef<Record<string, AgentLiveStatus>>({});
  const inFlightAdapterStatusRef = useRef<Promise<void> | null>(null);
  const agentIdsRef = useRef<string[]>([]);
  const runtimeKindRef = useRef(sharedAdapter.runtimeKind);
  const liveStatusByConvex = useAgentLiveStatuses(agentIds);
  const liveStatusByConvexRef = useRef<Record<string, AgentLiveStatus> | undefined>(undefined);

  useEffect(() => {
    runtimeKindRef.current = sharedAdapter.runtimeKind;
  }, [sharedAdapter.runtimeKind]);

  useEffect(() => {
    liveStatusByConvexRef.current = liveStatusByConvex;
  }, [liveStatusByConvex]);

  const applyOfficeSettingsValue = useMemo(
    () => (settings: OfficeSettingsModel) => {
      const unified = latestUnifiedRef.current;
      if (!unified) {
        const current = useOfficeWorldStore.getState();
        applyOfficeWorldSnapshot(
          {
            ...current,
            officeSettings: settings,
          },
          "settings",
        );
        return;
      }
      const pendingApprovals = latestApprovalsRef.current;
      const statusByAgent = mergeAgentLiveStatuses({
        agentIds: agentIdsRef.current,
        adapterStatuses: latestAdapterLiveStatusRef.current,
        convexStatuses: liveStatusByConvexRef.current,
        runtimeKind: runtimeKindRef.current,
        observedStatuses: observedCodexStatuses,
      });
      applyOfficeWorldSnapshot(
        toOfficeWorldSnapshot(
          toOfficeData(unified, settings, pendingApprovals, statusByAgent),
          statusByAgent,
        ),
        "settings",
      );
    },
    [observedCodexStatuses],
  );

  const load = React.useCallback(
    async (reason: OfficeDataRefreshReason = "manual"): Promise<void> => {
      if (inFlightLoadRef.current) {
        logOfficeRefresh("skip-in-flight", { reason });
        await inFlightLoadRef.current;
        if (cancelledRef.current) return;
        return load(reason);
      }

      const run = (async (): Promise<void> => {
        const adapter = adapterRef.current;
        if (!adapter) return;
        const generation = loadGenerationRef.current;
        const startedAt = performance.now();
        logOfficeRefresh("start", { reason, runtimeKind: adapter.runtimeKind });
        try {
          const [unified, pendingApprovals, officeSettings, configSnapshot] = await Promise.all([
            adapter.getUnifiedOfficeModel(),
            adapter.getPendingApprovals(),
            adapter.getOfficeSettings(),
            adapter.getConfigSnapshot(),
          ]);
          const unifiedWithObserved =
            adapter.runtimeKind === "codex"
              ? mergeObservedCodexWorkersIntoUnifiedOfficeModel(unified, observedCodexWorkers)
              : unified;
          const nextAgentIds = [
            ...new Set([
              ...unifiedWithObserved.runtimeAgents.map((item) => item.agentId),
              ...unifiedWithObserved.configuredAgents.map((item) => item.agentId),
            ]),
          ];
          agentIdsRef.current = nextAgentIds;
          setAgentIds((current) =>
            areStringArraysEqual(current, nextAgentIds) ? current : nextAgentIds,
          );

          const statusByAgent = mergeAgentLiveStatuses({
            agentIds: nextAgentIds,
            adapterStatuses: latestAdapterLiveStatusRef.current,
            convexStatuses: liveStatusByConvexRef.current,
            runtimeKind: adapter.runtimeKind,
            observedStatuses: observedCodexStatuses,
          });
          latestLiveStatusSignatureRef.current = JSON.stringify(statusByAgent);

          const placementRepair = repairTeamClusterPlacements({
            unified: unifiedWithObserved,
            officeSettings,
          });
          const repairedUnified = placementRepair.unified;
          const repairedOfficeSettings = placementRepair.officeSettings;
          const placementRepairPersistence = await persistPlacementRepairIfAllowed({
            adapter,
            changed: placementRepair.changed,
            expandedLayout: placementRepair.expandedLayout,
            officeObjects: repairedUnified.officeObjects,
            officeSettings: repairedOfficeSettings,
            readOnly: isReadOnly,
          });
          if (!placementRepairPersistence.skipped) {
            logOfficeRefresh("placement-repair", {
              reason,
              expandedLayout: placementRepair.expandedLayout,
              repairedTeamIds: placementRepair.repairedTeamIds,
            });
            const { objectsResult, settingsResult } = placementRepairPersistence;
            if (!objectsResult.ok || !settingsResult.ok) {
              logOfficeRefresh("placement-repair-persist-error", {
                objectsError: objectsResult.ok ? undefined : objectsResult.error,
                settingsError: settingsResult.ok ? undefined : settingsResult.error,
              });
            }
          } else if (placementRepair.changed) {
            logOfficeRefresh("placement-repair-skip-readonly", {
              reason,
              expandedLayout: placementRepair.expandedLayout,
              repairedTeamIds: placementRepair.repairedTeamIds,
            });
          }

          latestUnifiedRef.current = repairedUnified;
          latestApprovalsRef.current = pendingApprovals;
          if (cancelledRef.current || generation !== loadGenerationRef.current) {
            logOfficeRefresh("drop-stale", { reason, generation });
            return;
          }
          const officeData = toOfficeData(
            repairedUnified,
            repairedOfficeSettings,
            pendingApprovals,
            statusByAgent,
            configSnapshot,
          );
          const changedKeys = applyOfficeWorldSnapshot(
            toOfficeWorldSnapshot(officeData, statusByAgent),
            reason,
          );
          const elapsedMs = Math.round(performance.now() - startedAt);
          if (changedKeys.length === 0) {
            logOfficeRefresh("unchanged", {
              reason,
              elapsedMs,
              agents: nextAgentIds.length,
              objects: officeData.officeObjects.length,
              changedKeys,
            });
          } else {
            logOfficeRefresh("changed", {
              reason,
              elapsedMs,
              agents: nextAgentIds.length,
              objects: officeData.officeObjects.length,
              employees: officeData.employees.length,
              changedKeys,
            });
          }
          if (!inFlightAdapterStatusRef.current && nextAgentIds.length > 0) {
            const statusRun = (async (): Promise<void> => {
              const statusGeneration = generation;
              const statusStartedAt = performance.now();
              try {
                const adapterStatusByAgent = await adapter.getAgentsLiveStatus(nextAgentIds);
                if (cancelledRef.current || statusGeneration !== loadGenerationRef.current) return;
                latestAdapterLiveStatusRef.current = adapterStatusByAgent;
                const mergedStatus = mergeAgentLiveStatuses({
                  agentIds: nextAgentIds,
                  adapterStatuses: adapterStatusByAgent,
                  convexStatuses: liveStatusByConvexRef.current,
                  runtimeKind: adapter.runtimeKind,
                  observedStatuses: observedCodexStatuses,
                });
                const nextStatusSignature = JSON.stringify(mergedStatus);
                if (latestLiveStatusSignatureRef.current === nextStatusSignature) return;
                latestLiveStatusSignatureRef.current = nextStatusSignature;
                const current = useOfficeWorldStore.getState();
                const liveChangedKeys = applyOfficeWorldSnapshot(
                  toOfficeWorldSnapshot(
                    toOfficeData(
                      repairedUnified,
                      current.officeSettings,
                      pendingApprovals,
                      mergedStatus,
                    ),
                    mergedStatus,
                  ),
                  "live-status",
                );
                logOfficeRefresh(liveChangedKeys.length === 0 ? "unchanged" : "changed", {
                  reason: "adapter-live-status",
                  elapsedMs: Math.round(performance.now() - statusStartedAt),
                  agents: nextAgentIds.length,
                  changedKeys: liveChangedKeys,
                });
              } catch (error) {
                logOfficeRefresh("adapter-live-status-error", {
                  elapsedMs: Math.round(performance.now() - statusStartedAt),
                  message: error instanceof Error ? error.message : String(error),
                });
              }
            })();
            inFlightAdapterStatusRef.current = statusRun;
            void statusRun.finally(() => {
              if (inFlightAdapterStatusRef.current === statusRun) {
                inFlightAdapterStatusRef.current = null;
              }
            });
          }
        } catch (error) {
          logOfficeRefresh("error", {
            reason,
            message: error instanceof Error ? error.message : String(error),
          });
          if (cancelledRef.current || generation !== loadGenerationRef.current) return;
          const fallback = fallbackData();
          applyOfficeWorldSnapshot(
            toOfficeWorldSnapshot(
              { ...fallback, isLoading: false },
              {},
              error instanceof Error ? error.message : String(error),
            ),
            "error",
          );
        }
      })();

      inFlightLoadRef.current = run;
      try {
        await run;
      } finally {
        if (inFlightLoadRef.current === run) {
          inFlightLoadRef.current = null;
        }
      }
    },
    [isReadOnly, observedCodexStatuses, observedCodexWorkers],
  );

  useEffect(() => {
    if (!liveStatusByConvex || Object.keys(liveStatusByConvex).length === 0) return;
    const mergedStatus = mergeAgentLiveStatuses({
      agentIds,
      adapterStatuses: latestAdapterLiveStatusRef.current,
      convexStatuses: liveStatusByConvex,
      runtimeKind: sharedAdapter.runtimeKind,
      observedStatuses: observedCodexStatuses,
    });
    const nextStatusSignature = JSON.stringify(mergedStatus);
    if (latestLiveStatusSignatureRef.current === nextStatusSignature) return;
    const unified = latestUnifiedRef.current;
    if (!unified) return;
    const pendingApprovals = latestApprovalsRef.current;
    latestLiveStatusSignatureRef.current = nextStatusSignature;
    const current = useOfficeWorldStore.getState();
    const changedKeys = applyOfficeWorldSnapshot(
      toOfficeWorldSnapshot(
        toOfficeData(unified, current.officeSettings, pendingApprovals, mergedStatus),
        mergedStatus,
      ),
      "live-status",
    );
    logOfficeRefresh(changedKeys.length === 0 ? "unchanged" : "changed", {
      reason: "live-status",
      agents: agentIds.length,
      changedKeys,
    });
  }, [agentIds, liveStatusByConvex, observedCodexStatuses, sharedAdapter.runtimeKind]);

  useEffect(() => {
    adapterRef.current = sharedAdapter;
    runtimeKindRef.current = sharedAdapter.runtimeKind;
    cancelledRef.current = false;
    loadGenerationRef.current += 1;

    async function refresh(): Promise<void> {
      await load("manual");
    }

    async function manualResync(
      projectId: string,
      provider?: FederatedTaskProvider,
    ): Promise<{ ok: boolean; error?: string }> {
      const adapter = adapterRef.current;
      if (!adapter) return { ok: false, error: "adapter_unavailable" };
      const result = await adapter.manualResync(projectId, provider);
      await load("resync");
      return result;
    }

    async function upsertFederationPolicy(
      policy: FederationProjectPolicy,
    ): Promise<{ ok: boolean; error?: string }> {
      const adapter = adapterRef.current;
      if (!adapter) return { ok: false, error: "adapter_unavailable" };
      const result = await adapter.upsertFederationPolicy(policy);
      await load("policy");
      return { ok: result.ok, error: result.error };
    }

    async function upsertProviderIndexProfile(
      profile: ProviderIndexProfile,
    ): Promise<{ ok: boolean; error?: string }> {
      const adapter = adapterRef.current;
      if (!adapter) return { ok: false, error: "adapter_unavailable" };
      const result = await adapter.upsertProviderIndexProfile(profile);
      await load("provider-profile");
      return { ok: result.ok, error: result.error };
    }

    setActions({
      refresh,
      applyOfficeSettings: applyOfficeSettingsValue,
      manualResync,
      upsertFederationPolicy,
      upsertProviderIndexProfile,
    });
    useOfficeWorldStore.getState().setLoading(true, "initial");
    void load("initial");
    const timer = window.setInterval(() => {
      void load("poll");
    }, 5000);

    return () => {
      cancelledRef.current = true;
      loadGenerationRef.current += 1;
      window.clearInterval(timer);
    };
  }, [applyOfficeSettingsValue, load, sharedAdapter]);

  const memoizedValue = useMemo<OfficeDataContextValue>(
    () => ({
      ...worldContextData,
      ...actions,
    }),
    [actions, worldContextData],
  );

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__FARPLANE_OFFICE_DATA__ = memoizedValue;
    return () => {
      if (window.__FARPLANE_OFFICE_DATA__ === memoizedValue) {
        delete window.__FARPLANE_OFFICE_DATA__;
      }
    };
  }, [memoizedValue]);

  return <OfficeDataContext.Provider value={memoizedValue}>{children}</OfficeDataContext.Provider>;
}

export function useOfficeDataContext(): OfficeDataContextValue {
  const context = useOptionalOfficeDataContext();
  if (!context) {
    throw new Error("useOfficeDataContext must be used within OfficeDataProvider");
  }
  return context;
}

export function useOptionalOfficeDataContext(): OfficeDataContextValue | undefined {
  return useContext(OfficeDataContext);
}
