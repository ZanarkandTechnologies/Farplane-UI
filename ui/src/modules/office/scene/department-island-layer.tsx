/**
 * DEPARTMENT ISLAND LAYER
 * =======================
 * Renders the presentation-only raised slabs for the automatic hosted-room
 * archipelago. Navigation and collisions remain owned by the shared office
 * tile mask; this layer derives from the same pure layout module and writes no
 * state.
 */

import { ContactShadows, Html, RoundedBox } from "@react-three/drei";
import type { OfficeDioramaTheme } from "@/config/office-theme";
import { OFFICE_HTML_Z } from "@/lib/z-index";
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
// Bridges intentionally sit just under the deck tops. Their tile footprints
// overlap both endpoint slabs, so sharing the exact y=0 surface causes depth
// fighting while the camera moves.
const BRIDGE_SURFACE_DROP = 0.024;
const BRIDGE_CENTER_Y = -(BRIDGE_HEIGHT / 2 + BRIDGE_SURFACE_DROP);

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

function CapabilityIslandMarker({
  label,
  entryLabel,
  accentColor,
  hasRoom,
}: {
  label: string;
  entryLabel?: string;
  accentColor: string;
  hasRoom: boolean;
}): JSX.Element {
  return (
    <group name={`capability-marker-${label.toLowerCase().replaceAll(" ", "-")}`}>
      {!hasRoom ? (
        <group name="capability-entry-dial" position={[0, 0.08, 0]}>
          <mesh receiveShadow>
            <cylinderGeometry args={[1.05, 1.14, 0.11, 28]} />
            <meshStandardMaterial color="#6f6b62" roughness={0.88} />
          </mesh>
          <mesh position={[0, 0.07, 0]} receiveShadow>
            <cylinderGeometry args={[0.84, 0.93, 0.045, 28]} />
            <meshStandardMaterial
              color={accentColor}
              emissive={accentColor}
              emissiveIntensity={0.06}
              roughness={0.84}
            />
          </mesh>
          <mesh position={[0, 0.16, -0.32]} castShadow>
            <boxGeometry args={[0.58, 0.38, 0.07]} />
            <meshStandardMaterial color="#344746" roughness={0.52} />
          </mesh>
        </group>
      ) : null}
      <DepartmentLabel
        name={`department-label-${label.toLowerCase().replaceAll(" ", "-")}`}
        label={label}
        subtitle={entryLabel}
        accentColor={accentColor}
        height={hasRoom ? 3.15 : 1.42}
      />
    </group>
  );
}

function DepartmentLabel({
  name,
  label,
  subtitle,
  accentColor,
  height,
}: {
  name: string;
  label: string;
  subtitle?: string;
  accentColor: string;
  height: number;
}): JSX.Element {
  return (
    <group name={name} position={[0, height, 0]}>
      <Html
        center
        transform
        sprite
        distanceFactor={10.5}
        zIndexRange={OFFICE_HTML_Z.label}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div className="w-[154px] text-center leading-none [text-shadow:0_1px_4px_rgb(0_0_0_/_0.9)]">
          <span className="block whitespace-nowrap text-[10px] font-black uppercase tracking-[0.2em] text-stone-100">
            {label}
          </span>
          <span className="mx-auto mt-1 block h-px w-14" style={{ backgroundColor: accentColor }} />
          {subtitle ? (
            <span className="mt-1 block whitespace-nowrap text-[6px] font-bold uppercase tracking-[0.12em] text-stone-300/85">
              {subtitle}
            </span>
          ) : null}
        </div>
      </Html>
    </group>
  );
}

function CompanyNexusLabel({ dioramaTheme }: { dioramaTheme: OfficeDioramaTheme }): JSX.Element {
  return (
    <group name="company-nexus-label" position={[0, 5.05, 0]}>
      <Html
        center
        transform
        sprite
        distanceFactor={10.5}
        zIndexRange={OFFICE_HTML_Z.label}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div className="w-[164px] text-center leading-none [text-shadow:0_1px_4px_rgb(0_0_0_/_0.9)]">
          <span className="block whitespace-nowrap text-[10px] font-black uppercase tracking-[0.2em] text-stone-100">
            Company Nexus
          </span>
          <span
            className="mx-auto mt-1 block h-px w-20"
            style={{ backgroundColor: dioramaTheme.nexusVortex.cool }}
          />
        </div>
      </Html>
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
      <CompanyNexusLabel dioramaTheme={dioramaTheme} />
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
        <group key={island.id} name={`department-island-${island.id}`}>
          <Platform
            name={`department-island-platform-${island.id}`}
            center={island.center}
            width={island.width}
            depth={island.depth}
            topColor={dioramaTheme.islandTop}
            dioramaTheme={dioramaTheme}
          />
          <group position={[island.center[0], 0, island.center[1]]}>
            <CapabilityIslandMarker
              label={island.label}
              entryLabel={island.entryLabel}
              accentColor={island.accentColor}
              hasRoom={island.roomIds.length > 0}
            />
          </group>
        </group>
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
