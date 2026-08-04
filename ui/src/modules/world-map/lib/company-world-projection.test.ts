import { describe, expect, it } from "vitest";
import type { WorldProjection } from "../types";
import {
  COMPANY_WORLD_PREVIEW_CAPS,
  mergeCompanyWorld,
  normalizeCompanyWorldProjectRefs,
} from "./company-world-projection";

function projection(projectId: string, nodeCount = 1): WorldProjection {
  const nodes = Array.from({ length: nodeCount }, (_, index) => ({
    key: `${projectId}:shared-${index}`,
    entityId: `shared-${index}`,
    projectId,
    name: index === 0 ? "Shared Company" : `Entity ${index}`,
    kind: "company",
    aliases: [],
    metadata: {},
  }));
  return {
    schemaVersion: "3",
    project: { id: projectId, name: projectId },
    nodes,
    edges: [
      {
        key: `${projectId}:edge-valid`,
        projectId,
        sourceKey: nodes[0]?.key ?? "missing",
        targetKey: nodes[1]?.key ?? nodes[0]?.key ?? "missing",
        sourceEntityId: nodes[0]?.entityId ?? "missing",
        targetEntityId: nodes[1]?.entityId ?? nodes[0]?.entityId ?? "missing",
        context: "Connected",
        displayContext: "Connected",
      },
      {
        key: `${projectId}:edge-invalid`,
        projectId,
        sourceKey: nodes[0]?.key ?? "missing",
        targetKey: "missing:endpoint",
        sourceEntityId: nodes[0]?.entityId ?? "missing",
        targetEntityId: "missing",
        context: "Broken",
        displayContext: "Broken",
      },
    ],
    views: [],
    timeline: nodes[0]
      ? [
          {
            key: `${projectId}:timeline`,
            projectId,
            date: "2026-08-05",
            sourceEntityId: nodes[0].entityId,
            entityIds: [nodes[0].entityId],
            entityKeys: [nodes[0].key],
            context: "Evidence",
            displayContext: "Evidence",
            tags: {},
          },
        ]
      : [],
    issues: [],
    stale: false,
  };
}

describe("company world projection", () => {
  it("keeps same-id/name entities distinct and rewrites all project-qualified references", () => {
    const merged = mergeCompanyWorld([
      { ref: { id: "acme", name: "Acme", path: "/acme" }, projection: projection("local", 2) },
      { ref: { id: "nova", name: "Nova", path: "/nova" }, projection: projection("local", 2) },
      { ref: { id: "broken", name: "Broken", path: "/broken" }, error: "invalid json" },
      { ref: { id: "empty", name: "Empty", path: "/empty" }, projection: null },
    ]);

    expect(
      merged.nodes.filter((node) => node.name === "Shared Company").map((node) => node.key),
    ).toEqual(["acme::local:shared-0", "nova::local:shared-0"]);
    expect(merged.edges).toHaveLength(2);
    expect(merged.edges[0]).toMatchObject({
      projectId: "acme",
      sourceKey: "acme::local:shared-0",
      targetKey: "acme::local:shared-1",
    });
    expect(merged.timeline.map((entry) => entry.entityKeys)).toEqual([
      ["acme::local:shared-0"],
      ["nova::local:shared-0"],
    ]);
    expect(
      merged.warnings.filter((warning) => warning.code === "invalid_edge_endpoint"),
    ).toHaveLength(2);
    expect(merged.warnings).toContainEqual(
      expect.objectContaining({ code: "project_error", projectId: "broken" }),
    );
    expect(merged.warnings).toContainEqual(
      expect.objectContaining({ code: "project_missing", projectId: "empty" }),
    );
  });

  it("sorts, dedupes, and caps configured projects deterministically", () => {
    const input = [
      ...Array.from({ length: 25 }, (_, index) => ({
        id: `project-${String(index).padStart(2, "0")}`,
        name: `Project ${index}`,
        path: `/project-${index}`,
      })),
      { id: "project-00", name: "Duplicate", path: "/duplicate" },
    ].reverse();
    const normalized = normalizeCompanyWorldProjectRefs(input);
    expect(normalized.refs).toHaveLength(24);
    expect(normalized.refs[0]?.id).toBe("project-00");
    expect(normalized.refs.at(-1)?.id).toBe("project-23");
    expect(normalized.warnings.map((warning) => warning.code)).toEqual([
      "duplicate_project",
      "project_cap",
    ]);
  });

  it("applies panel and preview caps without retaining orphaned edges", () => {
    const result = {
      ref: { id: "large", name: "Large", path: "/large" },
      projection: projection("large", 100),
    };
    const preview = mergeCompanyWorld([result], COMPANY_WORLD_PREVIEW_CAPS);
    expect(preview.nodes).toHaveLength(80);
    expect(
      preview.edges.every((edge) => preview.nodes.some((node) => node.key === edge.sourceKey)),
    ).toBe(true);
    expect(preview.warnings).toContainEqual(expect.objectContaining({ code: "node_cap" }));
  });
});
