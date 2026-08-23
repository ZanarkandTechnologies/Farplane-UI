import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  applyOfficeSceneCameraConfig,
  applyOfficeSceneCameraViewport,
  getOfficeViewportFitZoom,
  type OfficeSceneCameraConfig,
  selectOfficeSceneCamera,
  shouldApplyOfficeViewportFitZoom,
} from "./office-scene-camera-rig";

const viewport = { width: 1280, height: 720 };

const perspectiveConfig: OfficeSceneCameraConfig = {
  projection: "perspective",
  position: [2, 10, 12],
  target: [1, 0, -2],
  fov: 42,
  zoom: 1,
};

describe("office scene camera rig", () => {
  it("selects the camera matching the active projection", () => {
    const perspective = new THREE.PerspectiveCamera();
    const orthographic = new THREE.OrthographicCamera();

    expect(
      selectOfficeSceneCamera("perspective", { perspective, orthographic }),
    ).toBe(perspective);
    expect(
      selectOfficeSceneCamera("orthographic", { perspective, orthographic }),
    ).toBe(orthographic);
  });

  it("configures a destination camera before it becomes active", () => {
    const camera = new THREE.PerspectiveCamera();

    applyOfficeSceneCameraConfig(camera, perspectiveConfig, viewport);

    expect(camera.position.toArray()).toEqual(perspectiveConfig.position);
    expect(camera.fov).toBe(42);
    expect(camera.near).toBe(0.1);
    expect(camera.far).toBe(1000);
    expect(camera.aspect).toBeCloseTo(16 / 9);
    const expectedDirection = new THREE.Vector3(...perspectiveConfig.target)
      .sub(new THREE.Vector3(...perspectiveConfig.position))
      .normalize();
    expect(
      camera
        .getWorldDirection(new THREE.Vector3())
        .distanceTo(expectedDirection),
    ).toBeLessThan(0.0001);
  });

  it("applies orthographic zoom without changing the camera type", () => {
    const camera = new THREE.OrthographicCamera();

    applyOfficeSceneCameraConfig(
      camera,
      {
        ...perspectiveConfig,
        projection: "orthographic",
        zoom: 28,
      },
      viewport,
    );

    expect(camera.isOrthographicCamera).toBe(true);
    expect(camera.zoom).toBe(28);
    expect([camera.left, camera.right, camera.top, camera.bottom]).toEqual([
      -640, 640, 360, -360,
    ]);
  });

  it("updates responsive projection bounds without resetting operator zoom", () => {
    const camera = new THREE.OrthographicCamera(-640, 640, 360, -360);
    camera.zoom = 32;

    applyOfficeSceneCameraViewport(camera, { width: 900, height: 600 });

    expect([camera.left, camera.right, camera.top, camera.bottom]).toEqual([
      -450, 450, 300, -300,
    ]);
    expect(camera.zoom).toBe(32);
  });

  it("backs an automatic diorama out on a narrow viewport without changing normal offices", () => {
    expect(getOfficeViewportFitZoom(23, { width: 1440, height: 900 })).toBe(23);
    expect(
      getOfficeViewportFitZoom(23, { width: 390, height: 844 }),
    ).toBeLessThan(7);

    const camera = new THREE.OrthographicCamera();
    applyOfficeSceneCameraConfig(
      camera,
      {
        ...perspectiveConfig,
        projection: "orthographic",
        zoom: 23,
        fitToViewport: true,
      },
      { width: 390, height: 844 },
    );

    expect(camera.zoom).toBeCloseTo(
      getOfficeViewportFitZoom(23, { width: 390, height: 844 }),
    );
  });

  it("does not reapply diorama fit when an unrelated panel rerenders the camera rig", () => {
    const config = { fitToViewport: true, zoom: 23 };
    const previous = { ...viewport, ...config };

    expect(
      shouldApplyOfficeViewportFitZoom(config, viewport, previous),
    ).toBe(false);
    expect(
      shouldApplyOfficeViewportFitZoom(
        config,
        { width: 900, height: 720 },
        previous,
      ),
    ).toBe(true);
  });
});
