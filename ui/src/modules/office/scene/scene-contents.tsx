/**
 * OFFICE SCENE CONTENTS
 * =====================
 * Internal scene composition for lighting, room shell, employees, office objects, and nav bootstrap.
 *
 * KEY CONCEPTS:
 * - This component composes focused hooks/modules instead of owning all scene responsibilities inline.
 * - Future startup phases should plug into bootstrap/hooks, not grow this component arbitrarily.
 *
 * USAGE:
 * - Render from the public `office-scene.tsx` canvas shell.
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 * - MEM-0150
 */

"use client";

import { OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { PlacementHandler } from "@/components/placement-handler";
import { extractAgentId } from "@/lib/entity-utils";
import { useChatStore } from "@/modules/chat/chat-store";
import type { StatusType } from "@/modules/navigation/components/status-indicator";
import { Employee } from "@/modules/office/components/employee";
import {
  getTeamCharacterPreviewForEmployee,
  useSyntheticTeamSkillDemo,
} from "@/modules/office/components/employee/use-team-character-preview";
import { getOfficeLayoutBounds } from "@/modules/office/lib/office-layout";
import { measureOfficeSceneQuality } from "@/modules/office/lib/office-scene-quality";
import { useOfficeWorldStore } from "@/modules/office/store";
import { updateOfficeQaState } from "@/modules/office/qa/office-qa-state";
import { applySyntheticSkillDemo } from "@/modules/office/synthetic-skill-demo";
import { useAppStore } from "@/store";
import { OfficeClickProbe } from "./office-click-probe";
import { getLiveEmployeePosition } from "./employee-position-registry";
import { getOfficeDebugOverlayPlan, OfficeDebugOverlaySystem } from "./office-debug-overlay-system";
import { OfficeLayoutEditor } from "./office-layout-editor";
import { OfficeLighting } from "./office-lighting";
import { ThreadLineageEffects } from "./thread-lineage-effects";
import {
  buildNavigableOfficeObjectSignature,
  getNavigableOfficeObjects,
} from "./office-object-navigation";
import { OfficeObjectRenderer } from "./office-object-renderer";
import { getOrbitWallFadeMask, OfficeRoomShell, type WallFadeMask } from "./office-room-shell";
import type { OfficeSceneProps } from "./types";
import { useOfficeSceneBootstrap } from "./use-office-scene-bootstrap";
import { useOfficeSceneCameraTransition, useOfficeSceneTheme } from "./use-office-scene-camera";
import {
  applyLiveStatusToSceneEmployees,
  useOfficeSceneDerivedData,
} from "./use-office-scene-derived-data";
import { useOfficeSceneInteractions } from "./use-office-scene-interactions";
import { getOfficeSceneViewState, isFixedOfficeSceneView } from "./view-profile";

/** Clamps orthographic camera zoom to [minZoom, maxZoom] each frame when in fixed 2.5D. */
function ZoomClamp({ minZoom, maxZoom }: { minZoom: number; maxZoom: number }) {
  useFrame((state) => {
    const camera = state.camera as THREE.OrthographicCamera;
    if (!camera.isOrthographicCamera) return;
    const z = camera.zoom;
    if (z < minZoom) camera.zoom = minZoom;
    else if (z > maxZoom) camera.zoom = maxZoom;
    if (camera.zoom !== z) camera.updateProjectionMatrix();
  });
  return null;
}

function OfficeCameraQaProbe({
  controlsRef,
  policy,
}: {
  controlsRef: React.RefObject<React.ElementRef<typeof OrbitControls> | null>;
  policy: { controlsEnabled: boolean; rotateEnabled: boolean; panEnabled: boolean; zoomEnabled: boolean };
}): null {
  useFrame((state) => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    const camera = state.camera as THREE.OrthographicCamera | THREE.PerspectiveCamera;
    const host = window as Window & { __FARPLANE_OFFICE_CAMERA__?: Record<string, unknown> };
    host.__FARPLANE_OFFICE_CAMERA__ = {
      projection: camera.type,
      position: camera.position.toArray(),
      zoom: "zoom" in camera ? camera.zoom : 1,
      target: controlsRef.current?.target.toArray() ?? null,
      controls: {
        enabled: controlsRef.current?.enabled ?? false,
        enableRotate: controlsRef.current?.enableRotate ?? false,
        enablePan: controlsRef.current?.enablePan ?? false,
        enableZoom: controlsRef.current?.enableZoom ?? false,
        policy,
        mouseButtons: controlsRef.current?.mouseButtons ?? null,
      },
    };
    updateOfficeQaState({ camera: host.__FARPLANE_OFFICE_CAMERA__ });
  });
  return null;
}

