import { describe, expect, it } from "vitest";
import {
  CAPABILITY_NEXUS_CENTER,
  CAPABILITY_NEXUS_COLORS,
  CAPABILITY_NEXUS_FLOW_IDS,
  createCapabilityNexusParticles,
} from "./capability-nexus-particles";

describe("capability nexus particles", () => {
  it("creates a stable multi-path murmuration around the map centre", () => {
    const first = createCapabilityNexusParticles();
    const second = createCapabilityNexusParticles();

    expect(first).toEqual(second);
    expect(first).toHaveLength(126);
    expect(new Set(first.map((particle) => particle.path)).size).toBe(
      CAPABILITY_NEXUS_FLOW_IDS.length,
    );
    expect(new Set(first.map((particle) => particle.color))).toEqual(
      new Set(Object.values(CAPABILITY_NEXUS_COLORS)),
    );
    expect(
      first.some(
        (particle) =>
          Math.abs(particle.x - CAPABILITY_NEXUS_CENTER.x) < 18 &&
          Math.abs(particle.y - CAPABILITY_NEXUS_CENTER.y) < 18,
      ),
    ).toBe(true);
  });
});
