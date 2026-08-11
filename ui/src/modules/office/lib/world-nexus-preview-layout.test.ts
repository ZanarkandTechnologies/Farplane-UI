import { describe, expect, it } from "vitest";
import type { CompanyWorldProjection } from "@/modules/world-map/types";
import {
  buildWorldNexusPreviewGraph,
  WORLD_NEXUS_PREVIEW_CAPS,
} from "./world-nexus-preview-layout";

function companyWorld(nodeCount = 3): CompanyWorldProjection {
  const nodes = Array.from({ length: nodeCount }, (_, index) => ({
    key: `alpha::entity-${index}`,
    entityId: `entity-${index}`,
    projectId: "alpha",
    name: `Entity ${index}`,
    kind: "company",
    aliases: [],
    metadata: {},
  }));
  return {
    schemaVersion: "company-1",
    project: { id: "all-projects", name: "All projects" },
    projects: [],
    nodes,
    edges: [
      {
        key: "alpha::valid",
        projectId: "alpha",
        sourceKey: nodes[0]?.key ?? "missing",
        targetKey: nodes[1]?.key ?? "missing",
        sourceEntityId: "entity-0",
        targetEntityId: "entity-1",
        context: "mentions",
        displayContext: "mentions",
      },
      {
        key: "alpha::orphan",
        projectId: "alpha",
        sourceKey: nodes[0]?.key ?? "missing",
        targetKey: "missing",
        sourceEntityId: "entity-0",
        targetEntityId: "missing",
        context: "mentions",
        displayContext: "mentions",
      },
    ],
    views: [],
    timeline: [],
    issues: [],
    warnings: [],
    stale: false,
    loadedAt: 1,
  };
}

describe("buildWorldNexusPreviewGraph", () => {
  it("is deterministic and only keeps associations with visible endpoints", () => {
    const projection = companyWorld();
    const first = buildWorldNexusPreviewGraph(projection);
    const second = buildWorldNexusPreviewGraph(projection);

    expect(first).toEqual(second);
    expect(first.nodes).toHaveLength(3);
    expect(first.edges).toEqual([
      expect.objectContaining({ key: "alpha::valid", sourceKey: "alpha::entity-0" }),
    ]);
  });

  it("keeps the preview within its render budget", () => {
    const graph = buildWorldNexusPreviewGraph(companyWorld(100));

    expect(graph.nodes).toHaveLength(WORLD_NEXUS_PREVIEW_CAPS.nodes);
    expect(graph.edges.length).toBeLessThanOrEqual(WORLD_NEXUS_PREVIEW_CAPS.edges);
  });

  it("uses configured project sources when World has not compiled entities yet", () => {
    const projection = companyWorld(0);
    projection.projects = [
      { id: "alpha", name: "Alpha", path: "/alpha", state: "ready", nodeCount: 0, edgeCount: 0 },
      { id: "beta", name: "Beta", path: "/beta", state: "missing", nodeCount: 0, edgeCount: 0 },
      { id: "gamma", name: "Gamma", path: "/gamma", state: "error", nodeCount: 0, edgeCount: 0 },
    ];

    const graph = buildWorldNexusPreviewGraph(projection);

    expect(graph.nodes.map((node) => node.key)).toEqual(["project:alpha", "project:beta"]);
    expect(graph.edges).toEqual([]);
  });
});
