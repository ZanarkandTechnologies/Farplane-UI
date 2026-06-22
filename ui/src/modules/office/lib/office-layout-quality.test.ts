import { describe, expect, it } from "vitest";

import { officeLayoutTileKey, type OfficeLayoutModel } from "./office-layout";
import { evaluateOfficeLayoutQuality, evaluateOfficePoiGraph } from "./office-layout-quality";

function layoutFromTiles(tiles: Array<[number, number]>): OfficeLayoutModel {
  return {
    version: 1,
    tileSize: 1,
    tiles: tiles.map(([x, z]) => officeLayoutTileKey(x, z)),
  };
}

describe("evaluateOfficeLayoutQuality", () => {
  it("reports fully connected walkable layouts", () => {
    const quality = evaluateOfficeLayoutQuality({
      layout: layoutFromTiles([
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
      ]),
      objects: [],
    });

    expect(quality.reachablePercent).toBe(1);
    expect(quality.disconnectedWalkableTiles).toBe(0);
    expect(quality.deadEndCount).toBe(2);
    expect(quality.chokePointCount).toBeGreaterThan(0);
  });

  it("penalizes disconnected walkable islands and target paths", () => {
    const quality = evaluateOfficeLayoutQuality({
      layout: layoutFromTiles([
        [0, 0],
        [1, 0],
        [10, 0],
        [11, 0],
      ]),
      objects: [
        {
          _id: "left",
          meshType: "team-cluster",
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          metadata: { footprintWidth: 0.1, footprintDepth: 0.1, footprintClearance: 0 },
        },
        {
          _id: "right",
          meshType: "plant",
          position: [11, 0, 0],
          rotation: [0, 0, 0],
          metadata: { footprintWidth: 0.1, footprintDepth: 0.1, footprintClearance: 0 },
        },
      ],
    });

    expect(quality.reachablePercent).toBeLessThan(1);
    expect(quality.disconnectedWalkableTiles).toBeGreaterThan(0);
    expect(quality.disconnectedTargetCount).toBeGreaterThan(0);
    expect(quality.score).toBeLessThan(0.5);
  });
});

describe("evaluateOfficePoiGraph", () => {
  it("proves team and furniture POIs are reachable through the walkable tile graph", () => {
    const graph = evaluateOfficePoiGraph({
      layout: layoutFromTiles([
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
        [4, 0],
      ]),
      objects: [
        {
          _id: "team-a",
          meshType: "team-cluster",
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          metadata: { footprintWidth: 0.1, footprintDepth: 0.1, footprintClearance: 0 },
        },
        {
          _id: "bookshelf-a",
          meshType: "bookshelf",
          position: [4, 0, 0],
          rotation: [0, 0, 0],
          metadata: { footprintWidth: 0.1, footprintDepth: 0.1, footprintClearance: 0 },
        },
      ],
    });

    expect(graph.rootId).toBe("team-cluster:team-a");
    expect(graph.nodes).toHaveLength(2);
    expect(graph.disconnectedIds).toEqual([]);
    expect(graph.reachableCount).toBe(2);
    expect(graph.averagePathLength).toBeGreaterThan(0);
  });

  it("names disconnected POIs instead of hiding them inside aggregate walkability", () => {
    const graph = evaluateOfficePoiGraph({
      layout: layoutFromTiles([
        [0, 0],
        [1, 0],
        [10, 0],
        [11, 0],
      ]),
      objects: [
        {
          _id: "team-a",
          meshType: "team-cluster",
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          metadata: { footprintWidth: 0.1, footprintDepth: 0.1, footprintClearance: 0 },
        },
        {
          _id: "pantry-a",
          meshType: "pantry",
          position: [11, 0, 0],
          rotation: [0, 0, 0],
          metadata: { footprintWidth: 0.1, footprintDepth: 0.1, footprintClearance: 0 },
        },
      ],
    });

    expect(graph.disconnectedCount).toBe(1);
    expect(graph.disconnectedIds).toEqual(["pantry:pantry-a"]);
  });
});
