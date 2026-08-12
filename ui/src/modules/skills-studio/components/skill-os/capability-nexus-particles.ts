/**
 * Presentation-only particle murmuration for the Capability Map centre.
 *
 * It uses the Capability Map visual grammar—deterministic multi-path flow,
 * sparse warm/ivory variation, and a living centre—without becoming a graph
 * node or claiming a runtime relationship between departments.
 */

export const CAPABILITY_NEXUS_CENTER = { x: 600, y: 405 } as const;

const FLOW_PATH_COUNT = 9;
const PARTICLE_COUNT = 126;

/** Neutral constellation colours; department colours remain reserved for nodes. */
export const CAPABILITY_NEXUS_COLORS = {
  core: "#d6b96f",
  ivory: "#f3eab8",
  muted: "#a89c6a",
  shadow: "#6f694b",
} as const;

export const CAPABILITY_NEXUS_FLOW_IDS = Array.from(
  { length: FLOW_PATH_COUNT },
  (_, path) => `flow-${path}`,
);

export type CapabilityNexusParticle = {
  color: string;
  id: string;
  opacity: number;
  path: number;
  r: number;
  x: number;
  y: number;
};

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic, view-only points arranged along nine overlapping flow paths. */
export function createCapabilityNexusParticles(): CapabilityNexusParticle[] {
  const random = mulberry32(0x68697665);

  return Array.from({ length: PARTICLE_COUNT }, (_, index) => {
    const path = index % CAPABILITY_NEXUS_FLOW_IDS.length;
    const pathAngle = (path / FLOW_PATH_COUNT) * Math.PI * 2;
    const progress = random();
    const turn = progress * Math.PI * 2.7 + pathAngle;
    const collectivePulse = 0.5 + Math.sin(turn * 1.45 + pathAngle * 0.6) * 0.5;
    const width = (random() - 0.5) * 18 * random();
    const radius = 12 + collectivePulse * 104 + width;
    const wobble = Math.sin(turn * 1.15 + pathAngle) * 11;
    const colorRole = index % 13;

    return {
      color:
        colorRole < 8
          ? CAPABILITY_NEXUS_COLORS.shadow
          : colorRole < 11
            ? CAPABILITY_NEXUS_COLORS.muted
            : colorRole === 11
              ? CAPABILITY_NEXUS_COLORS.ivory
              : CAPABILITY_NEXUS_COLORS.core,
      id: `nexus-${index}`,
      opacity: 0.2 + random() * 0.62,
      path,
      r: index % 11 === 0 ? 3.2 : index % 4 === 0 ? 2.05 : 1.1 + random() * 0.85,
      x: CAPABILITY_NEXUS_CENTER.x + Math.cos(turn) * radius + wobble,
      y: CAPABILITY_NEXUS_CENTER.y + Math.sin(turn) * radius * 0.56 + wobble * 0.3,
    };
  });
}
