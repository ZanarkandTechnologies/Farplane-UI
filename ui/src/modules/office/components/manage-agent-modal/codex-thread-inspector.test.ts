import { describe, expect, it } from "vitest";
import type { EmployeeData } from "@/modules/office/lib/types";
import {
  getDirectThreadLineage,
  getThreadLineageNetwork,
  resolveEmployeeThreadId,
} from "./codex-thread-inspector-logic";

describe("CodexThreadInspector lineage", () => {
  it("uses hook-observed thread identity before the employee id fallback", () => {
    const employee = {
      _id: "employee-codex-thread:fallback",
      teamId: "team-1",
      name: "Worker",
      team: "Core",
      initialPosition: [0, 0, 0],
      isBusy: false,
      observedRuntime: {
        kind: "codex",
        sourceInstanceId: "local",
        sessionKey: "session-key",
        threadId: "native-thread",
        controllable: false,
      },
    } as EmployeeData;
    expect(resolveEmployeeThreadId(employee)).toBe("native-thread");
  });

  it("selects direct parents and children while ignoring unrelated branches", () => {
    const graph = {
      nodes: [],
      edges: [
        { id: "p", source: "root", target: "child", kind: "spawned" as const, eventAt: 1 },
        { id: "c", source: "child", target: "leaf", kind: "forked" as const, eventAt: 2 },
        { id: "x", source: "other", target: "else", kind: "created" as const, eventAt: 3 },
      ],
    };
    const direct = getDirectThreadLineage({ graph, threadId: "codex-thread:child" });
    expect(direct.parents.map((edge) => edge.id)).toEqual(["p"]);
    expect(direct.children.map((edge) => edge.id)).toEqual(["c"]);
  });

  it("keeps observed parent lineage useful before the graph query returns the edge", () => {
    const direct = getDirectThreadLineage({
      graph: { nodes: [], edges: [] },
      threadId: "child",
      observedParentThreadId: "parent",
    });
    expect(direct.parents[0]).toMatchObject({
      source: "parent",
      target: "child",
      kind: "spawned",
    });
  });

  it("returns only the selected task's connected lineage component", () => {
    const graph = {
      nodes: [
        { id: "root", label: "Root", kind: "thread" as const, lastSeenAt: 1 },
        { id: "child", label: "Child", kind: "thread" as const, lastSeenAt: 2 },
        { id: "leaf", label: "Leaf", kind: "thread" as const, lastSeenAt: 3 },
        { id: "other", label: "Other", kind: "thread" as const, lastSeenAt: 4 },
      ],
      edges: [
        { id: "one", source: "root", target: "child", kind: "spawned" as const, eventAt: 1 },
        { id: "two", source: "child", target: "leaf", kind: "forked" as const, eventAt: 2 },
      ],
    };
    const network = getThreadLineageNetwork({ graph, threadId: "child" });
    expect(network.nodes.map((node) => node.id).sort()).toEqual(["child", "leaf", "root"]);
    expect(network.edges.map((edge) => edge.id)).toEqual(["one", "two"]);
  });
});
