/**
 * OFFICE SCENE CAMERA RIG
 * =======================
 * Owns the two projection cameras inside the persistent office Canvas.
 *
 * Inputs: the resolved office camera projection and framing config.
 * Outputs: the active R3F default camera used by controls and scene consumers.
 * Side effects: exchanges the R3F default camera without replacing the WebGL root.
 * Invariant: a projection handoff configures the destination camera before publishing it.
 */

import { OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";

export type OfficeSceneCameraConfig = {
  projection: "perspective" | "orthographic";
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  zoom: number;
};

type OfficeCameraPair = {
  perspective: THREE.PerspectiveCamera | null;
  orthographic: THREE.OrthographicCamera | null;
};

type OfficeProjectionCamera = THREE.PerspectiveCamera | THREE.OrthographicCamera;

export function selectOfficeSceneCamera(
  projection: OfficeSceneCameraConfig["projection"],
  cameras: OfficeCameraPair,
): OfficeProjectionCamera | null {
  return projection === "orthographic" ? cameras.orthographic : cameras.perspective;
}

export function applyOfficeSceneCameraConfig(
  camera: OfficeProjectionCamera,
  config: OfficeSceneCameraConfig,
): void {
  camera.position.set(...config.position);
  camera.lookAt(new THREE.Vector3(...config.target));
  camera.near = 0.1;
  camera.far = 1000;
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.fov = config.fov;
  } else if (camera instanceof THREE.OrthographicCamera) {
    camera.zoom = config.zoom;
  }
  camera.updateProjectionMatrix();
}

export function OfficeSceneCameraRig({
  config,
}: {
  config: OfficeSceneCameraConfig;
}): React.JSX.Element {
  const set = useThree((state) => state.set);
  const initialCamera = useThree((state) => state.camera);
  const perspectiveRef = useRef<THREE.PerspectiveCamera>(null);
  const orthographicRef = useRef<THREE.OrthographicCamera>(null);
  const activeProjectionRef = useRef<OfficeSceneCameraConfig["projection"] | null>(null);
  const initialCameraRef = useRef(initialCamera);

  useLayoutEffect(() => {
    const nextCamera = selectOfficeSceneCamera(config.projection, {
      perspective: perspectiveRef.current,
      orthographic: orthographicRef.current,
    });
    if (!nextCamera) return;

    const projectionChanged = activeProjectionRef.current !== config.projection;
    if (projectionChanged) {
      applyOfficeSceneCameraConfig(nextCamera, config);
      activeProjectionRef.current = config.projection;
      set({ camera: nextCamera });
    } else {
      // Position and target remain transition-owned when the projection is stable.
      if (nextCamera instanceof THREE.PerspectiveCamera) nextCamera.fov = config.fov;
      if (nextCamera instanceof THREE.OrthographicCamera) nextCamera.zoom = config.zoom;
      nextCamera.updateProjectionMatrix();
    }
  }, [config, set]);

  useLayoutEffect(
    () => () => {
      set({ camera: initialCameraRef.current });
    },
    [set],
  );

  return (
    <>
      <PerspectiveCamera ref={perspectiveRef} near={0.1} far={1000} />
      <OrthographicCamera ref={orthographicRef} near={0.1} far={1000} />
    </>
  );
}
