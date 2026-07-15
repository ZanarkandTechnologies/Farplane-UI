import { describe, expect, it } from "vitest";
import {
  addPaddedOfficeLayoutTile,
  buildOfficeConnectivityGraphEdges,
  getOfficeExteriorVoidTiles,
  isOfficeExteriorBoundaryLayoutTile,
  sortOfficeLayoutTiles,
} from "./office-layout-topology";

describe("office layout topology", () => {
  it("sorts tile keys by row and then column", () => {
    expect(sortOfficeLayoutTiles(["2:1", "0:-1", "1:1", "invalid"])).toEqual([
      "0:-1",
      "1:1",
      "2:1",
      "invalid",
    ]);
  });

  it("adds a square padded tile neighborhood", () => {
    const tiles = new Set<string>();
    addPaddedOfficeLayoutTile(tiles, 3, -2, 1);
    expect(tiles).toHaveLength(9);
    expect(tiles).toContain("2:-3");
    expect(tiles).toContain("4:-1");
  });

  it("builds a connected spanning graph with a bounded loop edge", () => {
    const edges = buildOfficeConnectivityGraphEdges([
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { x: 2, z: 2 },
    ]);
    expect(edges).toHaveLength(3);
    expect(edges.slice(0, 2).map(({ from, to }) => [from, to])).toEqual([
      [0, 1],
      [1, 2],
    ]);
  });

  it("distinguishes exterior boundaries from enclosed voids", () => {
    const tiles = new Set(["-1:-1", "0:-1", "1:-1", "-1:0", "1:0", "-1:1", "0:1", "1:1"]);
    const exteriorVoid = getOfficeExteriorVoidTiles(tiles);
    expect(exteriorVoid.has("0:0")).toBe(false);
    expect(isOfficeExteriorBoundaryLayoutTile({ tile: "0:-1", exteriorVoid })).toBe(true);
  });
});
