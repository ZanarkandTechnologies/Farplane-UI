"use client";

/**
 * ACTIVITY SCENE PROPS
 * ====================
 * Renders small transient, shared props at an engaged employee. Large station
 * equipment remains owned by the landmark bay; this component has no persistence.
 */

import { Box, Cylinder, Sphere } from "@react-three/drei";
import type { ActivityScenePresentation } from "@/modules/office/activity-scenes";

function material(color: string, emissive = false) {
  return (
    <meshStandardMaterial
      color={color}
      emissive={emissive ? color : "#000000"}
      emissiveIntensity={emissive ? 0.28 : 0}
    />
  );
}

export function ActivitySceneProps({ scene }: { scene: ActivityScenePresentation }) {
  const commonPosition: [number, number, number] = [0, 0.2, 0.58];

  switch (scene.propKind) {
    case "book":
      return (
        <group name="activity-scene-prop-book" position={commonPosition} rotation={[-0.28, 0, 0]}>
          <Box args={[0.42, 0.035, 0.34]} position={[-0.2, 0, 0]} rotation={[0, -0.12, 0]}>
            {material("#fef3c7")}
          </Box>
          <Box args={[0.42, 0.035, 0.34]} position={[0.2, 0, 0]} rotation={[0, 0.12, 0]}>
            {material("#fffbeb")}
          </Box>
          <Box args={[0.05, 0.045, 0.38]} position={[0, -0.01, 0]}>
            {material("#92400e")}
          </Box>
        </group>
      );
    case "tool":
      return (
        <group name="activity-scene-prop-tool" position={commonPosition} rotation={[0, 0, -0.55]}>
          <Cylinder args={[0.045, 0.045, 0.72, 8]}>{material("#a16207")}</Cylinder>
          <Box args={[0.34, 0.14, 0.13]} position={[0, 0.34, 0]}>
            {material("#cbd5e1")}
          </Box>
        </group>
      );
    case "handset":
      return (
        <group
          name="activity-scene-prop-handset"
          position={[0.42, 0.42, 0.48]}
          rotation={[0, 0, -0.25]}
        >
          <Box args={[0.16, 0.56, 0.13]}>{material("#0f172a")}</Box>
          <Sphere args={[0.1, 10, 8]} position={[0, 0.28, 0]}>
            {material(scene.accentColor, true)}
          </Sphere>
        </group>
      );
    case "archive-box":
      return (
        <group name="activity-scene-prop-archive-box" position={commonPosition}>
          <Box args={[0.68, 0.45, 0.42]}>{material("#92400e")}</Box>
          <Box args={[0.35, 0.13, 0.03]} position={[0, 0.05, 0.23]}>
            {material("#fef3c7")}
          </Box>
        </group>
      );
    case "planning-cards":
    case "chart":
      return (
        <group name={`activity-scene-prop-${scene.propKind}`} position={commonPosition}>
          <Box args={[0.86, 0.52, 0.06]}>{material("#0f172a")}</Box>
          {[-0.24, 0, 0.24].map((x, index) => (
            <Box
              key={x}
              args={[0.14, 0.08 + index * 0.08, 0.03]}
              position={[x, -0.08 + index * 0.04, 0.05]}
            >
              {material(index === 1 ? "#facc15" : scene.accentColor, true)}
            </Box>
          ))}
        </group>
      );
    case "arcade-controls":
      return (
        <group
          name="activity-scene-prop-arcade-controls"
          position={commonPosition}
          rotation={[-0.22, 0, 0]}
        >
          <Box args={[0.78, 0.12, 0.42]}>{material("#1e293b")}</Box>
          <Sphere args={[0.1, 10, 8]} position={[-0.18, 0.12, 0]}>
            {material("#ef4444", true)}
          </Sphere>
          <Sphere args={[0.08, 10, 8]} position={[0.18, 0.1, 0]}>
            {material("#22d3ee", true)}
          </Sphere>
        </group>
      );
    case "camera":
      return (
        <group name="activity-scene-prop-camera" position={commonPosition}>
          <Box args={[0.62, 0.42, 0.34]}>{material("#111827")}</Box>
          <Cylinder
            args={[0.16, 0.2, 0.24, 14]}
            rotation={[Math.PI / 2, 0, 0]}
            position={[0, 0, 0.28]}
          >
            {material(scene.accentColor, true)}
          </Cylinder>
        </group>
      );
    case "training-orb":
    case "hologram":
      return (
        <group name={`activity-scene-prop-${scene.propKind}`} position={[0, 0.45, 0.62]}>
          <Sphere args={[0.25, 14, 10]}>{material(scene.accentColor, true)}</Sphere>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.34, 0.025, 8, 24]} />
            <meshStandardMaterial
              color={scene.accentColor}
              emissive={scene.accentColor}
              emissiveIntensity={0.35}
            />
          </mesh>
        </group>
      );
    case "data-nodes":
      return (
        <group name="activity-scene-prop-data-nodes" position={[0, 0.38, 0.6]}>
          {[-0.28, 0, 0.28].map((x, index) => (
            <Sphere key={x} args={[0.11, 10, 8]} position={[x, index === 1 ? 0.2 : 0, 0]}>
              {material(scene.accentColor, true)}
            </Sphere>
          ))}
        </group>
      );
  }
}
