/**
 * OFFICE LAYOUT SOLVER
 * ====================
 * Owns deterministic auto-layout solving for generated office layouts.
 *
 * Inputs are semantic strategy output plus office objects. Outputs are a
 * compact tile layout, placed optional objects, reserved walk cells, and a
 * quality report. Walk cells are reserved occupancy: furniture cannot claim
 * them, but agents may traverse them.
 */

import {
  fillEnclosedOfficeLayoutGaps,
  getOfficeLayoutBounds,
  getOfficeLayoutTileSet,
  officeLayoutTileKey,
  parseOfficeLayoutTileKey,
  type OfficeLayoutModel,
} from "@/modules/office/lib/office-layout";
import {
  evaluateOfficeLayoutQuality,
  evaluateOfficePoiGraph,
  type OfficeLayoutQuality,
  type OfficePoiGraphReport,
} from "@/modules/office/lib/office-layout-quality";
import type { OfficeObject } from "@/modules/office/lib/types";
import { getObjectFootprintCells } from "@/modules/office/systems/occupancy-system";
import {
  canReserveOfficeObject,
  createOfficePlacementReservation,
  getOfficeLayoutCandidatePositions,
  type OfficePlacementObject,
} from "@/modules/office/systems/placement-engine";

export interface OfficeLayoutSolverInput {
  sourceLayout: OfficeLayoutModel;
  requiredObjects: OfficeObject[];
  optionalObjects: OfficeObject[];
  strategyId?: string;
  paddingTiles?: number;
  corridorRadiusTiles?: number;
  targetEmptyPercent?: number;
  objectGapTiles?: number;
}

export type OfficeLayoutSolverStageName =
  | "render_strategy_graph"
  | "reserve_shortest_walk_paths"
  | "pack_optional_objects"
  | "prune_empty_edges";

export interface OfficeLayoutSolverStageDebug {
  name: OfficeLayoutSolverStageName;
  inputTileCount: number;
  outputTileCount: number;
  objectCount?: number;
  routeTileCount?: number;
  placedObjectCount?: number;
  insidePlacedObjectCount?: number;
  overflowPlacedObjectCount?: number;
  unplacedObjectCount?: number;
  expansionTileCount?: number;
  prunedTileCount?: number;
}

export interface OfficeLayoutSolution {
  officeLayout: OfficeLayoutModel;
  placedOptionalObjects: OfficeObject[];
  reservedWalkTiles: string[];
  quality: OfficeLayoutQuality;
  poiGraph: OfficePoiGraphReport;
  debug: {
    sourceTileCount: number;
    finalTileCount: number;
    optionalObjectCount: number;
    placedOptionalObjectCount: number;
    overflowPlacedObjectCount: number;
    unplacedOptionalObjectCount: number;
    prunedTileCount: number;
    objectGapTiles: number;
    stages: OfficeLayoutSolverStageDebug[];
  };
}

interface TilePoint {
  x: number;
  z: number;
}

interface ConnectivityEdge {
  from: number;
  to: number;
  distance: number;
}

const DEFAULT_PADDING_TILES = 1;
const DEFAULT_CORRIDOR_RADIUS_TILES = 1;
const DEFAULT_TARGET_EMPTY_PERCENT = 0.3;
const DEFAULT_OBJECT_GAP_TILES = 1;
const DEFAULT_OVERFLOW_SEARCH_RADIUS_TILES = 14;
const DEFAULT_OVERFLOW_CANDIDATE_LIMIT = 900;
const CONNECTIVITY_LOOP_EDGE_RATIO = 0.2;

function normalizeTileRadius(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(12, Math.round(value ?? fallback)));
}

function normalizeTargetEmptyPercent(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_TARGET_EMPTY_PERCENT;
  return Math.max(0, Math.min(1, value ?? DEFAULT_TARGET_EMPTY_PERCENT));
}

function sortLayoutTiles(tiles: Iterable<string>): string[] {
  return [...tiles].sort((left, right) => {
    const leftParsed = parseOfficeLayoutTileKey(left);
    const rightParsed = parseOfficeLayoutTileKey(right);
    if (!leftParsed || !rightParsed) return left.localeCompare(right);
    return leftParsed.z === rightParsed.z
      ? leftParsed.x - rightParsed.x
      : leftParsed.z - rightParsed.z;
  });
}

function createTileMaskLayout(tileSet: Set<string>): OfficeLayoutModel {
  return {
    version: 1,
    tileSize: 1,
    tiles: sortLayoutTiles(tileSet),
  };
}

function neighborsOf(point: TilePoint): TilePoint[] {
  return [
    { x: point.x + 1, z: point.z },
    { x: point.x - 1, z: point.z },
    { x: point.x, z: point.z + 1 },
    { x: point.x, z: point.z - 1 },
  ];
}

function bfsWalkableComponent(
  start: TilePoint,
  walkableTiles: Set<string>,
): Set<string> {
  const startKey = officeLayoutTileKey(start.x, start.z);
  const visited = new Set<string>([startKey]);
  const queue = [start];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const neighbor of neighborsOf(current)) {
      const key = officeLayoutTileKey(neighbor.x, neighbor.z);
      if (!walkableTiles.has(key) || visited.has(key)) continue;
      visited.add(key);
      queue.push(neighbor);
    }
  }
  return visited;
}

