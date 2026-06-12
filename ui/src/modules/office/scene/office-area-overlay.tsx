/**
 * OFFICE AREA OVERLAY
 * ===================
 * Presentation layer for hierarchy-derived office districts.
 */

import { Text } from "@react-three/drei";
import type React from "react";
import type { OfficeAreaNode } from "@/modules/office/lib/office-area-layout";

function areaOpacity(depth: number, sceneBuilderMode: boolean): number {
  if (sceneBuilderMode) return depth <= 1 ? 0.2 : 0.13;
  if (depth <= 1) return 0.16;
  return 0.1;
}

function shouldShowAreaLabel(area: OfficeAreaNode): boolean {
  return area.depth <= 2 || Boolean(area.projectId);
}

function AreaBoundary({ area }: { area: OfficeAreaNode }) {
  const { rect } = area;
  const y = 0.035;
  const height = 0.08;
  const thickness = area.depth <= 1 ? 0.08 : 0.045;
  const color = area.color;
  return (
    <group name={`office-area-boundary-${area.id}`}>
      <mesh position={[rect.centerX, y, rect.minZ]}>
        <boxGeometry args={[rect.width, height, thickness]} />
        <meshBasicMaterial color={color} transparent opacity={0.52} depthWrite={false} />
      </mesh>
      <mesh position={[rect.centerX, y, rect.maxZ]}>
        <boxGeometry args={[rect.width, height, thickness]} />
        <meshBasicMaterial color={color} transparent opacity={0.52} depthWrite={false} />
      </mesh>
      <mesh position={[rect.minX, y, rect.centerZ]}>
        <boxGeometry args={[thickness, height, rect.depth]} />
        <meshBasicMaterial color={color} transparent opacity={0.52} depthWrite={false} />
      </mesh>
      <mesh position={[rect.maxX, y, rect.centerZ]}>
        <boxGeometry args={[thickness, height, rect.depth]} />
        <meshBasicMaterial color={color} transparent opacity={0.52} depthWrite={false} />
      </mesh>
    </group>
  );
}

function AreaLabel({ area }: { area: OfficeAreaNode }) {
  const { rect } = area;
  const fontSize = area.depth <= 1 ? 0.54 : area.projectId ? 0.34 : 0.28;
  const labelY = area.depth <= 1 ? 0.08 : 0.07;
  return (
    <group
      name={`office-area-label-${area.id}`}
      position={[rect.minX + 0.45, labelY, rect.minZ + 0.55]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <Text
        anchorX="left"
        anchorY="middle"
        color={area.depth <= 1 ? "#111827" : "#1f2937"}
        fontSize={fontSize}
        maxWidth={Math.max(2.8, rect.width - 0.9)}
        outlineWidth={0.012}
        outlineColor="#f8fafc"
      >
        {area.label}
      </Text>
    </group>
  );
}

export function OfficeAreaOverlay({
  officeAreas,
  sceneBuilderMode,
}: {
  officeAreas: OfficeAreaNode[];
  sceneBuilderMode: boolean;
}): React.JSX.Element | null {
  if (officeAreas.length === 0) return null;
  const visibleAreas = officeAreas.filter((area) => area.depth <= 2 || area.projectId);
  return (
    <group name="office-area-overlay">
      {visibleAreas.map((area) => (
        <group key={area.id} name={`office-area-${area.id}`}>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[area.rect.centerX, 0.012 + area.depth * 0.002, area.rect.centerZ]}
            receiveShadow={false}
          >
            <planeGeometry args={[Math.max(0.01, area.rect.width), Math.max(0.01, area.rect.depth)]} />
            <meshBasicMaterial
              color={area.color}
              transparent
              opacity={areaOpacity(area.depth, sceneBuilderMode)}
              depthWrite={false}
            />
          </mesh>
          <AreaBoundary area={area} />
          {shouldShowAreaLabel(area) ? <AreaLabel area={area} /> : null}
        </group>
      ))}
    </group>
  );
}
