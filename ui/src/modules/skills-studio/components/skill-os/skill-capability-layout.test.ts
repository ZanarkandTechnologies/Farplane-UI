import { describe, expect, it } from "vitest";
import { buildCapabilityGraphLayout } from "./skill-capability-layout";
import type { SkillGraphPayload } from "./skill-os-types";

const graph: SkillGraphPayload = {
  edges: [
    { source: "department:marketing", target: "skill:social-content", type: "member-of" },
    { source: "department:intelligence", target: "skill:research", type: "member-of" },
    { source: "skill:social-content", target: "method:social-content:thread", type: "contains" },
    { source: "skill:social-content", target: "method:social-content:carousel", type: "contains" },
    { source: "skill:research", target: "method:research:source-synthesis", type: "contains" },
  ],
  nodes: [
    {
      department_id: "marketing",
      id: "department:marketing",
      kind: "department",
      label: "Marketing",
    },
    {
      department_id: "intelligence",
      id: "department:intelligence",
      kind: "department",
      label: "Intelligence",
    },
    {
      group: "marketing",
      id: "skill:social-content",
      kind: "workflow",
      label: "social-content",
      skill_id: "social-content",
    },
    {
      group: "intelligence",
      id: "skill:research",
      kind: "workflow",
      label: "research",
      skill_id: "research",
    },
    {
      group: "marketing",
      id: "method:social-content:thread",
      kind: "artifact",
      label: "x-thread-draft",
      method_id: "social-content:thread",
      parent_skill: "social-content",
    },
    {
      group: "marketing",
      id: "method:social-content:carousel",
      kind: "artifact",
      label: "social-carousel-draft",
      method_id: "social-content:carousel",
      parent_skill: "social-content",
    },
    {
      group: "intelligence",
      id: "method:research:source-synthesis",
      kind: "artifact",
      label: "source-synthesis-report",
      method_id: "research:source-synthesis",
      parent_skill: "research",
    },
  ],
};

describe("capability map layout", () => {
  it("renders department anchors, their workflows, and declared artifact leaves in the overview", () => {
    const layout = buildCapabilityGraphLayout(graph, null);

    expect(layout.nodes).toHaveLength(7);
    expect(layout.nodes.filter((node) => node.kind === "department")).toHaveLength(2);
    expect(layout.nodes.filter((node) => node.kind === "workflow")).toHaveLength(2);
    expect(layout.nodes.filter((node) => node.kind === "artifact")).toHaveLength(3);
    expect(layout.edges).toHaveLength(5);
    expect(layout.points.get("department:marketing")?.y).not.toBe(
      layout.points.get("skill:social-content")?.y,
    );
  });

  it("zooms a department to its workflow constellation, then a workflow to its direct artifacts", () => {
    const departmentLayout = buildCapabilityGraphLayout(graph, "department:marketing");
    const skillLayout = buildCapabilityGraphLayout(graph, "skill:social-content");

    expect(departmentLayout.nodes.map((node) => node.id)).toEqual([
      "department:marketing",
      "skill:social-content",
      "method:social-content:carousel",
      "method:social-content:thread",
    ]);
    expect(departmentLayout.edges).toHaveLength(3);
    const marketingWorkflows = departmentLayout.nodes.filter((node) => node.kind === "workflow");
    expect(marketingWorkflows).toHaveLength(1);
    expect(marketingWorkflows[0].y).toBeLessThan(
      departmentLayout.points.get("department:marketing")?.y ?? 0,
    );

    expect(skillLayout.nodes.map((node) => node.id)).toEqual([
      "skill:social-content",
      "method:social-content:carousel",
      "method:social-content:thread",
    ]);
    expect(skillLayout.edges).toHaveLength(2);
    expect(
      Math.max(
        ...skillLayout.nodes.filter((node) => node.kind !== "workflow").map((node) => node.y),
      ),
    ).toBeLessThan(skillLayout.points.get("skill:social-content")?.y ?? 0);
  });
});
