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
  toOfficeData,
  type OfficeDataContextValue,
} from "@/providers/office-data-mapper";
import { stabilizeOfficeData } from "@/providers/office-data-stability";
import { useOfficeRuntimeAdapter, type OfficeRuntimeAdapter } from "@/modules/runtime";

const OfficeDataContext = createContext<OfficeDataContextValue | undefined>(undefined);

export type { OfficeDataContextValue };

type OfficeDataRefreshReason =
  | "initial"
  | "poll"
  | "manual"
  | "settings"
  | "resync"
  | "policy"
  | "provider-profile";

function isCodexAgentId(agentId: string): boolean {
  return agentId === "codex-main" || agentId.startsWith("codex-thread:");
}

export function mergeAgentLiveStatuses(input: {
  agentIds: string[];
  adapterStatuses?: Record<string, AgentLiveStatus>;
  convexStatuses?: Record<string, AgentLiveStatus>;
  runtimeKind?: string;
}): Record<string, AgentLiveStatus> {
  const adapterStatuses = input.adapterStatuses ?? {};
  const convexStatuses = input.convexStatuses ?? {};
  const merged: Record<string, AgentLiveStatus> = { ...convexStatuses };

  if (input.runtimeKind === "codex") {
    for (const agentId of input.agentIds) {
      if (!isCodexAgentId(agentId)) continue;
      const adapterStatus = adapterStatuses[agentId];
      if (adapterStatus) merged[agentId] = adapterStatus;
    }
    return merged;
  }

  if (Object.keys(merged).length > 0) return merged;
  return adapterStatuses;
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

export function OfficeDataProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const sharedAdapter = useOfficeRuntimeAdapter();
  const [value, setValue] = useState<OfficeDataContextValue>({ ...fallbackData(), isLoading: true });
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const adapterRef = useRef<OfficeRuntimeAdapter | null>(null);
  const cancelledRef = useRef(false);
  const loadGenerationRef = useRef(0);
  const inFlightLoadRef = useRef<Promise<void> | null>(null);
  const latestUnifiedRef = useRef<UnifiedOfficeModel | null>(null);
  const latestApprovalsRef = useRef<PendingApprovalModel[]>([]);
  const latestLiveStatusSignatureRef = useRef("");
  const latestAdapterLiveStatusRef = useRef<Record<string, AgentLiveStatus>>({});
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
        setValue((current) => ({ ...current, officeSettings: settings }));
        return;
      }
      const pendingApprovals = latestApprovalsRef.current;
      const statusByAgent = mergeAgentLiveStatuses({
        agentIds: agentIdsRef.current,
        adapterStatuses: latestAdapterLiveStatusRef.current,
        convexStatuses: liveStatusByConvexRef.current,
        runtimeKind: runtimeKindRef.current,
      });
      setValue((current) => {
        const next = stabilizeOfficeData(
          current,
          toOfficeData(unified, settings, pendingApprovals, statusByAgent),
        );
        if (next === current) return current;
        return {
          ...next,
          refresh: current.refresh,
          applyOfficeSettings: current.applyOfficeSettings,
          manualResync: current.manualResync,
          upsertFederationPolicy: current.upsertFederationPolicy,
          upsertProviderIndexProfile: current.upsertProviderIndexProfile,
        };
      });
    },
    [],
  );

  const load = React.useCallback(
    async (reason: OfficeDataRefreshReason = "manual"): Promise<void> => {
      if (inFlightLoadRef.current) {
        logOfficeRefresh("skip-in-flight", { reason });
        return inFlightLoadRef.current;
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
          const nextAgentIds = [
            ...new Set([
              ...unified.runtimeAgents.map((item) => item.agentId),
              ...unified.configuredAgents.map((item) => item.agentId),
            ]),
          ];
          agentIdsRef.current = nextAgentIds;
          setAgentIds((current) =>
            areStringArraysEqual(current, nextAgentIds) ? current : nextAgentIds,
          );

          const adapterStatusByAgent = await adapter.getAgentsLiveStatus(nextAgentIds);
          latestAdapterLiveStatusRef.current = adapterStatusByAgent;
          const statusByAgent = mergeAgentLiveStatuses({
            agentIds: nextAgentIds,
            adapterStatuses: adapterStatusByAgent,
            convexStatuses: liveStatusByConvexRef.current,
            runtimeKind: adapter.runtimeKind,
          });
          latestLiveStatusSignatureRef.current = JSON.stringify(statusByAgent);

          latestUnifiedRef.current = unified;
          latestApprovalsRef.current = pendingApprovals;
          if (cancelledRef.current || generation !== loadGenerationRef.current) {
            logOfficeRefresh("drop-stale", { reason, generation });
            return;
          }
          setValue((current) => {
            const next = stabilizeOfficeData(
              current,
              toOfficeData(unified, officeSettings, pendingApprovals, statusByAgent, configSnapshot),
            );
            const elapsedMs = Math.round(performance.now() - startedAt);
            if (next === current) {
              logOfficeRefresh("unchanged", {
                reason,
                elapsedMs,
                agents: nextAgentIds.length,
                objects: current.officeObjects.length,
              });
              return current;
            }
            logOfficeRefresh("changed", {
              reason,
              elapsedMs,
              agents: nextAgentIds.length,
              objects: next.officeObjects.length,
              employees: next.employees.length,
            });
            return {
              ...next,
              refresh: current.refresh,
              applyOfficeSettings: current.applyOfficeSettings,
              manualResync: current.manualResync,
              upsertFederationPolicy: current.upsertFederationPolicy,
              upsertProviderIndexProfile: current.upsertProviderIndexProfile,
            };
          });
        } catch (error) {
          logOfficeRefresh("error", {
            reason,
            message: error instanceof Error ? error.message : String(error),
          });
          if (cancelledRef.current || generation !== loadGenerationRef.current) return;
          setValue((current) => ({
            ...fallbackData(),
            refresh: current.refresh,
            applyOfficeSettings: current.applyOfficeSettings,
            manualResync: current.manualResync,
            upsertFederationPolicy: current.upsertFederationPolicy,
            upsertProviderIndexProfile: current.upsertProviderIndexProfile,
          }));
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
    [],
  );

  useEffect(() => {
    if (!liveStatusByConvex || Object.keys(liveStatusByConvex).length === 0) return;
    const mergedStatus = mergeAgentLiveStatuses({
      agentIds,
      adapterStatuses: latestAdapterLiveStatusRef.current,
      convexStatuses: liveStatusByConvex,
      runtimeKind: sharedAdapter.runtimeKind,
    });
    const nextStatusSignature = JSON.stringify(mergedStatus);
    if (latestLiveStatusSignatureRef.current === nextStatusSignature) return;
    const unified = latestUnifiedRef.current;
    if (!unified) return;
    const pendingApprovals = latestApprovalsRef.current;
    latestLiveStatusSignatureRef.current = nextStatusSignature;
    setValue((current) => {
      const next = stabilizeOfficeData(
        current,
        toOfficeData(
          unified,
          current.officeSettings,
          pendingApprovals,
          mergedStatus,
        ),
      );
      if (next === current) return current;
      return {
        ...next,
        refresh: current.refresh,
        applyOfficeSettings: current.applyOfficeSettings,
        manualResync: current.manualResync,
        upsertFederationPolicy: current.upsertFederationPolicy,
        upsertProviderIndexProfile: current.upsertProviderIndexProfile,
      };
    });
  }, [agentIds, liveStatusByConvex, sharedAdapter.runtimeKind]);

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

    setValue((current) => ({
      ...current,
      refresh,
      applyOfficeSettings: applyOfficeSettingsValue,
      manualResync,
      upsertFederationPolicy,
      upsertProviderIndexProfile,
      isLoading: true,
    }));
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

  const memoizedValue = useMemo(() => value, [value]);

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
