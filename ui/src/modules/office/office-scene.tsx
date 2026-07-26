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
import { memo, useMemo } from "react";
import { useChatStore } from "@/modules/chat/chat-store";
import { getOfficeLayoutBounds } from "@/modules/office/lib/office-layout";
import {
  getOfficeFrameloop,
  hasBlockingOfficePanel,
} from "@/modules/office/scene/office-render-policy";
import { OfficeSceneCameraRig } from "@/modules/office/scene/office-scene-camera-rig";
import { SceneContents } from "@/modules/office/scene/scene-contents";
import type { OfficeSceneProps } from "@/modules/office/scene/types";
import {
  getInitialOfficeCameraConfig,
  useOfficeSceneBackground,
} from "@/modules/office/scene/use-office-scene-camera";
import { useAppStore } from "@/store";

const OfficeScene = memo((props: OfficeSceneProps) => {
  const background = useOfficeSceneBackground(props.officeDecorSettings);
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
    const bounds = getOfficeLayoutBounds(props.officeLayout);
    return { x: bounds.centerX, z: bounds.centerZ, width: bounds.width, depth: bounds.depth };
  }, [props.officeLayout]);
  const initialCameraConfig = getInitialOfficeCameraConfig(props.officeViewSettings, {
    forcePerspective,
    isBuilderMode,
    layoutCenter,
  });

  return (
    <Canvas
      shadows="percentage"
      frameloop={frameloop}
      data-office-frameloop={frameloop}
      camera={{
        position: initialCameraConfig.position,
        fov: initialCameraConfig.fov,
        zoom: initialCameraConfig.zoom,
        near: 0.1,
        far: 1000,
      }}
      style={{ background, transition: "background 0.3s ease" }}
    >
      <OfficeSceneCameraRig config={initialCameraConfig} />
      <SceneContents {...props} />
    </Canvas>
  );
});

OfficeScene.displayName = "OfficeScene";

export default OfficeScene;
export type { OfficeSceneProps };
