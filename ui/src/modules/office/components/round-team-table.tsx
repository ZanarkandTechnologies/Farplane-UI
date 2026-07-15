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
}

const defaultTableColor = new THREE.Color("#4f3a2c");
const hoveredTableColor = new THREE.Color("#6f543e");
const tableEdgeColor = new THREE.Color("#8b684c");
const hardwareColor = new THREE.Color("#0f172a");
const standColor = new THREE.Color("#34383a");

export default function RoundTeamTable({ stationCount, isHovered }: RoundTeamTableProps) {
  const layout = useMemo(() => solveRoundTeamTableLayout(stationCount), [stationCount]);
  const tableColor = isHovered ? hoveredTableColor : defaultTableColor;

  return (
    <group name="round-team-table">
      <mesh position={[0, DESK_HEIGHT, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[layout.radius, layout.radius, 0.12, 64]} />
        <meshStandardMaterial color={tableColor} roughness={0.72} />
      </mesh>

      <mesh position={[0, DESK_HEIGHT + 0.075, 0]} receiveShadow>
        <cylinderGeometry args={[layout.radius * 0.98, layout.radius * 0.98, 0.028, 64]} />
        <meshStandardMaterial color={tableEdgeColor} roughness={0.86} />
      </mesh>

      <mesh position={[0, DESK_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.2, DESK_HEIGHT, 24]} />
        <meshStandardMaterial color={standColor} roughness={0.8} metalness={0.12} />
      </mesh>

      <mesh position={[0, 0.05, 0]} receiveShadow>
        <cylinderGeometry args={[0.62, 0.72, 0.1, 32]} />
        <meshStandardMaterial color="#2f3030" roughness={0.82} />
      </mesh>

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
            <meshStandardMaterial color={hardwareColor} roughness={0.5} />
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