function findLargestWalkableComponent(walkableTiles: Set<string>): Set<string> {
  const remaining = new Set(walkableTiles);
  let largest = new Set<string>();
  while (remaining.size > 0) {
    const firstKey = remaining.values().next().value as string | undefined;
    if (!firstKey) break;
    const parsed = parseOfficeLayoutTileKey(firstKey);
    if (!parsed) {
      remaining.delete(firstKey);
      continue;
    }
    const component = bfsWalkableComponent(parsed, walkableTiles);
    for (const tile of component) remaining.delete(tile);
    if (component.size > largest.size) largest = component;
  }
  return largest;
}

function addPaddedTile(
  tileSet: Set<string>,
  x: number,
  z: number,
  radius: number,
): void {
  for (let dx = -radius; dx <= radius; dx += 1) {
    for (let dz = -radius; dz <= radius; dz += 1) {
      tileSet.add(officeLayoutTileKey(x + dx, z + dz));
    }
  }
}

function getObjectAccessTile(object: OfficeObject): TilePoint | null {
  const cells = getObjectFootprintCells(object);
  if (cells.length === 0) return null;
  const occupied = new Set(cells.map((cell) => cell.key));
  const minX = Math.min(...cells.map((cell) => cell.x));
  const maxX = Math.max(...cells.map((cell) => cell.x));
  const minZ = Math.min(...cells.map((cell) => cell.z));
  const maxZ = Math.max(...cells.map((cell) => cell.z));
  const centerX = Math.round(object.position[0]);
  const centerZ = Math.round(object.position[2]);
  const candidates = [
    { x: maxX + 1, z: centerZ },
    { x: minX - 1, z: centerZ },
    { x: centerX, z: maxZ + 1 },
    { x: centerX, z: minZ - 1 },
  ];
  return (
    candidates.find(
      (candidate) =>
        !occupied.has(officeLayoutTileKey(candidate.x, candidate.z)),
    ) ?? null
  );
}

function getConnectivityEdges(centers: TilePoint[]): ConnectivityEdge[] {
  const edges: ConnectivityEdge[] = [];
  for (let from = 0; from < centers.length; from += 1) {
    for (let to = from + 1; to < centers.length; to += 1) {
      const left = centers[from];
      const right = centers[to];
      edges.push({
        from,
        to,
        distance: Math.abs(left.x - right.x) + Math.abs(left.z - right.z),
      });
    }
  }
  return edges.sort((left, right) => left.distance - right.distance);
}

function findConnectivityParent(parents: number[], index: number): number {
  let current = index;
  while (parents[current] !== current) {
    parents[current] = parents[parents[current]];
    current = parents[current];
  }
  return current;
}

function buildConnectivityGraphEdges(centers: TilePoint[]): ConnectivityEdge[] {
  if (centers.length <= 1) return [];
  const allEdges = getConnectivityEdges(centers);
  const parents = centers.map((_, index) => index);
  const mstEdges: ConnectivityEdge[] = [];
  const mstEdgeKeys = new Set<string>();

  for (const edge of allEdges) {
    const leftRoot = findConnectivityParent(parents, edge.from);
    const rightRoot = findConnectivityParent(parents, edge.to);
    if (leftRoot === rightRoot) continue;
    parents[rightRoot] = leftRoot;
    mstEdges.push(edge);
    mstEdgeKeys.add(`${edge.from}:${edge.to}`);
    if (mstEdges.length === centers.length - 1) break;
  }

  const loopBudget = Math.ceil(mstEdges.length * CONNECTIVITY_LOOP_EDGE_RATIO);
  const loopEdges = allEdges
    .filter((edge) => !mstEdgeKeys.has(`${edge.from}:${edge.to}`))
    .slice(0, loopBudget);
  return [...mstEdges, ...loopEdges];
}

function addReservedCorridor(input: {
  floorTiles: Set<string>;
  reservedWalkTiles: Set<string>;
  occupiedTiles: Set<string>;
  from: TilePoint;
  to: TilePoint;
  radius: number;
}): void {
  const seedLayout = createTileMaskLayout(input.floorTiles);
  const bounds = getOfficeLayoutBounds(seedLayout);
  const minX = Math.min(bounds.minTileX, input.from.x, input.to.x) - 3;
  const maxX = Math.max(bounds.maxTileX, input.from.x, input.to.x) + 3;
  const minZ = Math.min(bounds.minTileZ, input.from.z, input.to.z) - 3;
  const maxZ = Math.max(bounds.maxTileZ, input.from.z, input.to.z) + 3;
  const startKey = officeLayoutTileKey(input.from.x, input.from.z);
  const targetKey = officeLayoutTileKey(input.to.x, input.to.z);
  const visited = new Set<string>([startKey]);
  const previous = new Map<string, string | null>([[startKey, null]]);
  const queue = [input.from];

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (officeLayoutTileKey(current.x, current.z) === targetKey) break;
    const neighbors = [
      { x: current.x + 1, z: current.z },
      { x: current.x - 1, z: current.z },
      { x: current.x, z: current.z + 1 },
      { x: current.x, z: current.z - 1 },
    ].sort((left, right) => {
      const leftDistance =
        Math.abs(left.x - input.to.x) + Math.abs(left.z - input.to.z);
      const rightDistance =
        Math.abs(right.x - input.to.x) + Math.abs(right.z - input.to.z);
      return leftDistance - rightDistance;
    });
    for (const neighbor of neighbors) {
      if (
        neighbor.x < minX ||
        neighbor.x > maxX ||
        neighbor.z < minZ ||
        neighbor.z > maxZ
      ) {
        continue;
      }
      const key = officeLayoutTileKey(neighbor.x, neighbor.z);
      if (visited.has(key)) continue;
      if (input.occupiedTiles.has(key) && key !== targetKey) continue;
      visited.add(key);
      previous.set(key, officeLayoutTileKey(current.x, current.z));
      queue.push(neighbor);
    }
  }

  if (!previous.has(targetKey)) {
    const stepX = input.from.x <= input.to.x ? 1 : -1;
    for (let x = input.from.x; x !== input.to.x + stepX; x += stepX) {
      addPaddedTile(input.reservedWalkTiles, x, input.from.z, input.radius);
      addPaddedTile(input.floorTiles, x, input.from.z, input.radius);
    }
    const stepZ = input.from.z <= input.to.z ? 1 : -1;
    for (let z = input.from.z; z !== input.to.z + stepZ; z += stepZ) {
      addPaddedTile(input.reservedWalkTiles, input.to.x, z, input.radius);
      addPaddedTile(input.floorTiles, input.to.x, z, input.radius);
    }
    return;
  }

  let currentKey: string | null = targetKey;
  while (currentKey) {
    const parsed = parseOfficeLayoutTileKey(currentKey);
    if (parsed) {
      addPaddedTile(
        input.reservedWalkTiles,
        parsed.x,
        parsed.z,
        input.radius,
      );
      addPaddedTile(input.floorTiles, parsed.x, parsed.z, input.radius);
    }
    currentKey = previous.get(currentKey) ?? null;
  }
}

