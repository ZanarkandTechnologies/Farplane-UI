import { describe, expect, it } from "vitest";
import { buildCapabilityGraphLayout } from "./skill-capability-layout";
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
    { source: "department:intelligence", target: "skill:research", type: "member-of" },
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
      id: "skill:x-thread",
      kind: "workstation",
      label: "X Thread Writer",
      skill_id: "x-thread",
    },
    {
      group: "marketing",
      id: "skill:x-account",
      kind: "facility",
      label: "X Publishing",
      skill_id: "x-account",
    },
    {
      group: "intelligence",
      id: "skill:research",
      kind: "workstation",
      label: "Research Desk",
      skill_id: "research",
    },
  ],
};

describe("capability map layout", () => {
  it("renders an admitted facility behind its artifact-producing workstation", () => {
    const layout = buildCapabilityGraphLayout(graph, null);

    expect(layout.nodes).toHaveLength(5);
    expect(layout.nodes.filter((node) => node.kind === "department")).toHaveLength(2);
    expect(layout.nodes.filter((node) => node.kind === "workstation")).toHaveLength(2);
    expect(layout.nodes.filter((node) => node.kind === "facility")).toHaveLength(1);
    expect(layout.edges).toHaveLength(3);
    expect(layout.points.get("department:marketing")?.y).not.toBe(
      layout.points.get("skill:x-thread")?.y,
    );
  });

  it("zooms a department into a directed artifact-flow constellation", () => {
    const layout = buildCapabilityGraphLayout(graph, "department:marketing");

    expect(layout.nodes.map((node) => node.id)).toEqual([
      "department:marketing",
      "skill:x-thread",
      "skill:x-account",
    ]);
    expect(layout.edges).toHaveLength(2);
    expect(
      layout.edges.some(
        (edge) =>
          edge.source === "skill:x-thread" &&
          edge.target === "skill:x-account" &&
          edge.type === "artifact-flow",
      ),
    ).toBe(true);
    expect(layout.points.get("skill:x-account")?.y).toBeLessThan(
      layout.points.get("skill:x-thread")?.y ?? Number.POSITIVE_INFINITY,
    );
    expect(
      layout.nodes.filter((node) => node.kind !== "department").every((node) => node.y < 650),
    ).toBe(true);
  });
});
