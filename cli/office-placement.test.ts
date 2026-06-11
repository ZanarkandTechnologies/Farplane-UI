import { describe, expect, it } from "vitest";
import type { OfficeObjectModel } from "./sidecar-store.js";
import {
  findFirstOpenPlacement,
  findPlacementViolations,
  isPlacementAreaFree,
} from "./office-placement.js";

function makeObject(id: string, meshType: string, position: [number, number, number]): OfficeObjectModel {
  return {
    id,
    identifier: id,
    meshType,
    position,
  };
}

describe("office placement helpers", () => {
  it("accepts a free position inside bounds", () => {
    const free = isPlacementAreaFree({
      position: [0, 0, 0],
      meshType: "plant",
      existingObjects: [],
      bounds: { halfExtent: 17.5 },
    });
    expect(free).toBe(true);
  });

  it("rejects overlapping placement", () => {
    const free = isPlacementAreaFree({
      position: [0, 0, 0],
      meshType: "plant",
      existingObjects: [makeObject("plant-a", "plant", [0, 0, 0])],
      bounds: { halfExtent: 17.5 },
    });
    expect(free).toBe(false);
  });

  it("ignores collision against provided object id", () => {
    const free = isPlacementAreaFree({
      position: [0, 0, 0],
      meshType: "plant",
      existingObjects: [makeObject("plant-a", "plant", [0, 0, 0])],
      bounds: { halfExtent: 17.5 },
      ignoreObjectId: "plant-a",
    });
    expect(free).toBe(true);
  });

  it("finds deterministic first open slot", () => {
    const position = findFirstOpenPlacement({
      meshType: "plant",
      existingObjects: [makeObject("plant-a", "plant", [0, 0, 0])],
      bounds: { halfExtent: 17.5 },
    });
    expect(position).toEqual([-2, 0, -2]);
  });

  it("returns null when no slot is available in search grid", () => {
    const blockers: OfficeObjectModel[] = [];
    for (let x = -1; x <= 1; x += 1) {
      for (let z = -1; z <= 1; z += 1) {
        blockers.push(makeObject(`block-${x}-${z}`, "plant", [x, 0, z]));
      }
    }
    const position = findFirstOpenPlacement({
      meshType: "plant",
      existingObjects: blockers,
      bounds: { halfExtent: 1 },
    });
    expect(position).toBeNull();
  });

  it("reports collisions and out-of-bounds objects", () => {
    const violations = findPlacementViolations({
      bounds: { halfExtent: 17.5 },
      objects: [
        makeObject("team-a", "team-cluster", [0, 0, 0]),
        makeObject("team-b", "team-cluster", [1, 0, 1]),
        makeObject("team-edge", "team-cluster", [17, 0, 0]),
      ],
    });

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "collision",
          objectId: "team-a",
          otherObjectId: "team-b",
        }),
        expect.objectContaining({
          type: "out_of_bounds",
          objectId: "team-edge",
        }),
      ]),
    );
  });
});
