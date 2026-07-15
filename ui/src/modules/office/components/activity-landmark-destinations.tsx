/**
 * DESTINATION ACTIVITY LANDMARKS
 * =================================
 * Owns the low-poly panel-destination prop clusters. Inputs are visual kind selection
 * from the parent renderer; output is scene geometry with no state or side effects.
 */

import { Box, Cylinder, Sphere } from "@react-three/drei";
import { OFFICE_LANDMARK_THEME } from "@/config/office-theme";

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

export function WorldOrbLandmark() {
  return (
    <group>
      <Cylinder args={[1.15, 1.45, 0.22, 24]} position={[0, 0.2, 0]} castShadow>
        {material(M.darkMetal)}
      </Cylinder>
      <Cylinder args={[0.11, 0.18, 0.72, 12]} position={[0, 0.62, 0]}>
        {material(M.lightMetal)}
      </Cylinder>
      <Sphere args={[0.86, 20, 14]} position={[0, 1.35, 0]} castShadow>
        <meshStandardMaterial
          color={R.communication}
          emissive="#000000"
          emissiveIntensity={0}
          roughness={0.5}
          metalness={0.15}
        />
      </Sphere>
      <mesh position={[0, 1.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.9, 0.035, 8, 32]} />
        <meshStandardMaterial color={M.lightMetal} />
      </mesh>
      <mesh position={[0, 1.35, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.9, 0.028, 8, 32]} />
        <meshStandardMaterial color={M.warmPaper} />
      </mesh>
      <mesh position={[0, 1.35, 0]} rotation={[0.55, 0.18, -0.34]}>
        <torusGeometry args={[1.18, 0.045, 8, 36]} />
        <meshStandardMaterial color={R.knowledge} />
      </mesh>
      <Sphere args={[0.13, 10, 8]} position={[1.02, 1.74, 0.38]}>
        {material(M.warmPaper)}
      </Sphere>
    </group>
  );
}

export function SkillLabLandmark() {
  return (
    <group>
      <Cylinder args={[0.92, 0.92, 0.16, 20]} position={[0, 0.34, 0]}>
        {material(M.darkMetal)}
      </Cylinder>
      <Sphere args={[0.48, 16, 10]} position={[0, 1.12, 0]}>
        {material(R.coordination)}
      </Sphere>
      <Cylinder args={[0.06, 0.06, 0.72, 8]} position={[0, 0.7, 0]}>
        {material(M.lightMetal)}
      </Cylinder>
      {[-1.38, 1.38].map((x, index) => (
        <group key={x} position={[x, 0, -0.45]} rotation={[0, index ? -0.22 : 0.22, 0]}>
          <Box args={[0.88, 1.35, 0.55]} position={[0, 0.68, 0]} castShadow>
            {material(M.darkMetal)}
          </Box>
          <Box args={[0.65, 0.52, 0.04]} position={[0, 0.92, 0.3]}>
            {material(M.inactiveScreen)}
          </Box>
          <Sphere args={[0.09, 10, 8]} position={[0, 0.42, 0.31]}>
            {material(index ? R.coordination : M.warmPaper)}
          </Sphere>
        </group>
      ))}
      <Box args={[2.75, 0.12, 0.12]} position={[0, 2.15, -1.18]}>
        {material(M.darkMetal)}
      </Box>
    </group>
  );
}

export function OrganizationHallLandmark() {
  return (
    <group>
      {[-1.55, 1.55].map((x) => (
        <group key={x} position={[x, 0, -1.02]}>
          <Cylinder args={[0.22, 0.27, 1.9, 12]} position={[0, 1.03, 0]} castShadow>
            {material(M.warmPaper)}
          </Cylinder>
          <Cylinder args={[0.34, 0.34, 0.14, 12]} position={[0, 0.14, 0]}>
            {material(M.stone)}
          </Cylinder>
        </group>
      ))}
      <Box args={[3.65, 0.22, 0.48]} position={[0, 2.14, -1.02]} castShadow>
        {material(M.walnut)}
      </Box>
      <Box args={[2.5, 1.42, 0.1]} position={[0, 1.12, -1.3]}>
        {material(M.warmPaper)}
      </Box>
      {[
        [-0.72, 1.42],
        [0, 1.78],
        [0.72, 1.42],
        [-0.72, 0.82],
        [0.72, 0.82],
      ].map(([x, y], index) => (
        <Box key={`${x}-${y}`} args={[0.42, 0.25, 0.04]} position={[x, y, -1.23]}>
          {material(index === 1 ? R.knowledge : R.coordination)}
        </Box>
      ))}
      <Cylinder args={[0.72, 0.72, 0.12, 18]} position={[0, 0.65, 0.48]}>
        {material(R.coordination)}
      </Cylinder>
      <Cylinder args={[0.1, 0.14, 0.58, 10]} position={[0, 0.34, 0.48]}>
        {material(M.darkWalnut)}
      </Cylinder>
    </group>
  );
}

