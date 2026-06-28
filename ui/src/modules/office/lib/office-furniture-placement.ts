/**
 * OFFICE FURNITURE PLACEMENT
 * ==========================
 * Pure helpers for default furniture anchors, sidecar furniture classification,
 * and optional infill placement around project areas.
 *
 * Inputs are derived office layout state and candidate objects. Outputs are
 * candidate or placed office objects. The helpers mutate only the supplied
 * placement reservation when they successfully reserve an object.
 */

import { normalizeOfficeObjectId } from "@/modules/office/components/office-object-id";
import type { OfficeAreaNode } from "@/modules/office/lib/office-area-layout";
import { getOfficeLayoutBounds, type OfficeLayoutModel } from "@/modules/office/lib/office-layout";
import type { OfficeObject } from "@/modules/office/lib/types";
import {
  getObjectFootprintAabb,
  getObjectFootprintCells,
} from "@/modules/office/systems/occupancy-system";
import {
  canReserveOfficeObject,
  getOfficeLayoutCandidatePositions,
  type OfficePlacementObject,
  type OfficePlacementReservation,
  reserveOfficeObjectPlacement,
} from "@/modules/office/systems/placement-engine";

interface TileBounds {
  minTileX: number;
  maxTileX: number;
  minTileZ: number;
  maxTileZ: number;
}

const AUTO_PACKABLE_STARTER_OBJECT_IDS = new Set([
  "plant-entry-right",
  "plant-entry-left",
  "plant-back-left",
  "plant-center-left",
  "pantry-main",
  "couch-main",
  "farplane-map-console",
]);

export function getOfficeObjectFootprintTileBounds(objects: OfficeObject[]): TileBounds | null {
  let minTileX = Number.POSITIVE_INFINITY;
  let maxTileX = Number.NEGATIVE_INFINITY;
  let minTileZ = Number.POSITIVE_INFINITY;
  let maxTileZ = Number.NEGATIVE_INFINITY;
  let hasCells = false;

  for (const object of objects) {
    if (object.meshType === "wall-art") continue;
    for (const cell of getObjectFootprintCells(object)) {
      hasCells = true;
      minTileX = Math.min(minTileX, cell.x);
      maxTileX = Math.max(maxTileX, cell.x);
      minTileZ = Math.min(minTileZ, cell.z);
      maxTileZ = Math.max(maxTileZ, cell.z);
    }
  }

  return hasCells ? { minTileX, maxTileX, minTileZ, maxTileZ } : null;
}

export function isOfficeObjectPlacementLocked(
  object: { metadata?: Record<string, unknown> } | undefined,
): boolean {
  return (
    object?.metadata?.layoutLocked === true ||
    object?.metadata?.placementLocked === true ||
    object?.metadata?.locked === true
  );
}

export function isAutoPackableStarterObject(object: { id: string }): boolean {
  return AUTO_PACKABLE_STARTER_OBJECT_IDS.has(normalizeOfficeObjectId(object.id));
}

export function isPreservedOfficeObjectPlacement(object: OfficeObject): boolean {
  return isOfficeObjectPlacementLocked(object);
}

export function getCompactFurnitureAnchor(input: {
  meshType: string;
  index: number;
  officeLayout: OfficeLayoutModel;
}): [number, number, number] {
  const bounds = getOfficeLayoutBounds(input.officeLayout);
  const centerX = Math.round(bounds.centerX);
  const centerZ = Math.round(bounds.centerZ);
  const offsetX = Math.max(2, Math.floor(bounds.width / 5));
  const offsetZ = Math.max(2, Math.floor(bounds.depth / 5));
  const plantSlots: Array<[number, number, number]> = [
    [centerX - offsetX, 0, centerZ + offsetZ],
    [centerX + offsetX, 0, centerZ + offsetZ],
    [centerX - offsetX, 0, centerZ - offsetZ],
    [centerX + offsetX, 0, centerZ - offsetZ],
  ];
  if (input.meshType === "bookshelf") return [centerX, 0, centerZ - offsetZ];
  if (input.meshType === "couch") return [centerX + offsetX, 0, centerZ];
  if (input.meshType === "pantry") return [centerX - offsetX, 0, centerZ];
  if (input.meshType === "plant") return plantSlots[input.index % plantSlots.length];
  return [centerX, 0, centerZ];
}

