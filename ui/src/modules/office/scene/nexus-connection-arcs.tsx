"use client";

/**
 * NEXUS CONNECTION ARCS
 * =====================
 * Presentation-only "knowledge flow" layer for the department archipelago:
 * one dashed arc rises from each department island and lands inside the
 * Company World particle swarm, with a few small packets traveling along it.
 *
 * OWNERSHIP:
 * - Owns only the arc/packet visuals. Geometry derives from the same pure
 *   department-island layout the platforms use; this layer reads no stores
 *   and writes no state.
 *
 * INPUTS / OUTPUTS:
 * - Input: department island geometry + accent colors from the layout module.
 * - Output: seven dashed curves and twenty-one animated packet meshes; no side
 *   effects beyond per-frame position updates.
 *
 * INVARIANTS:
 * - Raycast is disabled on every mesh so arcs never block room/nexus clicks.
 * - Honors prefers-reduced-motion by freezing packets at their midpoint.
 * - Packet count per arc is bounded; geometry/materials are stable across
 *   frames (only object positions mutate).
 */

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { getDepartmentIslandGeometry } from "../lib/department-island-layout";

/** Arc endpoints: island deck level -> inside the nexus swarm. */
const ARC_START_Y = 0.7;
const ARC_END_Y = 2.9;
const ARC_LIFT_Y = 5.6;
const ARC_POINT_COUNT = 42;
const PACKET_SPEED = 0.055;
const PACKET_OFFSETS = [1 / 6, 1 / 2, 5 / 6] as const;

export interface NexusArcPlan {
  departmentId: string;
  accentColor: string;
  curve: THREE.QuadraticBezierCurve3;
  points: Array<[number, number, number]>;
}

/** Pure plan builder (exported for tests): one lifted quadratic arc per island. */
export function buildNexusArcPlans(): NexusArcPlan[] {
  return getDepartmentIslandGeometry().map((island, index) => {
    const start = new THREE.Vector3(island.center[0], ARC_START_Y, island.center[1]);
    const end = new THREE.Vector3(0, ARC_END_Y, 0);
    // Fan the lift points slightly so parallel arcs do not overlap in flight.
    const fan = index - 1.5;
    const control = new THREE.Vector3(
      island.center[0] * 0.42 + fan * 1.1,
      ARC_LIFT_Y + Math.abs(fan) * 0.5,
      island.center[1] * 0.42 - fan * 0.7,
    );
    const curve = new THREE.QuadraticBezierCurve3(start, control, end);
    const points = curve
      .getPoints(ARC_POINT_COUNT - 1)
      .map((point) => [point.x, point.y, point.z] as [number, number, number]);
    return { departmentId: island.id, accentColor: island.accentColor, curve, points };
  });
}

function ArcPackets({
  plan,
  color,
  frozen,
}: {
  plan: NexusArcPlan;
  color?: string;
  frozen: boolean;
}): React.JSX.Element {
  const packetRefs = useRef<Array<THREE.Mesh | null>>([]);
  const packetColor = color ?? plan.accentColor;

  useFrame((state) => {
    if (frozen) return;
    const elapsed = state.clock.getElapsedTime();
    for (let index = 0; index < PACKET_OFFSETS.length; index += 1) {
      const mesh = packetRefs.current[index];
      if (!mesh) continue;
      const offset = PACKET_OFFSETS[index] ?? 0;
      const t = (elapsed * PACKET_SPEED + offset) % 1;
      const position = plan.curve.getPoint(t);
      mesh.position.copy(position);
      // Packets swell slightly as they approach the nexus, like being pulled in.
      const scale = 0.75 + t * 0.6;
      mesh.scale.setScalar(scale);
    }
  });

  return (
    <group name={`nexus-arc-packets-${plan.departmentId}`}>
      {PACKET_OFFSETS.map((offset, index) => {
        const midpoint = plan.curve.getPoint(offset);
        return (
          <mesh
            key={`${plan.departmentId}-packet-${offset}`}
            ref={(mesh: THREE.Mesh | null) => {
              packetRefs.current[index] = mesh;
            }}
            position={midpoint}
            raycast={() => null}
          >
            <sphereGeometry args={[0.085, 10, 8]} />
            <meshStandardMaterial
              color={packetColor}
              emissive={packetColor}
              emissiveIntensity={color ? 0.22 : 0.85}
              roughness={color ? 0.76 : 0.4}
            />
          </mesh>
        );
      })}
    </group>
  );
}

export function NexusConnectionArcs({ color }: { color?: string }): React.JSX.Element {
  const plans = useMemo(() => buildNexusArcPlans(), []);
  const lineRefs = useRef<Array<THREE.Object3D | null>>([]);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  // Crawl the dash pattern toward the nexus so the arcs read as inbound flow.
  useFrame((state) => {
    if (reducedMotion) return;
    const offset = -state.clock.getElapsedTime() * 0.55;
    for (const line of lineRefs.current) {
      const material = (line as unknown as { material?: { dashOffset?: number } })?.material;
      if (material && typeof material.dashOffset === "number") {
        material.dashOffset = offset;
      }
    }
  });

  return (
    <group name="nexus-connection-arcs">
      {plans.map((plan, index) => (
        <group key={plan.departmentId} name={`nexus-arc-${plan.departmentId}`}>
          <Line
            ref={(line) => {
              lineRefs.current[index] = line as unknown as THREE.Object3D;
            }}
            points={plan.points}
            color={color ?? plan.accentColor}
            transparent
            opacity={color ? 0.24 : 0.42}
            lineWidth={1.1}
            dashed
            dashSize={0.42}
            gapSize={0.3}
            raycast={() => null}
          />
          <ArcPackets plan={plan} color={color} frozen={reducedMotion} />
        </group>
      ))}
    </group>
  );
}
