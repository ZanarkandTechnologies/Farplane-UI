import { describe, expect, it } from 'vitest';

import { officeLayoutTileKey, type OfficeLayoutModel } from '@/modules/office/lib/office-layout';

import { getBuilderGridLinePositions } from './builder-grid';

describe('unified builder grid geometry', () => {
  it('draws only the live tile mask instead of the layout bounding rectangle', () => {
    const layout: OfficeLayoutModel = {
      version: 1,
      tileSize: 1,
      tiles: [
        officeLayoutTileKey(0, 0),
        officeLayoutTileKey(1, 0),
        officeLayoutTileKey(0, 1),
      ],
    };

    const positions = getBuilderGridLinePositions(layout);

    expect(positions).toHaveLength(10 * 2 * 3);
    const segments = new Set<string>();
    for (let index = 0; index < positions.length; index += 6) {
      segments.add(
        `${positions[index]}:${positions[index + 2]}|${positions[index + 3]}:${positions[index + 5]}`,
      );
    }
    expect(segments.has('1.5:0.5|1.5:1.5')).toBe(false);
    expect(segments.has('0.5:1.5|1.5:1.5')).toBe(false);
  });
});
