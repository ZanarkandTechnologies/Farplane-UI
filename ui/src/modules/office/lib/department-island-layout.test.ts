import { describe, expect, it } from "vitest";
import {
  DEPARTMENT_ISLAND_IDS,
  getDepartmentArchipelagoLayoutCenter,
  getDepartmentIslandBridgeAccessTile,
  planDepartmentArchipelago,
} from "./department-island-layout";
import { OPERATING_ROOM_CATALOG } from "./operating-room-catalog";
import type { OfficeObject } from "./types";

function rooms(): OfficeObject[] {
  return OPERATING_ROOM_CATALOG.map((room, index) => ({
    _id: `room-${room.id}`,
    meshType: "activity-landmark",
    position: [index, 0, index],
    rotation: [0, 0, 0],
    metadata: { operatingRoomId: room.id },
  }));
}

describe("department island layout", () => {
  it("places the complete hosted-room catalog on seven capability islands", () => {
    const plan = planDepartmentArchipelago({ requiredObjects: [], destinations: rooms() });

    expect(plan?.islands).toHaveLength(7);
    expect(plan?.bridges).toHaveLength(7);
    expect(plan?.placedDestinations).toHaveLength(11);
    expect(
      new Set(plan?.placedDestinations.map((room) => room.metadata?.departmentIslandId)),
    ).toEqual(new Set(["back-office", "marketing", "operations", "intelligence", "customer"]));
  });

  it("keeps every room access point inside the tile-backed archipelago", () => {
    const plan = planDepartmentArchipelago({ requiredObjects: [], destinations: rooms() });

    expect(plan).not.toBeNull();
    expect(
      plan?.roomSlots.every((slot) =>
        plan.floorTiles.has(`${slot.accessTile.x}:${slot.accessTile.z}`),
      ),
    ).toBe(true);
    for (const departmentId of DEPARTMENT_ISLAND_IDS) {
      const access = getDepartmentIslandBridgeAccessTile(departmentId);
      expect(plan?.floorTiles.has(`${access.x}:${access.z}`)).toBe(true);
    }
    expect(plan?.floorTiles.size).toBeLessThan(
      (plan?.outerBounds.width ?? 0) * (plan?.outerBounds.depth ?? 0),
    );
  });

  it("centres the fixed camera on the complete seven-district ring", () => {
    expect(getDepartmentArchipelagoLayoutCenter()).toEqual({
      x: 0.5,
      z: 1,
      width: 48,
      depth: 45,
    });
  });
});
