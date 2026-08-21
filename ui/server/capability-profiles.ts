import type {
  CapabilityProfileAllowlist,
  CapabilityProfilesDocument,
  CodexCapabilityProfilesResponse,
} from "../src/modules/runtime/lib/codex-app-server/types";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

/**
 * The Core CLI knows filesystem locations; the browser only needs policy data.
 * Select the public fields explicitly so a later Core response cannot leak a
 * path or write receipt through this bridge by accident.
 */
export function toBrowserCapabilityProfilesResponse(
  value: unknown,
): CodexCapabilityProfilesResponse | null {
  const payload = asRecord(value);
  const documents = asRecord(payload?.documents);
  const global = asRecord(documents?.global);
  const project = asRecord(documents?.project);
  const catalog = asRecord(payload?.catalog);
  const enforcement = asRecord(payload?.enforcement);
  if (
    payload?.ok !== true ||
    !global?.document ||
    !project?.document ||
    !catalog ||
    !enforcement ||
    !Array.isArray(catalog.skill_ids) ||
    !Array.isArray(catalog.mcp_server_ids) ||
    typeof enforcement.state !== "string" ||
    typeof enforcement.policy_digest !== "string"
  ) {
    return null;
  }

  const active = payload.active_profile;
  if (active !== null && !asRecord(active)) return null;

  return {
    ok: true,
    documents: {
      global: { document: global.document as CapabilityProfilesDocument },
      project: { document: project.document as CapabilityProfilesDocument },
    },
    catalog: {
      skill_ids: catalog.skill_ids as string[],
      mcp_server_ids: catalog.mcp_server_ids as string[],
    },
    active_profile:
      active === null
        ? null
        : {
            ref: String((active as JsonRecord).ref ?? ""),
            label: String((active as JsonRecord).label ?? ""),
            allow: ((active as JsonRecord).allow ?? {}) as CapabilityProfileAllowlist,
            ...((active as JsonRecord).extends
              ? { extends: String((active as JsonRecord).extends) }
              : {}),
          },
    enforcement: {
      state: enforcement.state as "full_access" | "profiled",
      policy_digest: enforcement.policy_digest,
    },
  };
}
