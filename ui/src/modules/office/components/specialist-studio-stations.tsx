/** Fixed interactive stations for artifact specialists; they are services, never persistent employees. */

import { Html } from "@react-three/drei";
import { type ReactElement, useState } from "react";
import { OFFICE_HTML_Z } from "@/lib/z-index";
import { getOfficeCapabilityDepartmentForSpecialist } from "../lib/office-capability-projection";
import type { ProjectCouncilLayout } from "../lib/project-council-layout";

const DEPARTMENT_COLORS = {
  "back-office": "#a8ad76",
  sales: "#bf8aa8",
  deals: "#c9826b",
  marketing: "#c8ad72",
  operations: "#9b8bc5",
  intelligence: "#7fa9c0",
  customer: "#79b8a2",
} as const;

function conciseLabel(displayName: string): string {
  return displayName.replace(/ Specialist$/, "");
}

function SpecialistStation({
  station,
  onActivate,
}: {
  station: ProjectCouncilLayout["specialistStations"][number];
  onActivate?: (specialistId: string) => void;
}): ReactElement {
  const [isHovered, setIsHovered] = useState(false);
  const capability = getOfficeCapabilityDepartmentForSpecialist(station.specialistId);
  const color = capability?.accentColor ?? DEPARTMENT_COLORS[station.departmentId];
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: This R3F group is the facility's canvas hit target; the dialog supplies the accessible form controls.
    <group
      name={`specialist-station-${station.specialistId}`}
      position={station.position}
      rotation={[0, station.rotationY, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onActivate?.(station.specialistId);
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        onActivate?.(station.specialistId);
      }}
      onPointerOut={() => setIsHovered(false)}
      onPointerOver={(event) => {
        event.stopPropagation();
        setIsHovered(true);
      }}
    >
      <mesh position={[0, 0.045, 0]} receiveShadow>
        <cylinderGeometry args={[0.4, 0.46, 0.09, 18]} />
        <meshStandardMaterial color="#858278" roughness={0.86} />
      </mesh>
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <cylinderGeometry args={[0.34, 0.39, 0.035, 18]} />
        <meshStandardMaterial
          color={color}
          roughness={0.82}
          emissive={color}
          emissiveIntensity={isHovered ? 0.24 : 0.08}
        />
      </mesh>
      <mesh position={[0, 0.35, -0.09]} castShadow>
        <boxGeometry args={[0.38, 0.3, 0.045]} />
        <meshStandardMaterial
          color="#29484a"
          emissive="#315f5c"
          emissiveIntensity={0.28}
          roughness={0.42}
        />
      </mesh>
      <mesh position={[0, 0.17, 0.02]} castShadow>
        <boxGeometry args={[0.1, 0.16, 0.1]} />
        <meshStandardMaterial color="#4c4b45" roughness={0.64} />
      </mesh>
      <mesh position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.56, 0.56, 0.6, 18]} />
        <meshBasicMaterial depthWrite={false} transparent opacity={0} />
      </mesh>
      <Html
        center
        distanceFactor={7.8}
        position={[0, 0.72, 0]}
        sprite
        transform
        zIndexRange={OFFICE_HTML_Z.label}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <span className="block max-w-[88px] rounded-full border border-stone-300/75 bg-stone-50/88 px-1.5 py-0.5 text-center shadow-[0_3px_10px_rgba(74,67,55,0.16)]">
          {capability ? (
            <span className="block truncate text-[6px] font-bold uppercase leading-[1.05] tracking-[0.1em] text-stone-400">
              {capability.displayName}
            </span>
          ) : null}
          <span className="block truncate text-[7px] font-semibold uppercase leading-[1.1] tracking-[0.04em] text-stone-600">
            {conciseLabel(station.displayName)}
          </span>
        </span>
      </Html>
    </group>
  );
}

export function SpecialistStudioStations({
  layout,
  onActivate,
}: {
  layout: ProjectCouncilLayout;
  onActivate?: (specialistId: string) => void;
}): ReactElement {
  return (
    <group name="specialist-studio-stations">
      {layout.specialistStations.map((station) => (
        <SpecialistStation key={station.specialistId} station={station} onActivate={onActivate} />
      ))}
    </group>
  );
}
