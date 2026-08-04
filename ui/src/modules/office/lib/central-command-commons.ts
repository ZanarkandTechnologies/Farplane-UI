/**
 * CENTRAL COMMAND COMMONS
 * =======================
 * Owns the default auto-layout composition: one central command anchor plus
 * contiguous, walk-in activity bays on the north and west office edges.
 * Inputs are already-resolved required objects/routes; output is deterministic
 * geometry only and has no persistence side effects.
 */

import { getObjectFootprintCells } from "../systems/occupancy-system";
import {
  ACTIVITY_DESTINATION_BAY_DEPTH,
  ACTIVITY_DESTINATION_BAY_WIDTH,
} from "./activity-destination-room";
import {
  COMMAND_COMMONS_VISUAL_DEPTH,
  COMMAND_COMMONS_VISUAL_WIDTH,
} from "./command-commons-geometry";
import { officeLayoutTileKey, parseOfficeLayoutTileKey } from "./office-layout";
import type { OfficeObject } from "./types";

export const COMMAND_COMMONS_PANEL_ID = "world" as const;

export type CentralCommandBayEdge = "north" | "west" | "east";

export interface CentralCommandBaySlot {
  edge: CentralCommandBayEdge;
  position: [number, number, number];
  rotationY: number;
  accessTile: { x: number; z: number };
  tileKeys: string[];
}

export interface CentralCommandCommonsPlan {
  coreBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    width: number;
    depth: number;
  };
  outerBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    width: number;
    depth: number;
  };
  floorTiles: Set<string>;
  placedDestinations: OfficeObject[];
  roomSlots: CentralCommandBaySlot[];
}

function bounds(minX: number, maxX: number, minZ: number, maxZ: number) {
  return { minX, maxX, minZ, maxZ, width: maxX - minX + 1, depth: maxZ - minZ + 1 };
}

function getDemandBounds(input: {
  requiredObjects: OfficeObject[];
  reservedWalkTiles: Set<string>;
  paddingTiles: number;
}) {
  const points = input.requiredObjects.flatMap((object) =>
    object.meshType === "wall-art"
      ? []
      : getObjectFootprintCells(object).flatMap((cell) => [
          { x: cell.x - input.paddingTiles, z: cell.z - input.paddingTiles },
          { x: cell.x + input.paddingTiles, z: cell.z + input.paddingTiles },
        ]),
  );
  for (const key of input.reservedWalkTiles) {
    const tile = parseOfficeLayoutTileKey(key);
    if (tile) points.push(tile);
  }
  if (points.length === 0) return bounds(0, 0, 0, 0);
  return bounds(
    Math.min(...points.map((point) => point.x)),
    Math.max(...points.map((point) => point.x)),
    Math.min(...points.map((point) => point.z)),
    Math.max(...points.map((point) => point.z)),
  );
}

function moduleKeys(centerX: number, centerZ: number): string[] {
  const minX = Math.ceil(centerX - ACTIVITY_DESTINATION_BAY_WIDTH / 2);
  const minZ = Math.ceil(centerZ - ACTIVITY_DESTINATION_BAY_DEPTH / 2);
  const keys: string[] = [];
  for (let x = minX; x < minX + ACTIVITY_DESTINATION_BAY_WIDTH; x += 1) {
    for (let z = minZ; z < minZ + ACTIVITY_DESTINATION_BAY_DEPTH; z += 1) {
      keys.push(officeLayoutTileKey(x, z));
    }
  }
  return keys;
}

export function createCommandCommonsObject(
  input: { center?: [number, number, number]; companyId?: string } = {},
): OfficeObject {
  return {
    _id: "generated-command-commons",
    companyId: input.companyId,
    meshType: "command-commons",
    position: input.center ?? [0, 0, 0],
    rotation: [0, 0, 0],
    metadata: {
      generated: true,
      footprintWidth: COMMAND_COMMONS_VISUAL_WIDTH,
      footprintDepth: COMMAND_COMMONS_VISUAL_DEPTH,
      footprintClearance: 0.6,
      visualFootprintWidth: COMMAND_COMMONS_VISUAL_WIDTH,
      visualFootprintDepth: COMMAND_COMMONS_VISUAL_DEPTH,
      uiBinding: { kind: "internalPanel", panelId: COMMAND_COMMONS_PANEL_ID },
    },
  };
}

