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
import {
  useOfficeRuntimeAdapter,
  type OfficeRuntimeAdapter,
} from "@/modules/runtime";
import { useOfficeAccessMode } from "@/providers/office-access-mode-provider";
import { isConvexEnabled } from "@/providers/convex-provider";
import {
  LOCAL_OBSERVED_CODEX_DISCOVERY_RANGE_MS,
  type ObservedCodexWorkerRow,
} from "@/providers/local-observed-codex-workers";
import {
  OBSERVED_CODEX_PRESENCE_RANGE_MS,
  buildAgentLiveStatusSignature,
  buildOfficeStructuralRefreshSignature,
  mergeAgentLiveStatuses,
  mergeObservedCodexWorkerRows,
  mergeObservedCodexWorkersIntoUnifiedOfficeModel,
  observedCodexWorkersToLiveStatuses,
  persistPlacementRepairIfAllowed,
} from "@/providers/office-data-refresh";
import { api } from "../../../convex/_generated/api";

const OfficeDataContext = createContext<OfficeDataContextValue | undefined>(
  undefined,
);

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

export type { ObservedCodexWorkerRow };

type ObservedCodexWorkersQueryResult = {
  workers?: ObservedCodexWorkerRow[];
  rangeMs?: number;
};

const LOCAL_OBSERVED_CODEX_POLL_MS = 15 * 1000;
const OFFICE_STRUCTURAL_POLL_MS = 30 * 1000;
const EMPTY_OBSERVED_CODEX_WORKERS: ObservedCodexWorkerRow[] = [];

function coalesceOfficeRefreshReason(
  current: OfficeDataRefreshReason | null,
  next: OfficeDataRefreshReason,
): OfficeDataRefreshReason {
  if (!current || current === "poll") return next;
  return current;
}

function useLocalObservedCodexWorkers(
  enabled: boolean,
): ObservedCodexWorkerRow[] {
  const [workers, setWorkers] = useState<ObservedCodexWorkerRow[]>([]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setWorkers([]);
      return;
    }

    let cancelled = false;
    async function refresh(): Promise<void> {
      try {
        const params = new URLSearchParams({
          rangeMs: String(LOCAL_OBSERVED_CODEX_DISCOVERY_RANGE_MS),
          limit: "500",
        });
        const response = await fetch(
          `/farplane/local-observed-codex-workers?${params}`,
          {
            cache: "no-store",
          },
        );
        if (!response.ok)
          throw new Error(`local_observed_codex_failed:${response.status}`);
        const body = (await response.json()) as {
          workers?: ObservedCodexWorkerRow[];
        };
        if (!cancelled)
          setWorkers(Array.isArray(body.workers) ? body.workers : []);
      } catch {
        // Keep the last observed worker set through transient local telemetry
        // failures. Clearing here turns a fetch blip into a structural office
        // remap, which can make observed-only employees disappear and reappear.
      }
    }

    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, LOCAL_OBSERVED_CODEX_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled]);

  return workers;
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

