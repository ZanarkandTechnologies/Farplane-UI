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
    {
      source: "department:marketing",
      target: "skill:social-content",
      type: "member-of",
    },
    {
      source: "skill:social-content",
      target: "method:social-content:twitter-thread",
      type: "contains",
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
      group: "marketing",
      id: "skill:social-content",
      kind: "workflow",
      label: "social-content",
      skill_id: "social-content",
    },
    {
      group: "marketing",
      id: "method:social-content:twitter-thread",
      kind: "artifact",
      label: "x-thread-draft",
      method_id: "social-content:twitter-thread",
      output: "x-thread-draft",
      parent_skill: "social-content",
    },
  ],
};

describe("capability map model", () => {
  it("preserves the generated department membership instead of inventing an area", () => {
    const department = graph.nodes.find((node) => node.id === "department:marketing");
    if (!department) throw new Error("Expected Marketing department");
    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        source: "department:marketing",
        target: "skill:social-content",
        type: "member-of",
      }),
    );
    expect(capabilityNodeLabel(department)).toBe("Marketing");
    expect(capabilityNodeCaption(department)).toBe("DEPARTMENT");
  });

  it("uses declared department colour through a workflow and its artifact specialist", () => {
    const department = graph.nodes.find((node) => node.id === "department:marketing");
    const workflow = graph.nodes.find((node) => node.id === "skill:social-content");
    const action = graph.nodes.find((node) => node.id === "method:social-content:twitter-thread");
    if (!department || !workflow || !action)
      throw new Error("Expected declared Marketing graph nodes");

    expect(capabilityDepartmentColor(department)).toBe("#E6C86A");
    expect(capabilityDepartmentColor(department)).toBe(capabilityClusterColor(workflow));
    expect(capabilityClusterColor(action)).toBe(capabilityClusterColor(workflow));
    expect(capabilityNodeLabel(action)).toBe("X Thread");
    expect(capabilityNodeCaption(workflow)).toBe("WORKFLOW");
    expect(capabilityNodeCaption(action)).toBe("ARTIFACT");
  });

  it("resolves department and workflow focus through declared graph edges", () => {
    expect(capabilityFocusId(graph, "department:marketing")).toBe("department:marketing");
    expect(capabilityFocusId(graph, "social-content")).toBe("skill:social-content");
    expect(
      capabilityFocusContains(
        graph,
        "department:marketing",
        "method:social-content:twitter-thread",
      ),
    ).toBe(true);
  });
});
