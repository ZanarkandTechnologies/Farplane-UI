/**
 * Authored walkable surfaces and architectural shells for persisted office objects.
 * Inputs are persisted transforms; outputs are presentation-only scene nodes with no refs or side effects.
 * Obstacle registration and interactive object rendering remain owned by OfficeObjectRenderer.
 */

import type { OfficeObject } from "@/modules/office/lib/types";

const COMMAND_LOOP_SEGMENTS = [
  { key: "north", size: [29, 3.2], position: [0, -9] },
  { key: "south", size: [29, 3.2], position: [0, 9] },
  { key: "west", size: [3.2, 14.8], position: [-12.9, 0] },
  { key: "east", size: [3.2, 14.8], position: [12.9, 0] },
  { key: "north-spoke", size: [3.2, 4], position: [0, -5.9] },
  { key: "south-spoke", size: [3.2, 4], position: [0, 5.9] },
  { key: "west-spoke", size: [4, 3.2], position: [-7.5, 0] },
  { key: "east-spoke", size: [4, 3.2], position: [7.5, 0] },
] as const;

export function CommandCommonsCompositionGeometry({
  object,
}: {
  object: OfficeObject;
}): JSX.Element {
  return (
    <>
      <group
        position={[object.position[0], 0.008, object.position[2]]}
        rotation={[0, object.rotation?.[1] ?? 0, 0]}
        name={`walkable-command-loop-${object._id}`}
      >
        {COMMAND_LOOP_SEGMENTS.map((segment) => (
          <mesh
            key={segment.key}
            position={[segment.position[0], 0, segment.position[1]]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[segment.size[0], segment.size[1]]} />
            <meshStandardMaterial color="#766b5c" roughness={0.94} />
          </mesh>
        ))}
      </group>
      <mesh
        position={[object.position[0], 0.012, object.position[2]]}
        rotation={[-Math.PI / 2, 0, object.rotation?.[1] ?? 0]}
        receiveShadow
        name={`walkable-command-zone-${object._id}`}
      >
        <planeGeometry args={[11.2, 8.8]} />
        <meshStandardMaterial color="#5f4c3a" roughness={0.92} />
      </mesh>
    </>
  );
}

export function TeamNeighborhoodShellGeometry({ object }: { object: OfficeObject }): JSX.Element {
  return (
    <group position={object.position} rotation={object.rotation}>
      <mesh
        position={[0, 0.014, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        name={`walkable-team-neighborhood-zone-${object._id}`}
      >
        <planeGeometry args={[7.4, 5.8]} />
        <meshStandardMaterial color="#777066" roughness={0.94} />
      </mesh>
      <mesh position={[0, 0.32, -2.05]} castShadow receiveShadow>
        <boxGeometry args={[5.55, 0.64, 0.38]} />
        <meshStandardMaterial color="#312821" roughness={0.76} />
      </mesh>
      <mesh position={[0, 0.66, -2.05]}>
        <boxGeometry args={[5.2, 0.045, 0.16]} />
        <meshStandardMaterial color="#79583f" emissive="#754126" emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[-2.75, 0.32, 0.15]} castShadow receiveShadow>
        <boxGeometry args={[0.38, 0.64, 3.75]} />
        <meshStandardMaterial color="#312821" roughness={0.76} />
      </mesh>
      <mesh position={[-2.75, 0.66, 0.15]}>
        <boxGeometry args={[0.16, 0.045, 3.45]} />
        <meshStandardMaterial color="#79583f" emissive="#754126" emissiveIntensity={0.18} />
      </mesh>
    </group>
  );
}
