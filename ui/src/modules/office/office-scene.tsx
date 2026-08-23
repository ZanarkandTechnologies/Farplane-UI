"use client";

/**
 * OFFICE SCENE
 * ============
 * Public canvas shell for the 3D office experience.
 *
 * KEY CONCEPTS:
 * - This file stays thin and owns only the canvas shell plus external dialog mounting.
 * - Scene internals live under `modules/office/scene/` so startup, rendering, and data shaping stay modular.
 *
 * USAGE:
 * - Render `OfficeScene` anywhere the office 3D experience should appear.
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 * - MEM-0150
 */

import { Canvas } from "@react-three/fiber";
import { memo, useEffect, useMemo } from "react";
import { UI_Z } from "@/lib/z-index";
import { useChatStore } from "@/modules/chat/chat-store";
import { getDepartmentArchipelagoLayoutCenter } from "@/modules/office/lib/department-island-layout";
import { getOfficeLayoutBounds } from "@/modules/office/lib/office-layout";
import {
  getOfficeFrameloop,
  hasBlockingOfficePanel,
} from "@/modules/office/scene/office-render-policy";
import { OfficeSceneCameraRig } from "@/modules/office/scene/office-scene-camera-rig";
import { OfficeSceneErrorBoundary } from "@/modules/office/scene/office-scene-error-boundary";
import { canCreateWebGlContext } from "@/modules/office/scene/office-webgl-support";
import { SceneContents } from "@/modules/office/scene/scene-contents";
import type { OfficeSceneProps } from "@/modules/office/scene/types";
import {
  getInitialOfficeCameraConfig,
  useOfficeSceneBackground,
  useOfficeSceneDioramaTheme,
  useOfficeSceneThemeMode,
} from "@/modules/office/scene/use-office-scene-camera";
import { useAppStore } from "@/store";

const OfficeScene = memo((props: OfficeSceneProps) => {
  const isDarkMode = useOfficeSceneThemeMode();
  const { onNavigationReady } = props;
  const dioramaTheme = useOfficeSceneDioramaTheme();
  const configuredBackground = useOfficeSceneBackground(props.officeDecorSettings, isDarkMode);
  const background =
    props.officeLayoutStrategy === "team_neighborhoods"
      ? dioramaTheme.canvas
      : configuredBackground;
  const isBuilderMode = useAppStore((state) => state.isBuilderMode);
  const blockingPanelOpen = useAppStore(hasBlockingOfficePanel);
  const isChatOpen = useChatStore((state) => state.isChatOpen);
  const presentationMode = useChatStore((state) => state.presentationMode);
  const forcePerspective = isChatOpen && presentationMode === "story";
  const frameloop = getOfficeFrameloop({
    blockingPanelOpen,
    chatOpen: isChatOpen,
    presentationMode,
  });
  const layoutCenter = useMemo(() => {
    if (props.officeLayoutStrategy === "team_neighborhoods") {
      return getDepartmentArchipelagoLayoutCenter();
    }
    const bounds = getOfficeLayoutBounds(props.officeLayout);
    return {
      x: bounds.centerX,
      z: bounds.centerZ,
      width: bounds.width,
      depth: bounds.depth,
    };
  }, [props.officeLayout, props.officeLayoutStrategy]);
  const initialCameraConfig = getInitialOfficeCameraConfig(props.officeViewSettings, {
    forcePerspective,
    isBuilderMode,
    layoutCenter,
    fitToViewport:
      props.officeLayoutStrategy === "team_neighborhoods" && !isBuilderMode && !forcePerspective,
  });
  const webglAvailable = useMemo(() => canCreateWebGlContext(), []);

  useEffect(() => {
    if (!webglAvailable) onNavigationReady();
  }, [onNavigationReady, webglAvailable]);

  if (!webglAvailable) {
    return (
      <output
        className="flex h-full min-h-64 w-full items-center justify-center bg-background px-6 text-foreground"
        data-office-scene-webgl-unavailable
      >
        <div className="max-w-md text-center">
          <h2 className="text-lg font-semibold">Office scene unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This browser runtime cannot create a WebGL context. Office panels remain available.
          </p>
        </div>
      </output>
    );
  }

  return (
    <OfficeSceneErrorBoundary>
      <Canvas
        shadows="percentage"
        frameloop={frameloop}
        data-office-frameloop={frameloop}
        data-office-floor-pattern={props.officeDecorSettings.floorPatternId}
        data-office-wall-color={props.officeDecorSettings.wallColorId}
        data-office-background={props.officeDecorSettings.backgroundId}
        camera={{
          position: initialCameraConfig.position,
          fov: initialCameraConfig.fov,
          zoom: initialCameraConfig.zoom,
          near: 0.1,
          far: 1000,
        }}
        style={{
          background,
          isolation: "isolate",
          position: "relative",
          transition: "background 0.3s ease",
          zIndex: UI_Z.sceneCanvas,
        }}
      >
        <color attach="background" args={[background]} />
        <OfficeSceneCameraRig config={initialCameraConfig} />
        <SceneContents {...props} />
      </Canvas>
    </OfficeSceneErrorBoundary>
  );
});

OfficeScene.displayName = "OfficeScene";

export default OfficeScene;
export type { OfficeSceneProps };
