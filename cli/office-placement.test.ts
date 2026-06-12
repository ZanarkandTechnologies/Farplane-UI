import { describe, expect, it } from "vitest";
import type { OfficeObjectModel } from "./sidecar-store.js";
import {
  findFirstOpenPlacement,
  findPlacementViolations,
  getObjectFootprint as getCliObjectFootprint,
  isPlacementAreaFree,
} from "./office-placement.js";
import { getObjectFootprint as getUiObjectFootprint } from "@/modules/office/systems/occupancy-system";

function makeObject(id: string, meshType: string, position: [number, number, number]): OfficeObjectModel {
  return {
    id,
    identifier: id,
    meshType,
    position,
  };
}

function makeRotatedObject(
  id: string,
  meshType: string,
  position: [number, number, number],
  rotation: [number, number, number],
): OfficeObjectModel {
  return {
    ...makeObject(id, meshType, position),
    rotation,
  };
}

describe("office placement helpers", () => {
  it("keeps CLI and UI engine default footprints aligned", () => {
    for (const meshType of [
      "team-cluster",
      "plant",
      "couch",
      "bookshelf",
      "pantry",
      "glass-wall",
      "custom-mesh",
    ]) {
      expect(getCliObjectFootprint({ meshType })).toEqual(getUiObjectFootprint({ meshType }));
    }
  });

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

  it("treats visually crowded team table lanes as collisions", () => {
    const violations = findPlacementViolations({
      bounds: { halfExtent: 17.5 },
      objects: [
        makeObject("team-farplane", "team-cluster", [-4, 0, 6]),
        makeObject("team-misc", "team-cluster", [4, 0, 13]),
      ],
    });

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "collision",
          objectId: "team-farplane",
          otherObjectId: "team-misc",
        }),
      ]),
    );
  });

  it("reports padded decor collisions with rotated furniture", () => {
    const violations = findPlacementViolations({
      bounds: { halfExtent: 17.5 },
      objects: [
        makeRotatedObject("couch-main", "couch", [8, 0, -8], [0, Math.PI * 1.5, 0]),
        makeObject("farplane-map-console", "bookshelf", [7, 0, -11]),
      ],
    });

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "collision",
          objectId: "couch-main",
          otherObjectId: "farplane-map-console",
        }),
      ]),
    );
  });
});
