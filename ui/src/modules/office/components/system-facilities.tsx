/** Permanent non-chat integration facilities for the department archipelago. */

import { Html } from "@react-three/drei";
import { type ReactElement, useState } from "react";
import { OFFICE_HTML_Z } from "@/lib/z-index";
import type { ProjectCouncilLayout } from "../lib/project-council-layout";

function SystemFacility({
  facility,
  onActivate,
}: {
  facility: ProjectCouncilLayout["systemFacilities"][number];
  onActivate?: (facilityId: string) => void;
}): ReactElement {
  const [hovered, setHovered] = useState(false);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: This R3F group is the facility's canvas hit target; its dialog supplies the accessible details.
    <group
      name={`system-facility-${facility.facilityId}`}
      position={facility.position}
      rotation={[0, facility.rotationY, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onActivate?.(facility.facilityId);
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        onActivate?.(facility.facilityId);
      }}
      onPointerOut={() => setHovered(false)}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
    >
      <mesh position={[0, 0.13, 0]} receiveShadow>
        <cylinderGeometry args={[0.48, 0.56, 0.24, 6]} />
        <meshStandardMaterial color="#30353a" roughness={0.68} />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.19, 0.58, 6]} />
        <meshStandardMaterial
          color="#71a8d7"
          emissive="#71a8d7"
          emissiveIntensity={hovered ? 0.78 : 0.38}
          roughness={0.36}
        />
      </mesh>
      {[0.34, 0.58].map((height) => (
        <mesh key={height} position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.27, 0.018, 6, 24]} />
          <meshBasicMaterial color="#a7d4f6" transparent opacity={hovered ? 0.88 : 0.5} />
        </mesh>
      ))}
      <mesh position={[0, 0.58, 0]}>
        <cylinderGeometry args={[0.58, 0.58, 0.9, 18]} />
        <meshBasicMaterial depthWrite={false} transparent opacity={0} />
      </mesh>
      <Html
        center
        distanceFactor={7.8}
        position={[0, 0.95, 0]}
        sprite
        transform
        zIndexRange={OFFICE_HTML_Z.label}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <span className="block max-w-[88px] rounded-full border border-sky-200/70 bg-stone-50/90 px-1.5 py-0.5 text-center shadow-[0_3px_10px_rgba(74,67,55,0.16)]">
          <span className="block truncate text-[6px] font-bold uppercase leading-[1.05] tracking-[0.1em] text-sky-500">
            System facility
          </span>
          <span className="block truncate text-[7px] font-semibold uppercase leading-[1.1] tracking-[0.04em] text-stone-600">
            {facility.displayName}
          </span>
        </span>
      </Html>
    </group>
  );
}

export function SystemFacilities({
  layout,
  onActivate,
}: {
  layout: ProjectCouncilLayout;
  onActivate?: (facilityId: string) => void;
}): ReactElement {
  return (
    <group name="system-facilities">
      {layout.systemFacilities.map((facility) => (
        <SystemFacility key={facility.facilityId} facility={facility} onActivate={onActivate} />
      ))}
    </group>
  );
}
