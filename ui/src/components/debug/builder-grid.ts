/**
 * BUILDER GRID
 * ============
 * Pure geometry helpers for the builder-mode tile overlay grid.
 *
 * KEY CONCEPTS:
 * - Builder grid lines must align exactly to office layout tile boundaries.
 * - Geometry stays pure so regressions can be caught without mounting the scene.
 *
 * USAGE:
 * - Import from `unified-grid-helper.tsx` to render the overlay.
 * - Import from tests to validate rectangular and square layouts.
 *
 * MEMORY REFERENCES:
 * - MEM-0173
 */

import {
  parseOfficeLayoutTileKey,
  type OfficeLayoutModel,
} from '@/modules/office/lib/office-layout';

function addSegment(points: number[], seen: Set<string>, start: [number, number], end: [number, number]): void {
  const [left, right] =
    start[0] < end[0] || (start[0] === end[0] && start[1] <= end[1])
      ? [start, end]
      : [end, start];
  const key = `${left[0]}:${left[1]}|${right[0]}:${right[1]}`;
  if (seen.has(key)) return;
  seen.add(key);
  points.push(left[0], 0.01, left[1], right[0], 0.01, right[1]);
}

export function getBuilderGridLinePositions(layout: OfficeLayoutModel): Float32Array {
  const points: number[] = [];
  const seen = new Set<string>();
  for (const tileKey of layout.tiles) {
    const tile = parseOfficeLayoutTileKey(tileKey);
    if (!tile) continue;
    const minX = tile.x - 0.5;
    const maxX = tile.x + 0.5;
    const minZ = tile.z - 0.5;
    const maxZ = tile.z + 0.5;
    addSegment(points, seen, [minX, minZ], [maxX, minZ]);
    addSegment(points, seen, [maxX, minZ], [maxX, maxZ]);
    addSegment(points, seen, [maxX, maxZ], [minX, maxZ]);
    addSegment(points, seen, [minX, maxZ], [minX, minZ]);
  }
  return new Float32Array(points);
}
