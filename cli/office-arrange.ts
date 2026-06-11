/**
 * OFFICE ARRANGE
 * ==============
 * Purpose
 * - Provide deterministic office furniture allocation shared by CLI and UI.
 */

import { HALF_FLOOR } from "./constants.js";
import {
  findPlacementViolations,
  getMeshFootprint,
  isPlacementAreaFree,
  type PlacementViolation,
} from "./office-placement.js";
import type { OfficeObjectModel } from "./sidecar-store.js";

const TEAM_LANE_X = [-12, 0, 12];
const TEAM_LANE_Z = [13, 4.25, -4.5, -13];

const STUDIO_TEAM_LAYOUT: Array<[number, number, number]> = [
  [0, 0, 13],
  [-12, 0, 4.25],
  [12, 0, 4.25],
  [-12, 0, -4.5],
  [0, 0, -4.5],
  [12, 0, -4.5],
  [-12, 0, -13],
  [0, 0, -13],
  [12, 0, -13],
  [-12, 0, 13],
  [12, 0, 13],
  [0, 0, 4.25],
];

const STUDIO_PLANT_LAYOUT: Array<[number, number, number]> = [
  [-16, 0, 15],
  [16, 0, 15],
  [-16, 0, -16],
  [16, 0, -16],
];

const TEAM_GRID_X = TEAM_LANE_X;
const TEAM_GRID_Z = TEAM_LANE_Z;
const DECOR_GRID_X = [-16, -13, -10, -7, -4, -1, 2, 5, 8, 11, 14, 16];
const DECOR_GRID_Z = [16, 13, 10, 7, 4, 1, -2, -5, -8, -11, -14, -16];

export interface OfficeArrangeResult {
  objects: OfficeObjectModel[];
  moved: Array<{ id: string; position: [number, number, number] }>;
  placementViolations: PlacementViolation[];
}

export type OfficeArrangePlacementGuard = (
  object: OfficeObjectModel,
  placedObjects: OfficeObjectModel[],
) => boolean;