function addDirectReservedCorridor(input: {
  floorTiles: Set<string>;
  reservedWalkTiles: Set<string>;
  from: TilePoint;
  to: TilePoint;
  radius: number;
}): void {
  const stepX = input.from.x <= input.to.x ? 1 : -1;
  for (let x = input.from.x; x !== input.to.x + stepX; x += stepX) {
    addPaddedTile(input.reservedWalkTiles, x, input.from.z, input.radius);
    addPaddedTile(input.floorTiles, x, input.from.z, input.radius);
  }
  const stepZ = input.from.z <= input.to.z ? 1 : -1;
  for (let z = input.from.z; z !== input.to.z + stepZ; z += stepZ) {
    addPaddedTile(input.reservedWalkTiles, input.to.x, z, input.radius);
    addPaddedTile(input.floorTiles, input.to.x, z, input.radius);
  }
}

function buildReservedWalkTiles(input: {
  floorTiles: Set<string>;
  objects: OfficeObject[];
  radius: number;
}): Set<string> {
  const reservedWalkTiles = new Set<string>();
  const occupiedTiles = new Set<string>();
  const centers: TilePoint[] = [];

  for (const object of input.objects) {
    if (object.meshType === "wall-art") continue;
    for (const cell of getObjectFootprintCells(object)) {
      occupiedTiles.add(cell.key);
      addPaddedTile(input.floorTiles, cell.x, cell.z, DEFAULT_PADDING_TILES);
    }
    const accessTile = getObjectAccessTile(object);
    if (!accessTile) continue;
    centers.push(accessTile);
    addPaddedTile(
      reservedWalkTiles,
      accessTile.x,
      accessTile.z,
      input.radius,
    );
    addPaddedTile(input.floorTiles, accessTile.x, accessTile.z, input.radius);
  }

  for (const edge of buildConnectivityGraphEdges(centers)) {
    const from = centers[edge.from];
    const to = centers[edge.to];
    if (!from || !to) continue;
    addReservedCorridor({
      floorTiles: input.floorTiles,
      reservedWalkTiles,
      occupiedTiles,
      from,
      to,
      radius: input.radius,
    });
  }

  for (const tile of occupiedTiles) reservedWalkTiles.delete(tile);

  return reservedWalkTiles;
}

function toReservedWalkBlockers(
  reservedWalkTiles: Iterable<string>,
): OfficePlacementObject[] {
  return [...reservedWalkTiles].flatMap((tile) => {
    const parsed = parseOfficeLayoutTileKey(tile);
    if (!parsed) return [];
    return [
      {
        meshType: "custom-mesh",
        position: [parsed.x, 0, parsed.z],
        rotation: [0, 0, 0],
        metadata: {
          footprintWidth: 1,
          footprintDepth: 1,
          footprintClearance: 0,
          reservedWalkPath: true,
        },
      },
    ];
  });
}

interface OrderedOptionalPlacementObject {
  object: OfficeObject;
  sourceIndex: number;
  placementObject: OfficePlacementObject;
  footprintCellCount: number;
}

interface OptionalObjectPlacementResult {
  placedOptionalObjects: OfficeObject[];
  layout: OfficeLayoutModel;
  reservedWalkTiles: Set<string>;
  insidePlacedObjectCount: number;
  overflowPlacedObjectCount: number;
  unplacedObjectCount: number;
  expansionTileCount: number;
}

function getOrderedOptionalObjects(
  optionalObjects: OfficeObject[],
  objectGapTiles: number,
): OrderedOptionalPlacementObject[] {
  return optionalObjects
    .map((object, sourceIndex) => {
      const placementObject = withMinimumPlacementGap(
        toPlacementObject(object),
        objectGapTiles,
      );
      return {
        object,
        sourceIndex,
        placementObject,
        footprintCellCount: getObjectFootprintCells(placementObject).length,
      };
    })
    .sort((left, right) =>
      right.footprintCellCount === left.footprintCellCount
        ? left.sourceIndex - right.sourceIndex
        : right.footprintCellCount - left.footprintCellCount,
    );
}

