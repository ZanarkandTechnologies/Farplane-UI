/** Fixed visual stations for artifact specialists; they are services, never persistent employees. */

import { Html } from "@react-three/drei";
import type React from "react";
import { OFFICE_HTML_Z } from "@/lib/z-index";
import { getOfficeCapabilityDepartmentForSpecialist } from "../lib/office-capability-projection";
import type { ProjectCouncilLayout } from "../lib/project-council-layout";

const DEPARTMENT_COLORS = {
  intelligence: "#a59664",
  operations: "#798e77",
  production: "#a87869",
  assurance: "#72889a",
} as const;

function conciseLabel(displayName: string): string {
  return displayName.replace(/ Specialist$/, "");
}

function SpecialistStation({
  station,
}: {
  station: ProjectCouncilLayout["specialistStations"][number];
}): React.JSX.Element {
  const capability = getOfficeCapabilityDepartmentForSpecialist(station.specialistId);
  const color = capability?.accentColor ?? DEPARTMENT_COLORS[station.departmentId];
  return (
    <group
      name={`specialist-station-${station.specialistId}`}
      position={station.position}
      rotation={[0, station.rotationY, 0]}
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
          emissiveIntensity={0.08}
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
}: {
  layout: ProjectCouncilLayout;
}): React.JSX.Element {
  return (
    <group name="specialist-studio-stations">
      {layout.specialistStations.map((station) => (
        <SpecialistStation key={station.specialistId} station={station} />
      ))}
    </group>
  );
}
