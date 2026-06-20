import { describe, expect, it } from "vitest";

import { officeLayoutTileKey, type OfficeLayoutModel } from "./office-layout";
import { evaluateOfficeLayoutQuality } from "./office-layout-quality";

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
          meshType: "custom-mesh",
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          metadata: { footprintWidth: 0.1, footprintDepth: 0.1, footprintClearance: 0 },
        },
        {
          _id: "right",
          meshType: "custom-mesh",
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