/** Returns current orthographic zoom, updating only when zoom changes beyond threshold. */
function useCameraZoomWhenFixed(minZoom: number, maxZoom: number, enabled: boolean) {
  const [zoom, setZoom] = useState(() => minZoom + (maxZoom - minZoom) * 0.5);
  const last = useRef(zoom);
  useFrame((state) => {
    if (!enabled) return;
    const camera = state.camera as THREE.OrthographicCamera;
    if (!camera.isOrthographicCamera) return;
    const z = camera.zoom;
    if (Math.abs(z - last.current) > 0.08) {
      last.current = z;
      setZoom(z);
    }
  });
  useEffect(() => {
    if (!enabled) last.current = zoom;
  }, [enabled, zoom]);
  return zoom;
}

function wallFadeMaskKey(mask: WallFadeMask): string {
  return [
    mask.frontNorth ? "n" : "-",
    mask.frontSouth ? "s" : "-",
    mask.frontWest ? "w" : "-",
    mask.frontEast ? "e" : "-",
    Math.round(mask.fadeStrength * 100),
  ].join("");
}

/** Returns the near-camera wall fade mask for free-orbit perspective mode. */
function useOrbitWallFadeMask(officeLayout: OfficeSceneProps["officeLayout"], enabled: boolean) {
  const bounds = useMemo(() => getOfficeLayoutBounds(officeLayout), [officeLayout]);
  const [mask, setMask] = useState<WallFadeMask | undefined>(undefined);
  const lastKey = useRef("off");

  useFrame((state) => {
    if (!enabled) return;
    const next = getOrbitWallFadeMask(bounds, state.camera.position);
    const nextKey = wallFadeMaskKey(next);
    if (nextKey !== lastKey.current) {
      lastKey.current = nextKey;
      setMask(next.fadeStrength > 0 ? next : undefined);
    }
  });

  useEffect(() => {
    if (!enabled) {
      lastKey.current = "off";
      setMask(undefined);
    }
  }, [enabled]);

  return enabled ? mask : undefined;
}

