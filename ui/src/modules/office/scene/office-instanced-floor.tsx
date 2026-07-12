/**
 * OFFICE INSTANCED FLOOR
 * ======================
 * Owns the visible office floor instances derived from the persisted tile mask.
 * Inputs are layout, decor, and Builder state; output is one InstancedMesh with
 * deterministic instance IDs. It has no persistence side effects, and instance
 * order must remain stable so an instance ID always resolves to the same tile key.
 */

import type { ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  getFloorPatternPreset,
  type OfficeFloorPatternId,
} from "@/modules/office/lib/office-decor";
import {
  type OfficeLayoutModel,
  officeLayoutTileKey,
  parseOfficeLayoutTileKey,
} from "@/modules/office/lib/office-layout";

const FLOOR_TILE_POSITION_Y = -0.04;
const FLOOR_TILE_HEIGHT = 0.08;
const BUILDER_FLOOR_COLOR = "#d9ddd8";

export interface OfficeFloorInstancePlan {
  tileKeys: string[];
  positions: Array<[number, number, number]>;
  colors: string[];
}

function compareTiles(left: { x: number; z: number }, right: { x: number; z: number }): number {
  return left.z === right.z ? left.x - right.x : left.z - right.z;
}

function resolveFloorTileColor(
  patternId: OfficeFloorPatternId,
  colors: readonly [string, string, string],
  x: number,
  z: number,
): string {
  const [base, accent, line] = colors;
  if (patternId === "sandstone_tiles") {
    return (x + z) % 2 === 0 ? accent : base;
  }
  if (patternId === "graphite_grid") {
    return x % 3 === 0 || z % 3 === 0 ? line : accent;
  }
  return z % 2 === 0 ? accent : base;
}

export function buildOfficeFloorInstancePlan(
  officeLayout: OfficeLayoutModel,
  floorPatternId: OfficeFloorPatternId,
  sceneBuilderMode: boolean,
): OfficeFloorInstancePlan {
  const uniqueTiles = new Map<string, { x: number; z: number }>();
  for (const tileKey of officeLayout.tiles) {
    const tile = parseOfficeLayoutTileKey(tileKey);
    if (!tile) continue;
    uniqueTiles.set(officeLayoutTileKey(tile.x, tile.z), tile);
  }

  const tiles = [...uniqueTiles.values()].sort(compareTiles);
  const patternColors = getFloorPatternPreset(floorPatternId).colors;
  const tileKeys: string[] = [];
  const positions: Array<[number, number, number]> = [];
  const colors: string[] = [];

  for (const tile of tiles) {
    tileKeys.push(officeLayoutTileKey(tile.x, tile.z));
    positions.push([tile.x, FLOOR_TILE_POSITION_Y, tile.z]);
    colors.push(
      sceneBuilderMode
        ? BUILDER_FLOOR_COLOR
        : resolveFloorTileColor(floorPatternId, patternColors, tile.x, tile.z),
    );
  }

  return { tileKeys, positions, colors };
}

export function resolveOfficeFloorTileKey(
  plan: OfficeFloorInstancePlan,
  instanceId: number | undefined,
): string | null {
  if (instanceId == null || !Number.isInteger(instanceId) || instanceId < 0) return null;
  return plan.tileKeys[instanceId] ?? null;
}

export function OfficeInstancedFloor(props: {
  officeLayout: OfficeLayoutModel;
  floorPatternId: OfficeFloorPatternId;
  sceneBuilderMode: boolean;
  onClick: (event: ThreeEvent<MouseEvent>) => void;
}): React.JSX.Element {
  const { officeLayout, floorPatternId, sceneBuilderMode, onClick } = props;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const plan = useMemo(
    () => buildOfficeFloorInstancePlan(officeLayout, floorPatternId, sceneBuilderMode),
    [floorPatternId, officeLayout, sceneBuilderMode],
  );
  const userData = useMemo(() => ({ tileKeys: plan.tileKeys }), [plan.tileKeys]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let index = 0; index < plan.tileKeys.length; index += 1) {
      const position = plan.positions[index];
      if (!position) continue;
      matrix.makeTranslation(position[0], position[1], position[2]);
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, color.set(plan.colors[index] ?? BUILDER_FLOOR_COLOR));
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [plan]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: React Three Fiber mesh handles scene floor clicks, not DOM interaction semantics.
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, plan.tileKeys.length]}
      receiveShadow
      name="office-instanced-floor"
      onClick={onClick}
      userData={userData}
    >
      <boxGeometry args={[1, FLOOR_TILE_HEIGHT, 1]} />
      <meshStandardMaterial color="#ffffff" roughness={0.9} metalness={0.03} />
    </instancedMesh>
  );
}
