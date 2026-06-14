/**
 * READ-ONLY RUNTIME ADAPTER
 * =========================
 * Runtime adapter proxy that preserves read methods while failing write methods
 * closed for public/viewer office surfaces.
 *
 * Inputs: an existing OfficeRuntimeAdapter and read-only enabled flag.
 * Outputs: the same adapter contract with write-ish methods returning stable
 * readonly errors.
 * Side effects: none; blocked methods must not call through to the target.
 */

import type { OfficeRuntimeAdapter } from "./contract";

export const READONLY_MODE_ERROR = "readonly_mode";

const READONLY_RESULT_METHODS = new Set([
  "applyConfig",
  "createTeam",
  "downloadMeshAsset",
  "generateMeshyAsset",
  "installRepoSkillToAgentWorkspace",
  "manualResync",
  "recordProjectAccountEvent",
  "removeAgentWorkspaceSkill",
  "resolveApproval",
  "rollbackConfig",
  "saveAgentFile",
  "saveBusinessBuilderConfig",
  "syncTeamBusinessSkillsToAgents",
  "sendMessage",
]);

const READONLY_NULL_METHODS = new Set([
  "runSkillStudioDemo",
  "saveSkillStudioFile",
  "saveSkillStudioManifest",
]);

const READONLY_COMPANY_METHODS = new Set([
  "createProject",
  "saveCompanyModel",
  "upsertChannelBinding",
  "upsertFederationPolicy",
  "upsertProviderIndexProfile",
]);

function readonlyResult(): { ok: false; error: typeof READONLY_MODE_ERROR } {
  return { ok: false, error: READONLY_MODE_ERROR };
}

function officeObjectsFromArgs(args: unknown[]): unknown[] {
  const first = args[0];
  if (Array.isArray(first)) return first;
  const second = args[1];
  if (second && typeof second === "object" && "currentObjects" in second) {
    const currentObjects = (second as { currentObjects?: unknown }).currentObjects;
    if (Array.isArray(currentObjects)) return currentObjects;
  }
  return [];
}

export function createReadOnlyOfficeRuntimeAdapter(
  adapter: OfficeRuntimeAdapter,
  readOnly: boolean,
): OfficeRuntimeAdapter {
  if (!readOnly) return adapter;

  const proxy = new Proxy(adapter, {
    get(target, prop, receiver): unknown {
      if (prop === "capabilities") {
        return {
          ...target.capabilities,
          agentConfigWrite: false,
          agentSkillRuntimeControls: false,
          channels: false,
          employeeSkillEquip: false,
          promptSend: false,
          scheduler: false,
          teamAgentProvisioning: false,
          toolPolicy: false,
        };
      }

      if (typeof prop !== "string") {
        return Reflect.get(target, prop, receiver);
      }

      if (prop === "saveOfficeSettings") {
        return async (settings: unknown) => ({
          ...readonlyResult(),
          settings,
        });
      }

      if (prop === "saveOfficeObjects") {
        return async (...args: unknown[]) => ({
          ...readonlyResult(),
          objects: officeObjectsFromArgs(args),
        });
      }

      if (prop === "shuffleOfficeObjects") {
        return async (...args: unknown[]) => ({
          ...readonlyResult(),
          objects: officeObjectsFromArgs(args),
          movedCount: 0,
          placementViolationCount: 0,
        });
      }

      if (prop === "upsertOfficeObject" || prop === "deleteOfficeObject") {
        return async (...args: unknown[]) => ({
          ...readonlyResult(),
          objects: officeObjectsFromArgs(args),
        });
      }

      if (prop === "updateFederatedTask") {
        return async () => readonlyResult();
      }

      if (READONLY_COMPANY_METHODS.has(prop)) {
        return async () => ({
          ...readonlyResult(),
          company: await target.getCompanyModel(),
        });
      }

      if (READONLY_NULL_METHODS.has(prop)) {
        return async () => null;
      }

      if (READONLY_RESULT_METHODS.has(prop)) {
        return async () => readonlyResult();
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

  return proxy as OfficeRuntimeAdapter;
}
