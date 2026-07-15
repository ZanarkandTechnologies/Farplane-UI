import { describe, expect, it } from "vitest";
import { createCommandCommonsObject, planCentralCommandCommons } from "./central-command-commons";
import type { OfficeObject } from "./types";

function destination(index: number): OfficeObject {
  return {
    _id: `destination-${index}`,
    meshType: "activity-landmark",
    position: [0, 0, 0],
    rotation: [0, 0, 0],
  };
}

describe("central command commons", () => {
  it("creates one stable generated anchor at the requested center", () => {
    expect(createCommandCommonsObject({ center: [2, 0, -3] })).toMatchObject({
      _id: "generated-command-commons",
      meshType: "command-commons",
      position: [2, 0, -3],
      metadata: { generated: true, footprintWidth: 11.8, footprintDepth: 8.4 },
    });
  });

  it("lays room-sized 5x4 bays across a balanced north and side perimeter", () => {
    const plan = planCentralCommandCommons({
      requiredObjects: [createCommandCommonsObject()],
      reservedWalkTiles: new Set(),
      destinations: Array.from({ length: 7 }, (_, index) => destination(index)),
      paddingTiles: 1,
    });
    expect(plan).not.toBeNull();
    if (!plan) return;
    expect(new Set(plan.roomSlots.map((slot) => slot.edge))).toEqual(
      new Set(["north", "west", "east"]),
    );
    expect(plan.roomSlots.filter((slot) => slot.edge === "north")).toHaveLength(3);
    expect(plan.roomSlots.filter((slot) => slot.edge === "west")).toHaveLength(2);
    expect(plan.roomSlots.filter((slot) => slot.edge === "east")).toHaveLength(2);
    expect(plan.roomSlots.every((slot) => slot.tileKeys.length === 20)).toBe(true);
    expect(plan.floorTiles.size).toBe(plan.outerBounds.width * plan.outerBounds.depth);
    expect(plan.placedDestinations).toHaveLength(7);
    expect(
      plan.placedDestinations.every(
        (object) =>
          object.metadata?.destinationBayZone === true &&
          object.metadata?.footprintWidth === 5 &&
          object.metadata?.footprintDepth === 4,
      ),
    ).toBe(true);
  });
});
