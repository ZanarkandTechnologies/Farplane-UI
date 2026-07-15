import { describe, expect, it } from "vitest";

import { officeLayoutTileKey, type OfficeLayoutModel } from "./office-layout";
import { deriveOfficeSpaceStats } from "./office-space-stats";

function createLayout(width: number, depth: number): OfficeLayoutModel {
  const tiles: string[] = [];
  for (let x = 0; x < width; x += 1) {
    for (let z = 0; z < depth; z += 1) {
      tiles.push(officeLayoutTileKey(x, z));
    }
  }
  return { version: 1, tileSize: 1, tiles };
}

describe("deriveOfficeSpaceStats", () => {
  it("counts floor occupancy and employee presence buckets", () => {
    const stats = deriveOfficeSpaceStats({
      officeLayout: createLayout(10, 10),
      officeObjects: [
        {
          _id: "team-cluster-team-a",
          meshType: "team-cluster",
          position: [4, 0, 4],
          rotation: [0, 0, 0],
          metadata: { footprintWidth: 4, footprintDepth: 4, footprintClearance: 0 },
        },
      ],
      employees: [
        {
          _id: "employee-persistent",
          teamId: "team-a",
          name: "Persistent",
          team: "A",
          initialPosition: [0, 0, 0],
          isBusy: false,
          presencePersistent: true,
        },
        {
          _id: "employee-ephemeral",
          teamId: "team-a",
          name: "Ephemeral",
          team: "A",
          initialPosition: [0, 0, 0],
          isBusy: false,
          presencePersistent: false,
        },
      ],
    });

    expect(stats.totalEmployees).toBe(2);
    expect(stats.persistentEmployees).toBe(1);
    expect(stats.ephemeralEmployees).toBe(1);
    expect(stats.floorTiles).toBe(100);
    expect(stats.occupiedTiles).toBeGreaterThan(0);
    expect(stats.emptyPercent).toBeGreaterThan(0);
    expect(stats.maskFillPercent).toBe(1);
    expect(stats.walkablePercent).toBeGreaterThan(0);
    expect(stats.layoutQualityScore).toBeGreaterThanOrEqual(0);
  });

  it("counts explicit walkable visual zones without changing navigation footprints", () => {
    const baseObject = {
      _id: "generated-command-commons",
      meshType: "command-commons",
      position: [5, 0, 5] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      metadata: { footprintWidth: 4, footprintDepth: 3, footprintClearance: 0 },
    };
    const withoutZone = deriveOfficeSpaceStats({
      officeLayout: createLayout(12, 12),
      officeObjects: [baseObject],
      employees: [],
    });
    const withZone = deriveOfficeSpaceStats({
      officeLayout: createLayout(12, 12),
      officeObjects: [
        {
          ...baseObject,
          metadata: {
            ...baseObject.metadata,
            visualFootprintWidth: 8,
            visualFootprintDepth: 7,
          },
        },
      ],
      employees: [],
    });

    expect(withZone.occupiedTiles).toBeGreaterThan(withoutZone.occupiedTiles);
    expect(withZone.emptyPercent).toBeLessThan(withoutZone.emptyPercent);
  });
});