function placeOptionalObjects(input: {
  layout: OfficeLayoutModel;
  requiredObjects: OfficeObject[];
  optionalObjects: OfficeObject[];
  reservedWalkTiles: Set<string>;
  objectGapTiles: number;
  paddingTiles: number;
  corridorRadiusTiles: number;
}): OptionalObjectPlacementResult {
  let workingLayout = input.layout;
  let workingFloorTiles = getOfficeLayoutTileSet(input.layout);
  let workingReservedWalkTiles = new Set(input.reservedWalkTiles);
  const reservation = createOfficePlacementReservation([
    ...input.requiredObjects.map((object) =>
      withMinimumPlacementGap(toPlacementObject(object), input.objectGapTiles),
    ),
    ...toReservedWalkBlockers(input.reservedWalkTiles),
  ]);
  const reservedWalkBlockerKeys = new Set(input.reservedWalkTiles);
  const centroid = getRequiredObjectCentroid(input.requiredObjects, input.layout);
  const orderedObjects = getOrderedOptionalObjects(
    input.optionalObjects,
    input.objectGapTiles,
  );
  const placedOptionalObjects: OfficeObject[] = [];
  const overflowCandidates: OrderedOptionalPlacementObject[] = [];
  let insidePlacedObjectCount = 0;
  let overflowPlacedObjectCount = 0;
  let expansionTileCount = 0;

  for (const orderedObject of orderedObjects) {
    const { object, placementObject } = orderedObject;
    const position = findBestOptionalObjectPosition({
      layout: workingLayout,
      reservation,
      object: placementObject,
      centroid,
    });
    if (!position) {
      overflowCandidates.push(orderedObject);
      continue;
    }
    const reservedObject = { ...placementObject, position };
    reservation.objects.push(reservedObject);
    placedOptionalObjects.push({ ...object, position, metadata: reservedObject.metadata });
    insidePlacedObjectCount += 1;
  }

  for (const { object, placementObject } of overflowCandidates) {
    const result = findBestOverflowObjectPosition({
      layout: workingLayout,
      floorTiles: workingFloorTiles,
      reservedWalkTiles: workingReservedWalkTiles,
      reservation,
      object: placementObject,
      centroid,
      paddingTiles: input.paddingTiles,
      corridorRadiusTiles: input.corridorRadiusTiles,
    });
    if (!result) continue;
    const reservedObject = { ...placementObject, position: result.position };
    reservation.objects.push(reservedObject);
    const newReservedWalkTiles = [...result.reservedWalkTiles].filter(
      (tile) => !reservedWalkBlockerKeys.has(tile),
    );
    for (const tile of newReservedWalkTiles) reservedWalkBlockerKeys.add(tile);
    reservation.objects.push(...toReservedWalkBlockers(newReservedWalkTiles));
    placedOptionalObjects.push({
      ...object,
      position: result.position,
      metadata: reservedObject.metadata,
    });
    workingFloorTiles = result.floorTiles;
    workingReservedWalkTiles = result.reservedWalkTiles;
    workingLayout = result.layout;
    expansionTileCount += result.newTileCount;
    overflowPlacedObjectCount += 1;
  }

  return {
    placedOptionalObjects,
    layout: workingLayout,
    reservedWalkTiles: workingReservedWalkTiles,
    insidePlacedObjectCount,
    overflowPlacedObjectCount,
    unplacedObjectCount:
      input.optionalObjects.length - insidePlacedObjectCount - overflowPlacedObjectCount,
    expansionTileCount,
  };
}

function toPlacementObject(object: OfficeObject): OfficePlacementObject {
  return {
    meshType: object.meshType,
    position: object.position,
    metadata: object.metadata,
    rotation: object.rotation,
  };
}

