/**
 * ROUND TEAM TABLE
 * ================
 * Procedural large-team furniture for the 3D office scene.
 *
 * Inputs are a station count and hover state; output is one round table with
 * monitor stations distributed evenly around the tabletop. This component has
 * no persistence side effects and depends on `utils/layout.ts` for slot math.
 */
import { Box } from "@react-three/drei";
import { useMemo } from "react";
import { COMPUTER_HEIGHT, DESK_HEIGHT } from "@/constants";
import { solveRoundTeamTableLayout } from "@/modules/office/utils/layout";
import * as THREE from "three";

interface RoundTeamTableProps {
  stationCount: number;
  isHovered: boolean;
  variant?: "team" | "executive";
}

const defaultTableColor = new THREE.Color("#4f3a2c");
const hoveredTableColor = new THREE.Color("#6f543e");
const tableEdgeColor = new THREE.Color("#8b684c");
const hardwareColor = new THREE.Color("#0f172a");
const standColor = new THREE.Color("#34383a");

export default function RoundTeamTable({
  stationCount,
  isHovered,
  variant = "team",
}: RoundTeamTableProps) {
  const layout = useMemo(() => solveRoundTeamTableLayout(stationCount), [stationCount]);
  const isExecutive = variant === "executive";
  const tableColor = isExecutive
    ? isHovered
      ? new THREE.Color("#765839")
      : new THREE.Color("#5d432c")
    : isHovered
      ? hoveredTableColor
      : defaultTableColor;

  return (
    <group name="round-team-table">
      <mesh position={[0, DESK_HEIGHT, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[layout.radius, layout.radius, 0.12, 64]} />
        <meshStandardMaterial color={tableColor} roughness={0.72} />
      </mesh>

      <mesh position={[0, DESK_HEIGHT + 0.075, 0]} receiveShadow>
        <cylinderGeometry args={[layout.radius * 0.98, layout.radius * 0.98, 0.028, 64]} />
        <meshStandardMaterial
          color={isExecutive ? "#b88942" : tableEdgeColor}
          roughness={isExecutive ? 0.55 : 0.86}
          metalness={isExecutive ? 0.28 : 0}
        />
      </mesh>

      <mesh position={[0, DESK_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.2, DESK_HEIGHT, 24]} />
        <meshStandardMaterial color={standColor} roughness={0.8} metalness={0.12} />
      </mesh>

      <mesh position={[0, 0.05, 0]} receiveShadow>
        <cylinderGeometry args={[0.62, 0.72, 0.1, 32]} />
        <meshStandardMaterial color="#2f3030" roughness={0.82} />
      </mesh>

      {isExecutive ? (
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
        <group
          key={station.stationId}
          name={`round-table-station-${index}`}
          position={[station.x, DESK_HEIGHT + 0.13, station.z]}
          rotation={[0, station.yaw, 0]}
        >
          <Box args={[0.52, COMPUTER_HEIGHT * 0.82, 0.055]} position={[0, COMPUTER_HEIGHT / 2, 0]}>
            <meshStandardMaterial color="#111827" roughness={0.62} />
          </Box>
          <mesh position={[0, COMPUTER_HEIGHT / 2, 0.031]}>
            <planeGeometry args={[0.44, COMPUTER_HEIGHT * 0.66]} />
            <meshStandardMaterial
              color={isExecutive && index > 0 ? "#172a31" : hardwareColor}
              emissive={isExecutive && index > 0 ? "#0d5860" : "#000000"}
              emissiveIntensity={isExecutive && index > 0 ? 0.18 : 0}
              roughness={0.5}
            />
          </mesh>
          <Box args={[0.16, 0.035, 0.16]} position={[0, 0.035, -0.12]}>
            <meshStandardMaterial color={standColor} roughness={0.7} />
          </Box>
          <Box args={[0.035, 0.12, 0.035]} position={[0, 0.11, -0.07]}>
            <meshStandardMaterial color={standColor} roughness={0.7} />
          </Box>
        </group>
      ))}
    </group>
  );
}
