/**
 * OFFICE SCENE CAMERA
 * ===================
 * Encapsulates scene theme watching and builder camera transitions.
 *
 * KEY CONCEPTS:
 * - Theme observation and camera animation are scene-shell concerns, not render-tree concerns.
 * - Keeping this logic isolated prevents `office-scene.tsx` from growing with more startup/view state.
 *
 * USAGE:
 * - `useOfficeSceneBackground` in the outer canvas shell.
 * - `useOfficeSceneCameraTransition` in scene contents.
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 * - MEM-0168
 */

import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { getOfficeDioramaTheme, getOfficeTheme } from "@/config/office-theme";
import { resolveFarplaneTheme } from "@/config/theme-system";
import { getBackgroundPreset, type OfficeDecorSettings } from "@/modules/office/lib/office-decor";
import { getOfficeQaState, updateOfficeQaState } from "@/modules/office/qa/office-qa-state";
import type { OfficeSettingsModel } from "@/modules/runtime";
import { buildConsultCameraState } from "./consult-camera";
import {
  getOfficeSceneViewState,
  type OfficeLayoutCenter,
  type OfficeSceneViewSettings,
} from "./view-profile";

export function useOfficeSceneBackground(
  decorSettings?: OfficeDecorSettings,
  isDarkMode = false,
): string {
  return useMemo(() => {
    if (!decorSettings) return getOfficeTheme(isDarkMode).scene.background;
    const preset = getBackgroundPreset(decorSettings.backgroundId);
    return isDarkMode ? preset.darkColor : preset.lightColor;
  }, [decorSettings, isDarkMode]);
}

export function useOfficeSceneThemeMode(): boolean {
  const { resolvedTheme } = useTheme();
  return resolveFarplaneTheme(resolvedTheme) === "dark";
}

export function useOfficeSceneTheme(): ReturnType<typeof getOfficeTheme> {
  const isDarkMode = useOfficeSceneThemeMode();
  return useMemo(() => getOfficeTheme(isDarkMode), [isDarkMode]);
}

export function useOfficeSceneDioramaTheme(): ReturnType<typeof getOfficeDioramaTheme> {
  const isDarkMode = useOfficeSceneThemeMode();
  return useMemo(() => getOfficeDioramaTheme(isDarkMode), [isDarkMode]);
}

export function getInitialOfficeCameraConfig(
  settings: Pick<OfficeSettingsModel, "viewProfile" | "orbitControlsEnabled" | "cameraOrientation">,
  options?: {
    forcePerspective?: boolean;
    isBuilderMode?: boolean;
    layoutCenter?: OfficeLayoutCenter;
    fitToViewport?: boolean;
  },
): {
  projection: "perspective" | "orthographic";
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  zoom: number;
  fitToViewport?: boolean;
} {
  const viewState = getOfficeSceneViewState({
    isBuilderMode: options?.isBuilderMode ?? false,
    isDragging: false,
    settings,
    forcePerspective: options?.forcePerspective,
    layoutCenter: options?.layoutCenter,
  });
  return {
    projection: viewState.cameraProjection,
    position: viewState.cameraPosition,
    target: viewState.cameraTarget,
    fov: viewState.cameraFov,
    zoom: viewState.cameraZoom,
    fitToViewport: options?.fitToViewport,
  };
}

export const BUILDER_CAMERA_TRANSITION_MS = 180;
export const DEFAULT_CAMERA_TRANSITION_MS = 500;
export const STORY_CAMERA_TRANSITION_MS = 0;

export function getOfficeCameraTransitionDuration(input: {
  previousProjection?: "perspective" | "orthographic";
  nextProjection: "perspective" | "orthographic";
  previousBuilderMode?: boolean;
  isBuilderMode: boolean;
}): number {
  if (input.previousProjection === undefined || input.previousProjection !== input.nextProjection) {
    return 0;
  }
  if (
    input.previousBuilderMode !== undefined &&
    input.previousBuilderMode !== input.isBuilderMode
  ) {
    return BUILDER_CAMERA_TRANSITION_MS;
  }
  return DEFAULT_CAMERA_TRANSITION_MS;
}