function getMetadataNumberValue(
  metadata: Record<string, unknown> | undefined,
  key: string,
): number | undefined {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function withMinimumPlacementGap(
  object: OfficePlacementObject,
  objectGapTiles: number,
): OfficePlacementObject {
  const minClearance = Math.max(0, objectGapTiles / 2);
  const currentClearance = getMetadataNumberValue(object.metadata, "footprintClearance") ?? 0;
  if (currentClearance >= minClearance) return object;
  return {
    ...object,
    metadata: {
      ...(object.metadata ?? {}),
      footprintClearance: minClearance,
    },
  };
}

function getRequiredObjectCentroid(
  requiredObjects: OfficeObject[],
  layout: OfficeLayoutModel,
): TilePoint {
  if (requiredObjects.length === 0) {
    const bounds = getOfficeLayoutBounds(layout);
    return { x: Math.round(bounds.centerX), z: Math.round(bounds.centerZ) };
  }
  const sum = requiredObjects.reduce(
    (result, object) => ({
      x: result.x + object.position[0],
      z: result.z + object.position[2],
    }),
    { x: 0, z: 0 },
  );
  return {
    x: Math.round(sum.x / requiredObjects.length),
    z: Math.round(sum.z / requiredObjects.length),
  };
}

function findBestOptionalObjectPosition(input: {
  layout: OfficeLayoutModel;
  reservation: ReturnType<typeof createOfficePlacementReservation>;
  object: OfficePlacementObject;
  centroid: TilePoint;
}): [number, number, number] | null {
  let best: { position: [number, number, number]; score: number } | null = null;

  for (const position of getOfficeLayoutCandidatePositions({
    layout: input.layout,
    y: input.object.position[1],
  })) {
    const candidate = { ...input.object, position };
    if (
      !canReserveOfficeObject({
        object: candidate,
        layout: input.layout,
        reservation: input.reservation,
      })
    ) {
      continue;
    }
    const centroidDistance =
      (position[0] - input.centroid.x) ** 2 + (position[2] - input.centroid.z) ** 2;
    const preferredDistance =
      (position[0] - input.object.position[0]) ** 2 +
      (position[2] - input.object.position[2]) ** 2;
    const score = centroidDistance * 10 + preferredDistance;
    if (!best || score < best.score) {
      best = { position, score };
    }
  }

  return best?.position ?? null;
}

function toSolverOfficeObject(
  object: OfficePlacementObject,
  id = "candidate-object",
): OfficeObject {
  return {
    _id: id,
    meshType: object.meshType,
    position: object.position,
    rotation: object.rotation,
    metadata: object.metadata,
  };
}

function getOverflowCandidatePositions(input: {
  layout: OfficeLayoutModel;
  y: number;
  radius: number;
}): Array<[number, number, number]> {
  const bounds = getOfficeLayoutBounds(input.layout);
  const candidates: Array<{
    position: [number, number, number];
    boundaryDistance: number;
  }> = [];
  for (
    let x = bounds.minTileX - input.radius;
    x <= bounds.maxTileX + input.radius;
    x += 1
  ) {
    for (
      let z = bounds.minTileZ - input.radius;
      z <= bounds.maxTileZ + input.radius;
      z += 1
    ) {
      const outsideX =
        x < bounds.minTileX ? bounds.minTileX - x : x > bounds.maxTileX ? x - bounds.maxTileX : 0;
      const outsideZ =
        z < bounds.minTileZ ? bounds.minTileZ - z : z > bounds.maxTileZ ? z - bounds.maxTileZ : 0;
      const boundaryDistance = Math.max(outsideX, outsideZ);
      candidates.push({
        position: [x, input.y, z],
        boundaryDistance,
      });
    }
  }
  return candidates
    .sort((left, right) =>
      left.boundaryDistance === right.boundaryDistance
        ? left.position[2] === right.position[2]
          ? left.position[0] - right.position[0]
          : left.position[2] - right.position[2]
        : left.boundaryDistance - right.boundaryDistance,
    )
    .map((candidate) => candidate.position);
}

function buildOccupiedTileSet(objects: OfficePlacementObject[]): Set<string> {
  const occupiedTiles = new Set<string>();
  for (const object of objects) {
    if (object.meshType === "wall-art" || object.metadata?.reservedWalkPath === true) {
      continue;
    }
    for (const cell of getObjectFootprintCells(object)) occupiedTiles.add(cell.key);
  }
  return occupiedTiles;
}

function findNearestFloorTile(
  point: TilePoint,
  floorTiles: Set<string>,
): { tile: TilePoint; distance: number } | null {
  for (
    let radius = 0;
    radius <= DEFAULT_OVERFLOW_SEARCH_RADIUS_TILES + 4;
    radius += 1
  ) {
    let bestAtRadius: { tile: TilePoint; distance: number } | null = null;
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        if (Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;
        const tile = { x: point.x + dx, z: point.z + dz };
        if (!floorTiles.has(officeLayoutTileKey(tile.x, tile.z))) continue;
        const distance = Math.abs(dx) + Math.abs(dz);
        if (!bestAtRadius || distance < bestAtRadius.distance) {
          bestAtRadius = { tile, distance };
        }
      }
    }
    if (bestAtRadius) return bestAtRadius;
  }
  return null;
}

function buildOverflowCandidateLayout(input: {
  floorTiles: Set<string>;
  reservedWalkTiles: Set<string>;
  reservation: ReturnType<typeof createOfficePlacementReservation>;
  object: OfficePlacementObject;
  paddingTiles: number;
  corridorRadiusTiles: number;
}): {
  layout: OfficeLayoutModel;
  floorTiles: Set<string>;
  reservedWalkTiles: Set<string>;
  newTileCount: number;
  attachDistance: number;
} | null {
  const candidateObject = toSolverOfficeObject(input.object);
  const accessTile = getObjectAccessTile(candidateObject);
  const attach = accessTile ? findNearestFloorTile(accessTile, input.floorTiles) : null;
  const floorTiles = new Set(input.floorTiles);
  const reservedWalkTiles = new Set(input.reservedWalkTiles);
  const beforeTileCount = floorTiles.size;

  addObjectFootprintTiles({
    floorTiles,
    objects: [candidateObject],
    paddingTiles: input.paddingTiles,
  });

  if (accessTile && attach) {
    reservedWalkTiles.add(officeLayoutTileKey(accessTile.x, accessTile.z));
    floorTiles.add(officeLayoutTileKey(accessTile.x, accessTile.z));
    const occupiedTiles = buildOccupiedTileSet([
      ...input.reservation.objects,
      input.object,
    ]);
    addDirectReservedCorridor({
      floorTiles,
      reservedWalkTiles,
      from: attach.tile,
      to: accessTile,
      radius: input.corridorRadiusTiles,
    });
    for (const tile of occupiedTiles) reservedWalkTiles.delete(tile);
  }

  return {
    layout: createTileMaskLayout(floorTiles),
    floorTiles,
    reservedWalkTiles,
    newTileCount: Math.max(0, floorTiles.size - beforeTileCount),
    attachDistance: attach?.distance ?? 0,
  };
}

