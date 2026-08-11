/**
 * DEPARTMENT ISLAND LAYOUT
 * ========================
 * Owns deterministic automatic hosted-room placement as a small isometric
 * archipelago. Inputs are the existing room objects and required office
 * furniture; outputs are the same tile-backed navigation layout, placed rooms,
 * and presentation geometry used by the scene. It never persists a second
 * layout or collision model.
 */

import {
  ACTIVITY_DESTINATION_ROOM_DEPTH,
  ACTIVITY_DESTINATION_ROOM_WIDTH,
} from "./activity-destination-room";
import { getOperatingRoomId, type OperatingRoomId } from "./operating-room-catalog";
import { officeLayoutTileKey } from "./office-layout";
import { getObjectFootprintCells } from "../systems/occupancy-system";
import type { OfficeObject } from "./types";

export const DEPARTMENT_ISLAND_IDS = [
  "intelligence",
  "operations",
  "production",
  "assurance",
] as const;

export type DepartmentIslandId = (typeof DEPARTMENT_ISLAND_IDS)[number];

export interface DepartmentIslandDefinition {
  id: DepartmentIslandId;
  label: string;
  center: [number, number];
  width: number;
  depth: number;
  accentColor: string;
  roomIds: readonly OperatingRoomId[];
}

export interface DepartmentIslandBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  width: number;
  depth: number;
}

export interface DepartmentIslandGeometry extends DepartmentIslandDefinition {
  bounds: DepartmentIslandBounds;
}