export function useOfficeSceneCameraTransition(params: {
  isBuilderMode: boolean;
  settings: OfficeSceneViewSettings;
  orbitControlsRef: React.RefObject<{
    object: THREE.PerspectiveCamera | THREE.OrthographicCamera;
    target: THREE.Vector3;
    update: () => void;
  } | null>;
  setAnimatingCamera: (value: boolean) => void;
  consultCameraTarget?: [number, number, number] | null;
  forcePerspective?: boolean;
  layoutCenter?: OfficeLayoutCenter;
}): void {
  const {
    isBuilderMode,
    settings,
    orbitControlsRef,
    setAnimatingCamera,
    consultCameraTarget,
    forcePerspective,
    layoutCenter,
  } = params;
  const previousProjectionRef = useRef<"perspective" | "orthographic" | undefined>(undefined);
  const previousBuilderModeRef = useRef<boolean | undefined>(undefined);
  const storyInvocationRef = useRef<number | null>(null);
  const storyTargetReadyRef = useRef<number | null>(null);
  const storyTargetSignatureRef = useRef<string | null>(null);
  const [projectionRetry, setProjectionRetry] = useState(0);

  useEffect(() => {
    void projectionRetry;
    const controls = orbitControlsRef.current;
    if (!controls) return;

    const camera = controls.object;
    const storyTargetSignature = consultCameraTarget?.join(",") ?? null;
    if (storyTargetSignature && storyTargetSignatureRef.current !== storyTargetSignature) {
      const targetReadyAt = performance.now();
      storyInvocationRef.current = getOfficeQaState().storyInvocationAt ?? targetReadyAt;
      storyTargetReadyRef.current = targetReadyAt;
      storyTargetSignatureRef.current = storyTargetSignature;
    } else if (!storyTargetSignature) {
      storyInvocationRef.current = null;
      storyTargetReadyRef.current = null;
      storyTargetSignatureRef.current = null;
    }
    const consultCameraState = consultCameraTarget
      ? buildConsultCameraState(consultCameraTarget)
      : null;
    const nextViewState = consultCameraState
      ? null
      : getOfficeSceneViewState({
          isBuilderMode,
          isDragging: false,
          settings,
          forcePerspective,
          layoutCenter,
        });
    const nextProjection = consultCameraState
      ? "perspective"
      : (nextViewState?.cameraProjection ?? "perspective");
    const projectionIsReady =
      (nextProjection === "perspective" && camera instanceof THREE.PerspectiveCamera) ||
      (nextProjection === "orthographic" && camera instanceof THREE.OrthographicCamera);
    if (!projectionIsReady) {
      const retryTimer = window.setTimeout(() => {
        setProjectionRetry((attempt) => attempt + 1);
      }, 0);
      return () => window.clearTimeout(retryTimer);
    }
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const duration = consultCameraState
      ? STORY_CAMERA_TRANSITION_MS
      : getOfficeCameraTransitionDuration({
          previousProjection: previousProjectionRef.current,
          nextProjection,
          previousBuilderMode: previousBuilderModeRef.current,
          isBuilderMode,
        });
    previousProjectionRef.current = nextProjection;
    previousBuilderModeRef.current = isBuilderMode;
    const storyTargetReadyAt = consultCameraTarget
      ? (storyTargetReadyRef.current ?? performance.now())
      : null;
    const storyInvokedAt = consultCameraTarget
      ? (storyInvocationRef.current ?? storyTargetReadyAt)
      : null;
    const publishStoryTiming = (settledAt: number): void => {
      if (
        storyTargetReadyAt == null ||
        storyInvokedAt == null ||
        !import.meta.env.DEV ||
        typeof window === "undefined"
      ) {
        return;
      }
      const timing = {
        invokedAt: storyInvokedAt,
        targetReadyAt: storyTargetReadyAt,
        settledAt,
        targetReadyDurationMs: storyTargetReadyAt - storyInvokedAt,
        settleDurationMs: settledAt - storyTargetReadyAt,
        totalDurationMs: settledAt - storyInvokedAt,
      };
      updateOfficeQaState({ storyTiming: timing });
    };
    const endPos = new THREE.Vector3(
      ...(consultCameraState?.position ?? nextViewState?.cameraPosition ?? [0, 25, 30]),
    );
    const endTarget = new THREE.Vector3(
      ...(consultCameraState?.target ?? nextViewState?.cameraTarget ?? [0, 0, 0]),
    );
    if (
      startPos.distanceToSquared(endPos) < 0.0001 &&
      startTarget.distanceToSquared(endTarget) < 0.0001
    ) {
      setAnimatingCamera(false);
      publishStoryTiming(performance.now());
      return;
    }

    if (duration === 0) {
      camera.position.copy(endPos);
      controls.target.copy(endTarget);
      camera.lookAt(controls.target);
      camera.updateProjectionMatrix();
      controls.update();
      setAnimatingCamera(false);
      publishStoryTiming(performance.now());
      return;
    }

    setAnimatingCamera(true);
    const startTime = performance.now();
    let animationFrameId: number | undefined;

    const animateCamera = (): void => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) ** 3;

      camera.position.lerpVectors(startPos, endPos, eased);
      controls.target.lerpVectors(startTarget, endTarget, eased);
      camera.lookAt(controls.target);
      if (
        "updateProjectionMatrix" in camera &&
        typeof camera.updateProjectionMatrix === "function"
      ) {
        camera.updateProjectionMatrix();
      }
      controls.update();

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animateCamera);
      } else {
        setAnimatingCamera(false);
        publishStoryTiming(performance.now());
      }
    };

    animateCamera();
    return () => {
      if (animationFrameId !== undefined) cancelAnimationFrame(animationFrameId);
    };
  }, [
    consultCameraTarget,
    forcePerspective,
    isBuilderMode,
    layoutCenter,
    orbitControlsRef,
    projectionRetry,
    setAnimatingCamera,
    settings,
  ]);
}
