import { describe, expect, it } from "vitest";

import {
  createRectangularOfficeLayout,
  getOfficeLayoutTileSet,
  officeLayoutTileKey,
} from "@/modules/office/lib/office-layout";
import type { OfficeObject } from "@/modules/office/lib/types";
import { getObjectFootprintCells } from "@/modules/office/systems/occupancy-system";
import { solveOfficeAutoLayout } from "./office-layout-solver";

function object(
  id: string,
  meshType: string,
  position: [number, number, number],
  metadata: Record<string, unknown> = {},
): OfficeObject {
  return {
    _id: id,
    meshType,
    position,
    rotation: [0, 0, 0],
    metadata,
  };
}

describe("office layout solver", () => {
  it("reserves walk path cells before optional furniture placement", () => {
    const solution = solveOfficeAutoLayout({
      sourceLayout: createRectangularOfficeLayout({ width: 20, depth: 12 }),
      requiredObjects: [
        object("left-team", "plant", [-5, 0, 0]),
        object("right-team", "plant", [5, 0, 0]),
      ],
      optionalObjects: [object("center-plant", "plant", [0, 0, 0])],
    });
    const reservedWalkTiles = new Set(solution.reservedWalkTiles);
    const placed = solution.placedOptionalObjects[0];

    expect(solution.reservedWalkTiles.length).toBeGreaterThan(0);
    expect(placed).toBeDefined();
    expect(
      getObjectFootprintCells(placed).some((cell) =>
        reservedWalkTiles.has(cell.key),
      ),
    ).toBe(false);
  });

  it("prunes empty edge tiles while keeping important objects reachable", () => {
    const sourceLayout = createRectangularOfficeLayout({ width: 36, depth: 24 });
    const solution = solveOfficeAutoLayout({
      sourceLayout,
      requiredObjects: [
        object("left-poi", "plant", [-2, 0, 0]),
        object("right-poi", "plant", [2, 0, 0]),
      ],
      optionalObjects: [],
    });

    expect(solution.officeLayout.tiles.length).toBeLessThan(
      sourceLayout.tiles.length,
    );
    expect(solution.poiGraph.disconnectedCount).toBe(0);
    expect(solution.quality.reachablePercent).toBe(1);
  });

  it("does not prune the reserved square around required office tables", () => {
    const table = object("team", "team-cluster", [0, 0, 0], {
      deskCount: 4,
      footprintWidth: 4.3,
      footprintDepth: 4.65,
      footprintClearance: 0.15,
      teamId: "team-project",
    });
    const solution = solveOfficeAutoLayout({
      sourceLayout: createRectangularOfficeLayout({ width: 20, depth: 18 }),
      requiredObjects: [table, object("nearby-poi", "plant", [8, 0, 0])],
      optionalObjects: [],
      targetEmptyPercent: 0.5,
    });
    const finalTiles = getOfficeLayoutTileSet(solution.officeLayout);
    const protectedTableSquare = new Set<string>();

    for (const cell of getObjectFootprintCells(table)) {
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          protectedTableSquare.add(officeLayoutTileKey(cell.x + dx, cell.z + dz));
        }
      }
    }

    expect(solution.debug.prunedTileCount).toBeGreaterThan(0);
    expect(
      [...protectedTableSquare].every((tile) => finalTiles.has(tile)),
    ).toBe(true);
  });

  it("keeps required objects fixed and reports solver debug counts", () => {
    const requiredObjects = [
      object("locked-bookshelf", "bookshelf", [-3, 0, -2]),
      object("locked-couch", "couch", [4, 0, 2]),
    ];
    const solution = solveOfficeAutoLayout({
      sourceLayout: createRectangularOfficeLayout({ width: 24, depth: 18 }),
      requiredObjects,
      optionalObjects: [
        object("optional-plant", "plant", [-3, 0, -2]),
        object("optional-pantry", "pantry", [4, 0, 2]),
      ],
    });

    expect(requiredObjects[0]?.position).toEqual([-3, 0, -2]);
    expect(requiredObjects[1]?.position).toEqual([4, 0, 2]);
    expect(solution.debug.optionalObjectCount).toBe(2);
    expect(solution.debug.placedOptionalObjectCount).toBe(
      solution.placedOptionalObjects.length,
    );
    expect(solution.debug.stages.map((stage) => stage.name)).toEqual([
      "render_strategy_graph",
      "reserve_shortest_walk_paths",
      "pack_optional_objects",
      "prune_empty_edges",
    ]);
    expect(solution.poiGraph.disconnectedCount).toBe(0);
  });

  it("packs optional objects with a configurable minimum gap", () => {
    const solution = solveOfficeAutoLayout({
      sourceLayout: createRectangularOfficeLayout({ width: 22, depth: 18 }),
      requiredObjects: [object("team", "plant", [0, 0, 0])],
      optionalObjects: [
        object("optional-bookshelf", "bookshelf", [0, 0, 0]),
        object("optional-couch", "couch", [0, 0, 0]),
        object("optional-plant", "plant", [0, 0, 0]),
      ],
      objectGapTiles: 2,
    });

    expect(solution.debug.objectGapTiles).toBe(2);
    expect(solution.placedOptionalObjects.length).toBe(3);
    for (const placed of solution.placedOptionalObjects) {
      expect(placed.metadata?.footprintClearance).toBeGreaterThanOrEqual(1);
    }
  });

  it("normalizes invalid solver tuning knobs before footprint math", () => {
    const solution = solveOfficeAutoLayout({
      sourceLayout: createRectangularOfficeLayout({ width: 8, depth: 8 }),
      requiredObjects: [object("team", "plant", [0, 0, 0])],
      optionalObjects: [object("optional-plant", "plant", [0, 0, 0])],
      paddingTiles: Number.NaN,
      corridorRadiusTiles: Number.POSITIVE_INFINITY,
      targetEmptyPercent: -4,
      objectGapTiles: Number.NaN,
    });
    const placed = solution.placedOptionalObjects[0];
    const finalTiles = getOfficeLayoutTileSet(solution.officeLayout);

    expect(solution.debug.objectGapTiles).toBe(1);
    expect(placed).toBeDefined();
    expect(getObjectFootprintCells(placed!).length).toBeGreaterThan(0);
    expect(
      getObjectFootprintCells(placed!).every((cell) => finalTiles.has(cell.key)),
    ).toBe(true);
    expect(solution.poiGraph.disconnectedCount).toBe(0);
  });

  it("expands a compact annex for optional objects that cannot fit inside", () => {
    const sourceLayout = createRectangularOfficeLayout({ width: 5, depth: 5 });
    const solution = solveOfficeAutoLayout({
      sourceLayout,
      requiredObjects: [object("team", "plant", [0, 0, 0])],
      optionalObjects: [object("overflow-pantry", "pantry", [0, 0, 0])],
      targetEmptyPercent: 0.5,
    });
    const placed = solution.placedOptionalObjects.find(
      (entry) => entry._id === "overflow-pantry",
    );
    const packStage = solution.debug.stages.find(
      (stage) => stage.name === "pack_optional_objects",
    );
    const finalTiles = getOfficeLayoutTileSet(solution.officeLayout);

    expect(placed).toBeDefined();
    expect(solution.debug.overflowPlacedObjectCount).toBe(1);
    expect(solution.debug.unplacedOptionalObjectCount).toBe(0);
    expect(packStage?.overflowPlacedObjectCount).toBe(1);
    expect(packStage?.expansionTileCount).toBeGreaterThan(0);
    expect(
      getObjectFootprintCells(placed!).every((cell) => finalTiles.has(cell.key)),
    ).toBe(true);
    expect(solution.poiGraph.disconnectedCount).toBe(0);
  });

  it("fills existing empty floor before growing overflow space", () => {
    const sourceLayout = createRectangularOfficeLayout({ width: 9, depth: 9 });
    const sourceTiles = getOfficeLayoutTileSet(sourceLayout);
    const solution = solveOfficeAutoLayout({
      sourceLayout,
      requiredObjects: [object("team", "plant", [0, 0, 0])],
      optionalObjects: [
        object("overflow-pantry", "pantry", [0, 0, 0]),
        object("inside-plant", "plant", [2, 0, 2]),
      ],
      targetEmptyPercent: 0.5,
    });
    const insidePlant = solution.placedOptionalObjects.find(
      (entry) => entry._id === "inside-plant",
    );
    const overflowPantry = solution.placedOptionalObjects.find(
      (entry) => entry._id === "overflow-pantry",
    );
    const packStage = solution.debug.stages.find(
      (stage) => stage.name === "pack_optional_objects",
    );

    expect(insidePlant).toBeDefined();
    expect(overflowPantry).toBeDefined();
    expect(sourceTiles.has(`${insidePlant!.position[0]}:${insidePlant!.position[2]}`)).toBe(
      true,
    );
    expect(
      getObjectFootprintCells(overflowPantry!).some((cell) => !sourceTiles.has(cell.key)),
    ).toBe(true);
    expect(packStage?.insidePlacedObjectCount).toBe(1);
    expect(packStage?.overflowPlacedObjectCount).toBe(1);
    expect(solution.debug.unplacedOptionalObjectCount).toBe(0);
  });
});
