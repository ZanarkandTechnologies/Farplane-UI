/**
 * OFFICE OBJECT PLACEMENT
 * =======================
 * Shared builder placement helpers for draggable office objects.
 *
 * KEY CONCEPTS:
 * - Builder drag and exact transform saves must use the same office-layout placement rules.
 * - Object placement snaps to integer tile centers before layout clamping so preview matches persisted tile coordinates.
 *
 * USAGE:
 * - `getOfficeObjectPlacementMargin(meshType)`
 * - `constrainOfficeObjectPositionForLayout(position, layout, meshType)`
 *
 * MEMORY REFERENCES:
 * - MEM-0186
 */

import { clampPositionToOfficeLayout, type OfficeLayoutModel } from "../lib/office-layout";
import type { OfficeObject } from "../lib/types";
import {
  canReserveOfficeObject,
  createOfficePlacementReservation,
} from "../systems/placement-engine";

export function getOfficeObjectPlacementMargin(meshType: string): number {
  return meshType === "team-cluster" ? 2 : 1;
}

export function constrainOfficeObjectPositionForLayout(
  position: [number, number, number],
  layout: OfficeLayoutModel,
  meshType: string,
): [number, number, number] {
  const snapped: [number, number, number] = [
    Math.round(position[0]),
    position[1],
    Math.round(position[2]),
  ];
  return clampPositionToOfficeLayout(snapped, layout, getOfficeObjectPlacementMargin(meshType));
}

export function canPlaceOfficeObjectAtPosition(input: {
  position: [number, number, number];
  layout: OfficeLayoutModel;
  meshType: string;
  officeObjects: OfficeObject[];
  metadata?: Record<string, unknown>;
  rotation?: [number, number, number];
  ignoreObjectId?: string;
}): boolean {
  const reservation = createOfficePlacementReservation(
    input.officeObjects
      .filter((object) => String(object._id) !== input.ignoreObjectId)
      .map((object) => ({
        meshType: object.meshType,
        position: object.position,
        metadata: object.metadata,
        rotation: object.rotation,
      })),
  );
  return canReserveOfficeObject({
    object: {
      meshType: input.meshType,
      position: input.position,
      metadata: input.metadata,
      rotation: input.rotation,
    },
    layout: input.layout,
    reservation,
  });
}
