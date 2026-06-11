/**
 * OFFICE LAYOUT PLACEMENT
 * =======================
 * Purpose
 * - Validate object AABB footprints against the live office tile mask.
 */

import { HALF_FLOOR } from "./constants.js";
import { findPlacementViolations, getObjectPlacementAabb } from "./office-placement.js";
import type { OfficeObjectModel, OfficeSettingsModel } from "./sidecar-store.js";

function officeLayoutTileKey(x: number, z: number): string {
  return `${Math.round(x)}:${Math.round(z)}`;
}

export function isObjectInsideOfficeLayout(
  object: OfficeObjectModel,
  officeSettings: OfficeSettingsModel,
): boolean {
  if (object.meshType === "wall-art") return true;
  const tiles = new Set(officeSettings.officeLayout.tiles);
  const aabb = getObjectPlacementAabb(object);
  const minTileX = Math.floor(aabb.minX + 0.5);
  const maxTileX = Math.ceil(aabb.maxX - 0.5);
  const minTileZ = Math.floor(aabb.minZ + 0.5);
  const maxTileZ = Math.ceil(aabb.maxZ - 0.5);
  for (let x = minTileX; x <= maxTileX; x += 1) {
    for (let z = minTileZ; z <= maxTileZ; z += 1) {
      if (!tiles.has(officeLayoutTileKey(x, z))) return false;
    }
  }
  return true;
}

export function findLiveLayoutPlacementViolations(input: {
  objects: OfficeObjectModel[];
  officeSettings: OfficeSettingsModel;
}): ReturnType<typeof findPlacementViolations> {
  const squareViolations = findPlacementViolations({
    objects: input.objects,
    bounds: { halfExtent: HALF_FLOOR },
  });
  const squareOutOfBoundsIds = new Set(
    squareViolations
      .filter((entry) => entry.type === "out_of_bounds")
      .map((entry) => entry.objectId),
  );
  const layoutViolations = input.objects
    .filter((object) => !squareOutOfBoundsIds.has(object.id))
    .filter((object) => !isObjectInsideOfficeLayout(object, input.officeSettings))
    .map((object) => ({
      type: "out_of_bounds" as const,
      objectId: object.id,
      meshType: object.meshType,
      position: object.position,
    }));
  return [...squareViolations, ...layoutViolations];
}

export function getOfficeLayoutCandidatePositions(
  officeSettings: OfficeSettingsModel,
): Array<[number, number, number]> {
  return officeSettings.officeLayout.tiles
    .map((tile) => {
      const [xRaw, zRaw] = tile.split(":");
      return [Number(xRaw), 0, Number(zRaw)] as [number, number, number];
    })
    .filter((position) => Number.isFinite(position[0]) && Number.isFinite(position[2]));
}
