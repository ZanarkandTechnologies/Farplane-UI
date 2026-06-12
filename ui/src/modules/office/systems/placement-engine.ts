"use client";

/**
 * OFFICE PLACEMENT ENGINE
 * =======================
 * Pure slot selection and reservation helpers built on the occupancy system.
 */

import {
  clampPositionToOfficeLayout,
  type OfficeLayoutModel,
} from "@/modules/office/lib/office-layout";
import {
  countObjectFootprintCollisions,
  isObjectFootprintInsideLayout,
  objectFootprintsCollide,
  type ObjectFootprintInput,
} from "@/modules/office/systems/occupancy-system";

export type OfficePlacementObject = ObjectFootprintInput;

export interface OfficePlacementReservation {
  objects: OfficePlacementObject[];
}

export interface OfficePlacementResult {
  position: [number, number, number];
  collisionCount: number;
  usedFallback: boolean;
}

export function createOfficePlacementReservation(
  objects: OfficePlacementObject[] = [],
): OfficePlacementReservation {
  return { objects: [...objects] };
}

export function getOfficeLayoutCandidatePositions(input: {
  layout: OfficeLayoutModel;
  y?: number;
  preferredPosition?: [number, number, number];
}): Array<[number, number, number]> {
  const y = input.y ?? input.preferredPosition?.[1] ?? 0;
  const candidates = input.layout.tiles
    .map((tile) => {
      const [xRaw, zRaw] = tile.split(":");
      return [Number(xRaw), y, Number(zRaw)] as [number, number, number];
    })
    .filter((position) => Number.isFinite(position[0]) && Number.isFinite(position[2]));

  if (!input.preferredPosition) return candidates;

  return candidates.sort((left, right) => {
    const leftDistance =
      (left[0] - input.preferredPosition![0]) ** 2 +
      (left[2] - input.preferredPosition![2]) ** 2;
    const rightDistance =
      (right[0] - input.preferredPosition![0]) ** 2 +
      (right[2] - input.preferredPosition![2]) ** 2;
    return leftDistance - rightDistance;
  });
}

export function canReserveOfficeObject(input: {
  object: OfficePlacementObject;
  layout: OfficeLayoutModel;
  reservation: OfficePlacementReservation;
  ignoreObject?: OfficePlacementObject;
}): boolean {
  if (!isObjectFootprintInsideLayout(input.object, input.layout)) return false;
  return input.reservation.objects.every((reservedObject) => {
    if (reservedObject === input.ignoreObject) return true;
    return !objectFootprintsCollide(input.object, reservedObject);
  });
}

export function reserveOfficeObjectPlacement(input: {
  object: OfficePlacementObject;
  layout: OfficeLayoutModel;
  reservation: OfficePlacementReservation;
  allowCollisionFallback?: boolean;
}): OfficePlacementResult | null {
  const clampedPreferred = clampPositionToOfficeLayout(input.object.position, input.layout, 0);
  const preferredObject = { ...input.object, position: clampedPreferred };

  if (
    canReserveOfficeObject({
      object: preferredObject,
      layout: input.layout,
      reservation: input.reservation,
    })
  ) {
    input.reservation.objects.push(preferredObject);
    return { position: clampedPreferred, collisionCount: 0, usedFallback: false };
  }

  let lowestCollisionCandidate: {
    position: [number, number, number];
    collisionCount: number;
    distance: number;
  } | null = null;

  for (const position of getOfficeLayoutCandidatePositions({
    layout: input.layout,
    y: input.object.position[1],
    preferredPosition: input.object.position,
  })) {
    const candidateObject = { ...input.object, position };
    if (!isObjectFootprintInsideLayout(candidateObject, input.layout)) continue;
    const collisionCount = countObjectFootprintCollisions(
      candidateObject,
      input.reservation.objects,
    );
    if (collisionCount === 0) {
      input.reservation.objects.push(candidateObject);
      return { position, collisionCount: 0, usedFallback: false };
    }
    const distance =
      (position[0] - input.object.position[0]) ** 2 +
      (position[2] - input.object.position[2]) ** 2;
    if (
      lowestCollisionCandidate === null ||
      collisionCount < lowestCollisionCandidate.collisionCount ||
      (collisionCount === lowestCollisionCandidate.collisionCount &&
        distance < lowestCollisionCandidate.distance)
    ) {
      lowestCollisionCandidate = { position, collisionCount, distance };
    }
  }

  if (input.allowCollisionFallback !== false && lowestCollisionCandidate) {
    const fallbackObject = { ...input.object, position: lowestCollisionCandidate.position };
    input.reservation.objects.push(fallbackObject);
    return {
      position: lowestCollisionCandidate.position,
      collisionCount: lowestCollisionCandidate.collisionCount,
      usedFallback: true,
    };
  }

  return null;
}
