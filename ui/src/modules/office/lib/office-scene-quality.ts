/** Pure spatial-quality measurements published to the office QA surface. */

import { DESK_HEIGHT, TOTAL_HEIGHT } from "@/constants";
import {
  EMPLOYEE_HIT_CAPSULE_WIDTH,
  EMPLOYEE_VISUAL_SCALE,
} from "../components/employee/employee-scene-scale";
import { getObjectFootprint, isObjectFootprintInsideLayout } from "../systems/occupancy-system";
import { getOfficeLayoutWallSegments, type OfficeLayoutModel } from "./office-layout";
import { OPERATING_ROOM_IDS } from "./operating-room-catalog";
import type { OfficeObject } from "./types";

const COMPOSITION_MESH_TYPES = new Set(["team-cluster", "command-commons", "activity-landmark"]);
const CIRCULATION_MESH_TYPES = new Set(["team-cluster", "command-commons"]);
const WALL_MESH_TYPES = new Set(["glass-wall", "office-divider"]);

function visualValidationObject(object: OfficeObject): OfficeObject {
  const visualWidth = object.metadata?.visualFootprintWidth;
  const visualDepth = object.metadata?.visualFootprintDepth;
  if (typeof visualWidth !== "number" || typeof visualDepth !== "number") return object;
  return {
    ...object,
    metadata: {
      ...(object.metadata ?? {}),
      footprintWidth: visualWidth,
      footprintDepth: visualDepth,
    },
  };
}

function rawBounds(object: OfficeObject) {
  const footprint = getObjectFootprint(visualValidationObject(object));
  return {
    minX: object.position[0] - footprint.width / 2,
    maxX: object.position[0] + footprint.width / 2,
    minZ: object.position[2] - footprint.depth / 2,
    maxZ: object.position[2] + footprint.depth / 2,
  };
}

function edgeClearance(left: OfficeObject, right: OfficeObject): number {
  const a = rawBounds(left);
  const b = rawBounds(right);
  const gapX = Math.max(0, Math.max(a.minX, b.minX) - Math.min(a.maxX, b.maxX));
  const gapZ = Math.max(0, Math.max(a.minZ, b.minZ) - Math.min(a.maxZ, b.maxZ));
  return Math.hypot(gapX, gapZ);
}

function visualBoundsIntersect(left: OfficeObject, right: OfficeObject): boolean {
  const a = rawBounds(left);
  const b = rawBounds(right);
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

export function measureOfficeSceneQuality(
  officeObjects: OfficeObject[],
  officeLayout?: OfficeLayoutModel,
  options?: { hasOfficeShell?: boolean },
) {
  const leaves = officeObjects.filter((object) => COMPOSITION_MESH_TYPES.has(object.meshType));
  const walls = officeObjects.filter((object) => WALL_MESH_TYPES.has(object.meshType));
  let leafIntersectionCount = 0;
  let wallIntersectionCount = 0;
  const leafIntersections: string[] = [];
  const wallIntersections: string[] = [];
  let shellBoundaryIntersectionCount = 0;
  let minimumCirculationClearance = Number.POSITIVE_INFINITY;
  for (let leftIndex = 0; leftIndex < leaves.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < leaves.length; rightIndex += 1) {
      const left = leaves[leftIndex];
      const right = leaves[rightIndex];
      if (visualBoundsIntersect(left, right)) {
        leafIntersectionCount += 1;
        leafIntersections.push(`${String(left._id)}<>${String(right._id)}`);
      }
      if (CIRCULATION_MESH_TYPES.has(left.meshType) && CIRCULATION_MESH_TYPES.has(right.meshType)) {
        minimumCirculationClearance = Math.min(
          minimumCirculationClearance,
          edgeClearance(left, right),
        );
      }
    }
    for (const wall of walls) {
      if (visualBoundsIntersect(leaves[leftIndex], wall)) {
        wallIntersectionCount += 1;
        wallIntersections.push(`${String(leaves[leftIndex]._id)}<>${String(wall._id)}`);
      }
    }
    if (
      options?.hasOfficeShell !== false &&
      officeLayout &&
      !isObjectFootprintInsideLayout(visualValidationObject(leaves[leftIndex]), officeLayout)
    ) {
      wallIntersectionCount += 1;
      shellBoundaryIntersectionCount += 1;
      wallIntersections.push(`${String(leaves[leftIndex]._id)}<>office-shell`);
    }
  }
  const employeeWorldHeight = TOTAL_HEIGHT * EMPLOYEE_VISUAL_SCALE;
  const operatingRoomIds = officeObjects.flatMap((object) =>
    object.meshType === "activity-landmark" && typeof object.metadata?.operatingRoomId === "string"
      ? [object.metadata.operatingRoomId]
      : [],
  );
  const operatingRoomIdCounts = operatingRoomIds.reduce<Record<string, number>>((counts, id) => {
    counts[id] = (counts[id] ?? 0) + 1;
    return counts;
  }, {});
  return {
    employeeVisualScale: EMPLOYEE_VISUAL_SCALE,
    employeeWorldHeight,
    deskWorktopHeight: DESK_HEIGHT,
    employeeToDeskHeightRatio: employeeWorldHeight / DESK_HEIGHT,
    employeeHitCapsuleWidth: EMPLOYEE_HIT_CAPSULE_WIDTH,
    leafIntersectionCount,
    wallIntersectionCount,
    shellBoundaryIntersectionCount,
    leafIntersections,
    wallIntersections,
    operatingRoomCount: operatingRoomIds.length,
    missingOperatingRoomIds: OPERATING_ROOM_IDS.filter((roomId) => !operatingRoomIdCounts[roomId]),
    duplicateOperatingRoomIds: Object.entries(operatingRoomIdCounts)
      .filter(([, count]) => count > 1)
      .map(([roomId]) => roomId),
    minimumCirculationClearance: Number.isFinite(minimumCirculationClearance)
      ? minimumCirculationClearance
      : null,
    measuredLeafCount: leaves.length,
    measuredWallCount:
      walls.length + (officeLayout ? getOfficeLayoutWallSegments(officeLayout).length : 0),
  };
}
