import type { OpenClawAdapter } from "../openclaw";

export type RuntimeAdapterKind = "codex" | "openclaw";

export type RuntimeAdapterCapabilities = {
  persistentAgents: boolean;
  agentConfigWrite: boolean;
  agentWorkspaceFiles: boolean;
  employeeSkillEquip: boolean;
  globalSkillBrowser: boolean;
  skillEvalRuns: boolean;
  harnessGraph: boolean;
  agentSkillRuntimeControls: boolean;
  toolPolicy: boolean;
  channels: boolean;
  scheduler: boolean;
  sessionMessaging: boolean;
  teamAgentProvisioning: boolean;
  threadListing: boolean;
  threadRead: boolean;
  promptSend: boolean;
  liveEvents: boolean;
};

export type OfficeRuntimeAdapter = OpenClawAdapter & {
  readonly runtimeKind: RuntimeAdapterKind;
  readonly runtimeLabel: string;
  readonly capabilities: RuntimeAdapterCapabilities;
};

const RUNTIME_ADAPTER_STORAGE_KEY = "farplane.runtime-adapter.v1";

export function resolveRuntimeAdapterKind(value: unknown): RuntimeAdapterKind {
  return value === "openclaw" ? "openclaw" : "codex";
}

export function getRuntimeAdapterKind(defaultValue?: unknown): RuntimeAdapterKind {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(RUNTIME_ADAPTER_STORAGE_KEY);
      if (stored) return resolveRuntimeAdapterKind(stored);
    } catch {
      // Fall back to the configured default.
    }
  }
  return resolveRuntimeAdapterKind(defaultValue);
}

export function saveRuntimeAdapterKind(kind: RuntimeAdapterKind): RuntimeAdapterKind {
  const resolved = resolveRuntimeAdapterKind(kind);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(RUNTIME_ADAPTER_STORAGE_KEY, resolved);
  }
  return resolved;
}
