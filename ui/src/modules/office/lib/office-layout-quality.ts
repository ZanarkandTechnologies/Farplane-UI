/**
 * OFFICE LAYOUT QUALITY
 * =====================
 * Pure tile-graph scoring for compactness and walkability.
 *
 * The renderer owns visuals, but layout generation and HUD diagnostics need a
 * dependency-free way to answer: can agents actually move through this floor?
 */

import {
  getOfficeLayoutTileSet,
  officeLayoutTileKey,
  parseOfficeLayoutTileKey,
  type OfficeLayoutModel,
} from "@/modules/office/lib/office-layout";
import type { OfficeObject } from "@/modules/office/lib/types";
import { getObjectFootprintCells } from "@/modules/office/systems/occupancy-system";

interface TilePoint {
  x: number;
  z: number;
  key: string;
}

export interface OfficeLayoutQuality {
  floorTiles: number;
  occupiedTiles: number;
  walkableTiles: number;
  reachableWalkableTiles: number;
  reachablePercent: number;
  disconnectedWalkableTiles: number;
  deadEndCount: number;
  chokePointCount: number;
  importantTargetCount: number;
  disconnectedTargetCount: number;
  averageImportantPathLength: number | null;
  score: number;
}

function neighborsOf(point: TilePoint): TilePoint[] {
  return [
    { x: point.x + 1, z: point.z, key: officeLayoutTileKey(point.x + 1, point.z) },
    { x: point.x - 1, z: point.z, key: officeLayoutTileKey(point.x - 1, point.z) },
    { x: point.x, z: point.z + 1, key: officeLayoutTileKey(point.x, point.z + 1) },
    { x: point.x, z: point.z - 1, key: officeLayoutTileKey(point.x, point.z - 1) },
  ];
}

function parseTileSet(tileSet: Set<string>): TilePoint[] {
  return [...tileSet].flatMap((key) => {
    const parsed = parseOfficeLayoutTileKey(key);
    return parsed ? [{ ...parsed, key }] : [];
  });
}

function getOccupiedTileSet(objects: OfficeObject[], layoutTiles: Set<string>): Set<string> {
  const occupied = new Set<string>();
  for (const object of objects) {
    if (object.meshType === "wall-art") continue;
    for (const cell of getObjectFootprintCells(object)) {
      if (layoutTiles.has(cell.key)) occupied.add(cell.key);
    }
  }
  return occupied;
}

function bfsComponent(start: TilePoint, walkableTiles: Set<string>): Set<string> {
  const visited = new Set<string>([start.key]);
  const queue = [start];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const neighbor of neighborsOf(current)) {
      if (!walkableTiles.has(neighbor.key) || visited.has(neighbor.key)) continue;
      visited.add(neighbor.key);
      queue.push(neighbor);
    }
  }
  return visited;
}

function findLargestComponent(walkableTiles: Set<string>): Set<string> {
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
    const component = bfsComponent({ ...parsed, key: firstKey }, walkableTiles);
    for (const key of component) remaining.delete(key);
    if (component.size > largest.size) largest = component;
  }
  return largest;
}

function countDeadEnds(walkableTiles: Set<string>): number {
  return parseTileSet(walkableTiles).filter(
    (tile) => neighborsOf(tile).filter((neighbor) => walkableTiles.has(neighbor.key)).length <= 1,
  ).length;
}

function countArticulationPoints(walkableTiles: Set<string>): number {
  const tiles = parseTileSet(walkableTiles);
  const discovery = new Map<string, number>();
  const low = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const articulation = new Set<string>();
  let time = 0;

  const visit = (tile: TilePoint): void => {
    discovery.set(tile.key, time);
    low.set(tile.key, time);
    time += 1;
    let childCount = 0;

    for (const neighbor of neighborsOf(tile)) {
      if (!walkableTiles.has(neighbor.key)) continue;
      if (!discovery.has(neighbor.key)) {
        parent.set(neighbor.key, tile.key);
        childCount += 1;
        visit(neighbor);
        low.set(tile.key, Math.min(low.get(tile.key) ?? 0, low.get(neighbor.key) ?? 0));
        if (parent.get(tile.key) === null && childCount > 1) articulation.add(tile.key);
        if (
          parent.get(tile.key) !== null &&
          (low.get(neighbor.key) ?? 0) >= (discovery.get(tile.key) ?? 0)
        ) {
          articulation.add(tile.key);
        }
      } else if (neighbor.key !== parent.get(tile.key)) {
        low.set(tile.key, Math.min(low.get(tile.key) ?? 0, discovery.get(neighbor.key) ?? 0));
      }
    }
  };

  for (const tile of tiles) {
    if (discovery.has(tile.key)) continue;
    parent.set(tile.key, null);
    visit(tile);
  }

  return articulation.size;
}