export function SceneContents(props: OfficeSceneProps): React.JSX.Element {
  const {
    teams,
    employees,
    desks,
    officeObjects,
    officeAreas,
    officeFootprint,
    officeLayout,
    officeDecorSettings,
    officeViewSettings,
    companyId,
    customMeshLoadSignature,
    onNavigationReady,
    onNavigationReset,
  } = props;
  const enableOfficeObjects = import.meta.env.VITE_ENABLE_OFFICE_OBJECTS !== "false";

  const isBuilderMode = useAppStore((state) => state.isBuilderMode);
  const debugMode = useAppStore((state) => state.debugMode);
  const officeOverlays = useAppStore((state) => state.officeOverlays);
  const isAnimatingCamera = useAppStore((state) => state.isAnimatingCamera);
  const setAnimatingCamera = useAppStore((state) => state.setAnimatingCamera);
  const isDragging = useAppStore((state) => state.isDragging);
  const placementMode = useAppStore((state) => state.placementMode);
  const activeBuilderTool = useAppStore((state) => state.activeBuilderTool);
  const isChatOpen = useChatStore((state) => state.isChatOpen);
  const currentEmployeeId = useChatStore((state) => state.currentEmployeeId);
  const presentationMode = useChatStore((state) => state.presentationMode);
  const selectedAgentId = useAppStore((state) => state.selectedAgentId);
  const isStoryMode = isChatOpen && presentationMode === "story";

  const officeTheme = useOfficeSceneTheme();
  const sceneBuilderMode = isAnimatingCamera ? false : isBuilderMode;
  const forcePerspective = isStoryMode;
  const isLayoutEditing = sceneBuilderMode && activeBuilderTool !== null;
  const overlayPlan = useMemo(
    () =>
      getOfficeDebugOverlayPlan({
        debugMode,
        officeOverlays,
        sceneBuilderMode,
        placementActive: placementMode.active,
      }),
    [debugMode, officeOverlays, placementMode.active, sceneBuilderMode],
  );
  // MEM-0170 decision: fixed 2.5D uses compact scene overlays so Html cards cannot occlude the office.
  const useCompactSceneOverlays = isStoryMode ? false : isFixedOfficeSceneView(officeViewSettings);
  const layoutCenter = useMemo(() => {
    const bounds = getOfficeLayoutBounds(officeLayout);
    return { x: bounds.centerX, z: bounds.centerZ, width: bounds.width, depth: bounds.depth };
  }, [officeLayout]);
  const viewState = getOfficeSceneViewState({
    isBuilderMode: sceneBuilderMode,
    isDragging,
    settings: officeViewSettings,
    forcePerspective,
    layoutCenter,
  });
  const isFixed25 = isFixedOfficeSceneView(officeViewSettings) && !forcePerspective;
  const minZoom = viewState.minZoom ?? 12;
  const maxZoom = viewState.maxZoom ?? 55;
  const cameraZoom = useCameraZoomWhenFixed(minZoom, maxZoom, isFixed25);
  const orbitWallFadeMask = useOrbitWallFadeMask(
    officeLayout,
    !sceneBuilderMode && !isFixed25 && officeViewSettings.viewProfile === "free_orbit_3d",
  );

  const { employeesForScene, teamById, desksByTeamId } = useOfficeSceneDerivedData({
    teams,
    employees,
    desks,
    officeViewSettings,
  });
  const liveStatusByAgentId = useOfficeWorldStore((state) => state.liveStatusByAgentId);
  const runtimeEmployeesForScene = useMemo(
    () =>
      applyLiveStatusToSceneEmployees({
        employees: employeesForScene,
        liveStatusByAgentId,
        officeObjects,
      }),
    [employeesForScene, liveStatusByAgentId, officeObjects],
  );
  const syntheticSkillDemo = useSyntheticTeamSkillDemo();
  const presentedEmployeesForScene = useMemo(
    () =>
      applySyntheticSkillDemo({
        employees: runtimeEmployeesForScene,
        officeObjects,
        demo: syntheticSkillDemo,
      }),
    [officeObjects, runtimeEmployeesForScene, syntheticSkillDemo],
  );

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    const probe = window as Window & {
      __farplaneSyntheticSkillDemo?: typeof syntheticSkillDemo;
    };
    probe.__farplaneSyntheticSkillDemo = syntheticSkillDemo;
    return () => {
      delete probe.__farplaneSyntheticSkillDemo;
    };
  }, [syntheticSkillDemo]);
  const navigableOfficeObjects = useMemo(() => {
    return getNavigableOfficeObjects({
      officeObjects,
      teamById,
      enabled: enableOfficeObjects,
    });
  }, [officeObjects, teamById]);
  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    updateOfficeQaState({ quality: measureOfficeSceneQuality(officeObjects, officeLayout) });
  }, [officeLayout, officeObjects]);
  const navigableOfficeObjectIds = useMemo(
    () => navigableOfficeObjects.map((object) => String(object._id)),
    [navigableOfficeObjects],
  );
  const navigableOfficeObjectSignature = useMemo(
    () =>
      buildNavigableOfficeObjectSignature({
        officeObjects: navigableOfficeObjects,
        teamById,
        desksByTeamId,
        customMeshLoadSignature,
      }),
    [customMeshLoadSignature, desksByTeamId, navigableOfficeObjects, teamById],
  );
  const liveConsultCameraTarget = useMemo<[number, number, number] | null>(() => {
    if (!isChatOpen || presentationMode !== "story") return null;
    const fallbackEmployeeId = (() => {
      const agentId = extractAgentId(selectedAgentId);
      return agentId ? `employee-${agentId}` : null;
    })();
    const candidateIds = [currentEmployeeId, fallbackEmployeeId].filter(
      (value): value is string => Boolean(value),
    );
    for (const employeeId of candidateIds) {
      const employee = presentedEmployeesForScene.find((item) => item._id === employeeId);
      if (!employee) continue;
      return getLiveEmployeePosition(employeeId) ?? employee.initialPosition;
    }
    return null;
  }, [
    currentEmployeeId,
    isChatOpen,
    presentationMode,
    presentedEmployeesForScene,
    selectedAgentId,
  ]);
  const consultCameraTarget = liveConsultCameraTarget;

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    const runStoryFixture = (target: [number, number, number] | null): void => {
      const chat = useChatStore.getState();
      if (!target) {
        chat.setIsChatOpen(false);
        chat.setPresentationMode("classic");
        chat.setCurrentEmployeeId(null);
        return;
      }
      updateOfficeQaState({ storyInvocationAt: performance.now() });
      const employee = [...presentedEmployeesForScene].sort((left, right) => {
        const leftDistance =
          (left.initialPosition[0] - target[0]) ** 2 +
          (left.initialPosition[2] - target[2]) ** 2;
        const rightDistance =
          (right.initialPosition[0] - target[0]) ** 2 +
          (right.initialPosition[2] - target[2]) ** 2;
        return leftDistance - rightDistance;
      })[0];
      if (!employee) return;
      chat.setCurrentEmployeeId(String(employee._id));
      chat.setPresentationMode("story");
      chat.setIsChatOpen(true);
    };
    updateOfficeQaState({ runStoryFixture });
    return () => updateOfficeQaState({ runStoryFixture: undefined });
  }, [presentedEmployeesForScene]);

  const { orbitControlsRef, floorRef, createRegisteredObjectRef, getObjectRef } =
    useOfficeSceneBootstrap({
      officeLayout,
      officeObjectIds: navigableOfficeObjectIds,
      officeObjectSignature: navigableOfficeObjectSignature,
      onNavigationReady,
      onNavigationReset,
    });

  useEffect(() => {
    const controls = orbitControlsRef.current;
    if (!controls || !isFixed25) return;
    const setPrimaryMode = (pan: boolean): void => {
      controls.mouseButtons.LEFT = pan ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === "Space") setPrimaryMode(true);
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code === "Space") setPrimaryMode(false);
    };
    const onBlur = (): void => setPrimaryMode(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [isFixed25, orbitControlsRef]);

  const {
    handleBackgroundClick,
    handleBackgroundContextMenu,
    handleEmployeeClick,
    handleTeamClick,
    handleCeoDeskClick,
  } = useOfficeSceneInteractions({ employees });

  useOfficeSceneCameraTransition({
    isBuilderMode,
    settings: officeViewSettings,
    orbitControlsRef,
    setAnimatingCamera,
    consultCameraTarget,
    forcePerspective,
    layoutCenter,
  });

  const officeObjectsRendered = useMemo(() => {
    if (!enableOfficeObjects) return null;
    return (
      <OfficeObjectRenderer
        officeObjects={officeObjects}
        companyId={companyId}
        teamById={teamById}
        desksByTeamId={desksByTeamId}
        officeFootprint={officeFootprint}
        handleTeamClick={handleTeamClick}
        handleManagementClick={handleCeoDeskClick}
        getObjectRef={getObjectRef}
        createRegisteredObjectRef={createRegisteredObjectRef}
      />
    );
  }, [
    companyId,
    createRegisteredObjectRef,
    desksByTeamId,
    getObjectRef,
    handleCeoDeskClick,
    handleTeamClick,
    officeFootprint,
    officeObjects,
    teamById,
  ]);

  return (
    <>
      <OfficeLighting
        officeTheme={officeTheme}
        officeLayout={officeLayout}
        officeViewSettings={officeViewSettings}
      />
      <OfficeCameraQaProbe controlsRef={orbitControlsRef} policy={{
        controlsEnabled: viewState.controlsEnabled,
        rotateEnabled: viewState.rotateEnabled,
        panEnabled: viewState.panEnabled,
        zoomEnabled: viewState.zoomEnabled,
      }} />

      {isFixed25 && viewState.minZoom != null && viewState.maxZoom != null ? (
        <ZoomClamp minZoom={viewState.minZoom} maxZoom={viewState.maxZoom} />
      ) : null}

      <OrbitControls
        ref={orbitControlsRef}
        enabled={viewState.controlsEnabled && !isLayoutEditing && !consultCameraTarget}
        enableRotate={viewState.rotateEnabled && !isLayoutEditing && !consultCameraTarget}
        enablePan={viewState.panEnabled && !consultCameraTarget}
        enableZoom={viewState.zoomEnabled && !consultCameraTarget}
        panSpeed={sceneBuilderMode ? 0.75 : 1}
        zoomSpeed={sceneBuilderMode ? 0.75 : 1}
        maxPolarAngle={viewState.maxPolarAngle}
        minPolarAngle={viewState.minPolarAngle}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.PAN,
          RIGHT: THREE.MOUSE.PAN,
        }}
        touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
      />

      <OfficeRoomShell
        floorRef={floorRef}
        officeFootprint={officeFootprint}
        officeLayout={officeLayout}
        officeDecorSettings={officeDecorSettings}
        officeViewSettings={officeViewSettings}
        officeTheme={officeTheme}
        sceneBuilderMode={sceneBuilderMode}
        onBackgroundClick={handleBackgroundClick}
        onBackgroundContextMenu={handleBackgroundContextMenu}
        cameraZoom={isFixed25 ? cameraZoom : undefined}
        zoomRange={isFixed25 ? { minZoom, maxZoom } : undefined}
        orbitWallFadeMask={orbitWallFadeMask}
      />
      <OfficeLayoutEditor showDebugLabels={overlayPlan.showLayoutDebugLabels} />
      {import.meta.env.DEV ? (
        <OfficeClickProbe
          teams={teams}
          employees={presentedEmployeesForScene}
          officeObjects={officeObjects}
        />
      ) : null}
      {!sceneBuilderMode &&
        presentedEmployeesForScene.map((employee) => (
          <Employee
            key={employee._id}
            _id={employee._id}
            name={employee.name}
            position={employee.initialPosition}
            activityTargetPosition={employee.activityTargetPosition}
            activityTargetObjectPosition={employee.activityTargetObjectPosition}
            activityTargetSkillId={employee.activityTargetSkillId}
            activityEffectVariant={employee.activityEffectVariant}
            activityScenePresentation={employee.activityScenePresentation}
            isBusy={employee.isBusy}
            isCEO={employee.isCEO}
            isSupervisor={employee.isSupervisor}
            gender={employee.gender}
            onClick={handleEmployeeClick}
            debugMode={overlayPlan.showAgentPaths}
            debugPathOverlay={overlayPlan.showAgentPaths}
            status={(employee.status || "none") as StatusType}
            statusMessage={employee.statusMessage}
            wantsToWander={employee.wantsToWander}
            jobTitle={employee.jobTitle}
            team={employee.team}
            teamId={employee.teamId}
            notificationCount={employee.notificationCount}
            notificationPriority={employee.notificationPriority}
            activityState={employee.activityState}
            activityLabel={employee.activityLabel}
            activityDetail={employee.activityDetail}
            activityUpdatedAt={employee.activityUpdatedAt}
            bubbleMessages={employee.bubbleMessages}
            heartbeatState={employee.heartbeatState}
            heartbeatBubbles={employee.heartbeatBubbles}
            idleInteractionTargets={employee.idleInteractionTargets}
            presencePersistent={employee.presencePersistent}
            presenceExpiresAt={employee.presenceExpiresAt}
            teamCharacterPolicy={employee.teamCharacterPolicy}
            teamCharacterPreview={getTeamCharacterPreviewForEmployee(syntheticSkillDemo, {
              employeeId: String(employee._id),
              teamId: employee.teamId ? String(employee.teamId) : undefined,
              presencePersistent: employee.presencePersistent,
            })}
            profileImageUrl={employee.profileImageUrl}
            useCompactOverlayMode={useCompactSceneOverlays}
            appearance={employee.appearance}
          />
        ))}
      {!sceneBuilderMode ? <ThreadLineageEffects employees={presentedEmployeesForScene} /> : null}

      {officeObjectsRendered}

      <OfficeDebugOverlaySystem
        officeAreas={officeAreas}
        plan={overlayPlan}
        sceneBuilderMode={sceneBuilderMode}
      />
      {enableOfficeObjects ? <PlacementHandler /> : null}
    </>
  );
}
