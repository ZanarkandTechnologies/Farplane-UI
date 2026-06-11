"use client";

import {
  getOfficeLayoutTileSet,
  officeLayoutTileKey,
  type OfficeLayoutModel,
} from "@/modules/office/lib/office-layout";

export interface ObjectFootprintInput {
  meshType: string;
  position: [number, number, number];
  metadata?: Record<string, unknown>;
  rotation?: [number, number, number];
}

export interface ObjectFootprint {
  width: number;
  depth: number;
  clearance: number;
}

export interface ObjectFootprintCell {
  x: number;
  z: number;
  key: string;
}

export interface ObjectFootprintAabb {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const DEFAULT_OBJECT_FOOTPRINT: ObjectFootprint = {
  width: 2,
  depth: 2,
  clearance: 0.25,
};

export const OBJECT_FOOTPRINT_BY_MESH_TYPE: Record<string, ObjectFootprint> = {
  "team-cluster": { width: 3.4, depth: 3.2, clearance: 0.25 },
  plant: { width: 1, depth: 1, clearance: 0.2 },
  couch: { width: 3.4, depth: 2.2, clearance: 0.55 },
  bookshelf: { width: 3.1, depth: 1.4, clearance: 0.35 },
  pantry: { width: 7.2, depth: 2.4, clearance: 0.45 },
  "glass-wall": { width: 4, depth: 0.25, clearance: 0 },
  "custom-mesh": DEFAULT_OBJECT_FOOTPRINT,
};

function getMetadataNumber(
  metadata: Record<string, unknown> | undefined,
  key: string,
): number | null {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function rotateOffset(offsetX: number, offsetZ: number, rotationY: number): { x: number; z: number } {
  if (!Number.isFinite(rotationY)) return { x: offsetX, z: offsetZ };
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  return {
    x: offsetX * cos + offsetZ * sin,
    z: -offsetX * sin + offsetZ * cos,
  };
}

export function getObjectFootprint(input: {
  meshType: string;
  metadata?: Record<string, unknown>;
  rotation?: [number, number, number];
}): ObjectFootprint {
  const base = OBJECT_FOOTPRINT_BY_MESH_TYPE[input.meshType] ?? DEFAULT_OBJECT_FOOTPRINT;
  const width = Math.max(0.1, getMetadataNumber(input.metadata, "footprintWidth") ?? base.width);
  const depth = Math.max(0.1, getMetadataNumber(input.metadata, "footprintDepth") ?? base.depth);
  const clearance = Math.max(0, getMetadataNumber(input.metadata, "footprintClearance") ?? base.clearance);
  const rotationY = input.rotation?.[1] ?? 0;
  if (!Number.isFinite(rotationY)) return { width, depth, clearance };

  const cos = Math.abs(Math.cos(rotationY));
  const sin = Math.abs(Math.sin(rotationY));
  return {
    width: width * cos + depth * sin,
    depth: width * sin + depth * cos,
    clearance,
  };
}

export function getObjectFootprintAabb(input: ObjectFootprintInput): ObjectFootprintAabb {
  const footprint = getObjectFootprint(input);
  const rotationY = input.rotation?.[1] ?? 0;
  const offsetX =
    getMetadataNumber(input.metadata, "footprintOffsetX") ?? (input.meshType === "pantry" ? 0.4 : 0);
  const offsetZ =
    getMetadataNumber(input.metadata, "footprintOffsetZ") ?? (input.meshType === "pantry" ? -0.5 : 0);
  const rotatedOffset = rotateOffset(offsetX, offsetZ, rotationY);
  const centerX = input.position[0] + rotatedOffset.x;
  const centerZ = input.position[2] + rotatedOffset.z;
  const halfWidth = footprint.width / 2 + footprint.clearance;
  const halfDepth = footprint.depth / 2 + footprint.clearance;
  return {
    minX: centerX - halfWidth,
    maxX: centerX + halfWidth,
    minZ: centerZ - halfDepth,
    maxZ: centerZ + halfDepth,
  };
}

export function getObjectFootprintCells(input: ObjectFootprintInput): ObjectFootprintCell[] {
  const aabb = getObjectFootprintAabb(input);
  const cells: ObjectFootprintCell[] = [];
  const minTileX = Math.floor(aabb.minX + 0.5);
  const maxTileX = Math.ceil(aabb.maxX - 0.5);
  const minTileZ = Math.floor(aabb.minZ + 0.5);
  const maxTileZ = Math.ceil(aabb.maxZ - 0.5);

  for (let x = minTileX; x <= maxTileX; x += 1) {
    for (let z = minTileZ; z <= maxTileZ; z += 1) {
      cells.push({ x, z, key: officeLayoutTileKey(x, z) });
    }
  }

  return cells;
}

export function isObjectFootprintInsideLayout(
  object: ObjectFootprintInput,
  layout: OfficeLayoutModel,
): boolean {
  if (object.meshType === "wall-art") return true;
  const tiles = getOfficeLayoutTileSet(layout);
  return getObjectFootprintCells(object).every((cell) => tiles.has(cell.key));
}

export function objectFootprintsCollide(
  left: ObjectFootprintInput,
  right: ObjectFootprintInput,
): boolean {
  if (left.meshType === "glass-wall" && right.meshType === "glass-wall") return false;
  const leftCells = new Set(getObjectFootprintCells(left).map((cell) => cell.key));
  return getObjectFootprintCells(right).some((cell) => leftCells.has(cell.key));
}

export function countObjectFootprintCollisions(
  object: ObjectFootprintInput,
  reservedObjects: ObjectFootprintInput[],
): number {
  return reservedObjects.reduce(
    (count, reservedObject) =>
      count + (objectFootprintsCollide(object, reservedObject) ? 1 : 0),
    0,
  );
}
