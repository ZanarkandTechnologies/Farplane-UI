"use client";

/**
 * HIVE-MIND SWARM
 * ===============
 * Presentation-only Company World landmark. A dense particle flock travels
 * along several deforming flow paths so the centre reads as a fluid, collective
 * intelligence instead of a table, click marker, or generic dust cloud.
 *
 * OWNERSHIP:
 * - Owns only the particle visual; it reads no stores and writes no state.
 *
 * INPUTS / OUTPUTS:
 * - Input: an optional bounded particle count.
 * - Output: one table-free, interactive-safe swarm; no side effects.
 *
 * INVARIANTS:
 * - Deterministic seeds give every client the same starting flock silhouette.
 * - Positions update in-place with no per-frame allocations.
 * - Reduced motion freezes a composed flock rather than hiding the landmark.
 * - Raycast is disabled so the swarm never blocks the Company World click.
 */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OFFICE_DIORAMA_THEME, type OfficeDioramaTheme } from "@/config/office-theme";

const DEFAULT_PARTICLE_COUNT = 2_200;
const FLOW_PATH_COUNT = 9;
const MIN_PARTICLE_SCREEN_SIZE = 2.4;
const MAX_PARTICLE_SCREEN_SIZE = 5.5;
const ARCHIPELAGO_MIN_ZOOM = 5;
const HOVER_SIZE_MULTIPLIER = 1.3;

export function getHiveMindParticleScreenSize(cameraZoom: number, highlighted = false): number {
  const zoomScale = Math.sqrt(Math.max(cameraZoom, ARCHIPELAGO_MIN_ZOOM) / ARCHIPELAGO_MIN_ZOOM);
  const baseSize = THREE.MathUtils.clamp(
    MIN_PARTICLE_SCREEN_SIZE * zoomScale,
    MIN_PARTICLE_SCREEN_SIZE,
    MAX_PARTICLE_SCREEN_SIZE,
  );
  return baseSize * (highlighted ? HOVER_SIZE_MULTIPLIER : 1);
}

type HiveMindSwarmLayout = {
  geometry: THREE.BufferGeometry;
  pathSeeds: Float32Array;
  progressSeeds: Float32Array;
  widthSeeds: Float32Array;
  heightSeeds: Float32Array;
  speedSeeds: Float32Array;
};

type FlowPoint = {
  x: number;
  y: number;
  z: number;
};

/** Deterministic PRNG so the swarm silhouette is stable across mounts and clients. */
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

function getFlowPoint({
  pathSeed,
  progressSeed,
  widthSeed,
  heightSeed,
  elapsed = 0,
}: {
  pathSeed: number;
  progressSeed: number;
  widthSeed: number;
  heightSeed: number;
  elapsed?: number;
}): FlowPoint {
  const progress = (progressSeed + elapsed * 0.035) % 1;
  const turn = progress * Math.PI * 2.7 + pathSeed;
  const collectivePulse = 0.5 + Math.sin(turn * 1.45 + pathSeed * 0.6) * 0.5;
  const radius = 1.2 + collectivePulse * 2.15 + widthSeed;

  return {
    x: Math.cos(turn) * radius + Math.sin(turn * 1.15 + pathSeed) * 0.62,
    y:
      1.8 +
      Math.sin(turn * 1.55 + pathSeed * 0.7) * 1.15 +
      collectivePulse * 1.1 +
      heightSeed * (0.55 + collectivePulse * 0.35),
    z: Math.sin(turn) * radius * 0.72 + Math.cos(turn * 2.2 - pathSeed) * 0.52,
  };
}

function writeFlowPoint({
  positions,
  index,
  pathSeed,
  progressSeed,
  widthSeed,
  heightSeed,
  elapsed = 0,
}: {
  positions: Float32Array;
  index: number;
  pathSeed: number;
  progressSeed: number;
  widthSeed: number;
  heightSeed: number;
  elapsed?: number;
}): void {
  const point = getFlowPoint({
    pathSeed,
    progressSeed,
    widthSeed,
    heightSeed,
    elapsed,
  });
  const positionIndex = index * 3;
  positions[positionIndex] = point.x;
  positions[positionIndex + 1] = point.y;
  positions[positionIndex + 2] = point.z;
}

