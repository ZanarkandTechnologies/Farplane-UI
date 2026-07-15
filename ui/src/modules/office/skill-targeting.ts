"use client";

/**
 * OFFICE SKILL TARGETING
 * ======================
 * Resolve skill-bound office objects into avatar activity anchors.
 *
 * KEY CONCEPTS:
 * - Agent activity only reports semantic `skillId` values.
 * - Office objects stay responsible for placement and local runtime UI config.
 * - Ordinary anchors sit beside furniture; activity-room anchors sit inside their walkable floor.
 * - Shared skill hosts fan occupants around the object to avoid avatar overlap.
 *
 * USAGE:
 * - Build a `skillId -> position` lookup from office objects.
 * - Resolve the current live-status `skillId` to a transient avatar target.
 *
 * MEMORY REFERENCES:
 * - MEM-0173
 * - MEM-0175
 */

import type { OfficeObject } from "@/modules/office/lib/types";
import { ACTIVITY_DESTINATION_INTERIOR_INSET } from "./lib/activity-destination-room";
import { parseOfficeObjectInteractionConfig } from "./office-object-ui";

const DEFAULT_OBJECT_OFFSET = 2.1;
const OCCUPANT_RING_SPACING = 1.05;
const OCCUPANT_ARC_STEP = Math.PI / 5;
const OCCUPANT_MAX_RING_SIZE = 5;

export function getOfficeSkillAnchorPosition(object: OfficeObject): [number, number, number] {
  const rotationY =
    Array.isArray(object.rotation) && typeof object.rotation[1] === "number"
      ? object.rotation[1]
      : 0;
  if (object.meshType === "activity-landmark") {
    const normalizedRotation = Math.atan2(Math.sin(rotationY), Math.cos(rotationY));
    const inwardX = -Math.sin(normalizedRotation);
    const inwardZ = Math.cos(normalizedRotation);
    return [
      object.position[0] + inwardX * ACTIVITY_DESTINATION_INTERIOR_INSET,
      object.position[1],
      object.position[2] + inwardZ * ACTIVITY_DESTINATION_INTERIOR_INSET,
    ];
  }
  const offsetX = Math.sin(rotationY) * DEFAULT_OBJECT_OFFSET;
  const offsetZ = Math.cos(rotationY) * DEFAULT_OBJECT_OFFSET;
  return [object.position[0] + offsetX, object.position[1], object.position[2] + offsetZ];
}

function getOccupantArcOffset(occupantIndex: number, occupantCount: number): [number, number] {
  if (occupantCount <= 1) {
    return [0, 0];
  }
  const ringIndex = Math.floor(occupantIndex / OCCUPANT_MAX_RING_SIZE);
  const indexWithinRing = occupantIndex % OCCUPANT_MAX_RING_SIZE;
  const ringSize = Math.min(
    OCCUPANT_MAX_RING_SIZE,
    occupantCount - ringIndex * OCCUPANT_MAX_RING_SIZE,
  );
  const centerIndex = (ringSize - 1) / 2;
  const lateralStep = (indexWithinRing - centerIndex) * OCCUPANT_ARC_STEP;
  const radius = OCCUPANT_RING_SPACING * (ringIndex + 1);
  return [Math.sin(lateralStep) * radius, (Math.cos(lateralStep) - 1) * radius];
}

export function getOfficeSkillAnchorPositionForOccupant(
  object: OfficeObject,
  occupantIndex: number,
  occupantCount: number,
): [number, number, number] {
  const base = getOfficeSkillAnchorPosition(object);
  const rotationY =
    Array.isArray(object.rotation) && typeof object.rotation[1] === "number"
      ? object.rotation[1]
      : 0;
  const [localX, localZ] = getOccupantArcOffset(occupantIndex, occupantCount);
  const worldX = localX * Math.cos(rotationY) - localZ * Math.sin(rotationY);
  const worldZ = localX * Math.sin(rotationY) + localZ * Math.cos(rotationY);
  return [base[0] + worldX, base[1], base[2] + worldZ];
}

export function buildSkillTargetObjectMap(
  officeObjects: OfficeObject[],
): Map<string, OfficeObject> {
  const map = new Map<string, OfficeObject>();
  for (const object of officeObjects) {
    const skillBinding = parseOfficeObjectInteractionConfig(object.metadata).skillBinding;
    const skillIds = skillBinding
      ? [skillBinding.skillId, ...(skillBinding.skillIds ?? [])]
          .map((skillId) => skillId.trim())
          .filter(Boolean)
      : [];
    for (const skillId of skillIds) {
      if (!map.has(skillId)) map.set(skillId, object);
    }
  }
  return map;
}
