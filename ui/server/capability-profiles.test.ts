import { describe, expect, it } from "vitest";
import { toBrowserCapabilityProfilesResponse } from "./capability-profiles";

describe("toBrowserCapabilityProfilesResponse", () => {
  it("selects policy data while redacting Core filesystem paths and write receipts", () => {
    const response = toBrowserCapabilityProfilesResponse({
      ok: true,
      project_root: "/workspace/acme",
      documents: {
        global: {
          path: "/Users/operator/.farplane/capability-profiles.yaml",
          document: { version: 1, profiles: {} },
        },
        project: {
          path: "/workspace/acme/farplane/capability-profiles.yaml",
          document: { version: 1, profiles: {}, active_profile_ref: "project:research-only" },
        },
      },
      catalog: { skill_ids: ["research"], mcp_server_ids: ["Ref"] },
      active_profile: {
        ref: "project:research-only",
        label: "Research only",
        allow: { skill_ids: ["research"], mcp_server_ids: ["Ref"] },
      },
      enforcement: {
        state: "profiled",
        policy_digest: "digest",
      },
      write: { scope: "project", path: "/workspace/acme/farplane/capability-profiles.yaml" },
    });

    expect(response).toMatchObject({
      documents: {
        global: { document: { version: 1 } },
        project: { document: { active_profile_ref: "project:research-only" } },
      },
      active_profile: { label: "Research only" },
      enforcement: { state: "profiled" },
    });
    expect(response).not.toHaveProperty("project_root");
    expect(response).not.toHaveProperty("write");
    expect(response?.documents.global).not.toHaveProperty("path");
    expect(response?.documents.project).not.toHaveProperty("path");
  });

  it("rejects an incomplete Core response instead of passing through an ambiguous DTO", () => {
    expect(toBrowserCapabilityProfilesResponse({ ok: true })).toBeNull();
  });
});