function findBestOverflowObjectPosition(input: {
  layout: OfficeLayoutModel;
  floorTiles: Set<string>;
  reservedWalkTiles: Set<string>;
  reservation: ReturnType<typeof createOfficePlacementReservation>;
  object: OfficePlacementObject;
  centroid: TilePoint;
  paddingTiles: number;
  corridorRadiusTiles: number;
}): {
  position: [number, number, number];
  layout: OfficeLayoutModel;
  floorTiles: Set<string>;
  reservedWalkTiles: Set<string>;
  newTileCount: number;
} | null {
  let best:
    | {
        position: [number, number, number];
        layout: OfficeLayoutModel;
        floorTiles: Set<string>;
        reservedWalkTiles: Set<string>;
        newTileCount: number;
        score: number;
      }
    | null = null;
  let evaluatedCandidateCount = 0;

  for (const position of getOverflowCandidatePositions({
    layout: input.layout,
    y: input.object.position[1],
    radius: DEFAULT_OVERFLOW_SEARCH_RADIUS_TILES,
  })) {
    if (input.floorTiles.has(officeLayoutTileKey(position[0], position[2]))) {
      continue;
    }
    evaluatedCandidateCount += 1;
    if (evaluatedCandidateCount > DEFAULT_OVERFLOW_CANDIDATE_LIMIT) break;
    const candidate = { ...input.object, position };
    const expanded = buildOverflowCandidateLayout({
      floorTiles: input.floorTiles,
      reservedWalkTiles: input.reservedWalkTiles,
      reservation: input.reservation,
      object: candidate,
      paddingTiles: input.paddingTiles,
      corridorRadiusTiles: input.corridorRadiusTiles,
    });
    if (!expanded) continue;
    if (
      !canReserveOfficeObject({
        object: candidate,
        layout: expanded.layout,
        reservation: input.reservation,
      })
    ) {
      continue;
    }

    const centroidDistance =
      (position[0] - input.centroid.x) ** 2 + (position[2] - input.centroid.z) ** 2;
    const preferredDistance =
      (position[0] - input.object.position[0]) ** 2 +
      (position[2] - input.object.position[2]) ** 2;
    const score =
      expanded.newTileCount * 1_000 +
      expanded.attachDistance * 100 +
      centroidDistance * 5 +
      preferredDistance;
    if (!best || score < best.score) {
      best = {
        position,
        layout: expanded.layout,
        floorTiles: expanded.floorTiles,
        reservedWalkTiles: expanded.reservedWalkTiles,
        newTileCount: expanded.newTileCount,
        score,
      };
    }
  }

  return best
    ? {
        position: best.position,
        layout: best.layout,
        floorTiles: best.floorTiles,
        reservedWalkTiles: best.reservedWalkTiles,
        newTileCount: best.newTileCount,
      }
    : null;
}

function addObjectFootprintTiles(input: {
  floorTiles: Set<string>;
  objects: OfficeObject[];
  paddingTiles: number;
}): void {
  for (const object of input.objects) {
    if (object.meshType === "wall-art") continue;
    for (const cell of getObjectFootprintCells(object)) {
      addPaddedTile(input.floorTiles, cell.x, cell.z, input.paddingTiles);
    }
  }
}

function renderStrategyGraph(input: {
  sourceLayout: OfficeLayoutModel;
  requiredObjects: OfficeObject[];
  paddingTiles: number;
}): {
  layout: OfficeLayoutModel;
  floorTiles: Set<string>;
  stage: OfficeLayoutSolverStageDebug;
} {
  const floorTiles = getOfficeLayoutTileSet(input.sourceLayout);
  addObjectFootprintTiles({
    floorTiles,
    objects: input.requiredObjects,
    paddingTiles: input.paddingTiles,
  });
  const layout = createTileMaskLayout(floorTiles);
  return {
    layout,
    floorTiles,
    stage: {
      name: "render_strategy_graph",
      inputTileCount: input.sourceLayout.tiles.length,
      outputTileCount: layout.tiles.length,
      objectCount: input.requiredObjects.length,
    },
  };
}

function reserveShortestWalkPaths(input: {
  floorTiles: Set<string>;
  requiredObjects: OfficeObject[];
  corridorRadiusTiles: number;
}): {
  reservedWalkTiles: Set<string>;
  layout: OfficeLayoutModel;
  stage: OfficeLayoutSolverStageDebug;
} {
  const inputTileCount = input.floorTiles.size;
  const reservedWalkTiles = buildReservedWalkTiles({
    floorTiles: input.floorTiles,
    objects: input.requiredObjects,
    radius: input.corridorRadiusTiles,
  });
  const layout = createTileMaskLayout(input.floorTiles);
  return {
    reservedWalkTiles,
    layout,
    stage: {
      name: "reserve_shortest_walk_paths",
      inputTileCount,
      outputTileCount: layout.tiles.length,
      routeTileCount: reservedWalkTiles.size,
    },
  };
}

function packOptionalObjects(input: {
  layout: OfficeLayoutModel;
  requiredObjects: OfficeObject[];
  optionalObjects: OfficeObject[];
  reservedWalkTiles: Set<string>;
  objectGapTiles: number;
  paddingTiles: number;
  corridorRadiusTiles: number;
}): {
  placedOptionalObjects: OfficeObject[];
  layout: OfficeLayoutModel;
  reservedWalkTiles: Set<string>;
  stage: OfficeLayoutSolverStageDebug;
  overflowPlacedObjectCount: number;
  unplacedObjectCount: number;
} {
  const result = placeOptionalObjects(input);
  return {
    placedOptionalObjects: result.placedOptionalObjects,
    layout: result.layout,
    reservedWalkTiles: result.reservedWalkTiles,
    overflowPlacedObjectCount: result.overflowPlacedObjectCount,
    unplacedObjectCount: result.unplacedObjectCount,
    stage: {
      name: "pack_optional_objects",
      inputTileCount: input.layout.tiles.length,
      outputTileCount: result.layout.tiles.length,
      objectCount: input.optionalObjects.length,
      placedObjectCount: result.placedOptionalObjects.length,
      insidePlacedObjectCount: result.insidePlacedObjectCount,
      overflowPlacedObjectCount: result.overflowPlacedObjectCount,
      unplacedObjectCount: result.unplacedObjectCount,
      expansionTileCount: result.expansionTileCount,
    },
  };
}

