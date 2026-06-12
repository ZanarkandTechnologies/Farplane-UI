import { describe, expect, it } from "vitest";

import { createRectangularOfficeLayout } from "@/modules/office/lib/office-layout";
import {
  buildOfficeOccupancyGrid,
  buildOfficeWalkabilityGrid,
  canPlaceOfficeObject,
  getObjectFootprintAabb,
  getObjectFootprintCells,
  isObjectFootprintInsideLayout,
  objectFootprintsCollide,
} from "./occupancy-system";

describe("office occupancy system", () => {
  it("claims padded footprint cells for office objects", () => {
    const cells = getObjectFootprintCells({
      meshType: "plant",
      position: [0, 0, 0],
    });

    expect(cells.map((cell) => cell.key).sort()).toContain("0:0");
    expect(cells.length).toBeGreaterThan(1);
  });

  it("detects object collisions through occupied cells", () => {
    const left = { meshType: "couch", position: [0, 0, 0] as [number, number, number] };
    const right = { meshType: "plant", position: [1, 0, 0] as [number, number, number] };

    expect(objectFootprintsCollide(left, right)).toBe(true);
  });

  it("detects off-floor footprint cells against the live layout", () => {
    const layout = createRectangularOfficeLayout({ width: 5, depth: 5 });

    expect(
      isObjectFootprintInsideLayout(
        { meshType: "pantry", position: [3, 0, 0] },
        layout,
      ),
    ).toBe(false);
  });

  it("builds an occupancy grid and validates available placement", () => {
    const layout = createRectangularOfficeLayout({ width: 15, depth: 15 });
    const couch = { meshType: "couch", position: [0, 0, 0] as [number, number, number] };
    const plant = { meshType: "plant", position: [5, 0, 5] as [number, number, number] };
    const grid = buildOfficeOccupancyGrid({ layout, objects: [couch] });

    expect(canPlaceOfficeObject(plant, grid)).toBe(true);
    expect(canPlaceOfficeObject({ ...plant, position: [0, 0, 0] }, grid)).toBe(false);
  });

  it("applies rotation to footprint bounds", () => {
    const unrotated = getObjectFootprintAabb({
      meshType: "pantry",
      position: [0, 0, 0],
      rotation: [0, 0, 0],
    });
    const rotated = getObjectFootprintAabb({
      meshType: "pantry",
      position: [0, 0, 0],
      rotation: [0, Math.PI / 2, 0],
    });

    expect(rotated.maxZ - rotated.minZ).toBeGreaterThan(unrotated.maxZ - unrotated.minZ);
  });

  it("derives pathfinding walkability from layout and object occupancy", () => {
    const layout = createRectangularOfficeLayout({ width: 7, depth: 7 });
    const walkability = buildOfficeWalkabilityGrid({
      layout,
      objects: [{ meshType: "plant", position: [0, 0, 0] }],
      cellSize: 0.5,
    });

    const centerX = Math.floor((0 - walkability.worldMinX) / walkability.cellSize);
    const centerZ = Math.floor((0 - walkability.worldMinZ) / walkability.cellSize);

    expect(walkability.walkableGrid[0][0]).toBe(true);
    expect(walkability.walkableGrid[centerX][centerZ]).toBe(false);
  });
});
