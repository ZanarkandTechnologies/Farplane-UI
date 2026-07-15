"use client";

/** Authored prop clusters for each semantic activity landmark kind. */

import { Box, Cylinder, Sphere } from "@react-three/drei";
import { OFFICE_LANDMARK_THEME } from "@/config/office-theme";
import type { ActivityLandmarkKind } from "../activity-scenes";
import {
  CommsHubLandmark,
  OrganizationHallLandmark,
  ResourceArchiveLandmark,
  SkillLabLandmark,
  TelemetryConsoleLandmark,
  ThreadDataLabLandmark,
  WorldOrbLandmark,
} from "./activity-landmark-destinations";

const M = OFFICE_LANDMARK_THEME.materials;
const R = OFFICE_LANDMARK_THEME.roles;

function material(color: string, emissive?: string) {
  return (
    <meshStandardMaterial
      color={color}
      emissive={emissive ?? "#000000"}
      emissiveIntensity={emissive ? 0.25 : 0}
    />
  );
}

function GymLandmark() {
  return (
    <group>
      <Box args={[1.7, 0.16, 0.62]} position={[0.35, 0.48, 0.25]} castShadow>
        {material(M.walnut)}
      </Box>
      {[-0.45, 1.15].map((x) => (
        <Cylinder key={x} args={[0.07, 0.07, 0.86, 10]} position={[x, 0.43, 0.25]}>
          {material(M.darkMetal)}
        </Cylinder>
      ))}
      {[-1.65, -0.95].map((x) => (
        <group key={x} position={[x, 0.23, -0.7]} rotation={[0, 0, Math.PI / 2]}>
          <Cylinder args={[0.08, 0.08, 0.6, 10]}>{material(M.lightMetal)}</Cylinder>
          {[-0.35, 0.35].map((y) => (
            <Cylinder key={y} args={[0.25, 0.25, 0.16, 12]} position={[0, y, 0]}>
              {material(R.creative)}
            </Cylinder>
          ))}
        </group>
      ))}
      {[-1.7, 1.7].map((x) => (
        <Box key={x} args={[0.12, 2.25, 0.12]} position={[x, 1.12, -1.15]} castShadow>
          {material(M.lightMetal)}
        </Box>
      ))}
      <Box args={[3.5, 0.12, 0.12]} position={[0, 2.18, -1.15]} castShadow>
        {material(M.lightMetal)}
      </Box>
      <Box args={[1.15, 0.04, 2.3]} position={[1.35, 0.08, 0.45]}>
        {material(R.creative)}
      </Box>
    </group>
  );
}

function LibraryLandmark() {
  const books = [R.knowledge, R.coordination, M.warmPaper, R.communication, R.creative];
  return (
    <group>
      <Box args={[3.6, 2.5, 0.25]} position={[0, 1.25, -1.25]} castShadow>
        {material(M.darkWalnut)}
      </Box>
      {[0.45, 1.15, 1.85].map((y) => (
        <Box key={y} args={[3.5, 0.09, 0.55]} position={[0, y, -1.05]}>
          {material(M.walnut)}
        </Box>
      ))}
      {[0, 1, 2].flatMap((row) =>
        books.map((color, index) => (
          <Box
            key={`${row}-${color}`}
            args={[0.34, 0.46, 0.18]}
            position={[-1.2 + index * 0.6, 0.7 + row * 0.7, -0.88]}
          >
            {material(color)}
          </Box>
        )),
      )}
      <Cylinder args={[0.8, 0.8, 0.12, 20]} position={[0, 0.72, 0.45]}>
        {material(R.knowledge)}
      </Cylinder>
      <Cylinder args={[0.09, 0.12, 0.68, 12]} position={[0, 0.36, 0.45]}>
        {material(M.darkWalnut)}
      </Cylinder>
      <Box args={[0.75, 0.06, 0.55]} position={[0, 0.83, 0.45]} rotation={[0, 0.2, 0]}>
        {material(M.warmPaper)}
      </Box>
    </group>
  );
}

