/**
 * OFFICE PLACEMENT
 * ================
 * Purpose
 * - Provide deterministic footprint + occupancy checks for CLI placement.
 *
 * KEY CONCEPTS:
 * - All collision checks are on XZ plane using simple AABB footprints.
 * - Auto placement uses expanding square-ring scan from a fixed origin.
 *
 * USAGE:
 * - isPlacementAreaFree(...)
 * - findFirstOpenPlacement(...)
 *
 * MEMORY REFERENCES:
 * - MEM-0120
 */
import type { OfficeObjectModel } from "./sidecar-store.js";

export interface PlacementFootprint {
  width: number;
  depth: number;
  clearance: number;
}

export interface PlacementBounds {
  halfExtent: number;
}

export interface AutoPlacementInput {
  meshType: string;
  metadata?: Record<string, unknown>;
  existingObjects: OfficeObjectModel[];
  bounds: PlacementBounds;
  gridStep?: number;
}

export interface PlacementViolation {
  type: "collision" | "out_of_bounds";
  objectId: string;
  otherObjectId?: string;
  meshType: string;
  otherMeshType?: string;
  position: [number, number, number];
  otherPosition?: [number, number, number];
}

export interface PlacementAabb {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const DEFAULT_FOOTPRINT: PlacementFootprint = { width: 2, depth: 2, clearance: 0.25 };
export const TEAM_CLUSTER_VISUAL_FOOTPRINT: PlacementFootprint = {
  width: 9.2,
  depth: 7.4,
  clearance: 0.5,
};

const FOOTPRINT_BY_MESH: Record<string, PlacementFootprint> = {
  "team-cluster": TEAM_CLUSTER_VISUAL_FOOTPRINT,
  plant: { width: 1, depth: 1, clearance: 0.2 },
  couch: { width: 3.4, depth: 2.2, clearance: 0.8 },
  bookshelf: { width: 3.1, depth: 1.4, clearance: 0.65 },
  pantry: { width: 7.2, depth: 2.4, clearance: 0.65 },
  "glass-wall": { width: 4, depth: 0.35, clearance: 0.05 },
  "custom-mesh": { width: 2, depth: 2, clearance: 0.25 },
};

function asFinitePositive(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function asFiniteNonNegative(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function normalizeGridStep(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return 1;
  return raw;
}

export function getMeshFootprint(meshType: string, metadata?: Record<string, unknown>): PlacementFootprint {
  const base = FOOTPRINT_BY_MESH[meshType] ?? DEFAULT_FOOTPRINT;
  const meta = metadata ?? {};
  const width = asFinitePositive(meta.footprintWidth) ?? base.width;
  const depth = asFinitePositive(meta.footprintDepth) ?? base.depth;
  const clearance = asFiniteNonNegative(meta.footprintClearance) ?? base.clearance;
  return { width, depth, clearance };
}

export function getObjectFootprint(object: {
  meshType: string;
  metadata?: Record<string, unknown>;
  rotation?: [number, number, number];
}): PlacementFootprint {
  const footprint = getMeshFootprint(object.meshType, object.metadata);
  const rotationY = object.rotation?.[1] ?? 0;
  if (!Number.isFinite(rotationY)) return footprint;
  const cos = Math.abs(Math.cos(rotationY));
  const sin = Math.abs(Math.sin(rotationY));
  return {
    width: footprint.width * cos + footprint.depth * sin,
    depth: footprint.width * sin + footprint.depth * cos,
    clearance: footprint.clearance,
  };
}

function getMeshFootprintOffset(meshType: string, metadata?: Record<string, unknown>): { x: number; z: number } {
  const metadataOffsetX = metadata?.footprintOffsetX;
  const metadataOffsetZ = metadata?.footprintOffsetZ;
  const x =
    typeof metadataOffsetX === "number" && Number.isFinite(metadataOffsetX)
      ? metadataOffsetX
      : meshType === "pantry"
        ? 0.4
        : 0;
  const z =
    typeof metadataOffsetZ === "number" && Number.isFinite(metadataOffsetZ)
      ? metadataOffsetZ
      : meshType === "pantry"
        ? -0.5
        : 0;
  return { x, z };
}

function rotateOffset(offset: { x: number; z: number }, rotationY: number): { x: number; z: number } {
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  return {
    x: offset.x * cos + offset.z * sin,
    z: -offset.x * sin + offset.z * cos,
  };
}

export function getObjectPlacementAabb(object: {
  meshType: string;
  position: [number, number, number];
  metadata?: Record<string, unknown>;
  rotation?: [number, number, number];
}): PlacementAabb {
  const footprint = getObjectFootprint(object);
  const rotationY = object.rotation?.[1] ?? 0;
  const offset = getMeshFootprintOffset(object.meshType, object.metadata);
  const rotatedOffset = Number.isFinite(rotationY) ? rotateOffset(offset, rotationY) : offset;
  const centerX = object.position[0] + rotatedOffset.x;
  const centerZ = object.position[2] + rotatedOffset.z;
  const halfWidth = effectiveHalfWidth(footprint);
  const halfDepth = effectiveHalfDepth(footprint);
  return {
    minX: centerX - halfWidth,
    maxX: centerX + halfWidth,
    minZ: centerZ - halfDepth,
    maxZ: centerZ + halfDepth,
  };
}

function effectiveHalfWidth(footprint: PlacementFootprint): number {
  return footprint.width / 2 + footprint.clearance;
}

function effectiveHalfDepth(footprint: PlacementFootprint): number {
  return footprint.depth / 2 + footprint.clearance;
}

function isAabbInsideBounds(aabb: PlacementAabb, bounds: PlacementBounds): boolean {
  const limit = bounds.halfExtent;
  return aabb.minX >= -limit && aabb.maxX <= limit && aabb.minZ >= -limit && aabb.maxZ <= limit;
}

function intersectsXZ(leftAabb: PlacementAabb, rightAabb: PlacementAabb): boolean {
  return (
    leftAabb.minX < rightAabb.maxX &&
    leftAabb.maxX > rightAabb.minX &&
    leftAabb.minZ < rightAabb.maxZ &&
    leftAabb.maxZ > rightAabb.minZ
  );
}

function canSharePlacementContact(leftMeshType: string, rightMeshType: string): boolean {
  return leftMeshType === "glass-wall" && rightMeshType === "glass-wall";
}

export function findPlacementViolations(input: {
  objects: OfficeObjectModel[];
  bounds: PlacementBounds;
}): PlacementViolation[] {
  const violations: PlacementViolation[] = [];

  for (const object of input.objects) {
    if (!isAabbInsideBounds(getObjectPlacementAabb(object), input.bounds)) {
      violations.push({
        type: "out_of_bounds",
        objectId: object.id,
        meshType: object.meshType,
        position: object.position,
      });
    }
  }

  for (let leftIndex = 0; leftIndex < input.objects.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < input.objects.length; rightIndex += 1) {
      const left = input.objects[leftIndex];
      const right = input.objects[rightIndex];
      if (canSharePlacementContact(left.meshType, right.meshType)) continue;
      if (
        intersectsXZ(
          getObjectPlacementAabb(left),
          getObjectPlacementAabb(right),
        )
      ) {
        violations.push({
          type: "collision",
          objectId: left.id,
          otherObjectId: right.id,
          meshType: left.meshType,
          otherMeshType: right.meshType,
          position: left.position,
          otherPosition: right.position,
        });
      }
    }
  }

  return violations;
}

export function isPlacementAreaFree(input: {
  position: [number, number, number];
  meshType: string;
  metadata?: Record<string, unknown>;
  rotation?: [number, number, number];
  existingObjects: OfficeObjectModel[];
  bounds: PlacementBounds;
  ignoreObjectId?: string;
}): boolean {
  const targetAabb = getObjectPlacementAabb(input);
  if (!isAabbInsideBounds(targetAabb, input.bounds)) {
    return false;
  }
  for (const object of input.existingObjects) {
    if (input.ignoreObjectId && object.id === input.ignoreObjectId) continue;
    if (intersectsXZ(targetAabb, getObjectPlacementAabb(object))) {
      return false;
    }
  }
  return true;
}

function snap(raw: number, step: number): number {
  return Math.round(raw / step) * step;
}

export function findFirstOpenPlacement(input: AutoPlacementInput): [number, number, number] | null {
  const step = normalizeGridStep(input.gridStep);
  const maxRing = Math.ceil((input.bounds.halfExtent * 2) / step) + 2;
  const originX = 0;
  const originZ = 0;
  const metadata = input.metadata ?? {};

  for (let ring = 0; ring <= maxRing; ring += 1) {
    for (let dz = -ring; dz <= ring; dz += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
        const candidate: [number, number, number] = [snap(originX + dx * step, step), 0, snap(originZ + dz * step, step)];
        if (
          isPlacementAreaFree({
            position: candidate,
            meshType: input.meshType,
            metadata,
            existingObjects: input.existingObjects,
            bounds: input.bounds,
          })
        ) {
          return candidate;
        }
      }
    }
  }
  return null;
}
