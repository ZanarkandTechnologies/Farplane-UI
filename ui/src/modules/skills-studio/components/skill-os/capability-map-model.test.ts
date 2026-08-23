import { describe, expect, it } from "vitest";
import {
  capabilityClusterColor,
  capabilityDepartmentColor,
  capabilityFocusContains,
  capabilityFocusId,
  capabilityNodeCaption,
  capabilityNodeLabel,
} from "./capability-map-model";
import type { SkillGraphPayload } from "./skill-os-types";

const graph: SkillGraphPayload = {
  edges: [
    { source: "department:marketing", target: "skill:x-thread", type: "member-of" },
    {
      source: "skill:x-thread",
      target: "skill:x-account",
      type: "artifact-flow",
      label: "x-thread-draft",
    },
  ],
  nodes: [
    {
      department_id: "marketing",
      id: "department:marketing",
      kind: "department",
      label: "Marketing",
    },
    {
      capability: { consumes: ["content-brief"], produces: ["x-thread-draft"] },
      group: "marketing",
      id: "skill:x-thread",
      kind: "workstation",
      label: "X Thread Writer",
      skill_id: "x-thread",
    },
    {
      capability: { consumes: ["x-thread-draft"] },
      group: "marketing",
      id: "skill:x-account",
      kind: "facility",
      label: "X Publishing",
      skill_id: "x-account",
    },
  ],
};

describe("capability map model", () => {
  it("keeps an explicit facility boundary beneath its workstation", () => {
    expect(capabilityFocusId(graph, "department:marketing")).toBe("department:marketing");
    expect(capabilityFocusId(graph, "skill:x-thread")).toBeNull();
    expect(capabilityFocusContains(graph, "department:marketing", "skill:x-thread")).toBe(true);
    expect(capabilityFocusContains(graph, "department:marketing", "skill:x-account")).toBe(true);
    expect(graph.edges).toHaveLength(2);
  });

  it("keeps direct workstations and facilities in their declared department colour", () => {
    const department = graph.nodes[0];
    const workstation = graph.nodes[1];
    const facility = graph.nodes[2];
    if (!department || !workstation || !facility) throw new Error("Expected pilot nodes");

    expect(capabilityDepartmentColor(department)).toBe("#E6C86A");
    expect(capabilityClusterColor(workstation)).toBe("#E6C86A");
    expect(capabilityClusterColor(facility)).toBe("#E6C86A");
    expect(capabilityNodeLabel(workstation)).toBe("X Thread Writer");
    expect(capabilityNodeCaption(workstation)).toBe("WORKSTATION");
    expect(capabilityNodeCaption(facility)).toBe("SYSTEM FACILITY");
  });
});
