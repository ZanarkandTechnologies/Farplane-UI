import { describe, expect, it, vi } from "vitest";
import { launchCapabilityProfileThread } from "./capability-profile-launch";

const restrictedPolicy = {
  ok: true as const,
  documents: {
    global: { document: { version: 1 as const, profiles: {} } },
    project: { document: { version: 1 as const, profiles: {} } },
  },
  catalog: { skill_ids: [], mcp_server_ids: [] },
  active_profile: {
    ref: "project:research-only",
    label: "Research only",
    allow: { skill_ids: ["research"], mcp_server_ids: ["Ref"] },
  },
  enforcement: { state: "profiled" as const, policy_digest: "digest" },
};

describe("launchCapabilityProfileThread", () => {
  it("compiles every project-owned launch against the live runtime inventory", async () => {
    const startThread = vi.fn(async () => ({ thread: { id: "thread-1" } }));
    const recordSnapshot = vi.fn(async () => undefined);
    const result = await launchCapabilityProfileThread(
      { projectPath: "/workspace/acme", developerInstructions: "Run the studio job." },
      {
        readPolicy: async () => restrictedPolicy,
        readRuntimeCatalog: async () => ({
          skillIds: ["research", "imagegen"],
          mcpServerIds: ["Ref", "notion"],
        }),
        startThread,
        recordSnapshot,
      },
    );

    expect(startThread).toHaveBeenCalledWith({
      cwd: "/workspace/acme",
      developerInstructions: "Run the studio job.",
      config: {
        "skills.config": [
          { name: "imagegen", enabled: false },
          { name: "research", enabled: true },
        ],
        "mcp_servers.Ref.enabled": true,
        "mcp_servers.notion.enabled": false,
      },
    });
    expect(recordSnapshot).toHaveBeenCalledWith({
      projectPath: "/workspace/acme",
      threadId: "thread-1",
      profileRef: "project:research-only",
      policyDigest: "digest",
    });
    expect(result.snapshotRecorded).toBe(true);
  });

  it("returns an already-created thread when telemetry persistence fails", async () => {
    const result = await launchCapabilityProfileThread(
      { projectPath: "/workspace/acme" },
      {
        readPolicy: async () => ({
          ...restrictedPolicy,
          active_profile: null,
          enforcement: { state: "full_access", policy_digest: "full" },
        }),
        readRuntimeCatalog: vi.fn(),
        startThread: async () => ({ thread: { id: "thread-1" } }),
        recordSnapshot: async () => {
          throw new Error("disk full");
        },
      },
    );

    expect(result).toEqual({ result: { thread: { id: "thread-1" } }, snapshotRecorded: false });
  });
});
