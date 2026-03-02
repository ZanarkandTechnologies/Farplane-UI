import { describe, expect, it } from "vitest";

import { hashSchemaVersion, resolveCanonicalWriteProvider, toFederationPolicy, toProviderIndexProfile, toTask } from "./openclaw-adapter";

describe("openclaw federation normalization", () => {
  it("normalizes federated task defaults", () => {
    const task = toTask({
      id: "task-1",
      projectId: "proj-1",
      title: "Wire Notion sync",
      status: "doing",
      priority: "critical",
    });
    expect(task).not.toBeNull();
    expect(task?.provider).toBe("internal");
    expect(task?.canonicalProvider).toBe("internal");
    expect(task?.status).toBe("todo");
    expect(task?.priority).toBe("medium");
    expect(task?.syncState).toBe("healthy");
  });

  it("normalizes federation policy defaults", () => {
    const policy = toFederationPolicy({
      projectId: "proj-1",
      canonicalProvider: "notion",
      mirrors: ["internal", "bad"],
      writeBackEnabled: true,
      conflictPolicy: "newest_wins",
    });
    expect(policy).toEqual({
      projectId: "proj-1",
      canonicalProvider: "notion",
      mirrors: ["internal"],
      writeBackEnabled: true,
      conflictPolicy: "newest_wins",
    });
  });

  it("generates deterministic schema version hashes", () => {
    const a = hashSchemaVersion("same-payload");
    const b = hashSchemaVersion("same-payload");
    const c = hashSchemaVersion("different-payload");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("maps provider profile payload into deterministic profile", () => {
    const profile = toProviderIndexProfile({
      projectId: "proj-2",
      provider: "notion",
      entityId: "db-123",
      entityName: "Tasks",
      fieldMappings: [
        { name: "Name", type: "title" },
        { name: "Status", type: "status", options: ["To Do", "Done"] },
      ],
    });
    expect(profile).not.toBeNull();
    expect(profile?.profileId).toBe("proj-2:notion:db-123");
    expect(profile?.schemaVersion.startsWith("schema-")).toBe(true);
  });

  it("resolves canonical write provider with fallback", () => {
    expect(resolveCanonicalWriteProvider(null, "internal")).toBe("internal");
    expect(
      resolveCanonicalWriteProvider(
        {
          projectId: "proj-3",
          canonicalProvider: "notion",
          mirrors: [],
          writeBackEnabled: false,
          conflictPolicy: "canonical_wins",
        },
        "internal",
      ),
    ).toBe("notion");
  });
});
