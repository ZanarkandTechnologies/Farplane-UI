/**
 * WORLD NEXUS PREVIEW
 * ===================
 * Renders one compact Company World snapshot above Command Commons.
 * Geometry is derived from the passed read-only projection, and animation only
 * rotates the visual group; this component never owns a data read or refresh.
 */

import { useFrame } from "@react-three/fiber";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { CompanyWorldProjection } from "@/modules/world-map/types";
import { buildWorldNexusPreviewGraph } from "../lib/world-nexus-preview-layout";

function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}

function createNexusGeometry(graph: ReturnType<typeof buildWorldNexusPreviewGraph>) {
  const nodePositions = new Float32Array(graph.nodes.flatMap((node) => node.position));
  const nodeColors = new Float32Array(
    graph.nodes.flatMap((node) => new THREE.Color(node.color).toArray()),
  );
  const positionsByKey = new Map(graph.nodes.map((node) => [node.key, node.position]));
  const edgePositions: number[] = [];
  const edgeColors: number[] = [];
  for (const edge of graph.edges) {
    const source = positionsByKey.get(edge.sourceKey);
    const target = positionsByKey.get(edge.targetKey);
    if (!source || !target) continue;
    edgePositions.push(...source, ...target);
    const color = new THREE.Color(edge.color).multiplyScalar(0.78).toArray();
    edgeColors.push(...color, ...color);
  }

  const nodes = new THREE.BufferGeometry();
  nodes.setAttribute("position", new THREE.BufferAttribute(nodePositions, 3));
  nodes.setAttribute("color", new THREE.BufferAttribute(nodeColors, 3));
  const edges = new THREE.BufferGeometry();
  edges.setAttribute("position", new THREE.Float32BufferAttribute(edgePositions, 3));
  edges.setAttribute("color", new THREE.Float32BufferAttribute(edgeColors, 3));
  return { nodes, edges };
}

export function WorldNexusPreview({
  projection,
}: {
  projection?: CompanyWorldProjection;
}): React.JSX.Element | null {
  const graph = useMemo(() => buildWorldNexusPreviewGraph(projection), [projection]);
  const geometry = useMemo(() => createNexusGeometry(graph), [graph]);
  const motionGroup = useRef<THREE.Group>(null);
  const reducedMotion = useReducedMotion();

  useEffect(
    () => () => {
      geometry.nodes.dispose();
      geometry.edges.dispose();
    },
    [geometry],
  );

  useFrame((state) => {
    if (!motionGroup.current || reducedMotion || graph.nodes.length === 0) return;
    motionGroup.current.rotation.y = state.clock.getElapsedTime() * 0.075;
  });

  if (graph.nodes.length === 0) return null;

  return (
    <group
      name="company-world-nexus-preview"
      position={[0, 0.02, 0]}
      userData={{ nodeCount: graph.nodes.length, edgeCount: graph.edges.length }}
    >
      <group ref={motionGroup}>
        {graph.edges.length ? (
          <lineSegments geometry={geometry.edges}>
            <lineBasicMaterial transparent opacity={0.42} vertexColors />
          </lineSegments>
        ) : null}
        <points geometry={geometry.nodes}>
          <pointsMaterial
            transparent
            opacity={0.92}
            size={0.095}
            sizeAttenuation
            vertexColors
            depthWrite={false}
          />
        </points>
      </group>
      <mesh position={[0, 0.56, 0]}>
        <sphereGeometry args={[0.12, 16, 12]} />
        <meshStandardMaterial color="#eff9f4" emissive="#8fc6ba" emissiveIntensity={0.78} />
      </mesh>
      <pointLight position={[0, 0.6, 0]} color="#bde5dc" intensity={0.72} distance={2.6} />
    </group>
  );
}
