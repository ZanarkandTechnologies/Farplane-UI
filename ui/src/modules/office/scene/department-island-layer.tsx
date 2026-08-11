/**
 * DEPARTMENT ISLAND LAYER
 * =======================
 * Renders the presentation-only raised slabs for the automatic hosted-room
 * archipelago. Navigation and collisions remain owned by the shared office
 * tile mask; this layer derives from the same pure layout module and writes no
 * state.
 */

import { ContactShadows, RoundedBox } from "@react-three/drei";
import type { OfficeDioramaTheme } from "@/config/office-theme";
import {
  getDepartmentIslandBridgePlan,
  getDepartmentIslandGeometry,
} from "@/modules/office/lib/department-island-layout";
import type { ProjectCouncilLayout } from "@/modules/office/lib/project-council-layout";
import { NexusConnectionArcs } from "./nexus-connection-arcs";

// The deck surfaces stay at y=0 so every existing agent, desk, and nav tile
// keeps its placement. Only the presentation thickness changes: the islands
// should read as connected floor plates, not half-avatar-high podiums.
const ISLAND_EDGE_HEIGHT = 0.18;
const ISLAND_TOP_HEIGHT = 0.07;
const ISLAND_EDGE_CENTER_Y = -(ISLAND_TOP_HEIGHT + ISLAND_EDGE_HEIGHT / 2);
const ISLAND_TOP_CENTER_Y = -ISLAND_TOP_HEIGHT / 2;
const ISLAND_BASE_Y = -(ISLAND_EDGE_HEIGHT + ISLAND_TOP_HEIGHT);
const BRIDGE_HEIGHT = 0.07;
const BRIDGE_CENTER_Y = -BRIDGE_HEIGHT / 2;

function Platform({
  name,
  center,
  width,
  depth,
  topColor,
  dioramaTheme,
}: {
  name: string;
  center: [number, number];
  width: number;
  depth: number;
  topColor: string;
  dioramaTheme: OfficeDioramaTheme;
}): JSX.Element {
  return (
    <group name={name} position={[center[0], 0, center[1]]}>
      <RoundedBox
        args={[width, ISLAND_EDGE_HEIGHT, depth]}
        position={[0, ISLAND_EDGE_CENTER_Y, 0]}
        radius={0.08}
        smoothness={3}
      >
        <meshStandardMaterial color={dioramaTheme.islandEdge} roughness={0.96} />
      </RoundedBox>
      <RoundedBox
        args={[width - 0.1, ISLAND_TOP_HEIGHT, depth - 0.1]}
        position={[0, ISLAND_TOP_CENTER_Y, 0]}
        radius={0.03}
        smoothness={2}
        receiveShadow
      >
        <meshStandardMaterial color={topColor} roughness={0.98} />
      </RoundedBox>
    </group>
  );
}

function CouncilHub({
  radius,
  dioramaTheme,
}: {
  radius: number;
  dioramaTheme: OfficeDioramaTheme;
}): JSX.Element {
  const edgeRadius = radius + 1.12;
  return (
    <group name="project-council-hub">
      <mesh position={[0, ISLAND_EDGE_CENTER_Y, 0]} receiveShadow>
        <cylinderGeometry args={[edgeRadius, edgeRadius, ISLAND_EDGE_HEIGHT, 56]} />
        <meshStandardMaterial color={dioramaTheme.islandEdge} roughness={0.96} />
      </mesh>
      <mesh position={[0, ISLAND_TOP_CENTER_Y, 0]} receiveShadow>
        <cylinderGeometry args={[edgeRadius - 0.1, edgeRadius - 0.1, ISLAND_TOP_HEIGHT, 56]} />
        <meshStandardMaterial color={dioramaTheme.nexusTop} roughness={0.98} />
      </mesh>
    </group>
  );
}

export function DepartmentIslandLayer({
  enabled,
  councilLayout,
  dioramaTheme,
}: {
  enabled: boolean;
  councilLayout?: ProjectCouncilLayout;
  dioramaTheme: OfficeDioramaTheme;
}): JSX.Element | null {
  if (!enabled) return null;
  const islands = getDepartmentIslandGeometry();
  const bridges = getDepartmentIslandBridgePlan();

  return (
    <group name="department-archipelago">
      <NexusConnectionArcs color={dioramaTheme.nexusVortex.cool} />
      <ContactShadows
        position={[0, ISLAND_BASE_Y - 0.02, 0]}
        opacity={0.24}
        scale={[54, 42]}
        blur={2.8}
        far={24}
        resolution={256}
        color={dioramaTheme.shadow}
        frames={1}
      />
      <CouncilHub radius={councilLayout?.council.radius ?? 5.8} dioramaTheme={dioramaTheme} />
      {islands.map((island) => (
        <Platform
          key={island.id}
          name={`department-island-${island.id}`}
          center={island.center}
          width={island.width}
          depth={island.depth}
          topColor={dioramaTheme.islandTop}
          dioramaTheme={dioramaTheme}
        />
      ))}
      {bridges.map((bridge) => {
        const width = bridge.maxX - bridge.minX + 1;
        const depth = bridge.maxZ - bridge.minZ + 1;
        return (
          <RoundedBox
            key={bridge.id}
            name={`department-bridge-${bridge.id}`}
            args={[width, BRIDGE_HEIGHT, depth]}
            position={[
              (bridge.minX + bridge.maxX) / 2,
              BRIDGE_CENTER_Y,
              (bridge.minZ + bridge.maxZ) / 2,
            ]}
            radius={0.03}
            smoothness={2}
            receiveShadow
          >
            <meshStandardMaterial color={dioramaTheme.bridge} roughness={0.98} />
          </RoundedBox>
        );
      })}
    </group>
  );
}
