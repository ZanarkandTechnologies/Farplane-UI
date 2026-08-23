import { describe, expect, it } from "vitest";
import { buildCapabilityGraphLayout } from "./skill-capability-layout";
import type { SkillGraphPayload } from "./skill-os-types";

const graph: SkillGraphPayload = {
  edges: [
    { source: "department:marketing", target: "skill:content-brief", type: "member-of" },
    { source: "department:marketing", target: "skill:x-thread", type: "member-of" },
    {
      source: "skill:content-brief",
      target: "skill:x-thread",
      type: "artifact-flow",
      label: "content-brief",
    },
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
      id: "skill:content-brief",
      kind: "workstation",
      label: "Content Brief",
      skill_id: "content-brief",
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

    expect(layout.nodes).toHaveLength(6);
    expect(layout.nodes.filter((node) => node.kind === "department")).toHaveLength(2);
    expect(layout.nodes.filter((node) => node.kind === "workstation")).toHaveLength(3);
    expect(layout.nodes.filter((node) => node.kind === "facility")).toHaveLength(1);
    expect(layout.edges).toHaveLength(4);
    expect(layout.points.get("department:marketing")?.y).not.toBe(
      layout.points.get("skill:x-thread")?.y,
    );
  });

  it("zooms a department into a directed artifact-flow chain", () => {
    const layout = buildCapabilityGraphLayout(graph, "department:marketing");

    expect(layout.nodes.map((node) => node.id)).toEqual([
      "department:marketing",
      "skill:content-brief",
      "skill:x-thread",
      "skill:x-account",
    ]);
    expect(layout.edges).toEqual([
      expect.objectContaining({
        source: "department:marketing",
        target: "skill:content-brief",
        type: "member-of",
      }),
      expect.objectContaining({
        source: "skill:content-brief",
        target: "skill:x-thread",
        type: "artifact-flow",
      }),
      expect.objectContaining({
        source: "skill:x-thread",
        target: "skill:x-account",
        type: "artifact-flow",
      }),
    ]);
    expect(
      layout.edges.some(
        (edge) =>
          edge.source === "skill:x-thread" &&
          edge.target === "skill:x-account" &&
          edge.type === "artifact-flow",
      ),
    ).toBe(true);
    expect(
      layout.edges.some(
        (edge) =>
          edge.source === "department:marketing" &&
          edge.target === "skill:x-thread" &&
          edge.type === "member-of",
      ),
    ).toBe(false);
    expect(layout.points.get("skill:x-thread")?.y).toBeLessThan(
      layout.points.get("skill:content-brief")?.y ?? Number.POSITIVE_INFINITY,
    );
    expect(layout.points.get("skill:x-account")?.y).toBeLessThan(
      layout.points.get("skill:x-thread")?.y ?? Number.POSITIVE_INFINITY,
    );
    expect(
      layout.nodes.filter((node) => node.kind !== "department").every((node) => node.y < 650),
    ).toBe(true);
  });
});
