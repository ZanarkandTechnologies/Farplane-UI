/**
 * ROUND TEAM TABLE
 * ================
 * Procedural large-team furniture for the 3D office scene.
 *
 * Inputs are a station count and hover state; output is one round table with
 * monitor stations distributed evenly around the tabletop. This component has
 * no persistence side effects and depends on `utils/layout.ts` for slot math.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { DESK_HEIGHT } from "@/constants";
import { solveRoundTeamTableLayout } from "@/modules/office/utils/layout";
import { DeskMonitor } from "./desk-monitor";

interface RoundTeamTableProps {
  stationCount: number;
  isHovered: boolean;
  variant?: "team" | "executive";
  /**
   * Keeps the normal team tables warm and timber-like while allowing the
   * Company Council to read as one light, intentional shared surface.
   */
  finish?: "walnut" | "ivory";
  /** The Council's World Nexus occupies the centre, so it owns that focal effect. */
  showExecutiveNexus?: boolean;
  /** Expands the tabletop footprint without stretching the monitors themselves. */
  planarScale?: number;
}

const defaultTableColor = new THREE.Color("#4f3a2c");
const hoveredTableColor = new THREE.Color("#6f543e");
const tableEdgeColor = new THREE.Color("#8b684c");
const standColor = new THREE.Color("#34383a");

export default function RoundTeamTable({
  stationCount,
  isHovered,
  variant = "team",
  finish = "walnut",
  showExecutiveNexus = true,
  planarScale = 1,
}: RoundTeamTableProps) {
  const layout = useMemo(() => solveRoundTeamTableLayout(stationCount), [stationCount]);
  const isExecutive = variant === "executive";
  const isIvory = finish === "ivory";
  const safePlanarScale = Number.isFinite(planarScale) ? Math.max(0.2, planarScale) : 1;
  const tabletopRadius = layout.radius * safePlanarScale;
  const pedestalScale = Math.min(1.55, Math.sqrt(safePlanarScale));
  const tableColor = isIvory
    ? isHovered
      ? new THREE.Color("#ffffff")
      : new THREE.Color("#fffbf2")
    : isExecutive
      ? isHovered
        ? new THREE.Color("#765839")
        : new THREE.Color("#5d432c")
      : isHovered
        ? hoveredTableColor
        : defaultTableColor;

  return (
    <group name="round-team-table">
      <mesh position={[0, DESK_HEIGHT, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[tabletopRadius, tabletopRadius, 0.12, 64]} />
        <meshStandardMaterial
          color={tableColor}
          emissive={isIvory ? "#fffaf0" : "#000000"}
          emissiveIntensity={isIvory ? 0.18 : 0}
          roughness={isIvory ? 0.34 : 0.72}
        />
      </mesh>

      <mesh position={[0, DESK_HEIGHT + 0.075, 0]} receiveShadow>
        <cylinderGeometry args={[tabletopRadius * 0.98, tabletopRadius * 0.98, 0.028, 64]} />
        <meshStandardMaterial
          color={isIvory ? "#e8e3d9" : isExecutive ? "#b88942" : tableEdgeColor}
          roughness={isIvory ? 0.48 : isExecutive ? 0.55 : 0.86}
          metalness={isIvory ? 0.08 : isExecutive ? 0.28 : 0}
        />
      </mesh>

      <mesh position={[0, DESK_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry args={[0.14 * pedestalScale, 0.2 * pedestalScale, DESK_HEIGHT, 24]} />
        <meshStandardMaterial color={standColor} roughness={0.8} metalness={0.12} />
      </mesh>

      <mesh position={[0, 0.05, 0]} receiveShadow>
        <cylinderGeometry args={[0.62 * pedestalScale, 0.72 * pedestalScale, 0.1, 32]} />
        <meshStandardMaterial color="#2f3030" roughness={0.82} />
      </mesh>

      {isExecutive && showExecutiveNexus ? (
        <group name="executive-pod-decor">
          <mesh position={[0, DESK_HEIGHT + 0.102, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.4, 0.56, 40]} />
            <meshStandardMaterial
              color="#d4a75f"
              emissive="#6f481d"
              emissiveIntensity={0.22}
              roughness={0.45}
              metalness={0.35}
            />
          </mesh>
          <mesh position={[0, DESK_HEIGHT + 0.24, 0]} castShadow>
            <octahedronGeometry args={[0.18, 0]} />
            <meshStandardMaterial
              color="#f2c97d"
              emissive="#b26b24"
              emissiveIntensity={0.38}
              roughness={0.36}
              metalness={0.24}
            />
          </mesh>
          <pointLight
            position={[0, DESK_HEIGHT + 0.42, 0]}
            color="#f2bc6b"
            intensity={0.42}
            distance={3.4}
          />
        </group>
      ) : null}

      {layout.stations.map((station, index) => (
        <DeskMonitor
          key={station.stationId}
          name={`round-table-station-${index}`}
          position={[station.x * safePlanarScale, DESK_HEIGHT + 0.1, station.z * safePlanarScale]}
          rotation={[0, station.yaw, 0]}
        />
      ))}
    </group>
  );
}
