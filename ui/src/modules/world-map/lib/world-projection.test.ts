import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  filterWorldEdges,
  filterWorldNodes,
  parseWorldProjection,
  worldGeoJson,
} from "./world-projection";

const fixture = JSON.parse(
  readFileSync(path.resolve(__dirname, "../fixtures/project/.farplane/entities/world.json"), "utf8"),
) as unknown;

describe("world projection", () => {
  it("parses the Core contract without dropping unlocated nodes or sentence context", () => {
    const projection = parseWorldProjection(fixture);
    expect(projection.project).toEqual({
      id: "fixture-supply-chain",
      name: "Fixture Supply Chain",
      path: undefined,
    });
    expect(projection.nodes).toHaveLength(3);
    expect(projection.nodes[0].metadata.industry).toBe("industrial-components");
    expect(projection.edges[0].context).toContain("supplies aluminum housings");
    expect(projection.edges[0].context).toContain("[Acme Motors](entity:acme-motors)");
    expect(projection.edges[0].displayContext).toContain(
      "supplies aluminum housings to Acme Motors",
    );
    expect(projection.edges[0].displayContext).not.toContain("entity:");
    expect(projection.views).toEqual([
      {
        id: "malaysia-suppliers",
        name: "Malaysia Suppliers",
        entityIds: ["penang-castings", "precision-alloys"],
      },
    ]);
  });

  it("combines named-view membership with ordinary filters and removes orphaned edges", () => {
    const projection = parseWorldProjection(fixture);
    const nodes = filterWorldNodes(
      projection.nodes,
      { query: "", kind: "all", location: "Malaysia", viewId: "malaysia-suppliers" },
      projection.views,
    );
    expect(nodes.map((node) => node.entityId)).toEqual([
      "penang-castings",
      "precision-alloys",
    ]);
    expect(filterWorldEdges(projection.edges, nodes)).toEqual([]);
    expect(
      filterWorldNodes(
        projection.nodes,
        { query: "", kind: "all", location: "", viewId: "all" },
        projection.views,
      ),
    ).toHaveLength(3);
  });

  it("filters names, aliases, kinds, and locations while retaining unlocated matches", () => {
    const projection = parseWorldProjection(fixture);
    expect(
      filterWorldNodes(projection.nodes, {
        query: "PC Manufacturing",
        kind: "all",
        location: "",
      }).map((row) => row.entityId),
    ).toEqual(["penang-castings"]);
    expect(
      filterWorldNodes(projection.nodes, { query: "", kind: "supplier", location: "" }).map(
        (row) => row.entityId,
      ),
    ).toEqual(["precision-alloys"]);
    expect(
      filterWorldNodes(projection.nodes, { query: "", kind: "all", location: "Malaysia" }),
    ).toHaveLength(2);
  });

  it("plots only located nodes and edges whose two endpoints are plotted", () => {
    const projection = parseWorldProjection(fixture);
    const complete = worldGeoJson(projection.nodes, projection.edges);
    expect(complete.points.features).toHaveLength(2);
    expect(complete.lines.features).toHaveLength(1);
    expect(complete.lines.features[0]?.properties).toMatchObject({
      sourceName: "Penang Castings",
      targetName: "Acme Motors",
    });
    const withoutTarget = worldGeoJson(
      [projection.nodes[0], projection.nodes[2]],
      projection.edges,
    );
    expect(withoutTarget.points.features).toHaveLength(1);
    expect(withoutTarget.lines.features).toHaveLength(0);
  });

  it("preserves Core compiler issues that use the reason field", () => {
    const projection = parseWorldProjection({
      project: { project_id: "fixture" },
      nodes: [],
      edges: [],
      issues: [{ path: ".farplane/entities/acme.md", reason: "unresolved_entity_link:missing" }],
    });

    expect(projection.issues).toEqual([
      {
        code: "unresolved_entity_link:missing",
        message: "unresolved_entity_link:missing",
        path: ".farplane/entities/acme.md",
      },
    ]);
  });

  it("handles large local projections with deterministic filtering", () => {
    const base = parseWorldProjection(fixture);
    const nodes = Array.from({ length: 1200 }, (_, index) => ({
      ...base.nodes[0],
      key: `project:entity-${index}`,
      entityId: `entity-${index}`,
      name: `Entity ${index}`,
    }));
    expect(
      filterWorldNodes(nodes, { query: "Entity 1199", kind: "all", location: "" }),
    ).toHaveLength(1);
  });
});
