import { describe, expect, it } from "vitest";

import { createRectangularOfficeLayout } from "@/modules/office/lib/office-layout";
import {
  createOfficePlacementReservation,
  reserveOfficeObjectPlacement,
} from "./placement-engine";

describe("office placement engine", () => {
  it("reserves the preferred position when it is legal", () => {
    const layout = createRectangularOfficeLayout({ width: 15, depth: 15 });
    const reservation = createOfficePlacementReservation();

    const result = reserveOfficeObjectPlacement({
      object: { meshType: "plant", position: [0, 0, 0] },
      layout,
      reservation,
    });

    expect(result).toMatchObject({
      position: [0, 0, 0],
      collisionCount: 0,
      usedFallback: false,
    });
    expect(reservation.objects).toHaveLength(1);
  });

  it("moves colliding objects into the nearest legal slot", () => {
    const layout = createRectangularOfficeLayout({ width: 15, depth: 15 });
    const reservation = createOfficePlacementReservation([
      { meshType: "couch", position: [0, 0, 0] },
    ]);

    const result = reserveOfficeObjectPlacement({
      object: { meshType: "plant", position: [0, 0, 0] },
      layout,
      reservation,
    });

    expect(result).not.toBeNull();
    expect(result?.position).not.toEqual([0, 0, 0]);
    expect(result?.collisionCount).toBe(0);
    expect(reservation.objects).toHaveLength(2);
  });

  it("returns null when no collision-free slot exists and fallback is disabled", () => {
    const layout = createRectangularOfficeLayout({ width: 3, depth: 3 });
    const reservation = createOfficePlacementReservation([
      { meshType: "pantry", position: [0, 0, 0] },
    ]);

    const result = reserveOfficeObjectPlacement({
      object: { meshType: "couch", position: [0, 0, 0] },
      layout,
      reservation,
      allowCollisionFallback: false,
    });

    expect(result).toBeNull();
  });

  it("can use a lowest-collision fallback for essential objects", () => {
    const layout = createRectangularOfficeLayout({ width: 5, depth: 5 });
    const reservation = createOfficePlacementReservation([
      {
        meshType: "custom-mesh",
        position: [0, 0, 0],
        metadata: { footprintWidth: 5, footprintDepth: 5, footprintClearance: 0 },
      },
    ]);

    const result = reserveOfficeObjectPlacement({
      object: { meshType: "plant", position: [0, 0, 0] },
      layout,
      reservation,
      allowCollisionFallback: true,
    });

    expect(result).not.toBeNull();
    expect(result?.usedFallback).toBe(true);
    expect(result?.collisionCount).toBeGreaterThan(0);
  });
});
