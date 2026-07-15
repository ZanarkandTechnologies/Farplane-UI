/**
 * ACTIVITY DESTINATION RAILS
 * ==========================
 * Plans uniform north/west/east room rails around already placed required objects.
 *
 * Inputs are required object footprints, their reserved walk tiles, and ordered activity
 * destinations. Outputs are one smooth rectangular floor with exact 5x5 room zones
 * on three sides. The camera-facing south side has no room rail. Side effects: none.
 */

import { getObjectFootprintCells } from "../systems/occupancy-system";
import {
  ACTIVITY_DESTINATION_ROOM_DEPTH,
  ACTIVITY_DESTINATION_ROOM_WIDTH,
} from "./activity-destination-room";
import { officeLayoutTileKey, parseOfficeLayoutTileKey } from "./office-layout";
import type { OfficeObject } from "./types";

export interface ActivityDestinationRailBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  width: number;
  depth: number;
}

export type ActivityDestinationRailEdge = "north" | "east" | "west";

export interface ActivityDestinationRailSlot {
  edge: ActivityDestinationRailEdge;
  position: [number, number, number];
  rotationY: number;
  accessTile: { x: number; z: number };
  tileKeys: string[];
}

export interface ActivityDestinationRailPlan {
  coreBounds: ActivityDestinationRailBounds;
  outerBounds: ActivityDestinationRailBounds;
  floorTiles: Set<string>;
  placedDestinations: OfficeObject[];
  roomSlots: ActivityDestinationRailSlot[];
}

function createBounds(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): ActivityDestinationRailBounds {
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    width: maxX - minX + 1,
    depth: maxZ - minZ + 1,
  };
}

function getSeedBounds(input: {
  requiredObjects: OfficeObject[];
  reservedWalkTiles: Set<string>;
  paddingTiles: number;
}): ActivityDestinationRailBounds {
  const requiredPoints = input.requiredObjects.flatMap((object) =>
    object.meshType === "wall-art"
      ? []
      : getObjectFootprintCells(object).flatMap((cell) => [
          { x: cell.x - input.paddingTiles, z: cell.z - input.paddingTiles },
          { x: cell.x + input.paddingTiles, z: cell.z + input.paddingTiles },
        ]),
  );
  const reservedPoints = [...input.reservedWalkTiles].flatMap((key) => {
    const tile = parseOfficeLayoutTileKey(key);
    return tile ? [{ x: tile.x, z: tile.z }] : [];
  });
  // Required walk tiles already include their corridor radius. Padding them a
  // second time grows a mostly empty core by a full module at threshold edges.
  const points = [...requiredPoints, ...reservedPoints];
  if (points.length === 0) return createBounds(0, 0, 0, 0);
  return createBounds(
    Math.min(...points.map((point) => point.x)),
    Math.max(...points.map((point) => point.x)),
    Math.min(...points.map((point) => point.z)),
    Math.max(...points.map((point) => point.z)),
  );
}

function getRoomSlotCapacity(coreColumns: number, coreRows: number): number {
  return coreColumns + coreRows * 2;
}

function getBalancedRailCounts(roomCount: number): {
  north: number;
  east: number;
  west: number;
} {
  const north = Math.ceil(roomCount / 3);
  const remaining = roomCount - north;
  const east = Math.ceil(remaining / 2);
  return { north, east, west: remaining - east };
}

function growCoreModules(input: {
  minimumColumns: number;
  minimumRows: number;
  requiredRoomSlots: number;
  minimumCoreTileArea: number;
  targetAspect: number;
}): { columns: number; rows: number } {
  let columns = Math.max(1, input.minimumColumns);
  let rows = Math.max(1, input.minimumRows);
  while (
    getRoomSlotCapacity(columns, rows) < input.requiredRoomSlots ||
    columns * rows * ACTIVITY_DESTINATION_ROOM_WIDTH * ACTIVITY_DESTINATION_ROOM_DEPTH <
      input.minimumCoreTileArea
  ) {
    const addColumnAspect = (columns + 1) / rows;
    const addRowAspect = columns / (rows + 1);
    const columnError = Math.abs(Math.log(addColumnAspect / input.targetAspect));
    const rowError = Math.abs(Math.log(addRowAspect / input.targetAspect));
    if (columnError <= rowError) columns += 1;
    else rows += 1;
  }
  return { columns, rows };
}

