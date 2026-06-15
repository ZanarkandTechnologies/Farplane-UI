"use client";

import { Box, Cone, Cylinder, Sphere } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { memo, useMemo, useRef } from "react";
import * as THREE from "three";

import {
  BODY_HEIGHT,
  BODY_WIDTH,
  HAIR_HEIGHT,
  HEAD_HEIGHT,
  HEAD_WIDTH,
  LEG_HEIGHT,
  TOTAL_HEIGHT,
} from "@/constants";
import type { EmployeeActivityState } from "@/modules/office/lib/types";
import { getEmployeeIndicatorColor } from "./presence-visuals";

/**
 * EMPLOYEE DECORATIONS
 * ====================
 * Shared decorative meshes used by the office employee avatar.
 *
 * KEY CONCEPTS:
 * - Keep the main employee shell focused on behavior/state wiring
 * - Memoize decorative sub-meshes because their props are stable per employee
 *
 * MEMORY REFERENCES:
 * - MEM-0144
 */

const PropellerHat = memo(function PropellerHat() {
  const propellerRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (propellerRef.current) {
      propellerRef.current.rotation.y += delta * 5;
    }
  });

  const hatWidth = HEAD_WIDTH;
  const hatHeight = 0.05;

  return (
    <group position={[0, HAIR_HEIGHT / 2 + hatHeight / 2, 0]}>
      <group>
        <Box
          args={[hatWidth / 2, hatHeight, hatWidth / 2]}
          position={[-hatWidth / 4, 0, -hatWidth / 4]}
        >
          <meshStandardMaterial color="#CC2200" />
        </Box>
        <Box
          args={[hatWidth / 2, hatHeight, hatWidth / 2]}
          position={[hatWidth / 4, 0, -hatWidth / 4]}
        >
          <meshStandardMaterial color="#FF4500" />
        </Box>
        <Box
          args={[hatWidth / 2, hatHeight, hatWidth / 2]}
          position={[-hatWidth / 4, 0, hatWidth / 4]}
        >
          <meshStandardMaterial color="#FF6B3D" />
        </Box>
        <Box
          args={[hatWidth / 2, hatHeight, hatWidth / 2]}
          position={[hatWidth / 4, 0, hatWidth / 4]}
        >
          <meshStandardMaterial color="#D4380D" />
        </Box>
      </group>

      <Box args={[0.01, 0.08, 0.01]} position={[0, hatHeight, 0]}>
        <meshStandardMaterial color="#FFD700" />
      </Box>

      <group ref={propellerRef} position={[0, hatHeight + 0.08, 0]}>
        <Box args={[0.2, 0.005, 0.02]}>
          <meshStandardMaterial color="#FF4500" />
        </Box>
        <Box args={[0.02, 0.005, 0.2]}>
          <meshStandardMaterial color="#CC2200" />
        </Box>
      </group>
    </group>
  );
});

export const CeoCrown = memo(function CeoCrown() {
  const crownWidth = HEAD_WIDTH * 0.9;
  const crownY = HAIR_HEIGHT / 2 + 0.08;
  const pointY = crownY + 0.08;

  return (
    <group position={[0, crownY, 0]}>
      <Cylinder args={[crownWidth * 0.5, crownWidth * 0.44, 0.1, 6]} castShadow>
        <meshStandardMaterial color="#FACC15" emissive="#B45309" emissiveIntensity={0.18} />
      </Cylinder>
      {[-0.28, 0, 0.28].map((offsetX) => (
        <Cone
          key={offsetX}
          args={[0.08, 0.18, 4]}
          position={[offsetX * crownWidth, pointY, 0]}
          castShadow
        >
          <meshStandardMaterial color="#FDE68A" emissive="#F59E0B" emissiveIntensity={0.2} />
        </Cone>
      ))}
    </group>
  );
});

export const LobsterClaws = memo(function LobsterClaws({ color }: { color: string }) {
  const clawY = LEG_HEIGHT + BODY_HEIGHT * 0.5;
  const clawOffsetX = BODY_WIDTH / 2 + 0.08;
  const pincerGap = 0.025;

  const Pincer = ({ side }: { side: 1 | -1 }) => (
    <group position={[side * clawOffsetX, clawY - TOTAL_HEIGHT / 2, 0.02]}>
      <Box args={[0.14, 0.05, 0.16]} position={[side * 0.04, pincerGap, 0]} castShadow>
        <meshStandardMaterial color={color} />
      </Box>
      <Box args={[0.12, 0.04, 0.14]} position={[side * 0.03, -pincerGap - 0.03, 0]} castShadow>
        <meshStandardMaterial color={color} />
      </Box>
    </group>
  );

  return (
    <>
      <Pincer side={1} />
      <Pincer side={-1} />
    </>
  );
});