function StudioLandmark() {
  return (
    <group>
      <Box args={[2.8, 2.35, 0.12]} position={[0.65, 1.18, -1.25]}>
        {material(M.warmPaper)}
      </Box>
      <Cylinder args={[0.13, 0.2, 1.25, 12]} position={[-1.25, 0.63, 0.65]}>
        {material(M.darkMetal)}
      </Cylinder>
      <Box args={[0.6, 0.45, 0.75]} position={[-1.25, 1.35, 0.65]} castShadow>
        {material(M.darkMetal)}
      </Box>
      <Cylinder
        args={[0.2, 0.26, 0.32, 16]}
        position={[-1.25, 1.35, 0.18]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        {material(M.inactiveScreen)}
      </Cylinder>
      {[-1.55, 1.55].map((x) => (
        <group key={x} position={[x, 1.45, -0.25]} rotation={[0, 0, x < 0 ? -0.3 : 0.3]}>
          <Cylinder args={[0.04, 0.04, 1.7, 8]}>{material(M.darkMetal)}</Cylinder>
          <Sphere args={[0.35, 12, 8]} position={[0, 0.9, 0]}>
            {material(M.warmPaper)}
          </Sphere>
        </group>
      ))}
      <Box args={[1.15, 0.12, 0.72]} position={[0.7, 0.72, 0.4]}>
        {material(R.creative)}
      </Box>
    </group>
  );
}

function PlanningLandmark() {
  return (
    <group>
      <Cylinder args={[1.35, 1.35, 0.16, 24]} position={[0, 0.86, 0]}>
        {material(M.walnut)}
      </Cylinder>
      <Cylinder args={[0.16, 0.23, 0.78, 12]} position={[0, 0.43, 0]}>
        {material(M.darkMetal)}
      </Cylinder>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2;
        return (
          <Box
            key={i}
            args={[0.46, 0.04, 0.32]}
            position={[Math.cos(angle) * 0.82, 0.96, Math.sin(angle) * 0.82]}
            rotation={[0, -angle, 0]}
          >
            {material(i % 2 ? R.knowledge : M.warmPaper)}
          </Box>
        );
      })}
      <Box args={[2.5, 1.65, 0.1]} position={[0, 1.25, -1.42]}>
        {material(M.warmPaper)}
      </Box>
      {[R.creative, R.coordination, R.communication].map((color, i) => (
        <Box
          key={color}
          args={[0.52, 0.34, 0.03]}
          position={[-0.72 + i * 0.72, 1.35 + (i % 2) * 0.42, -1.34]}
        >
          {material(color)}
        </Box>
      ))}
    </group>
  );
}

function QaArcadeLandmark() {
  return (
    <group>
      {[-1.05, 1.05].map((x, i) => (
        <group key={x} position={[x, 0, -0.35]}>
          <Box args={[1.15, 1.8, 0.75]} position={[0, 0.9, 0]} castShadow>
            {material(i ? M.darkMetal : M.upholstery)}
          </Box>
          <Box args={[0.82, 0.58, 0.04]} position={[0, 1.25, 0.39]}>
            {material(M.inactiveScreen)}
          </Box>
          <Box args={[0.9, 0.12, 0.45]} position={[0, 0.72, 0.42]} rotation={[-0.25, 0, 0]}>
            {material(M.darkMetal)}
          </Box>
          <Sphere args={[0.08, 10, 8]} position={[-0.2, 0.83, 0.63]}>
            {material(R.systems)}
          </Sphere>
          <Cylinder args={[0.04, 0.04, 0.22, 8]} position={[-0.2, 0.73, 0.58]}>
            {material(M.lightMetal)}
          </Cylinder>
        </group>
      ))}
      <Box args={[2.8, 0.18, 0.25]} position={[0, 2.12, -0.35]}>
        {material(M.darkMetal)}
      </Box>
    </group>
  );
}

function WorkshopLandmark() {
  return (
    <group>
      <Box args={[3.4, 0.18, 1.05]} position={[0, 0.92, 0]} castShadow>
        {material(M.walnut)}
      </Box>
      {[-1.45, 1.45].map((x) => (
        <Box key={x} args={[0.15, 0.86, 0.15]} position={[x, 0.45, 0]}>
          {material(M.darkMetal)}
        </Box>
      ))}
      <Box args={[3.5, 1.55, 0.12]} position={[0, 1.25, -1.35]}>
        {material(M.stone)}
      </Box>
      {[0, 1, 2, 3].map((i) => (
        <Cylinder
          key={i}
          args={[0.08, 0.08, 0.58, 8]}
          position={[-1.1 + i * 0.72, 1.45, -1.22]}
          rotation={[0, 0, i % 2 ? 0.55 : -0.35]}
        >
          {material(i % 2 ? R.creative : M.lightMetal)}
        </Cylinder>
      ))}
      <Box args={[0.85, 0.62, 0.65]} position={[-0.78, 1.33, 0]}>
        {material(M.inactiveScreen)}
      </Box>
      <Cylinder
        args={[0.34, 0.34, 0.24, 16]}
        position={[0.75, 1.16, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        {material(M.lightMetal)}
      </Cylinder>
    </group>
  );
}

export function ActivityLandmarkAuthoredVisual({ kind }: { kind: ActivityLandmarkKind }) {
  switch (kind) {
    case "library":
      return <LibraryLandmark />;
    case "studio":
      return <StudioLandmark />;
    case "planning":
      return <PlanningLandmark />;
    case "qa-arcade":
      return <QaArcadeLandmark />;
    case "workshop":
      return <WorkshopLandmark />;
    case "skill-lab":
      return <SkillLabLandmark />;
    case "organization-hall":
      return <OrganizationHallLandmark />;
    case "resource-archive":
      return <ResourceArchiveLandmark />;
    case "comms-hub":
      return <CommsHubLandmark />;
    case "telemetry-console":
      return <TelemetryConsoleLandmark />;
    case "thread-data-lab":
      return <ThreadDataLabLandmark />;
    case "world-orb":
      return <WorldOrbLandmark />;
    default:
      return <GymLandmark />;
  }
}