function getModuleTileKeys(centerX: number, centerZ: number): string[] {
  const minX = Math.ceil(centerX - ACTIVITY_DESTINATION_ROOM_WIDTH / 2);
  const minZ = Math.ceil(centerZ - ACTIVITY_DESTINATION_ROOM_DEPTH / 2);
  const keys: string[] = [];
  for (let x = minX; x < minX + ACTIVITY_DESTINATION_ROOM_WIDTH; x += 1) {
    for (let z = minZ; z < minZ + ACTIVITY_DESTINATION_ROOM_DEPTH; z += 1) {
      keys.push(officeLayoutTileKey(x, z));
    }
  }
  return keys;
}

function createSlot(input: {
  edge: ActivityDestinationRailEdge;
  x: number;
  z: number;
  y: number;
  rotationY: number;
  accessTile: { x: number; z: number };
}): ActivityDestinationRailSlot {
  return {
    edge: input.edge,
    position: [input.x, input.y, input.z],
    rotationY: input.rotationY,
    accessTile: input.accessTile,
    tileKeys: getModuleTileKeys(input.x, input.z),
  };
}

function getThreeSidedSlots(input: {
  coreBounds: ActivityDestinationRailBounds;
  coreColumns: number;
  coreRows: number;
  y: number;
}): ActivityDestinationRailSlot[] {
  const { coreBounds, coreColumns, coreRows, y } = input;
  const northZ = coreBounds.minZ - (ACTIVITY_DESTINATION_ROOM_DEPTH + 1) / 2;
  const westX = coreBounds.minX - (ACTIVITY_DESTINATION_ROOM_WIDTH + 1) / 2;
  const eastX = coreBounds.maxX + (ACTIVITY_DESTINATION_ROOM_WIDTH + 1) / 2;
  const northSlots: ActivityDestinationRailSlot[] = [];
  const eastSlots: ActivityDestinationRailSlot[] = [];
  const westSlots: ActivityDestinationRailSlot[] = [];

  for (let column = 0; column < coreColumns; column += 1) {
    const x =
      coreBounds.minX +
      (ACTIVITY_DESTINATION_ROOM_WIDTH - 1) / 2 +
      column * ACTIVITY_DESTINATION_ROOM_WIDTH;
    northSlots.push(
      createSlot({
        edge: "north",
        x,
        z: northZ,
        y,
        rotationY: 0,
        accessTile: { x: Math.round(x), z: coreBounds.minZ },
      }),
    );
  }
  for (let row = 0; row < coreRows; row += 1) {
    const z =
      coreBounds.minZ +
      (ACTIVITY_DESTINATION_ROOM_DEPTH - 1) / 2 +
      row * ACTIVITY_DESTINATION_ROOM_DEPTH;
    eastSlots.push(
      createSlot({
        edge: "east",
        x: eastX,
        z,
        y,
        rotationY: Math.PI / 2,
        accessTile: { x: coreBounds.maxX, z: Math.round(z) },
      }),
    );
  }
  for (let row = 0; row < coreRows; row += 1) {
    const z =
      coreBounds.minZ +
      (ACTIVITY_DESTINATION_ROOM_DEPTH - 1) / 2 +
      row * ACTIVITY_DESTINATION_ROOM_DEPTH;
    westSlots.push(
      createSlot({
        edge: "west",
        x: westX,
        z,
        y,
        rotationY: -Math.PI / 2,
        accessTile: { x: coreBounds.minX, z: Math.round(z) },
      }),
    );
  }
  return [...northSlots, ...eastSlots, ...westSlots];
}

function selectBalancedRailSlots(
  slots: ActivityDestinationRailSlot[],
  roomCount: number,
): ActivityDestinationRailSlot[] {
  const north = slots.filter((slot) => slot.edge === "north");
  const east = slots.filter((slot) => slot.edge === "east");
  const west = slots.filter((slot) => slot.edge === "west");
  const counts = getBalancedRailCounts(roomCount);
  if (counts.north > north.length || counts.east > east.length || counts.west > west.length) {
    throw new Error("Activity destination rail capacity invariant failed");
  }
  // Side rails grow from the back toward the open camera-facing entrance.
  return [
    ...north.slice(0, counts.north),
    ...east.slice(0, counts.east),
    ...west.slice(0, counts.west),
  ];
}

