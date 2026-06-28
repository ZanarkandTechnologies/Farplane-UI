import { describe, expect, it } from "vitest";

import type { OfficeAreaNode } from "./office-area-layout";
import {
  createRectangularOfficeLayout,
  getOfficeLayoutBounds,
} from "./office-layout";
import type { OfficeObject } from "./types";
import {
  buildDefaultFurnitureObjects,
  getOfficeObjectFootprintTileBounds,
  isAutoPackableStarterObject,
  isOfficeObjectPlacementLocked,
  placeFurnitureInEmptySpace,
} from "./office-furniture-placement";
import {
  getObjectFootprintAabb,
  isObjectFootprintInsideLayout,
} from "../systems/occupancy-system";
import { createOfficePlacementReservation } from "../systems/placement-engine";

function furniture(
  _id: string,
  meshType: string,
  position: [number, number, number],
): OfficeObject {
  return {
    _id,
    meshType,
    position,
    rotation: [0, 0, 0],
  };
}

function area(input: {
  id: string;
  projectId?: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}): OfficeAreaNode {
  const width = input.maxX - input.minX;
  const depth = input.maxZ - input.minZ;
  return {
    id: input.id,
    label: input.id,
    kind: input.projectId ? "project" : "district",
    depth: 1,
    projectId: input.projectId,
    weight: 1,
    color: "#ffffff",
    rect: {
      minX: input.minX,
      maxX: input.maxX,
      minZ: input.minZ,
      maxZ: input.maxZ,
      width,
      depth,
      centerX: input.minX + width / 2,
      centerZ: input.minZ + depth / 2,
    },
  };
}

function objectOverlapsArea(object: OfficeObject, targetArea: OfficeAreaNode): boolean {
  const bounds = getObjectFootprintAabb(object);
  return (
    bounds.minX < targetArea.rect.maxX &&
    bounds.maxX > targetArea.rect.minX &&
    bounds.minZ < targetArea.rect.maxZ &&
    bounds.maxZ > targetArea.rect.minZ
  );
}

describe("office furniture placement", () => {
  it("keeps generated default furniture footprints inside compact layouts", () => {
    const layout = createRectangularOfficeLayout({ width: 12, depth: 10 });
    const defaults = buildDefaultFurnitureObjects("company-1", layout, [
      furniture("team", "team-cluster", [0, 0, 0]),
    ]);

    expect(defaults.map((object) => object.meshType)).toEqual(
      expect.arrayContaining(["plant", "bookshelf", "couch", "pantry"]),
    );
    for (const object of defaults) {
      expect(isObjectFootprintInsideLayout(object, layout)).toBe(true);
    }
  });

  it("places infill furniture near the office center without overlapping project cores", () => {
    const layout = createRectangularOfficeLayout({ width: 24, depth: 20 });
    const bounds = getOfficeLayoutBounds(layout);
    const coreAreas = [
      area({
        id: "left-project",
        projectId: "proj-left",
        minX: -5,
        maxX: -1,
        minZ: -3,
        maxZ: 3,
      }),
      area({
        id: "right-project",
        projectId: "proj-right",
        minX: 1,
        maxX: 5,
        minZ: -3,
        maxZ: 3,
      }),
    ];
    const reservedTables = [
      furniture("left-table", "team-cluster", [-3, 0, 0]),
      furniture("right-table", "team-cluster", [3, 0, 0]),
    ];
    const placed = placeFurnitureInEmptySpace({
      objects: [
        furniture("pantry", "pantry", [-10, 0, -8]),
        furniture("couch", "couch", [10, 0, -8]),
        furniture("bookshelf", "bookshelf", [0, 0, -8]),
      ],
      officeLayout: layout,
      reservation: createOfficePlacementReservation(
        reservedTables.map((object) => ({
          meshType: object.meshType,
          position: object.position,
          rotation: object.rotation,
          metadata: object.metadata,
        })),
      ),
      coreAreas,
    });
    const averageCenterDistance =
      placed.reduce(
        (sum, object) =>
          sum +
          Math.hypot(
            object.position[0] - bounds.centerX,
            object.position[2] - bounds.centerZ,
          ),
        0,
      ) / Math.max(1, placed.length);

    expect(placed.map((object) => object.meshType)).toEqual(
      expect.arrayContaining(["bookshelf", "couch"]),
    );
    expect(averageCenterDistance).toBeLessThan(7);
    for (const object of placed) {
      expect(coreAreas.some((projectArea) => objectOverlapsArea(object, projectArea))).toBe(false);
    }
  });

  it("classifies locked and starter furniture without mapper state", () => {
    expect(isOfficeObjectPlacementLocked({ metadata: { layoutLocked: true } })).toBe(true);
    expect(isOfficeObjectPlacementLocked({ metadata: { locked: false } })).toBe(false);
    expect(isAutoPackableStarterObject({ id: "office-plant-entry-right" })).toBe(true);
    expect(isAutoPackableStarterObject({ id: "custom-bookshelf" })).toBe(false);
  });

  it("derives footprint tile bounds for non-wall-art objects", () => {
    const bounds = getOfficeObjectFootprintTileBounds([
      furniture("left", "plant", [-2, 0, 0]),
      furniture("ignored", "wall-art", [10, 0, 10]),
      furniture("right", "plant", [3, 0, 1]),
    ]);

    expect(bounds?.minTileX).toBeLessThanOrEqual(-2);
    expect(bounds?.maxTileX).toBeGreaterThanOrEqual(3);
    expect(bounds?.maxTileZ).toBeGreaterThanOrEqual(1);
  });
});
