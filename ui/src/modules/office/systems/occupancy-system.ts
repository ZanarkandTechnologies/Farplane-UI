"use client";

/**
 * OFFICE OCCUPANCY SYSTEM
 * =======================
 * Owns object footprints, occupied floor cells, collision checks, and layout containment.
 *
 * Game-engine shape:
 * - Objects expose an X/Z footprint.
 * - The occupancy system converts footprints into claimed layout cells.
 * - Placement, debug overlays, builder tools, and future pathing consume this one contract.
 */

import {
  getOfficeLayoutBounds,
  getOfficeLayoutTileSet,
  officeLayoutTileKey,
  parseOfficeLayoutTileKey,
  type OfficeLayoutModel,
} from "@/modules/office/lib/office-layout";
import {
  DEFAULT_OBJECT_FOOTPRINT,
  getMetadataNumber,
  getObjectFootprint,
  OBJECT_FOOTPRINT_BY_MESH_TYPE,
  type ObjectFootprint,
} from "@/modules/office/lib/object-footprints";

export interface ObjectFootprintInput {
  meshType: string;
  position: [number, number, number];
  metadata?: Record<string, unknown>;
  rotation?: [number, number, number];
}

export {
  DEFAULT_OBJECT_FOOTPRINT,
  getObjectFootprint,
  OBJECT_FOOTPRINT_BY_MESH_TYPE,
  type ObjectFootprint,
};

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

export interface OfficeOccupancyGrid {
  layout: OfficeLayoutModel;
  occupiedCells: Map<string, ObjectFootprintInput[]>;
  objects: ObjectFootprintInput[];
}

export interface OfficeCollisionReport {
  object: ObjectFootprintInput;
  collisions: ObjectFootprintInput[];
  outsideLayout: boolean;
}

export interface OfficeWalkabilityGrid {
  gridWidth: number;
  gridDepth: number;
  cellSize: number;
  worldMinX: number;
  worldMinZ: number;
  walkableGrid: boolean[][];
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
  if (left.meshType === "office-divider" && right.meshType === "office-divider") return false;
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

export function buildOfficeOccupancyGrid(input: {
  layout: OfficeLayoutModel;
  objects: ObjectFootprintInput[];
}): OfficeOccupancyGrid {
  const occupiedCells = new Map<string, ObjectFootprintInput[]>();
  for (const object of input.objects) {
    if (object.meshType === "wall-art") continue;
    for (const cell of getObjectFootprintCells(object)) {
      const occupants = occupiedCells.get(cell.key) ?? [];
      occupants.push(object);
      occupiedCells.set(cell.key, occupants);
    }
  }
  return { layout: input.layout, occupiedCells, objects: input.objects };
}

export function getOfficeCollisionReport(
  object: ObjectFootprintInput,
  grid: OfficeOccupancyGrid,
): OfficeCollisionReport {
  const collisions = grid.objects.filter(
    (candidate) => candidate !== object && objectFootprintsCollide(object, candidate),
  );
  return {
    object,
    collisions,
    outsideLayout: !isObjectFootprintInsideLayout(object, grid.layout),
  };
}

export function canPlaceOfficeObject(
  object: ObjectFootprintInput,
  grid: OfficeOccupancyGrid,
): boolean {
  const report = getOfficeCollisionReport(object, grid);
  return !report.outsideLayout && report.collisions.length === 0;
}

function worldRangeToGridRange(input: {
  minWorld: number;
  maxWorld: number;
  worldMin: number;
  maxIndex: number;
  cellSize: number;
}): { min: number; max: number } {
  const min = Math.floor((input.minWorld - input.worldMin) / input.cellSize);
  const max = Math.ceil((input.maxWorld - input.worldMin) / input.cellSize) - 1;
  return {
    min: Math.max(0, Math.min(input.maxIndex, min)),
    max: Math.max(0, Math.min(input.maxIndex, max)),
  };
}

/**
 * Builds the pathfinding-ready walkability grid from the same layout and
 * footprint contract used by placement and debug overlays.
 *
 * The current A* scene adapter still owns Three.js object collection; this pure
 * bridge is the canonical next wire-up point so pathing can stop duplicating
 * obstacle shape assumptions.
 */
export function buildOfficeWalkabilityGrid(input: {
  layout: OfficeLayoutModel;
  objects: ObjectFootprintInput[];
  cellSize?: number;
}): OfficeWalkabilityGrid {
  const cellSize = Math.max(0.1, input.cellSize ?? 0.5);
  const bounds = getOfficeLayoutBounds(input.layout);
  const gridWidth = Math.ceil(bounds.width / cellSize);
  const gridDepth = Math.ceil(bounds.depth / cellSize);
  const walkableGrid = Array.from({ length: gridWidth }, () =>
    Array.from({ length: gridDepth }, () => false),
  );

  for (const tileKey of getOfficeLayoutTileSet(input.layout)) {
    const tile = parseOfficeLayoutTileKey(tileKey);
    if (!tile) continue;
    const xRange = worldRangeToGridRange({
      minWorld: tile.x - 0.5,
      maxWorld: tile.x + 0.5,
      worldMin: bounds.minWorldX,
      maxIndex: gridWidth - 1,
      cellSize,
    });
    const zRange = worldRangeToGridRange({
      minWorld: tile.z - 0.5,
      maxWorld: tile.z + 0.5,
      worldMin: bounds.minWorldZ,
      maxIndex: gridDepth - 1,
      cellSize,
    });
    for (let x = xRange.min; x <= xRange.max; x += 1) {
      for (let z = zRange.min; z <= zRange.max; z += 1) {
        walkableGrid[x][z] = true;
      }
    }
  }

  for (const object of input.objects) {
    if (object.meshType === "wall-art" || object.meshType === "activity-landmark") continue;
    const aabb = getObjectFootprintAabb(object);
    const xRange = worldRangeToGridRange({
      minWorld: aabb.minX,
      maxWorld: aabb.maxX,
      worldMin: bounds.minWorldX,
      maxIndex: gridWidth - 1,
      cellSize,
    });
    const zRange = worldRangeToGridRange({
      minWorld: aabb.minZ,
      maxWorld: aabb.maxZ,
      worldMin: bounds.minWorldZ,
      maxIndex: gridDepth - 1,
      cellSize,
    });
    for (let x = xRange.min; x <= xRange.max; x += 1) {
      for (let z = zRange.min; z <= zRange.max; z += 1) {
        walkableGrid[x][z] = false;
      }
    }
  }

  return {
    gridWidth,
    gridDepth,
    cellSize,
    worldMinX: bounds.minWorldX,
    worldMinZ: bounds.minWorldZ,
    walkableGrid,
  };
}
