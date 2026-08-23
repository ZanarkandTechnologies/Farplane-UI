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

import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";

export type OfficeSceneCameraConfig = {
  projection: "perspective" | "orthographic";
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  zoom: number;
  /**
   * Keep a presentation-only orthographic diorama fully framed on a narrow
   * viewport. Manual offices retain their operator-controlled zoom on resize.
   */
  fitToViewport?: boolean;
};

type OfficeCameraPair = {
  perspective: THREE.PerspectiveCamera | null;
  orthographic: THREE.OrthographicCamera | null;
};

type OfficeProjectionCamera =
  | THREE.PerspectiveCamera
  | THREE.OrthographicCamera;

export type OfficeSceneViewport = {
  width: number;
  height: number;
};

type OfficeViewportFitState = OfficeSceneViewport & {
  fitToViewport?: boolean;
  zoom: number;
};

const DIORAMA_REFERENCE_ASPECT = 16 / 10;

export function getOfficeViewportFitZoom(
  zoom: number,
  viewport: OfficeSceneViewport,
): number {
  const aspect = Math.max(1, viewport.width) / Math.max(1, viewport.height);
  return zoom * Math.min(1, aspect / DIORAMA_REFERENCE_ASPECT);
}

export function shouldApplyOfficeViewportFitZoom(
  config: Pick<OfficeSceneCameraConfig, "fitToViewport" | "zoom">,
  viewport: OfficeSceneViewport,
  previous: OfficeViewportFitState | null,
): boolean {
  if (!config.fitToViewport) return false;
  return (
    previous === null ||
    previous.fitToViewport !== config.fitToViewport ||
    previous.zoom !== config.zoom ||
    previous.width !== viewport.width ||
    previous.height !== viewport.height
  );
}

export function selectOfficeSceneCamera(
  projection: OfficeSceneCameraConfig["projection"],
  cameras: OfficeCameraPair,
): OfficeProjectionCamera | null {
  return projection === "orthographic"
    ? cameras.orthographic
    : cameras.perspective;
}

export function applyOfficeSceneCameraConfig(
  camera: OfficeProjectionCamera,
  config: OfficeSceneCameraConfig,
  viewport: OfficeSceneViewport,
): void {
  camera.position.set(...config.position);
  camera.lookAt(new THREE.Vector3(...config.target));
  camera.near = 0.1;
  camera.far = 1000;
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.fov = config.fov;
  } else if (camera instanceof THREE.OrthographicCamera) {
    camera.zoom = config.fitToViewport
      ? getOfficeViewportFitZoom(config.zoom, viewport)
      : config.zoom;
  }
  applyOfficeSceneCameraViewport(camera, viewport);
}

export function applyOfficeSceneCameraViewport(
  camera: OfficeProjectionCamera,
  viewport: OfficeSceneViewport,
): void {
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.aspect = width / height;
  } else {
    camera.left = width / -2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = height / -2;
  }
  camera.updateProjectionMatrix();
}

export function OfficeSceneCameraRig({
  config,
}: {
  config: OfficeSceneCameraConfig;
}): React.JSX.Element {
  const set = useThree((state) => state.set);
  const viewportWidth = useThree((state) => state.size.width);
  const viewportHeight = useThree((state) => state.size.height);
  const initialCamera = useThree((state) => state.camera);
  const activeCamera = useThree((state) => state.camera);
  const perspectiveRef = useRef<THREE.PerspectiveCamera>(null);
  const orthographicRef = useRef<THREE.OrthographicCamera>(null);
  const activeProjectionRef = useRef<
    OfficeSceneCameraConfig["projection"] | null
  >(null);
  const viewportFitStateRef = useRef<OfficeViewportFitState | null>(null);
  const initialCameraRef = useRef(initialCamera);

  useLayoutEffect(() => {
    if (import.meta.env.DEV && typeof window !== "undefined") {
      (
        window as Window & {
          __FARPLANE_OFFICE_CAMERA_CONFIG__?: OfficeSceneCameraConfig;
        }
      ).__FARPLANE_OFFICE_CAMERA_CONFIG__ = config;
    }
    const nextCamera = selectOfficeSceneCamera(config.projection, {
      perspective: perspectiveRef.current,
      orthographic: orthographicRef.current,
    });
    if (!nextCamera) return;

    const projectionChanged = activeProjectionRef.current !== config.projection;
    const activeCameraDrifted = activeCamera !== nextCamera;
    const viewport = { width: viewportWidth, height: viewportHeight };
    const shouldApplyViewportFit = shouldApplyOfficeViewportFitZoom(
      config,
      viewport,
      viewportFitStateRef.current,
    );
    if (projectionChanged || activeCameraDrifted) {
      applyOfficeSceneCameraConfig(nextCamera, config, viewport);
      activeProjectionRef.current = config.projection;
      set({ camera: nextCamera });
    } else {
      // Position, target, and zoom remain transition/control-owned when the projection is stable.
      if (nextCamera instanceof THREE.PerspectiveCamera)
        nextCamera.fov = config.fov;
      if (nextCamera instanceof THREE.OrthographicCamera && shouldApplyViewportFit) {
        nextCamera.zoom = getOfficeViewportFitZoom(config.zoom, viewport);
      }
      applyOfficeSceneCameraViewport(nextCamera, viewport);
    }
    viewportFitStateRef.current = {
      fitToViewport: config.fitToViewport,
      height: viewport.height,
      width: viewport.width,
      zoom: config.zoom,
    };
  }, [activeCamera, config, set, viewportHeight, viewportWidth]);

  useLayoutEffect(
    () => () => {
      set({ camera: initialCameraRef.current });
    },
    [set],
  );

  return (
    <>
      <perspectiveCamera ref={perspectiveRef} near={0.1} far={1000} />
      <orthographicCamera ref={orthographicRef} near={0.1} far={1000} />
    </>
  );
}