/** Pure, deterministic seed data for the multi-path particle murmuration. */
export function createHiveMindSwarmLayout(
  count: number,
  palette = OFFICE_DIORAMA_THEME.nexusVortex,
): HiveMindSwarmLayout {
  const random = mulberry32(0x68697665);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const pathSeeds = new Float32Array(count);
  const progressSeeds = new Float32Array(count);
  const widthSeeds = new Float32Array(count);
  const heightSeeds = new Float32Array(count);
  const speedSeeds = new Float32Array(count);
  const color = new THREE.Color();

  for (let index = 0; index < count; index += 1) {
    const pathSeed = ((index % FLOW_PATH_COUNT) / FLOW_PATH_COUNT) * Math.PI * 2;
    const progressSeed = random();
    const widthSeed = (random() - 0.5) * 0.78 * random();
    const heightSeed = (random() - 0.5) * 0.92;

    pathSeeds[index] = pathSeed;
    progressSeeds[index] = progressSeed;
    widthSeeds[index] = widthSeed;
    heightSeeds[index] = heightSeed;
    speedSeeds[index] = 0.72 + random() * 0.52;
    writeFlowPoint({
      positions,
      index,
      pathSeed,
      progressSeed,
      widthSeed,
      heightSeed,
    });

    const colorRole = index % 13;
    color.set(
      colorRole < 8
        ? palette.ink
        : colorRole < 11
          ? palette.cool
          : colorRole === 11
            ? palette.pale
            : palette.warm,
    );
    color.toArray(colors, index * 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return { geometry, pathSeeds, progressSeeds, widthSeeds, heightSeeds, speedSeeds };
}

export function NexusParticleField({
  count = DEFAULT_PARTICLE_COUNT,
  highlighted = false,
  dioramaTheme = OFFICE_DIORAMA_THEME,
}: {
  count?: number;
  highlighted?: boolean;
  dioramaTheme?: OfficeDioramaTheme;
}): React.JSX.Element {
  const swarm = useMemo(
    () => createHiveMindSwarmLayout(count, dioramaTheme.nexusVortex),
    [count, dioramaTheme.nexusVortex],
  );
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const opacity =
    dioramaTheme.mode === "night" ? (highlighted ? 0.56 : 0.38) : highlighted ? 1 : 0.94;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  useEffect(() => () => swarm.geometry.dispose(), [swarm]);

  useFrame((state) => {
    if (materialRef.current) {
      const cameraZoom =
        state.camera instanceof THREE.OrthographicCamera ? state.camera.zoom : ARCHIPELAGO_MIN_ZOOM;
      materialRef.current.size = getHiveMindParticleScreenSize(cameraZoom, highlighted);
      materialRef.current.opacity = opacity;
    }

    if (reducedMotion) return;

    const positions = swarm.geometry.getAttribute("position").array as Float32Array;
    const elapsed = state.clock.getElapsedTime();
    for (let index = 0; index < swarm.pathSeeds.length; index += 1) {
      writeFlowPoint({
        positions,
        index,
        pathSeed: swarm.pathSeeds[index] ?? 0,
        progressSeed: swarm.progressSeeds[index] ?? 0,
        widthSeed: swarm.widthSeeds[index] ?? 0,
        heightSeed: swarm.heightSeeds[index] ?? 0,
        elapsed: elapsed * (swarm.speedSeeds[index] ?? 1),
      });
    }
    swarm.geometry.getAttribute("position").needsUpdate = true;
  });

  return (
    <group name="hive-mind-swarm" scale={[1.15, 1.08, 1.15]}>
      <points geometry={swarm.geometry} raycast={() => null}>
        <pointsMaterial
          ref={materialRef}
          transparent
          opacity={opacity}
          size={MIN_PARTICLE_SCREEN_SIZE}
          sizeAttenuation={false}
          vertexColors
          depthWrite={false}
        />
      </points>
    </group>
  );
}