export function buildDefaultFurnitureObjects(
  companyId: string,
  officeLayout: OfficeLayoutModel,
  anchorObjects: OfficeObject[] = [],
): OfficeObject[] {
  const bounds = getOfficeLayoutBounds(officeLayout);
  const anchorBounds = getOfficeObjectFootprintTileBounds(anchorObjects);
  const fallbackInsetX = Math.max(3, Math.min(5, Math.floor(bounds.width / 4)));
  const fallbackInsetZ = Math.max(3, Math.min(5, Math.floor(bounds.depth / 4)));
  const leftX = anchorBounds ? anchorBounds.minTileX - 1 : bounds.minWorldX + fallbackInsetX;
  const rightX = anchorBounds ? anchorBounds.maxTileX + 1 : bounds.maxWorldX - fallbackInsetX;
  const backZ = anchorBounds ? anchorBounds.minTileZ - 1 : bounds.minWorldZ + fallbackInsetZ;
  const frontZ = anchorBounds ? anchorBounds.maxTileZ + 1 : bounds.maxWorldZ - fallbackInsetZ;
  const centerX = anchorBounds
    ? Math.round((anchorBounds.minTileX + anchorBounds.maxTileX) / 2)
    : bounds.centerX;
  const keepFootprintInsideLayout = (object: OfficeObject): OfficeObject => {
    let position = object.position;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const cells = getObjectFootprintCells({
        meshType: object.meshType,
        position,
        metadata: object.metadata,
        rotation: object.rotation,
      });
      const minX = Math.min(...cells.map((cell) => cell.x));
      const maxX = Math.max(...cells.map((cell) => cell.x));
      const minZ = Math.min(...cells.map((cell) => cell.z));
      const maxZ = Math.max(...cells.map((cell) => cell.z));
      const shiftX =
        minX < bounds.minTileX
          ? bounds.minTileX - minX
          : maxX > bounds.maxTileX
            ? bounds.maxTileX - maxX
            : 0;
      const shiftZ =
        minZ < bounds.minTileZ
          ? bounds.minTileZ - minZ
          : maxZ > bounds.maxTileZ
            ? bounds.maxTileZ - maxZ
            : 0;
      if (shiftX === 0 && shiftZ === 0) break;
      position = [position[0] + shiftX, position[1], position[2] + shiftZ];
    }
    return { ...object, position };
  };
  const defaultFurniture: OfficeObject[] = [
    {
      _id: "plant-1",
      companyId,
      meshType: "plant",
      position: [leftX, 0, frontZ],
      rotation: [0, 0, 0],
    },
    {
      _id: "plant-2",
      companyId,
      meshType: "plant",
      position: [rightX, 0, frontZ],
      rotation: [0, 0, 0],
    },
    {
      _id: "bookshelf-1",
      companyId,
      meshType: "bookshelf",
      position: [centerX, 0, backZ],
      rotation: [0, 0, 0],
    },
    {
      _id: "couch-1",
      companyId,
      meshType: "couch",
      position: [rightX, 0, backZ],
      rotation: [0, Math.PI, 0],
    },
    {
      _id: "pantry-1",
      companyId,
      meshType: "pantry",
      position: [leftX, 0, backZ],
      rotation: [0, 0, 0],
    },
  ];
  return defaultFurniture.map(keepFootprintInsideLayout);
}

export function toPlacementObject(object: OfficeObject): OfficePlacementObject {
  return {
    meshType: object.meshType,
    position: object.position,
    metadata: object.metadata,
    rotation: object.rotation,
  };
}