export function planCentralCommandCommons(input: {
  requiredObjects: OfficeObject[];
  reservedWalkTiles: Set<string>;
  destinations: OfficeObject[];
  paddingTiles: number;
  minimumCoreTileArea?: number;
}): CentralCommandCommonsPlan | null {
  if (input.destinations.length === 0) return null;
  const demand = getDemandBounds(input);
  // Keep the command table visually centered in the shell. Activity bays form
  // a balanced three-sided perimeter instead of growing an asymmetric north-
  // west L that leaves one half of the office looking vacant.
  const northCount = Math.ceil(input.destinations.length / 3);
  const sideCount = input.destinations.length - northCount;
  const westCount = Math.ceil(sideCount / 2);
  const eastCount = sideCount - westCount;
  let columns = Math.max(1, northCount, Math.ceil(demand.width / ACTIVITY_DESTINATION_BAY_WIDTH));
  let rows = Math.max(
    1,
    westCount,
    eastCount,
    Math.ceil(demand.depth / ACTIVITY_DESTINATION_BAY_DEPTH),
  );
  const minimumArea = input.minimumCoreTileArea ?? 0;
  while (
    columns * ACTIVITY_DESTINATION_BAY_WIDTH * rows * ACTIVITY_DESTINATION_BAY_DEPTH <
    minimumArea
  ) {
    if (columns * ACTIVITY_DESTINATION_BAY_WIDTH <= rows * ACTIVITY_DESTINATION_BAY_DEPTH)
      columns += 1;
    else rows += 1;
  }

  const coreWidth = columns * ACTIVITY_DESTINATION_BAY_WIDTH;
  const coreDepth = rows * ACTIVITY_DESTINATION_BAY_DEPTH;
  const centerX = (demand.minX + demand.maxX) / 2;
  const centerZ = (demand.minZ + demand.maxZ) / 2;
  const minX = Math.round(centerX - (coreWidth - 1) / 2);
  const minZ = Math.round(centerZ - (coreDepth - 1) / 2);
  const coreBounds = bounds(minX, minX + coreWidth - 1, minZ, minZ + coreDepth - 1);
  // Bays are walk-in alcoves carved from the perimeter of the occupied core.
  // Keeping them inside the shell removes the empty moat that an external rail
  // creates between the activities and the nearest work neighborhoods.
  const outerBounds = coreBounds;

  const northSlots: CentralCommandBaySlot[] = Array.from({ length: northCount }, (_, index) => {
    const x = coreBounds.minX + ((index + 1) / (northCount + 1)) * (coreBounds.width - 1);
    const z = coreBounds.minZ + (ACTIVITY_DESTINATION_BAY_DEPTH - 1) / 2;
    return {
      edge: "north",
      position: [x, input.destinations[0]?.position[1] ?? 0, z],
      rotationY: 0,
      accessTile: { x: Math.round(x), z: coreBounds.minZ + ACTIVITY_DESTINATION_BAY_DEPTH },
      tileKeys: moduleKeys(x, z),
    };
  });
  const westSlots: CentralCommandBaySlot[] = Array.from({ length: westCount }, (_, index) => {
    const x = coreBounds.minX + (ACTIVITY_DESTINATION_BAY_WIDTH - 1) / 2;
    const z = coreBounds.minZ + ((index + 1) / (westCount + 1)) * (coreBounds.depth - 1);
    return {
      edge: "west",
      position: [x, input.destinations[0]?.position[1] ?? 0, z],
      rotationY: -Math.PI / 2,
      accessTile: { x: coreBounds.minX + ACTIVITY_DESTINATION_BAY_WIDTH, z: Math.round(z) },
      tileKeys: moduleKeys(x, z),
    };
  });
  const eastSlots: CentralCommandBaySlot[] = Array.from({ length: eastCount }, (_, index) => {
    const x = coreBounds.maxX - (ACTIVITY_DESTINATION_BAY_WIDTH - 1) / 2;
    const z = coreBounds.minZ + ((index + 1) / (eastCount + 1)) * (coreBounds.depth - 1);
    return {
      edge: "east",
      position: [x, input.destinations[0]?.position[1] ?? 0, z],
      rotationY: Math.PI / 2,
      accessTile: { x: coreBounds.maxX - ACTIVITY_DESTINATION_BAY_WIDTH, z: Math.round(z) },
      tileKeys: moduleKeys(x, z),
    };
  });
  const roomSlots = [...northSlots, ...westSlots, ...eastSlots];
  const floorTiles = new Set<string>();
  for (let x = outerBounds.minX; x <= outerBounds.maxX; x += 1) {
    for (let z = outerBounds.minZ; z <= outerBounds.maxZ; z += 1) {
      floorTiles.add(officeLayoutTileKey(x, z));
    }
  }
  const placedDestinations = input.destinations.map((object, index) => {
    const slot = roomSlots[index];
    if (!slot) throw new Error("Central command bay capacity invariant failed");
    return {
      ...object,
      position: slot.position,
      rotation: [object.rotation?.[0] ?? 0, slot.rotationY, object.rotation?.[2] ?? 0],
      metadata: {
        ...(object.metadata ?? {}),
        destinationBayZone: true,
        destinationBayEdge: slot.edge,
        destinationRoomZone: false,
        footprintWidth: ACTIVITY_DESTINATION_BAY_WIDTH,
        footprintDepth: ACTIVITY_DESTINATION_BAY_DEPTH,
        footprintClearance: 0,
      },
    } as OfficeObject;
  });
  return { coreBounds, outerBounds, floorTiles, placedDestinations, roomSlots };
}