function logOfficeRefresh(
  event: string,
  details: Record<string, unknown> = {},
): void {
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

export function OfficeDataProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const sharedAdapter = useOfficeRuntimeAdapter();
  const { isReadOnly } = useOfficeAccessMode();
  const worldContextData = useOfficeWorldStore(
    useShallow(selectOfficeWorldContextData),
  );
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
  const convexObservedCodexWorkers =
    observedCodexPresence?.workers ?? EMPTY_OBSERVED_CODEX_WORKERS;
  const localObservedCodexWorkers = useLocalObservedCodexWorkers(
    sharedAdapter.runtimeKind === "codex",
  );
  const observedCodexWorkers = useMemo(
    () =>
      convexObservedCodexWorkers.length > 0
        ? convexObservedCodexWorkers
        : mergeObservedCodexWorkerRows(localObservedCodexWorkers),
    [convexObservedCodexWorkers, localObservedCodexWorkers],
  );
  const observedCodexStatuses = useMemo(
    () => observedCodexWorkersToLiveStatuses(observedCodexWorkers),
    [observedCodexWorkers],
  );
  const observedCodexWorkersRef = useRef<ObservedCodexWorkerRow[]>([]);
  const observedCodexStatusesRef = useRef<Record<string, AgentLiveStatus>>({});
  const adapterRef = useRef<OfficeRuntimeAdapter | null>(null);
  const cancelledRef = useRef(false);
  const loadGenerationRef = useRef(0);
  const inFlightLoadRef = useRef<Promise<void> | null>(null);
  const pendingLoadReasonRef = useRef<OfficeDataRefreshReason | null>(null);
  const latestUnifiedRef = useRef<UnifiedOfficeModel | null>(null);
  const latestApprovalsRef = useRef<PendingApprovalModel[]>([]);
  const latestStructuralSignatureRef = useRef("");
  const latestLiveStatusSignatureRef = useRef("");
  const latestAdapterLiveStatusRef = useRef<Record<string, AgentLiveStatus>>(
    {},
  );
  const inFlightAdapterStatusRef = useRef<Promise<void> | null>(null);
  const agentIdsRef = useRef<string[]>([]);
  const runtimeKindRef = useRef(sharedAdapter.runtimeKind);
  const liveStatusByConvex = useAgentLiveStatuses(agentIds);
  const liveStatusByConvexRef = useRef<
    Record<string, AgentLiveStatus> | undefined
  >(undefined);

  useEffect(() => {
    runtimeKindRef.current = sharedAdapter.runtimeKind;
  }, [sharedAdapter.runtimeKind]);

  useEffect(() => {
    liveStatusByConvexRef.current = liveStatusByConvex;
  }, [liveStatusByConvex]);

  useEffect(() => {
    observedCodexWorkersRef.current = observedCodexWorkers;
  }, [observedCodexWorkers]);

  useEffect(() => {
    observedCodexStatusesRef.current = observedCodexStatuses;
  }, [observedCodexStatuses]);

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
        observedStatuses: observedCodexStatusesRef.current,
      });
      applyOfficeWorldSnapshot(
        toOfficeWorldSnapshot(
          toOfficeData(unified, settings, pendingApprovals, statusByAgent),
          statusByAgent,
        ),
        "settings",
      );
    },
    [],
  );

  const refreshAdapterLiveStatus = React.useCallback(
    (
      adapter: OfficeRuntimeAdapter,
      nextAgentIds: string[],
      generation: number,
      reason: string,
    ): void => {
      if (inFlightAdapterStatusRef.current || nextAgentIds.length === 0) return;
      const statusRun = (async (): Promise<void> => {
        const statusStartedAt = performance.now();
        try {
          const adapterStatusByAgent =
            await adapter.getAgentsLiveStatus(nextAgentIds);
          if (cancelledRef.current || generation !== loadGenerationRef.current)
            return;
          latestAdapterLiveStatusRef.current = adapterStatusByAgent;
          const mergedStatus = mergeAgentLiveStatuses({
            agentIds: nextAgentIds,
            adapterStatuses: adapterStatusByAgent,
            convexStatuses: liveStatusByConvexRef.current,
            runtimeKind: adapter.runtimeKind,
            observedStatuses: observedCodexStatusesRef.current,
          });
          const nextStatusSignature = buildAgentLiveStatusSignature(mergedStatus);
          if (latestLiveStatusSignatureRef.current === nextStatusSignature)
            return;
          latestLiveStatusSignatureRef.current = nextStatusSignature;
          const current = useOfficeWorldStore.getState();
          const liveChangedKeys = applyOfficeWorldSnapshot(
            {
              ...current,
              liveStatusByAgentId: mergedStatus,
              isLoading: false,
            },
            "live-status",
          );
          logOfficeRefresh(
            liveChangedKeys.length === 0 ? "unchanged" : "changed",
            {
              reason,
              elapsedMs: Math.round(performance.now() - statusStartedAt),
              agents: nextAgentIds.length,
              changedKeys: liveChangedKeys,
            },
          );
        } catch (error) {
          logOfficeRefresh("adapter-live-status-error", {
            reason,
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
    },
    [],
  );

  const load = React.useCallback(
    async (reason: OfficeDataRefreshReason = "manual"): Promise<void> => {
      if (inFlightLoadRef.current) {
        const blockedRun = inFlightLoadRef.current;
        pendingLoadReasonRef.current = coalesceOfficeRefreshReason(
          pendingLoadReasonRef.current,
          reason,
        );
        logOfficeRefresh("skip-in-flight", {
          reason,
          pendingReason: pendingLoadReasonRef.current,
        });
        await blockedRun;
        if (inFlightLoadRef.current === blockedRun) {
          inFlightLoadRef.current = null;
        }
        const replayReason = pendingLoadReasonRef.current;
        if (replayReason && !cancelledRef.current) {
          pendingLoadReasonRef.current = null;
          await load(replayReason);
        }
        return;
      }

      let nextReason: OfficeDataRefreshReason | null = reason;
      while (nextReason && !cancelledRef.current) {
        const currentReason = nextReason;
        pendingLoadReasonRef.current = null;
        const run = (async (): Promise<void> => {
          const adapter = adapterRef.current;
          if (!adapter) return;
          const generation = loadGenerationRef.current;
          const startedAt = performance.now();
          logOfficeRefresh("start", {
            reason: currentReason,
            runtimeKind: adapter.runtimeKind,
          });
          try {
            const [unified, pendingApprovals, officeSettings, configSnapshot] =
              await Promise.all([
                adapter.getUnifiedOfficeModel(),
                adapter.getPendingApprovals(),
                adapter.getOfficeSettings(),
                adapter.getConfigSnapshot(),
              ]);
          const observedWorkers = observedCodexWorkersRef.current;
          const structuralSignature = buildOfficeStructuralRefreshSignature({
            unified,
            officeSettings,
            pendingApprovals,
            configSnapshot,
            observedWorkers,
          });
          if (
            currentReason === "poll" &&
            latestStructuralSignatureRef.current === structuralSignature
          ) {
            refreshAdapterLiveStatus(
              adapter,
              agentIdsRef.current,
              generation,
              "adapter-live-status",
            );
            logOfficeRefresh("skip-unchanged-structural", {
              reason: currentReason,
              elapsedMs: Math.round(performance.now() - startedAt),
            });
            return;
          }
          latestStructuralSignatureRef.current = structuralSignature;
          const unifiedWithObserved =
            adapter.runtimeKind === "codex"
              ? mergeObservedCodexWorkersIntoUnifiedOfficeModel(
                  unified,
                  observedWorkers,
                )
              : unified;
          const nextAgentIds = [
            ...new Set([
              ...unifiedWithObserved.runtimeAgents.map((item) => item.agentId),
              ...unifiedWithObserved.configuredAgents.map(
                (item) => item.agentId,
              ),
            ]),
          ];
          agentIdsRef.current = nextAgentIds;
          setAgentIds((current) =>
            areStringArraysEqual(current, nextAgentIds)
              ? current
              : nextAgentIds,
          );

          const statusByAgent = mergeAgentLiveStatuses({
            agentIds: nextAgentIds,
            adapterStatuses: latestAdapterLiveStatusRef.current,
            convexStatuses: liveStatusByConvexRef.current,
            runtimeKind: adapter.runtimeKind,
            observedStatuses: observedCodexStatusesRef.current,
          });
          latestLiveStatusSignatureRef.current = buildAgentLiveStatusSignature(statusByAgent);

          const placementRepair = repairTeamClusterPlacements({
            unified: unifiedWithObserved,
            officeSettings,
          });
          const repairedUnified = placementRepair.unified;
          const repairedOfficeSettings = placementRepair.officeSettings;
          const placementRepairPersistence =
            await persistPlacementRepairIfAllowed({
              adapter,
              changed: placementRepair.changed,
              expandedLayout: placementRepair.expandedLayout,
              officeObjects: repairedUnified.officeObjects,
              officeSettings: repairedOfficeSettings,
              readOnly: isReadOnly,
            });
          if (!placementRepairPersistence.skipped) {
            logOfficeRefresh("placement-repair", {
              reason: currentReason,
              expandedLayout: placementRepair.expandedLayout,
              repairedTeamIds: placementRepair.repairedTeamIds,
            });
            const { objectsResult, settingsResult } =
              placementRepairPersistence;
            if (!objectsResult.ok || !settingsResult.ok) {
              logOfficeRefresh("placement-repair-persist-error", {
                objectsError: objectsResult.ok
                  ? undefined
                  : objectsResult.error,
                settingsError: settingsResult.ok
                  ? undefined
                  : settingsResult.error,
              });
            }
          } else if (placementRepair.changed) {
            logOfficeRefresh("placement-repair-skip-readonly", {
              reason: currentReason,
              expandedLayout: placementRepair.expandedLayout,
              repairedTeamIds: placementRepair.repairedTeamIds,
            });
          }

          const hadLoadedStructuralSnapshot = Boolean(latestUnifiedRef.current);
          if (
            (cancelledRef.current ||
              generation !== loadGenerationRef.current) &&
            hadLoadedStructuralSnapshot
          ) {
            logOfficeRefresh("drop-stale", { reason: currentReason, generation });
            pendingLoadReasonRef.current = null;
            return;
          }
          latestUnifiedRef.current = repairedUnified;
          latestApprovalsRef.current = pendingApprovals;
          const officeData = toOfficeData(
            repairedUnified,
            repairedOfficeSettings,
            pendingApprovals,
            statusByAgent,
            configSnapshot,
          );
          const changedKeys = applyOfficeWorldSnapshot(
            toOfficeWorldSnapshot(officeData, statusByAgent),
            currentReason,
          );
          const elapsedMs = Math.round(performance.now() - startedAt);
          if (changedKeys.length === 0) {
            logOfficeRefresh("unchanged", {
              reason: currentReason,
              elapsedMs,
              agents: nextAgentIds.length,
              objects: officeData.officeObjects.length,
              changedKeys,
            });
          } else {
            logOfficeRefresh("changed", {
              reason: currentReason,
              elapsedMs,
              agents: nextAgentIds.length,
              objects: officeData.officeObjects.length,
              employees: officeData.employees.length,
              changedKeys,
            });
          }
          refreshAdapterLiveStatus(
            adapter,
            nextAgentIds,
            generation,
            "adapter-live-status",
          );
        } catch (error) {
          logOfficeRefresh("error", {
            reason: currentReason,
            message: error instanceof Error ? error.message : String(error),
          });
          if (cancelledRef.current || generation !== loadGenerationRef.current)
            return;
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
        nextReason = pendingLoadReasonRef.current;
      }
    },
    [isReadOnly, refreshAdapterLiveStatus],
  );

  useEffect(() => {
    const hasConvexStatuses = Object.keys(liveStatusByConvex ?? {}).length > 0;
    const hasObservedStatuses = Object.keys(observedCodexStatuses).length > 0;
    if (!hasConvexStatuses && !hasObservedStatuses) return;
    const mergedStatus = mergeAgentLiveStatuses({
      agentIds,
      adapterStatuses: latestAdapterLiveStatusRef.current,
      convexStatuses: liveStatusByConvex,
      runtimeKind: sharedAdapter.runtimeKind,
      observedStatuses: observedCodexStatuses,
    });
    const nextStatusSignature = buildAgentLiveStatusSignature(mergedStatus);
    if (latestLiveStatusSignatureRef.current === nextStatusSignature) return;
    if (!latestUnifiedRef.current) return;
    latestLiveStatusSignatureRef.current = nextStatusSignature;
    const current = useOfficeWorldStore.getState();
    const changedKeys = applyOfficeWorldSnapshot(
      {
        ...current,
        liveStatusByAgentId: mergedStatus,
        isLoading: false,
      },
      "live-status",
    );
    logOfficeRefresh(changedKeys.length === 0 ? "unchanged" : "changed", {
      reason: "live-status",
      agents: agentIds.length,
      changedKeys,
    });
  }, [
    agentIds,
    liveStatusByConvex,
    observedCodexStatuses,
    sharedAdapter.runtimeKind,
  ]);

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
    }, OFFICE_STRUCTURAL_POLL_MS);

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

  return (
    <OfficeDataContext.Provider value={memoizedValue}>
      {children}
    </OfficeDataContext.Provider>
  );
}

export function useOfficeDataContext(): OfficeDataContextValue {
  const context = useOptionalOfficeDataContext();
  if (!context) {
    throw new Error(
      "useOfficeDataContext must be used within OfficeDataProvider",
    );
  }
  return context;
}

export function useOptionalOfficeDataContext():
  | OfficeDataContextValue
  | undefined {
  return useContext(OfficeDataContext);
}