export function placeFurnitureObjects(input: {
  objects: OfficeObject[];
  officeLayout: OfficeLayoutModel;
  reservation: OfficePlacementReservation;
}): OfficeObject[] {
  return input.objects.flatMap((object) => {
    const position =
      reserveOfficeObjectPlacement({
        object: toPlacementObject(object),
        layout: input.officeLayout,
        reservation: input.reservation,
        allowCollisionFallback: false,
      })?.position ?? null;
    return position ? [{ ...object, position }] : [];
  });
}

function rectOverlapsAreaRect(
  rect: ReturnType<typeof getObjectFootprintAabb>,
  areaRect: OfficeAreaNode["rect"],
): boolean {
  return (
    rect.minX < areaRect.maxX &&
    rect.maxX > areaRect.minX &&
    rect.minZ < areaRect.maxZ &&
    rect.maxZ > areaRect.minZ
  );
}

function objectOverlapsProjectCoreArea(
  object: OfficePlacementObject,
  areas: OfficeAreaNode[],
): boolean {
  const bounds = getObjectFootprintAabb(object);
  return areas.some(
    (area) =>
      Boolean(area.projectId) &&
      rectOverlapsAreaRect(bounds, area.rect),
  );
}

function positionDistanceSquared(
  position: [number, number, number],
  target: { x: number; z: number },
): number {
  return (position[0] - target.x) ** 2 + (position[2] - target.z) ** 2;
}

function findBestFurnitureInfillPosition(input: {
  object: OfficeObject;
  officeLayout: OfficeLayoutModel;
  reservation: OfficePlacementReservation;
  coreAreas: OfficeAreaNode[];
}): [number, number, number] | null {
  const placementObject = toPlacementObject(input.object);
  const bounds = getOfficeLayoutBounds(input.officeLayout);
  const officeCenter = { x: bounds.centerX, z: bounds.centerZ };
  let best: { position: [number, number, number]; score: number } | null = null;

  for (const position of getOfficeLayoutCandidatePositions({
    layout: input.officeLayout,
    y: placementObject.position[1],
    preferredPosition: placementObject.position,
  })) {
    const candidate = { ...placementObject, position };
    if (objectOverlapsProjectCoreArea(candidate, input.coreAreas)) continue;
    if (
      !canReserveOfficeObject({
        object: candidate,
        layout: input.officeLayout,
        reservation: input.reservation,
      })
    ) {
      continue;
    }

    const centerDistance = positionDistanceSquared(position, officeCenter);
    const preferredDistance = positionDistanceSquared(position, {
      x: input.object.position[0],
      z: input.object.position[2],
    });
    const score = centerDistance * 100 + preferredDistance * 0.1;
    if (!best || score < best.score) {
      best = { position, score };
    }
  }

  return best?.position ?? null;
}

export function placeFurnitureInEmptySpace(input: {
  objects: OfficeObject[];
  officeLayout: OfficeLayoutModel;
  reservation: OfficePlacementReservation;
  coreAreas: OfficeAreaNode[];
}): OfficeObject[] {
  const orderedObjects = [...input.objects].sort((left, right) => {
    const leftCells = getObjectFootprintCells(toPlacementObject(left)).length;
    const rightCells = getObjectFootprintCells(toPlacementObject(right)).length;
    return rightCells === leftCells
      ? left._id.localeCompare(right._id)
      : rightCells - leftCells;
  });
  const placed: OfficeObject[] = [];

  for (const object of orderedObjects) {
    const position = findBestFurnitureInfillPosition({
      object,
      officeLayout: input.officeLayout,
      reservation: input.reservation,
      coreAreas: input.coreAreas,
    });
    if (!position) continue;
    const placedObject = { ...object, position };
    input.reservation.objects.push(toPlacementObject(placedObject));
    placed.push(placedObject);
  }

  return placed;
}