export const LobsterAntennae = memo(function LobsterAntennae() {
  const antennaY = LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT + HAIR_HEIGHT - TOTAL_HEIGHT / 2;
  const antennaColor = "#FF8C00";

  return (
    <>
      <group
        position={[-HEAD_WIDTH * 0.25, antennaY, HEAD_WIDTH * 0.15]}
        rotation={[0.15, 0, -0.25]}
      >
        <Box args={[0.02, 0.22, 0.02]} position={[0, 0.11, 0]} castShadow>
          <meshStandardMaterial color={antennaColor} />
        </Box>
      </group>
      <group position={[HEAD_WIDTH * 0.25, antennaY, HEAD_WIDTH * 0.15]} rotation={[0.15, 0, 0.25]}>
        <Box args={[0.02, 0.22, 0.02]} position={[0, 0.11, 0]} castShadow>
          <meshStandardMaterial color={antennaColor} />
        </Box>
      </group>
    </>
  );
});

export const LobsterEyes = memo(function LobsterEyes() {
  const eyeBaseY = LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT * 0.6 - TOTAL_HEIGHT / 2;
  const eyeSpacing = HEAD_WIDTH * 0.3;

  const EyeStalk = ({ offsetX }: { offsetX: number }) => (
    <group position={[offsetX, eyeBaseY, HEAD_WIDTH * 0.35]}>
      <Cylinder args={[0.015, 0.015, 0.08, 6]} position={[0, 0.04, 0]} castShadow>
        <meshStandardMaterial color="#FF8C00" />
      </Cylinder>
      <Sphere args={[0.03, 8, 8]} position={[0, 0.1, 0]} castShadow>
        <meshStandardMaterial color="#FFFFFF" />
      </Sphere>
      <Sphere args={[0.016, 6, 6]} position={[0, 0.1, 0.02]} castShadow>
        <meshStandardMaterial color="#111111" />
      </Sphere>
    </group>
  );

  return (
    <>
      <EyeStalk offsetX={-eyeSpacing} />
      <EyeStalk offsetX={eyeSpacing} />
    </>
  );
});

function SolidHeartIndicator({
  color,
  opacity,
}: {
  color: string;
  opacity: number;
}) {
  const heartShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.115);
    shape.bezierCurveTo(-0.16, -0.02, -0.14, 0.11, -0.055, 0.115);
    shape.bezierCurveTo(-0.02, 0.118, 0, 0.094, 0, 0.07);
    shape.bezierCurveTo(0, 0.094, 0.02, 0.118, 0.055, 0.115);
    shape.bezierCurveTo(0.14, 0.11, 0.16, -0.02, 0, -0.115);
    return shape;
  }, []);

  return (
    <mesh position={[0, 0, -0.018]} rotation={[0, 0, 0]}>
      <extrudeGeometry
        args={[
          heartShape,
          {
            depth: 0.036,
            bevelEnabled: true,
            bevelThickness: 0.004,
            bevelSize: 0.004,
            bevelSegments: 1,
          },
        ]}
      />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={opacity}
        emissive={color}
        emissiveIntensity={0.18}
        roughness={0.55}
        metalness={0.04}
      />
    </mesh>
  );
}

export const TeamPlumbob = memo(function TeamPlumbob({
  teamId,
  activityState,
  persistent,
  indicatorOpacity = 1,
}: {
  teamId?: string;
  activityState?: EmployeeActivityState;
  persistent?: boolean;
  indicatorOpacity?: number;
}) {
  const diamondRef = useRef<THREE.Group>(null);

  const color = useMemo(
    () => getEmployeeIndicatorColor({ teamId, activityState }),
    [activityState, teamId],
  );

  useFrame((state) => {
    if (diamondRef.current) {
      const activeMultiplier =
        activityState && activityState !== "idle" && activityState !== "done" ? 1.8 : 1;
      diamondRef.current.position.y =
        TOTAL_HEIGHT / 2 + 0.55 + Math.sin(state.clock.elapsedTime * 1.5 * activeMultiplier) * 0.04;
    }
  });

  const isActivityActive =
    typeof activityState === "string" && activityState !== "idle" && activityState !== "done";
  const opacity = (isActivityActive ? 0.95 : 0.85) * indicatorOpacity;
  const coneRadius = 0.12;
  const coneHeight = 0.18;
  const emissiveIntensity = isActivityActive ? 0.65 : 0.3;

  return (
    <group ref={diamondRef} position={[0, TOTAL_HEIGHT / 2 + 0.55, 0]}>
      {persistent ? (
        <SolidHeartIndicator color={color} opacity={opacity} />
      ) : (
        <>
          <Cone
            args={[coneRadius, coneHeight, 4]}
            position={[0, coneHeight / 2, 0]}
            rotation={[0, Math.PI / 4, 0]}
          >
            <meshStandardMaterial
              color={color}
              transparent
              opacity={opacity}
              emissive={color}
              emissiveIntensity={emissiveIntensity}
            />
          </Cone>
          <Cone
            args={[coneRadius, coneHeight, 4]}
            position={[0, -coneHeight / 2, 0]}
            rotation={[Math.PI, Math.PI / 4, 0]}
          >
            <meshStandardMaterial
              color={color}
              transparent
              opacity={opacity}
              emissive={color}
              emissiveIntensity={emissiveIntensity}
            />
          </Cone>
        </>
      )}
    </group>
  );
});

export const PmGoggleHat = PropellerHat;
export const SupervisorHat = PmGoggleHat;