function addRectangleTiles(bounds: ActivityDestinationRailBounds, output: Set<string>): void {
  for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
    for (let z = bounds.minZ; z <= bounds.maxZ; z += 1) {
      output.add(officeLayoutTileKey(x, z));
    }
  }
}

export function planActivityDestinationRails(input: {
  requiredObjects: OfficeObject[];
  reservedWalkTiles: Set<string>;
  destinations: OfficeObject[];
  paddingTiles: number;
  minimumCoreTileArea?: number;
}): ActivityDestinationRailPlan | null {
  if (input.destinations.length === 0) return null;
  const seedBounds = getSeedBounds(input);
  const railCounts = getBalancedRailCounts(input.destinations.length);
  const minimumColumns = Math.max(
    Math.ceil(seedBounds.width / ACTIVITY_DESTINATION_ROOM_WIDTH),
    railCounts.north,
  );
  const minimumRows = Math.max(
    Math.ceil(seedBounds.depth / ACTIVITY_DESTINATION_ROOM_DEPTH),
    railCounts.east,
    railCounts.west,
  );
  const targetAspect = Math.max(
    0.25,
    Math.min(4, seedBounds.width / Math.max(1, seedBounds.depth)),
  );
  const modules = growCoreModules({
    minimumColumns,
    minimumRows,
    requiredRoomSlots: input.destinations.length,
    minimumCoreTileArea: input.minimumCoreTileArea ?? 0,
    targetAspect,
  });
  const coreWidth = modules.columns * ACTIVITY_DESTINATION_ROOM_WIDTH;
  const coreDepth = modules.rows * ACTIVITY_DESTINATION_ROOM_DEPTH;
  const seedCenterX = (seedBounds.minX + seedBounds.maxX) / 2;
  const seedCenterZ = (seedBounds.minZ + seedBounds.maxZ) / 2;
  const coreMinX = Math.round(seedCenterX - (coreWidth - 1) / 2);
  const coreMinZ = Math.round(seedCenterZ - (coreDepth - 1) / 2);
  const coreBounds = createBounds(
    coreMinX,
    coreMinX + coreWidth - 1,
    coreMinZ,
    coreMinZ + coreDepth - 1,
  );
  const outerBounds = createBounds(
    coreBounds.minX - ACTIVITY_DESTINATION_ROOM_WIDTH,
    coreBounds.maxX + ACTIVITY_DESTINATION_ROOM_WIDTH,
    coreBounds.minZ - ACTIVITY_DESTINATION_ROOM_DEPTH,
    coreBounds.maxZ,
  );
  const floorTiles = new Set<string>();
  addRectangleTiles(outerBounds, floorTiles);
  const allSlots = getThreeSidedSlots({
    coreBounds,
    coreColumns: modules.columns,
    coreRows: modules.rows,
    y: input.destinations[0]?.position[1] ?? 0,
  });
  const roomSlots = selectBalancedRailSlots(allSlots, input.destinations.length);
  const placedDestinations = input.destinations.map((object, index) => {
    const slot = roomSlots[index];
    if (!slot) throw new Error("Activity destination rail capacity invariant failed");
    return {
      ...object,
      position: slot.position,
      rotation: [object.rotation?.[0] ?? 0, slot.rotationY, object.rotation?.[2] ?? 0] as [
        number,
        number,
        number,
      ],
      metadata: {
        ...(object.metadata ?? {}),
        footprintWidth: ACTIVITY_DESTINATION_ROOM_WIDTH,
        footprintDepth: ACTIVITY_DESTINATION_ROOM_DEPTH,
        footprintClearance: 0,
        destinationRoomZone: true,
      },
    };
  });

  return {
    coreBounds,
    outerBounds,
    floorTiles,
    placedDestinations,
    roomSlots,
  };
}
