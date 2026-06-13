import { describe, expect, it } from "vitest";
import {
  createRectangularOfficeLayout,
  getOfficeLayoutBounds,
} from "@/modules/office/lib/office-layout";
import { getOrbitWallFadeMask } from "./office-room-shell";

const bounds = getOfficeLayoutBounds(createRectangularOfficeLayout({ width: 10, depth: 10 }));

describe("getOrbitWallFadeMask", () => {
  it("fades the nearest orbit-facing walls when the camera is close", () => {
    const mask = getOrbitWallFadeMask(bounds, { x: bounds.maxWorldX + 1, z: bounds.maxWorldZ + 1 });

    expect(mask.frontEast).toBe(true);
    expect(mask.frontSouth).toBe(true);
    expect(mask.frontNorth).toBe(false);
    expect(mask.frontWest).toBe(false);
    expect(mask.fadeStrength).toBeGreaterThan(0.8);
  });

  it("does not fade walls when the orbit camera is far from the perimeter", () => {
    const mask = getOrbitWallFadeMask(bounds, { x: bounds.maxWorldX + 18, z: bounds.centerZ });

    expect(mask.frontEast).toBe(true);
    expect(mask.fadeStrength).toBe(0);
  });
});
