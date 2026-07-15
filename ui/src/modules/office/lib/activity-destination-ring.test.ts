import { describe, expect, it } from "vitest";
import { getObjectFootprintCells } from "../systems/occupancy-system";
import { planActivityDestinationRails } from "./activity-destination-ring";
import { officeLayoutTileKey } from "./office-layout";
import type { OfficeObject } from "./types";

function object(id: string, meshType: string, position: [number, number, number]): OfficeObject {
  return { _id: id, meshType, position, rotation: [0, 0, 0], metadata: {} };
}

function createDestinations(count: number): OfficeObject[] {
  return Array.from({ length: count }, (_, index) =>
    object(`destination-${index}`, "activity-landmark", [index, 0, 0]),
  );
}

describe("activity destination room rails", () => {
  it("distributes ten compact room zones as four north, three east, and three west", () => {
    const plan = planActivityDestinationRails({
      requiredObjects: [object("table", "plant", [0, 0, 0])],
      reservedWalkTiles: new Set([officeLayoutTileKey(0, 0)]),
      destinations: createDestinations(10),
      paddingTiles: 2,
    });

    expect(plan).not.toBeNull();
    expect(plan?.placedDestinations).toHaveLength(10);
    expect(plan?.roomSlots.map((slot) => slot.edge)).toEqual([
      "north",
      "north",
      "north",
      "north",
      "east",
      "east",
      "east",
      "west",
      "west",
      "west",
    ]);
    expect(plan?.roomSlots.every((slot) => slot.tileKeys.length === 25)).toBe(true);
    expect(
      plan?.placedDestinations.every(
        (destination) =>
          destination.metadata?.destinationRoomZone === true &&
          destination.metadata?.footprintWidth === 5 &&
          destination.metadata?.footprintDepth === 5,
      ),
    ).toBe(true);
  });

  it("keeps one smooth rectangular floor without adding a south room rail", () => {
    const plan = planActivityDestinationRails({
      requiredObjects: [object("table", "plant", [0, 0, 0])],
      reservedWalkTiles: new Set(),
      destinations: createDestinations(10),
      paddingTiles: 2,
    });
    if (!plan) throw new Error("Expected rail plan");

    expect(plan.coreBounds.width).toBe(20);
    expect(plan.coreBounds.depth).toBe(15);
    expect(plan.floorTiles.size).toBe(plan.outerBounds.width * plan.outerBounds.depth);
    expect(
      plan.floorTiles.has(officeLayoutTileKey(plan.coreBounds.minX, plan.coreBounds.maxZ + 1)),
    ).toBe(false);
  });

  it("keeps every opening in the core and immediately beside its room zone", () => {
    const plan = planActivityDestinationRails({
      requiredObjects: [object("table", "plant", [0, 0, 0])],
      reservedWalkTiles: new Set(),
      destinations: createDestinations(10),
      paddingTiles: 2,
    });
    if (!plan) throw new Error("Expected rail plan");
    const roomCells = new Set(
      plan.placedDestinations.flatMap((destination) =>
        getObjectFootprintCells(destination).map((cell) => cell.key),
      ),
    );

    expect(
      plan.roomSlots.every(
        (slot) =>
          Number.isInteger(slot.accessTile.x) &&
          Number.isInteger(slot.accessTile.z) &&
          slot.accessTile.x >= plan.coreBounds.minX &&
          slot.accessTile.x <= plan.coreBounds.maxX &&
          slot.accessTile.z >= plan.coreBounds.minZ &&
          slot.accessTile.z <= plan.coreBounds.maxZ &&
          !roomCells.has(officeLayoutTileKey(slot.accessTile.x, slot.accessTile.z)),
      ),
    ).toBe(true);
    expect(
      plan.roomSlots.every((slot, index) => {
        const destination = plan.placedDestinations[index];
        if (!destination) return false;
        return (
          Math.min(
            ...getObjectFootprintCells(destination).map(
              (cell) => Math.abs(cell.x - slot.accessTile.x) + Math.abs(cell.z - slot.accessTile.z),
            ),
          ) === 1
        );
      }),
    ).toBe(true);
  });

  it("is deterministic for the same table and destination inputs", () => {
    const input = {
      requiredObjects: [object("table", "plant", [2, 0, -3])],
      reservedWalkTiles: new Set([officeLayoutTileKey(2, -2)]),
      destinations: createDestinations(10),
      paddingTiles: 2,
    };

    expect(planActivityDestinationRails(input)).toEqual(planActivityDestinationRails(input));
  });

  it("does not pad an already-reserved corridor into another room module", () => {
    const plan = planActivityDestinationRails({
      requiredObjects: [object("table", "plant", [0, 0, 0])],
      reservedWalkTiles: new Set([officeLayoutTileKey(14, 0)]),
      destinations: createDestinations(6),
      paddingTiles: 2,
    });

    expect(plan?.coreBounds.width).toBe(20);
  });

  it("grows a wide shallow core until the balanced side rails fit", () => {
    const wideTable = {
      ...object("wide-table", "plant", [0, 0, 0]),
      metadata: { footprintWidth: 58, footprintDepth: 1, footprintClearance: 0 },
    };
    const plan = planActivityDestinationRails({
      requiredObjects: [wideTable],
      reservedWalkTiles: new Set(),
      destinations: createDestinations(10),
      paddingTiles: 0,
    });

    expect(plan?.coreBounds.width).toBe(60);
    expect(plan?.coreBounds.depth).toBe(15);
    expect(plan?.roomSlots.map((slot) => slot.edge)).toEqual([
      "north",
      "north",
      "north",
      "north",
      "east",
      "east",
      "east",
      "west",
      "west",
      "west",
    ]);
  });
});