function getProtectedTiles(input: {
  layout: OfficeLayoutModel;
  objects: OfficeObject[];
  reservedWalkTiles: Set<string>;
}): Set<string> {
  const layoutTiles = getOfficeLayoutTileSet(input.layout);
  const protectedTiles = new Set<string>();
  for (const tile of input.reservedWalkTiles) {
    if (layoutTiles.has(tile)) protectedTiles.add(tile);
  }
  for (const object of input.objects) {
    if (object.meshType === "wall-art") continue;
    for (const cell of getObjectFootprintCells(object)) {
      if (layoutTiles.has(cell.key)) protectedTiles.add(cell.key);
    }
  }
  return protectedTiles;
}

function getExteriorVoidTiles(tileSet: Set<string>): Set<string> {
  const seedLayout = createTileMaskLayout(tileSet);
  const bounds = getOfficeLayoutBounds(seedLayout);
  const minTileX = bounds.minTileX - 1;
  const maxTileX = bounds.maxTileX + 1;
  const minTileZ = bounds.minTileZ - 1;
  const maxTileZ = bounds.maxTileZ + 1;
  const exteriorVoid = new Set<string>();
  const pending = [{ x: minTileX, z: minTileZ }];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;
    if (
      current.x < minTileX ||
      current.x > maxTileX ||
      current.z < minTileZ ||
      current.z > maxTileZ
    ) {
      continue;
    }
    const key = officeLayoutTileKey(current.x, current.z);
    if (tileSet.has(key) || exteriorVoid.has(key)) continue;
    exteriorVoid.add(key);
    pending.push(
      { x: current.x + 1, z: current.z },
      { x: current.x - 1, z: current.z },
      { x: current.x, z: current.z + 1 },
      { x: current.x, z: current.z - 1 },
    );
  }

  return exteriorVoid;
}

function isExteriorBoundaryLayoutTile(input: {
  tile: string;
  exteriorVoid: Set<string>;
}): boolean {
  const parsed = parseOfficeLayoutTileKey(input.tile);
  if (!parsed) return false;
  return (
    input.exteriorVoid.has(officeLayoutTileKey(parsed.x + 1, parsed.z)) ||
    input.exteriorVoid.has(officeLayoutTileKey(parsed.x - 1, parsed.z)) ||
    input.exteriorVoid.has(officeLayoutTileKey(parsed.x, parsed.z + 1)) ||
    input.exteriorVoid.has(officeLayoutTileKey(parsed.x, parsed.z - 1))
  );
}

function getOfficeLayoutEmptyPercent(input: {
  layout: OfficeLayoutModel;
  objects: OfficeObject[];
}): number {
  const layoutTiles = getOfficeLayoutTileSet(input.layout);
  if (layoutTiles.size === 0) return 0;
  const occupiedTiles = new Set<string>();
  for (const object of input.objects) {
    if (object.meshType === "wall-art") continue;
    for (const cell of getObjectFootprintCells(object)) {
      if (layoutTiles.has(cell.key)) occupiedTiles.add(cell.key);
    }
  }
  return Math.max(0, layoutTiles.size - occupiedTiles.size) / layoutTiles.size;
}

function pruneEmptyLayoutTiles(input: {
  layout: OfficeLayoutModel;
  objects: OfficeObject[];
  reservedWalkTiles: Set<string>;
  targetEmptyPercent: number;
}): OfficeLayoutModel {
  let current = input.layout;
  const protectedTiles = getProtectedTiles({
    layout: current,
    objects: input.objects,
    reservedWalkTiles: input.reservedWalkTiles,
  });

  while (
    getOfficeLayoutEmptyPercent({ layout: current, objects: input.objects }) >=
    input.targetEmptyPercent
  ) {
    const currentTileSet = getOfficeLayoutTileSet(current);
    const exteriorVoid = getExteriorVoidTiles(currentTileSet);
    const removableTiles = current.tiles
      .filter(
        (tile) =>
          !protectedTiles.has(tile) &&
          isExteriorBoundaryLayoutTile({ tile, exteriorVoid }),
      )
      .sort((left, right) => {
        const leftParsed = parseOfficeLayoutTileKey(left);
        const rightParsed = parseOfficeLayoutTileKey(right);
        const leftDistance =
          Math.abs(leftParsed?.x ?? 0) + Math.abs(leftParsed?.z ?? 0);
        const rightDistance =
          Math.abs(rightParsed?.x ?? 0) + Math.abs(rightParsed?.z ?? 0);
        return rightDistance - leftDistance;
      });

    let removedTile = false;
    for (const tile of removableTiles) {
      const nextTiles = current.tiles.filter((candidate) => candidate !== tile);
      const nextLayout = createTileMaskLayout(new Set(nextTiles));
      const graph = evaluateOfficePoiGraph({
        layout: nextLayout,
        objects: input.objects,
      });
      if (graph.disconnectedCount > 0) continue;
      current = nextLayout;
      removedTile = true;
      break;
    }

    if (!removedTile) break;
  }

  return current;
}