export function ResourceArchiveLandmark() {
  const cratePositions: Array<[number, number, number]> = [
    [-1.15, 0.35, 0.62],
    [-0.45, 0.35, 0.62],
    [-0.82, 1.02, 0.62],
  ];
  return (
    <group>
      <Box args={[2.1, 2.25, 0.52]} position={[0.78, 1.13, -1.08]} castShadow>
        {material(M.darkMetal)}
      </Box>
      {[0.48, 1.1, 1.72].map((y) => (
        <Box key={y} args={[1.95, 0.1, 0.72]} position={[0.78, y, -0.82]}>
          {material(M.walnut)}
        </Box>
      ))}
      {[0, 1, 2].flatMap((row) =>
        [0, 1, 2].map((column) => (
          <Box
            key={`${row}-${column}`}
            args={[0.42, 0.38, 0.38]}
            position={[0.2 + column * 0.58, 0.73 + row * 0.62, -0.79]}
          >
            {material((row + column) % 2 ? R.knowledge : M.warmPaper)}
          </Box>
        )),
      )}
      {cratePositions.map(([x, y, z], index) => (
        <Box key={`${x}-${y}`} args={[0.62, 0.62, 0.62]} position={[x, y, z]} castShadow>
          {material(index === 2 ? R.knowledge : M.darkWalnut)}
        </Box>
      ))}
    </group>
  );
}

export function CommsHubLandmark() {
  return (
    <group>
      <Cylinder args={[0.48, 0.65, 0.18, 16]} position={[0, 0.18, -0.52]}>
        {material(M.darkMetal)}
      </Cylinder>
      <Cylinder args={[0.06, 0.1, 1.72, 10]} position={[0, 1.08, -0.52]}>
        {material(M.lightMetal)}
      </Cylinder>
      {[0.55, 1.05, 1.55].map((y, index) => (
        <Cylinder
          key={y}
          args={[0.06, 0.06, 1.25 - index * 0.22, 8]}
          position={[0, y, -0.52]}
          rotation={[0, 0, Math.PI / 2]}
        >
          {material(R.communication)}
        </Cylinder>
      ))}
      <Sphere args={[0.16, 12, 8]} position={[0, 2.02, -0.52]}>
        {material(M.warmPaper)}
      </Sphere>
      {[-0.88, 0.88].map((x) => (
        <group key={x} position={[x, 0, 0.45]} rotation={[0, x < 0 ? 0.18 : -0.18, 0]}>
          <Box args={[0.72, 0.72, 0.68]} position={[0, 0.47, 0]} castShadow>
            {material(M.darkMetal)}
          </Box>
          <Box args={[0.52, 0.35, 0.04]} position={[0, 0.58, 0.36]}>
            {material(M.inactiveScreen)}
          </Box>
        </group>
      ))}
    </group>
  );
}

export function TelemetryConsoleLandmark() {
  return (
    <group>
      <Box args={[2.6, 1.65, 0.28]} position={[0, 1.18, -0.92]} castShadow>
        {material(M.darkMetal)}
      </Box>
      {[-0.8, 0, 0.8].map((x, index) => (
        <group key={x} position={[x, 1.25, -0.75]}>
          <Box args={[0.65, 0.92, 0.04]}>{material(M.inactiveScreen)}</Box>
          {[0, 1, 2].map((row) => (
            <Box
              key={row}
              args={[0.5 - row * 0.08, 0.055, 0.02]}
              position={[-0.06 + row * 0.05, 0.25 - row * 0.22, 0.04]}
            >
              {material(index === 1 ? R.knowledge : R.systems)}
            </Box>
          ))}
        </group>
      ))}
      <Box args={[2.7, 0.18, 0.72]} position={[0, 0.67, 0.15]} castShadow>
        {material(M.darkMetal)}
      </Box>
      {[-1.02, -0.34, 0.34, 1.02].map((x, index) => (
        <Sphere key={x} args={[0.09, 10, 8]} position={[x, 0.8, 0.52]}>
          {material(index % 2 ? R.knowledge : R.systems)}
        </Sphere>
      ))}
    </group>
  );
}

export function ThreadDataLabLandmark() {
  const nodes: Array<[number, number, number]> = [
    [-1, 1.62, -0.55],
    [0, 2.12, -0.62],
    [1, 1.62, -0.55],
    [-0.55, 0.92, -0.45],
    [0.55, 0.92, -0.45],
  ];
  return (
    <group>
      <Box args={[2.65, 0.16, 0.9]} position={[0, 0.78, 0.25]} castShadow>
        {material(M.darkMetal)}
      </Box>
      {[-1.05, 1.05].map((x) => (
        <Cylinder key={x} args={[0.1, 0.14, 0.72, 10]} position={[x, 0.4, 0.25]}>
          {material(M.lightMetal)}
        </Cylinder>
      ))}
      {nodes.map(([x, y, z], index) => (
        <group key={`${x}-${y}`}>
          <Sphere args={[0.2, 12, 8]} position={[x, y, z]}>
            {material(index === 1 ? R.creative : R.systems)}
          </Sphere>
          {index > 0 ? (
            <Cylinder
              args={[0.035, 0.035, 0.95, 8]}
              position={[x / 2, (y + 1.3) / 2, z - 0.08]}
              rotation={[0, 0, x < 0 ? -0.72 : 0.72]}
            >
              {material(M.lightMetal)}
            </Cylinder>
          ) : null}
        </group>
      ))}
      <Cylinder args={[0.62, 0.62, 0.08, 20]} position={[0, 0.92, 0.25]}>
        {material(M.inactiveScreen)}
      </Cylinder>
    </group>
  );
}
