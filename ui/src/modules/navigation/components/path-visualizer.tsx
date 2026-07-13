/**
 * Renders an employee's computed navigation route in world space.
 * Paths are projected onto the floor for readability; manual destinations remain visible after arrival.
 */

import { Line } from "@react-three/drei";
import { memo, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const PATH_FLOOR_Y = 0.045;
const MANUAL_CONTROL_COLOR = "#22d3ee";

type PathVisualizerProps = {
  originalPath: THREE.Vector3[] | null;
  remainingPath: THREE.Vector3[] | null;
  isGoingToDesk: boolean;
  employeeId: string;
  variant?: "debug" | "manual";
  destination?: [number, number, number] | null;
};

function projectPointToFloor(point: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(point.x, PATH_FLOOR_Y, point.z);
}

function PathWaypointDots({ points, color }: { points: THREE.Vector3[]; color: string }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const matrix = new THREE.Matrix4();
    for (let index = 0; index < points.length; index += 1) {
      matrix.makeTranslation(points[index].x, points[index].y + 0.012, points[index].z);
      mesh.setMatrixAt(index, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [points]);

  if (points.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, points.length]} renderOrder={41}>
      <sphereGeometry args={[0.055, 8, 8]} />
      <meshBasicMaterial color={color} transparent opacity={0.95} depthTest={false} />
    </instancedMesh>
  );
}

function DestinationMarker({ point, color }: { point: THREE.Vector3; color: string }) {
  return (
    <group position={point} renderOrder={42} name="manual-control-destination-marker">
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.43, 40]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.95}
          depthTest={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <circleGeometry args={[0.09, 24]} />
        <meshBasicMaterial color="#ffffff" depthTest={false} side={THREE.DoubleSide} />
      </mesh>
      <Line
        points={[
          [-0.58, 0.006, 0],
          [-0.3, 0.006, 0],
        ]}
        color={color}
        lineWidth={2}
        depthTest={false}
      />
      <Line
        points={[
          [0.3, 0.006, 0],
          [0.58, 0.006, 0],
        ]}
        color={color}
        lineWidth={2}
        depthTest={false}
      />
      <Line
        points={[
          [0, 0.006, -0.58],
          [0, 0.006, -0.3],
        ]}
        color={color}
        lineWidth={2}
        depthTest={false}
      />
      <Line
        points={[
          [0, 0.006, 0.3],
          [0, 0.006, 0.58],
        ]}
        color={color}
        lineWidth={2}
        depthTest={false}
      />
    </group>
  );
}

const PathVisualizer = memo(function PathVisualizer({
  originalPath,
  remainingPath,
  isGoingToDesk,
  employeeId,
  variant = "debug",
  destination,
}: PathVisualizerProps) {
  const color = variant === "manual" ? MANUAL_CONTROL_COLOR : isGoingToDesk ? "#0099ff" : "#ff00ff";
  const floorOriginalPath = useMemo(
    () => originalPath?.map(projectPointToFloor) ?? null,
    [originalPath],
  );
  const floorRemainingPath = useMemo(
    () => remainingPath?.map(projectPointToFloor) ?? null,
    [remainingPath],
  );
  const destinationPoint = useMemo(() => {
    if (destination) {
      return new THREE.Vector3(destination[0], PATH_FLOOR_Y + 0.008, destination[2]);
    }
    const pathEnd = floorRemainingPath?.at(-1);
    return pathEnd?.clone() ?? null;
  }, [destination, floorRemainingPath]);
  const waypointPoints = useMemo(
    () => (variant === "manual" ? (floorRemainingPath?.slice(1, -1) ?? []) : []),
    [floorRemainingPath, variant],
  );

  const hasOriginalPath = Boolean(floorOriginalPath && floorOriginalPath.length > 1);
  const hasRemainingPath = Boolean(floorRemainingPath && floorRemainingPath.length > 1);
  if (!hasOriginalPath && !hasRemainingPath && !destinationPoint) return null;

  return (
    <group name={`employee-path-${employeeId}`}>
      {hasOriginalPath && floorOriginalPath ? (
        <Line
          points={floorOriginalPath}
          color={color}
          lineWidth={0.045}
          dashed
          dashSize={0.1}
          gapSize={0.1}
          transparent
          opacity={0.3}
          depthTest={false}
          worldUnits
          renderOrder={39}
        />
      ) : null}

      {hasRemainingPath && floorRemainingPath ? (
        <Line
          points={floorRemainingPath}
          color={color}
          lineWidth={variant === "manual" ? 0.065 : 0.05}
          transparent
          opacity={variant === "manual" ? 0.9 : 1}
          depthTest={false}
          worldUnits
          renderOrder={40}
        />
      ) : null}

      {variant === "manual" ? <PathWaypointDots points={waypointPoints} color={color} /> : null}
      {destinationPoint ? <DestinationMarker point={destinationPoint} color={color} /> : null}
    </group>
  );
});

export default PathVisualizer;
