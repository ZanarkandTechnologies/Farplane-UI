/**
 * OFFICE LAYOUT TOPOLOGY
 * ======================
 * Pure tile-set and connectivity primitives shared by office layout derivation and solving.
 * Callers retain placement policy; this module only owns deterministic topology mechanics.
 */

import {
  getOfficeLayoutBounds,
  officeLayoutTileKey,
  parseOfficeLayoutTileKey,
} from "./office-layout";

export interface OfficeTilePoint {
  x: number;
  z: number;
}

export interface OfficeConnectivityEdge {
  from: number;
  to: number;
  distance: number;
}

const DEFAULT_CONNECTIVITY_LOOP_EDGE_RATIO = 0.2;

export function sortOfficeLayoutTiles(tiles: Iterable<string>): string[] {
  return [...tiles].sort((left, right) => {
    const leftParsed = parseOfficeLayoutTileKey(left);
    const rightParsed = parseOfficeLayoutTileKey(right);
    if (!leftParsed || !rightParsed) return left.localeCompare(right);
    return leftParsed.z === rightParsed.z
      ? leftParsed.x - rightParsed.x
      : leftParsed.z - rightParsed.z;
  });
}

export function addPaddedOfficeLayoutTile(
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

function getConnectivityEdges(centers: readonly OfficeTilePoint[]): OfficeConnectivityEdge[] {
  const edges: OfficeConnectivityEdge[] = [];
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

export function buildOfficeConnectivityGraphEdges(
  centers: readonly OfficeTilePoint[],
  loopEdgeRatio = DEFAULT_CONNECTIVITY_LOOP_EDGE_RATIO,
): OfficeConnectivityEdge[] {
  if (centers.length <= 1) return [];
  const allEdges = getConnectivityEdges(centers);
  const parents = centers.map((_, index) => index);
  const spanningEdges: OfficeConnectivityEdge[] = [];
  const spanningEdgeKeys = new Set<string>();

  for (const edge of allEdges) {
    const leftRoot = findConnectivityParent(parents, edge.from);
    const rightRoot = findConnectivityParent(parents, edge.to);
    if (leftRoot === rightRoot) continue;
    parents[rightRoot] = leftRoot;
    spanningEdges.push(edge);
    spanningEdgeKeys.add(`${edge.from}:${edge.to}`);
    if (spanningEdges.length === centers.length - 1) break;
  }

  const loopBudget = Math.ceil(spanningEdges.length * loopEdgeRatio);
  const loopEdges = allEdges
    .filter((edge) => !spanningEdgeKeys.has(`${edge.from}:${edge.to}`))
    .slice(0, loopBudget);
  return [...spanningEdges, ...loopEdges];
}

export function getOfficeExteriorVoidTiles(tileSet: Set<string>): Set<string> {
  if (tileSet.size === 0) return new Set();
  const layout = {
    version: 1 as const,
    tileSize: 1 as const,
    tiles: sortOfficeLayoutTiles(tileSet),
  };
  const bounds = getOfficeLayoutBounds(layout);
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

export function isOfficeExteriorBoundaryLayoutTile(input: {
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