function nearestWalkableTile(
  position: [number, number, number],
  layoutTiles: Set<string>,
  walkableTiles: Set<string>,
): string | null {
  const start: TilePoint = {
    x: Math.round(position[0]),
    z: Math.round(position[2]),
    key: officeLayoutTileKey(position[0], position[2]),
  };
  if (walkableTiles.has(start.key)) return start.key;
  if (!layoutTiles.has(start.key)) {
    let nearest: { key: string; distance: number } | null = null;
    for (const tile of parseTileSet(walkableTiles)) {
      const distance = (tile.x - start.x) ** 2 + (tile.z - start.z) ** 2;
      if (!nearest || distance < nearest.distance) nearest = { key: tile.key, distance };
    }
    return nearest?.key ?? null;
  }

  const visited = new Set<string>([start.key]);
  const queue = [start];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const neighbor of neighborsOf(current)) {
      if (!layoutTiles.has(neighbor.key) || visited.has(neighbor.key)) continue;
      if (walkableTiles.has(neighbor.key)) return neighbor.key;
      visited.add(neighbor.key);
      queue.push(neighbor);
    }
  }
  return null;
}

function shortestPathLength(
  fromKey: string,
  toKey: string,
  walkableTiles: Set<string>,
): number | null {
  if (fromKey === toKey) return 0;
  const parsed = parseOfficeLayoutTileKey(fromKey);
  if (!parsed) return null;
  const visited = new Set<string>([fromKey]);
  const queue: Array<TilePoint & { distance: number }> = [{ ...parsed, key: fromKey, distance: 0 }];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const neighbor of neighborsOf(current)) {
      if (!walkableTiles.has(neighbor.key) || visited.has(neighbor.key)) continue;
      if (neighbor.key === toKey) return current.distance + 1;
      visited.add(neighbor.key);
      queue.push({ ...neighbor, distance: current.distance + 1 });
    }
  }
  return null;
}

function getImportantTargetKeys(input: {
  objects: OfficeObject[];
  layoutTiles: Set<string>;
  walkableTiles: Set<string>;
}): string[] {
  const keys = input.objects
    .filter((object) => object.meshType !== "wall-art" && object.meshType !== "glass-wall")
    .filter((object) => object.meshType !== "office-divider")
    .map((object) => nearestWalkableTile(object.position, input.layoutTiles, input.walkableTiles))
    .filter((key): key is string => Boolean(key));
  return [...new Set(keys)].slice(0, 16);
}

export function evaluateOfficeLayoutQuality(input: {
  layout: OfficeLayoutModel;
  objects: OfficeObject[];
}): OfficeLayoutQuality {
  const layoutTiles = getOfficeLayoutTileSet(input.layout);
  const occupiedTiles = getOccupiedTileSet(input.objects, layoutTiles);
  const walkableTiles = new Set([...layoutTiles].filter((tile) => !occupiedTiles.has(tile)));
  const largestComponent = findLargestComponent(walkableTiles);
  const reachablePercent =
    walkableTiles.size > 0 ? largestComponent.size / walkableTiles.size : 0;
  const targetKeys = getImportantTargetKeys({
    objects: input.objects,
    layoutTiles,
    walkableTiles,
  });
  const pathLengths: number[] = [];
  let disconnectedTargetCount = 0;

  for (let index = 1; index < targetKeys.length; index += 1) {
    const distance = shortestPathLength(targetKeys[0], targetKeys[index], walkableTiles);
    if (distance == null) {
      disconnectedTargetCount += 1;
    } else {
      pathLengths.push(distance);
    }
  }

  const deadEndCount = countDeadEnds(walkableTiles);
  const chokePointCount = countArticulationPoints(walkableTiles);
  const averageImportantPathLength =
    pathLengths.length > 0
      ? pathLengths.reduce((sum, distance) => sum + distance, 0) / pathLengths.length
      : null;
  const deadEndPenalty = walkableTiles.size > 0 ? deadEndCount / walkableTiles.size : 0;
  const chokePenalty = walkableTiles.size > 0 ? chokePointCount / walkableTiles.size : 0;
  const targetPenalty = targetKeys.length > 1 ? disconnectedTargetCount / (targetKeys.length - 1) : 0;
  const pathPenalty =
    averageImportantPathLength == null ? 0 : Math.min(0.3, averageImportantPathLength / 200);

  return {
    floorTiles: layoutTiles.size,
    occupiedTiles: occupiedTiles.size,
    walkableTiles: walkableTiles.size,
    reachableWalkableTiles: largestComponent.size,
    reachablePercent,
    disconnectedWalkableTiles: Math.max(0, walkableTiles.size - largestComponent.size),
    deadEndCount,
    chokePointCount,
    importantTargetCount: targetKeys.length,
    disconnectedTargetCount,
    averageImportantPathLength,
    score: Math.max(
      0,
      reachablePercent - deadEndPenalty * 0.2 - chokePenalty * 0.35 - targetPenalty - pathPenalty,
    ),
  };
}