function arrangePriority(object: OfficeObjectModel): number {
  const id = object.id.toLowerCase();
  const teamId = String(object.metadata?.teamId ?? "").toLowerCase();
  const name = String(object.metadata?.name ?? "").toLowerCase();
  const haystack = `${id} ${teamId} ${name}`;
  if (teamId === "team-management" || name === "management") return 0;
  if (haystack.includes("projects-farplane-ui")) return 2;
  if (haystack.includes("projects-farplane")) return 1;
  if (haystack.includes("kenjipcx-life")) return 3;
  if (haystack.includes("codex-proj-misc")) return 4;
  if (haystack.includes("scammed") || haystack.includes("scamcheck")) return 5;
  if (haystack.includes("coding-harness")) return 6;
  return 100;
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededScore(seed: string, id: string): number {
  return hashSeed(`${seed}:${id}`) / 0xffffffff;
}

function seededPositions(
  xs: number[],
  zs: number[],
  seed: string,
  salt: string,
): Array<[number, number, number]> {
  const positions: Array<[number, number, number]> = [];
  for (const z of zs) {
    for (const x of xs) {
      positions.push([x, 0, z]);
    }
  }
  return positions.sort((left, right) => {
    const leftScore = seededScore(seed, `${salt}:${left[0]}:${left[2]}`);
    const rightScore = seededScore(seed, `${salt}:${right[0]}:${right[2]}`);
    return leftScore - rightScore;
  });
}

function sortCandidatePositions(
  positions: Array<[number, number, number]>,
  seed: string,
  salt: string,
): Array<[number, number, number]> {
  return [...positions].sort((left, right) => {
    const leftScore = seededScore(seed, `${salt}:${left[0]}:${left[2]}`);
    const rightScore = seededScore(seed, `${salt}:${right[0]}:${right[2]}`);
    return leftScore - rightScore;
  });
}

function isFloorObject(object: OfficeObjectModel): boolean {
  return object.meshType !== "wall-art";
}

function placeObject(
  object: OfficeObjectModel,
  placed: OfficeObjectModel[],
  candidates: Array<[number, number, number]>,
  canPlaceObject?: OfficeArrangePlacementGuard,
): OfficeObjectModel {
  for (const position of candidates) {
    const candidate = { ...object, position };
    if (
      isPlacementAreaFree({
        position,
        meshType: object.meshType,
        metadata: object.metadata,
        rotation: object.rotation,
        existingObjects: placed,
        bounds: { halfExtent: HALF_FLOOR },
      })
      && (!canPlaceObject || canPlaceObject(candidate, placed))
    ) {
      return candidate;
    }
  }
  const footprint = getMeshFootprint(object.meshType, object.metadata);
  throw new Error(
    `office_shuffle_no_slot:${object.id}:footprint=${footprint.width}x${footprint.depth}`,
  );
}

function withValidation(
  objects: OfficeObjectModel[],
  moved: Array<{ id: string; position: [number, number, number] }>,
): OfficeArrangeResult {
  return {
    objects,
    moved,
    placementViolations: findPlacementViolations({
      objects: objects.filter(isFloorObject),
      bounds: { halfExtent: HALF_FLOOR },
    }),
  };
}

export function arrangeOfficeObjectsForStudio(objects: OfficeObjectModel[]): OfficeArrangeResult {
  const teamObjects = objects
    .filter((entry) => entry.meshType === "team-cluster")
    .sort((left, right) => {
      const priorityDelta = arrangePriority(left) - arrangePriority(right);
      return priorityDelta === 0 ? left.id.localeCompare(right.id) : priorityDelta;
    });
  const teamPositionById = new Map<string, [number, number, number]>();
  teamObjects.forEach((object, index) => {
    const position = STUDIO_TEAM_LAYOUT[index] ?? STUDIO_TEAM_LAYOUT[STUDIO_TEAM_LAYOUT.length - 1];
    teamPositionById.set(object.id, position);
  });

  let plantIndex = 0;
  const moved: Array<{ id: string; position: [number, number, number] }> = [];
  const nextObjects = objects.map((object) => {
    const teamPosition = teamPositionById.get(object.id);
    const plantPosition =
      object.meshType === "plant" ? STUDIO_PLANT_LAYOUT[plantIndex++] : undefined;
    const position = teamPosition ?? plantPosition;
    if (!position) return object;
    if (
      object.position[0] === position[0] &&
      object.position[1] === position[1] &&
      object.position[2] === position[2]
    ) {
      return object;
    }
    moved.push({ id: object.id, position });
    return { ...object, position };
  });

  return withValidation(nextObjects, moved);
}

export function shuffleOfficeObjects(
  objects: OfficeObjectModel[],
  options: {
    seed?: string | number;
    teamCandidates?: Array<[number, number, number]>;
    decorCandidates?: Array<[number, number, number]>;
    canPlaceObject?: OfficeArrangePlacementGuard;
  } = {},
): OfficeArrangeResult {
  const seed = String(options.seed ?? Date.now());
  const floorObjects = objects
    .filter(isFloorObject)
    .sort((left, right) => {
      const priorityDelta = arrangePriority(left) - arrangePriority(right);
      if (priorityDelta !== 0) return priorityDelta;
      const meshDelta =
        (left.meshType === "team-cluster" ? 0 : 1) - (right.meshType === "team-cluster" ? 0 : 1);
      if (meshDelta !== 0) return meshDelta;
      return seededScore(seed, left.id) - seededScore(seed, right.id);
    });
  const fixedObjects = objects.filter((object) => !isFloorObject(object));
  const teamCandidates = options.teamCandidates
    ? sortCandidatePositions(options.teamCandidates, seed, "teams")
    : seededPositions(TEAM_GRID_X, TEAM_GRID_Z, seed, "teams");
  const decorCandidates = options.decorCandidates
    ? sortCandidatePositions(options.decorCandidates, seed, "decor")
    : seededPositions(DECOR_GRID_X, DECOR_GRID_Z, seed, "decor");
  const placed: OfficeObjectModel[] = [];
  const nextById = new Map<string, OfficeObjectModel>();
  const moved: Array<{ id: string; position: [number, number, number] }> = [];

  for (const object of floorObjects) {
    const candidates = object.meshType === "team-cluster" ? teamCandidates : decorCandidates;
    const placedObject = placeObject(object, placed, candidates, options.canPlaceObject);
    placed.push(placedObject);
    nextById.set(object.id, placedObject);
    if (
      object.position[0] !== placedObject.position[0] ||
      object.position[1] !== placedObject.position[1] ||
      object.position[2] !== placedObject.position[2]
    ) {
      moved.push({ id: object.id, position: placedObject.position });
    }
  }

  for (const object of fixedObjects) {
    nextById.set(object.id, object);
  }

  return withValidation(
    objects.map((object) => nextById.get(object.id) ?? object),
    moved,
  );
}