function removeDisconnectedWalkablePockets(input: {
  layout: OfficeLayoutModel;
  objects: OfficeObject[];
  reservedWalkTiles: Set<string>;
}): OfficeLayoutModel {
  const layoutTiles = getOfficeLayoutTileSet(input.layout);
  const protectedTiles = getProtectedTiles({
    layout: input.layout,
    objects: input.objects,
    reservedWalkTiles: input.reservedWalkTiles,
  });
  const occupiedTiles = new Set<string>();
  for (const object of input.objects) {
    if (object.meshType === "wall-art") continue;
    for (const cell of getObjectFootprintCells(object)) {
      if (layoutTiles.has(cell.key)) occupiedTiles.add(cell.key);
    }
  }
  const walkableTiles = new Set(
    [...layoutTiles].filter((tile) => !occupiedTiles.has(tile)),
  );
  const largestWalkable = findLargestWalkableComponent(walkableTiles);
  const keptTiles = new Set(
    [...layoutTiles].filter(
      (tile) => protectedTiles.has(tile) || largestWalkable.has(tile),
    ),
  );
  return keptTiles.size === layoutTiles.size
    ? input.layout
    : createTileMaskLayout(keptTiles);
}

function pruneEmptyEdges(input: {
  expandedLayout: OfficeLayoutModel;
  objects: OfficeObject[];
  reservedWalkTiles: Set<string>;
  targetEmptyPercent: number;
}): {
  officeLayout: OfficeLayoutModel;
  stage: OfficeLayoutSolverStageDebug;
} {
  const prunedLayout = pruneEmptyLayoutTiles({
    layout: input.expandedLayout,
    objects: input.objects,
    reservedWalkTiles: input.reservedWalkTiles,
    targetEmptyPercent: input.targetEmptyPercent,
  });
  const pocketPrunedLayout = removeDisconnectedWalkablePockets({
    layout: prunedLayout,
    objects: input.objects,
    reservedWalkTiles: input.reservedWalkTiles,
  });
  const officeLayout = fillEnclosedOfficeLayoutGaps(pocketPrunedLayout);
  return {
    officeLayout,
    stage: {
      name: "prune_empty_edges",
      inputTileCount: input.expandedLayout.tiles.length,
      outputTileCount: officeLayout.tiles.length,
      prunedTileCount: Math.max(
        0,
        input.expandedLayout.tiles.length - officeLayout.tiles.length,
      ),
    },
  };
}

export function solveOfficeAutoLayout(
  input: OfficeLayoutSolverInput,
): OfficeLayoutSolution {
  const paddingTiles = normalizeTileRadius(input.paddingTiles, DEFAULT_PADDING_TILES);
  const corridorRadiusTiles = normalizeTileRadius(
    input.corridorRadiusTiles,
    DEFAULT_CORRIDOR_RADIUS_TILES,
  );
  const targetEmptyPercent = normalizeTargetEmptyPercent(input.targetEmptyPercent);
  const objectGapTiles = normalizeTileRadius(input.objectGapTiles, DEFAULT_OBJECT_GAP_TILES);
  const stages: OfficeLayoutSolverStageDebug[] = [];
  const graphSeed = renderStrategyGraph({
    sourceLayout: input.sourceLayout,
    requiredObjects: input.requiredObjects,
    paddingTiles,
  });
  stages.push(graphSeed.stage);
  const walkPathSeed = reserveShortestWalkPaths({
    floorTiles: graphSeed.floorTiles,
    requiredObjects: input.requiredObjects,
    corridorRadiusTiles,
  });
  stages.push(walkPathSeed.stage);
  const packed = packOptionalObjects({
    layout: walkPathSeed.layout,
    requiredObjects: input.requiredObjects,
    optionalObjects: input.optionalObjects,
    reservedWalkTiles: walkPathSeed.reservedWalkTiles,
    objectGapTiles,
    paddingTiles,
    corridorRadiusTiles,
  });
  stages.push(packed.stage);
  const placedOptionalObjects = packed.placedOptionalObjects;
  const allObjects = [...input.requiredObjects, ...placedOptionalObjects];
  const finalFloorTiles = new Set<string>();

  addObjectFootprintTiles({
    floorTiles: finalFloorTiles,
    objects: allObjects,
    paddingTiles,
  });
  const reservedWalkTiles = buildReservedWalkTiles({
    floorTiles: finalFloorTiles,
    objects: allObjects,
    radius: corridorRadiusTiles,
  });
  const expandedLayout =
    finalFloorTiles.size > 0
      ? createTileMaskLayout(finalFloorTiles)
      : packed.layout;
  const pruned = pruneEmptyEdges({
    expandedLayout,
    objects: allObjects,
    reservedWalkTiles,
    targetEmptyPercent,
  });
  stages.push(pruned.stage);
  const officeLayout = pruned.officeLayout;
  const quality = evaluateOfficeLayoutQuality({
    layout: officeLayout,
    objects: allObjects,
  });
  const poiGraph = evaluateOfficePoiGraph({
    layout: officeLayout,
    objects: allObjects,
  });

  return {
    officeLayout,
    placedOptionalObjects,
    reservedWalkTiles: sortLayoutTiles(reservedWalkTiles),
    quality,
    poiGraph,
    debug: {
      sourceTileCount: input.sourceLayout.tiles.length,
      finalTileCount: officeLayout.tiles.length,
      optionalObjectCount: input.optionalObjects.length,
      placedOptionalObjectCount: placedOptionalObjects.length,
      overflowPlacedObjectCount: packed.overflowPlacedObjectCount,
      unplacedOptionalObjectCount: packed.unplacedObjectCount,
      prunedTileCount: Math.max(0, expandedLayout.tiles.length - officeLayout.tiles.length),
      objectGapTiles,
      stages,
    },
  };
}
