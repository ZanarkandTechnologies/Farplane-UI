/**
 * DEPARTMENT ISLAND LAYOUT
 * ========================
 * Owns deterministic automatic hosted-room placement as a small isometric
 * archipelago. Inputs are the existing room objects and required office
 * furniture; outputs are the same tile-backed navigation layout, placed rooms,
 * and presentation geometry used by the scene. It never persists a second
 * layout or collision model.
 */

import { getObjectFootprintCells } from "../systems/occupancy-system";
import {
  ACTIVITY_DESTINATION_ROOM_DEPTH,
  ACTIVITY_DESTINATION_ROOM_WIDTH,
} from "./activity-destination-room";
import { officeLayoutTileKey } from "./office-layout";
import { getOperatingRoomId, type OperatingRoomId } from "./operating-room-catalog";
import type { OfficeObject } from "./types";

export const DEPARTMENT_ISLAND_IDS = [
  "back-office",
  "sales",
  "deals",
  "marketing",
  "operations",
  "intelligence",
  "customer",
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
  /** A semantic workflow entry point when the department has no owned room yet. */
  entryLabel?: string;
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
    id: "back-office",
    label: "Back Office",
    center: [-16, -12],
    width: 13,
    depth: 9,
    accentColor: "#a8ad76",
    roomIds: ["organization", "finance"],
  },
  {
    id: "sales",
    label: "Sales",
    center: [0, -17],
    width: 13,
    depth: 9,
    accentColor: "#bf8aa8",
    roomIds: [],
    entryLabel: "Lead & Outreach",
  },
  {
    id: "deals",
    label: "Deals",
    center: [17, -12],
    width: 13,
    depth: 9,
    accentColor: "#c9826b",
    roomIds: [],
    entryLabel: "Solution & Pricing",
  },
  {
    id: "marketing",
    label: "Marketing",
    center: [18, 3],
    width: 13,
    depth: 7,
    accentColor: "#c8ad72",
    roomIds: ["production"],
  },
  {
    id: "operations",
    label: "Operations",
    center: [12, 16],
    width: 19,
    depth: 15,
    accentColor: "#9b8bc5",
    roomIds: ["self-improvement", "qa", "harness", "skills", "telemetry"],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    center: [-10, 16],
    width: 15,
    depth: 11,
    accentColor: "#7fa9c0",
    roomIds: ["research", "thread-data"],
  },
  {
    id: "customer",
    label: "Customer",
    center: [-18, 3],
    width: 11,
    depth: 9,
    accentColor: "#79b8a2",
    roomIds: ["comms"],
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
  const roomCount = definition.roomIds.length;
  if (roomCount === 0) return [];
  const columns = roomCount <= 2 ? roomCount : Math.min(3, Math.ceil(Math.sqrt(roomCount)));
  const rows = Math.ceil(roomCount / columns);
  const xSpacing = columns === 1 ? 0 : Math.min(5, (definition.width - 6) / (columns - 1));
  const zSpacing = rows === 1 ? 0 : Math.min(6, (definition.depth - 6) / (rows - 1));
  const positions = Array.from({ length: roomCount }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      position: [
        centerX + (column - (columns - 1) / 2) * xSpacing,
        0,
        centerZ + (row - (rows - 1) / 2) * zSpacing,
      ] as [number, number, number],
      rotationY: row === rows - 1 && rows > 1 ? Math.PI : 0,
    };
  });

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

/**
 * The camera-facing bounds of the fixed seven-district office. This is derived
 * from the same islands as the floor and never from persisted object positions,
 * so automatic rooms cannot shift the visual centre away from the World Nexus.
 */
export function getDepartmentArchipelagoPresentationBounds(): DepartmentIslandBounds {
  return getArchipelagoBounds(getDepartmentIslandGeometry(), NEXUS_BOUNDS);
}

export function getDepartmentArchipelagoLayoutCenter(): {
  x: number;
  z: number;
  width: number;
  depth: number;
} {
  const presentationBounds = getDepartmentArchipelagoPresentationBounds();
  return {
    x: (presentationBounds.minX + presentationBounds.maxX) / 2,
    z: (presentationBounds.minZ + presentationBounds.maxZ) / 2,
    width: presentationBounds.width,
    depth: presentationBounds.depth,
  };
}

export function getDepartmentIslandBridgePlan(): DepartmentIslandBridge[] {
  return [
    { id: "back-office", minX: -10, maxX: -7, minZ: -8, maxZ: -5 },
    { id: "sales", minX: -1, maxX: 1, minZ: -13, maxZ: -6 },
    { id: "deals", minX: 7, maxX: 11, minZ: -8, maxZ: -5 },
    { id: "marketing", minX: 7, maxX: 12, minZ: 0, maxZ: 2 },
    { id: "operations", minX: 4, maxX: 6, minZ: 6, maxZ: 9 },
    { id: "intelligence", minX: -4, maxX: -2, minZ: 6, maxZ: 11 },
    { id: "customer", minX: -13, maxX: -7, minZ: 0, maxZ: 2 },
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
  const definition = DEPARTMENT_ISLAND_DEFINITIONS.find(
    (candidate) => candidate.id === departmentId,
  );
  if (!definition) throw new Error(`No department configured for bridge ${departmentId}`);
  const [centerX, centerZ] = definition.center;
  const bridgeCenterX = (bridge.minX + bridge.maxX) / 2;
  const bridgeCenterZ = (bridge.minZ + bridge.maxZ) / 2;
  const horizontal = Math.abs(centerX - bridgeCenterX) > Math.abs(centerZ - bridgeCenterZ);
  return {
    x: horizontal
      ? centerX < bridgeCenterX
        ? bridge.minX
        : bridge.maxX
      : Math.round(bridgeCenterX),
    z: horizontal ? Math.round(bridgeCenterZ) : centerZ < bridgeCenterZ ? bridge.minZ : bridge.maxZ,
  };
}

const TEAM_DECKS: readonly DepartmentIslandTeamDeck[] = [
  { departmentId: "back-office", position: [-20, 0, -12] },
  { departmentId: "sales", position: [0, 0, -20] },
  { departmentId: "deals", position: [20, 0, -12] },
  { departmentId: "marketing", position: [21, 0, 3] },
  { departmentId: "operations", position: [17, 0, 18] },
  { departmentId: "intelligence", position: [-10, 0, 18] },
  { departmentId: "customer", position: [-20, 0, 3] },
] as const;

/** Stable automatic project-table decks; overflow wraps by capacity without persistence. */
export function getDepartmentIslandTeamDeck(index: number): DepartmentIslandTeamDeck {
  const safeIndex = Math.max(0, Math.floor(index));
  const fallback = TEAM_DECKS[0];
  if (!fallback) throw new Error("Department islands require at least one project-table deck");
  return TEAM_DECKS[safeIndex % TEAM_DECKS.length] ?? fallback;
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