export interface DepartmentIslandBridge {
  id: DepartmentIslandId;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface DepartmentIslandTeamDeck {
  position: [number, number, number];
  departmentId: DepartmentIslandId;
}

export interface DepartmentIslandRoomSlot {
  departmentId: DepartmentIslandId;
  position: [number, number, number];
  rotationY: number;
  accessTile: { x: number; z: number };
  tileKeys: string[];
}

export interface DepartmentArchipelagoPlan {
  coreBounds: DepartmentIslandBounds;
  outerBounds: DepartmentIslandBounds;
  floorTiles: Set<string>;
  placedDestinations: OfficeObject[];
  roomSlots: DepartmentIslandRoomSlot[];
  islands: DepartmentIslandGeometry[];
  bridges: DepartmentIslandBridge[];
  nexus: DepartmentIslandBounds;
}

const NEXUS_BOUNDS = bounds(-6, 6, -5, 5);

export const DEPARTMENT_ISLAND_DEFINITIONS: readonly DepartmentIslandDefinition[] = [
  {
    id: "intelligence",
    label: "Intelligence",
    center: [-17, -11],
    width: 15,
    depth: 13,
    accentColor: "#A59664",
    roomIds: ["research", "skills", "self-improvement"],
  },
  {
    id: "operations",
    label: "Operations",
    center: [-17, 11],
    width: 15,
    depth: 13,
    accentColor: "#798E77",
    roomIds: ["harness", "organization", "finance"],
  },
  {
    id: "production",
    label: "Production",
    center: [17, -10],
    width: 15,
    depth: 7,
    accentColor: "#A87869",
    roomIds: ["production", "comms"],
  },
  {
    id: "assurance",
    label: "Assurance",
    center: [17, 11],
    width: 15,
    depth: 13,
    accentColor: "#72889A",
    roomIds: ["qa", "telemetry", "thread-data"],
  },
] as const;

const DEPARTMENT_BY_ROOM_ID = new Map<OperatingRoomId, DepartmentIslandId>(
  DEPARTMENT_ISLAND_DEFINITIONS.flatMap((definition) =>
    definition.roomIds.map((roomId) => [roomId, definition.id] as const),
  ),
);

function bounds(minX: number, maxX: number, minZ: number, maxZ: number): DepartmentIslandBounds {
  return { minX, maxX, minZ, maxZ, width: maxX - minX + 1, depth: maxZ - minZ + 1 };
}

function boundsForDefinition(definition: DepartmentIslandDefinition): DepartmentIslandBounds {
  const halfWidth = Math.floor(definition.width / 2);
  const halfDepth = Math.floor(definition.depth / 2);
  return bounds(
    definition.center[0] - halfWidth,
    definition.center[0] + halfWidth,
    definition.center[1] - halfDepth,
    definition.center[1] + halfDepth,
  );
}

function addRectangleTiles(
  target: Set<string>,
  input: DepartmentIslandBounds | DepartmentIslandBridge,
): void {
  for (let x = input.minX; x <= input.maxX; x += 1) {
    for (let z = input.minZ; z <= input.maxZ; z += 1) {
      target.add(officeLayoutTileKey(x, z));
    }
  }
}

function roomTileKeys(position: [number, number, number]): string[] {
  const minX = Math.ceil(position[0] - ACTIVITY_DESTINATION_ROOM_WIDTH / 2);
  const minZ = Math.ceil(position[2] - ACTIVITY_DESTINATION_ROOM_DEPTH / 2);
  const keys: string[] = [];
  for (let x = minX; x < minX + ACTIVITY_DESTINATION_ROOM_WIDTH; x += 1) {
    for (let z = minZ; z < minZ + ACTIVITY_DESTINATION_ROOM_DEPTH; z += 1) {
      keys.push(officeLayoutTileKey(x, z));
    }
  }
  return keys;
}

function roomSlotsForDefinition(
  definition: DepartmentIslandDefinition,
): DepartmentIslandRoomSlot[] {
  const [centerX, centerZ] = definition.center;
  const positions: Array<{ position: [number, number, number]; rotationY: number }> =
    definition.roomIds.length === 2
      ? [
          { position: [centerX - 3, 0, centerZ], rotationY: 0 },
          { position: [centerX + 3, 0, centerZ], rotationY: 0 },
        ]
      : [
          { position: [centerX - 3, 0, centerZ - 3], rotationY: 0 },
          { position: [centerX + 3, 0, centerZ - 3], rotationY: 0 },
          { position: [centerX, 0, centerZ + 3], rotationY: Math.PI },
        ];

  return positions.map(({ position, rotationY }) => ({
    departmentId: definition.id,
    position,
    rotationY,
    accessTile:
      Math.abs(rotationY) < 0.001
        ? { x: Math.round(position[0]), z: Math.round(position[2] + 3) }
        : { x: Math.round(position[0]), z: Math.round(position[2] - 3) },
    tileKeys: roomTileKeys(position),
  }));
}

function getArchipelagoBounds(
  islands: DepartmentIslandGeometry[],
  nexus: DepartmentIslandBounds,
): DepartmentIslandBounds {
  const entries = [...islands.map((island) => island.bounds), nexus];
  return bounds(
    Math.min(...entries.map((entry) => entry.minX)),
    Math.max(...entries.map((entry) => entry.maxX)),
    Math.min(...entries.map((entry) => entry.minZ)),
    Math.max(...entries.map((entry) => entry.maxZ)),
  );
}

export function getDepartmentIslandId(roomId: OperatingRoomId): DepartmentIslandId {
  const departmentId = DEPARTMENT_BY_ROOM_ID.get(roomId);
  if (!departmentId) throw new Error(`No department island configured for room ${roomId}`);
  return departmentId;
}

export function getDepartmentIslandGeometry(): DepartmentIslandGeometry[] {
  return DEPARTMENT_ISLAND_DEFINITIONS.map((definition) => ({
    ...definition,
    bounds: boundsForDefinition(definition),
  }));
}

export function getDepartmentIslandBridgePlan(): DepartmentIslandBridge[] {
  return [
    { id: "intelligence", minX: -9, maxX: -7, minZ: -5, maxZ: -5 },
    { id: "operations", minX: -9, maxX: -7, minZ: 5, maxZ: 5 },
    // The Production island meets the south-east bridge at z=-7. Keeping this
    // one tile deeper avoids a diagonal-only contact, which tile navigation
    // correctly treats as disconnected.
    { id: "production", minX: 7, maxX: 9, minZ: -7, maxZ: -5 },
    { id: "assurance", minX: 7, maxX: 9, minZ: 5, maxZ: 5 },
  ];
}

/**
 * The first walkable tile on each department's bridge. Room routing targets
 * this local seam rather than the centre of the office, so a populated nexus
 * cannot make an otherwise valid department look disconnected.
 */
export function getDepartmentIslandBridgeAccessTile(departmentId: DepartmentIslandId): {
  x: number;
  z: number;
} {
  const bridge = getDepartmentIslandBridgePlan().find((candidate) => candidate.id === departmentId);
  if (!bridge) throw new Error(`No bridge configured for department ${departmentId}`);
  return {
    x: departmentId === "intelligence" || departmentId === "operations" ? bridge.minX : bridge.maxX,
    z: bridge.minZ,
  };
}

const TEAM_DECKS: readonly DepartmentIslandTeamDeck[] = [
  { departmentId: "intelligence", position: [-22, 0, -6] },
  { departmentId: "operations", position: [-22, 0, 15] },
  { departmentId: "production", position: [12, 0, -6] },
  { departmentId: "assurance", position: [12, 0, 15] },
  { departmentId: "production", position: [22, 0, -6] },
  { departmentId: "assurance", position: [22, 0, 15] },
  { departmentId: "intelligence", position: [-12, 0, -6] },
  { departmentId: "operations", position: [-12, 0, 15] },
] as const;

/** Stable automatic project-table decks; overflow wraps by capacity without persistence. */
export function getDepartmentIslandTeamDeck(index: number): DepartmentIslandTeamDeck {
  const safeIndex = Math.max(0, Math.floor(index));
  return TEAM_DECKS[safeIndex % TEAM_DECKS.length] ?? TEAM_DECKS[0]!;
}

export function isDepartmentArchipelagoRoom(object: OfficeObject): boolean {
  const roomId = getOperatingRoomId(object);
  return roomId !== null && DEPARTMENT_BY_ROOM_ID.has(roomId);
}

export function planDepartmentArchipelago(input: {
  requiredObjects: OfficeObject[];
  destinations: OfficeObject[];
}): DepartmentArchipelagoPlan | null {
  if (input.destinations.length === 0) return null;
  const islands = getDepartmentIslandGeometry();
  const bridges = getDepartmentIslandBridgePlan();
  const floorTiles = new Set<string>();
  addRectangleTiles(floorTiles, NEXUS_BOUNDS);
  for (const island of islands) addRectangleTiles(floorTiles, island.bounds);
  for (const bridge of bridges) addRectangleTiles(floorTiles, bridge);
  for (const object of input.requiredObjects) {
    for (const cell of getObjectFootprintCells(object)) floorTiles.add(cell.key);
  }

  const slotsByRoomId = new Map<OperatingRoomId, DepartmentIslandRoomSlot>();
  for (const definition of DEPARTMENT_ISLAND_DEFINITIONS) {
    const slots = roomSlotsForDefinition(definition);
    definition.roomIds.forEach((roomId, index) => {
      const slot = slots[index];
      if (slot) slotsByRoomId.set(roomId, slot);
    });
  }

  const placedDestinations: OfficeObject[] = [];
  const roomSlots: DepartmentIslandRoomSlot[] = [];
  for (const object of input.destinations) {
    const roomId = getOperatingRoomId(object);
    if (!roomId) continue;
    const slot = slotsByRoomId.get(roomId);
    if (!slot) continue;
    placedDestinations.push({
      ...object,
      position: [slot.position[0], object.position[1] ?? 0, slot.position[2]],
      rotation: [object.rotation?.[0] ?? 0, slot.rotationY, object.rotation?.[2] ?? 0],
      metadata: {
        ...(object.metadata ?? {}),
        departmentIslandId: slot.departmentId,
        destinationBayZone: false,
        destinationRoomZone: true,
        footprintWidth: ACTIVITY_DESTINATION_ROOM_WIDTH,
        footprintDepth: ACTIVITY_DESTINATION_ROOM_DEPTH,
        footprintClearance: 0,
      },
    });
    roomSlots.push(slot);
  }

  return {
    coreBounds: getArchipelagoBounds(islands, NEXUS_BOUNDS),
    outerBounds: getArchipelagoBounds(islands, NEXUS_BOUNDS),
    floorTiles,
    placedDestinations,
    roomSlots,
    islands,
    bridges,
    nexus: NEXUS_BOUNDS,
  };
}
