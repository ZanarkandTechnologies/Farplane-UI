"use client";

/** Presentation-only poof burst mounted whenever a skill changes the team character. */

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type * as THREE from "three";

const PARTICLE_COUNT = 12;

export function CharacterTransformPoof(): React.ReactElement {
  const groupRef = useRef<THREE.Group>(null);
  const startedAtRef = useRef<number | undefined>(undefined);
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, index) => {
        const angle = (index / PARTICLE_COUNT) * Math.PI * 2;
        return { x: Math.cos(angle), y: (index % 3) * 0.22 - 0.2, z: Math.sin(angle) };
      }),
    [],
  );

  useFrame((state) => {
    startedAtRef.current ??= state.clock.elapsedTime;
    const elapsed = state.clock.elapsedTime - startedAtRef.current;
    const progress = Math.min(elapsed / 0.72, 1);
    if (!groupRef.current) return;
    if (progress >= 1 && !groupRef.current.visible) return;
    groupRef.current.visible = progress < 1;
    groupRef.current.scale.setScalar(0.35 + progress * 1.75);
    groupRef.current.rotation.y = progress * 1.4;
    groupRef.current.children.forEach((child) => {
      const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 0.86 * (1 - progress));
    });
  });

  return (
    <group ref={groupRef} position={[0, 0.15, 0]} name="character-transform-poof">
      {particles.map((particle, index) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: deterministic fixed particle ring.
          key={index}
          position={[particle.x * 0.52, particle.y, particle.z * 0.52]}
        >
          <sphereGeometry args={[0.2 + (index % 2) * 0.07, 8, 8]} />
          <meshBasicMaterial
            color={index % 3 === 0 ? "#fef3c7" : index % 3 === 1 ? "#c4b5fd" : "#f9a8d4"}
            transparent
            opacity={0.86}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
