import { describe, expect, it } from "vitest";
import { createHiveMindSwarmLayout, getHiveMindParticleScreenSize } from "./nexus-particle-field";

describe("createHiveMindSwarmLayout", () => {
  it("builds a deterministic, broad particle murmuration", () => {
    const first = createHiveMindSwarmLayout(360);
    const second = createHiveMindSwarmLayout(360);
    const firstPositions = first.geometry.getAttribute("position").array as Float32Array;
    const secondPositions = second.geometry.getAttribute("position").array as Float32Array;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < firstPositions.length; index += 3) {
      expect(firstPositions[index]).toBe(secondPositions[index]);
      expect(firstPositions[index + 1]).toBe(secondPositions[index + 1]);
      expect(firstPositions[index + 2]).toBe(secondPositions[index + 2]);

      const x = firstPositions[index] ?? 0;
      const y = firstPositions[index + 1] ?? 0;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    expect(firstPositions).toHaveLength(360 * 3);
    expect(maxX - minX).toBeGreaterThan(6);
    expect(maxY - minY).toBeGreaterThan(2);

    first.geometry.dispose();
    second.geometry.dispose();
  });
});

describe("getHiveMindParticleScreenSize", () => {
  it("keeps particles readable when zoomed out and enlarges them while zooming in", () => {
    expect(getHiveMindParticleScreenSize(5)).toBe(2.4);
    expect(getHiveMindParticleScreenSize(20)).toBe(4.8);
    expect(getHiveMindParticleScreenSize(55)).toBe(5.5);
    expect(getHiveMindParticleScreenSize(20, true)).toBeCloseTo(6.24);
  });
});
