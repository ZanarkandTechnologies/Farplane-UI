"use client";
/**
 * EMPLOYEE
 * ========
 * Main office employee avatar shell that composes locomotion, overlays, and decorative meshes.
 *
 * KEY CONCEPTS:
 * - Visual mesh shell stays separate from locomotion state
 * - Avatar overlays are extracted to avoid re-rendering all geometry on label/status changes
 * - The public `Employee` API remains unchanged for `office-scene.tsx`
 *
 * MEMORY REFERENCES:
 * - MEM-0144
 * - MEM-0163
 * - MEM-0188
 */
import { Edges } from "@react-three/drei";
import { type ThreeEvent } from "@react-three/fiber";
import { memo, useCallback, useState } from "react";
import { TOTAL_HEIGHT } from "@/constants";
import type { Id } from "@/lib/entity-types";
import PathVisualizer from "@/modules/navigation/components/path-visualizer";
import type { StatusType } from "@/modules/navigation/components/status-indicator";
import type { EmployeeActivityState } from "@/modules/office/lib/types";
import { type AgentState } from "@/modules/runtime";
import { useAppStore } from "@/store";
import { ContextMenu } from "../context-menu";
import { EmployeePresenceAura, resolveEmployeePresenceVisual } from "./presence-visuals";
import { ThreeHumanCharacterRenderer } from "./renderers/three-human";
import type { CharacterRendererConfig } from "./renderers/types";
import { EmployeeStatusBubbles, formatSkillInvocationLabel } from "./StatusBubbles";
import { useEmployeeActions } from "./use-employee-actions";
import { useEmployeeActivityVisibility } from "./use-employee-activity-visibility";
import { useEmployeeAvatarPalette } from "./use-employee-avatar-palette";
import { useEmployeeCharacterRenderer } from "./use-employee-character-renderer";
import { useEmployeeLocomotion } from "./use-employee-locomotion";
import { useEmployeeVisualEffects } from "./use-employee-visual-effects";

export interface EmployeeProps {
  _id: Id<"employees">;
  name: string;
  position: [number, number, number];
  activityTargetPosition?: [number, number, number];
  activityTargetObjectPosition?: [number, number, number];
  activityTargetSkillId?: string;
  activityEffectVariant?: "ghost" | "blink";
  isBusy?: boolean;
  isCEO?: boolean;
  isSupervisor?: boolean;
  gender?: string;
  onClick: (employeeId: Id<"employees">) => void;
  debugMode?: boolean;
  debugPathOverlay?: boolean;
  status?: StatusType;
  statusMessage?: string;
  wantsToWander?: boolean;
  jobTitle?: string;
  team?: string;
  teamId?: string;
  notificationCount?: number;
  notificationPriority?: number;
  activityState?: EmployeeActivityState;
  activityLabel?: string;
  activityDetail?: string;
  activityUpdatedAt?: number;
  bubbleMessages?: Array<{ threadId: string; message: string; eventAt: number }>;
  heartbeatState?: AgentState;
  heartbeatBubbles?: Array<{ label: string; weight?: number }>;
  presencePersistent?: boolean;
  presenceExpiresAt?: number;
  profileImageUrl?: string;
  useCompactOverlayMode?: boolean;
  appearance?: {
    clothesStyle?: "default" | "dj" | "professional" | "techBro";
    hairColor?: string;
    petType?: "none" | "dog" | "cat" | "goldfish" | "rabbit" | "lobster";
    characterRenderer?: CharacterRendererConfig;
  };
}

const Employee = memo(function Employee({
  _id: id,
  name,
  position,
  activityTargetPosition,
  activityTargetObjectPosition,
  activityTargetSkillId,
  activityEffectVariant,
  isBusy,
  isCEO,
  isSupervisor,
  onClick,
  profileImageUrl,
  debugMode = false,
  debugPathOverlay = debugMode,
  statusMessage,
  wantsToWander = true,
  jobTitle,
  team,
  teamId,
  activityState,
  activityLabel,
  activityDetail,
  activityUpdatedAt,
  bubbleMessages,
  heartbeatState,
  presencePersistent,
  presenceExpiresAt,
  useCompactOverlayMode = false,
  appearance,
}: EmployeeProps) {
  const employeeIdString = `employee-${id}`;
  const isSelected = useAppStore((state) => state.selectedObjectId === employeeIdString);
  const setSelectedObjectId = useAppStore((state) => state.setSelectedObjectId);
  const highlightedEmployeeIds = useAppStore((state) => state.highlightedEmployeeIds);
  const isOfficeOnboardingVisible = useAppStore((state) => state.isOfficeOnboardingVisible);
  const officeOnboardingStep = useAppStore((state) => state.officeOnboardingStep);

  const [isHovered, setIsHovered] = useState(false);
  const isHighlighted = highlightedEmployeeIds.has(id);
  const isCodexThreadEmployee = String(id).startsWith("employee-codex-thread:");
  const {
    visibleActivityState,
    visibleActivityLabel,
    visibleActivityDetail,
    markVisibleActivitySeen,
  } = useEmployeeActivityVisibility({
    employeeId: String(id),
    activityState,
    activityLabel,
    activityDetail,
    activityUpdatedAt,
  });

  const { groupRef, debugDeskDecision, debugPathData, isGoingToDesk, animationMode, movementDirection } =
    useEmployeeLocomotion({
      id,
      position,
      activityTargetPosition,
      activityTargetSkillId,
      activityEffectVariant,
      isBusy,
      isCEO,
      wantsToWander,
      heartbeatState,
      debugMode,
    });
  const finalColors = useEmployeeAvatarPalette({ isCEO, appearance });
  const employeeActions = useEmployeeActions({ id, isCEO, onClick });
  const presenceVisual = resolveEmployeePresenceVisual({ presencePersistent, heartbeatState });

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      setSelectedObjectId(isSelected ? null : employeeIdString);
      markVisibleActivitySeen();
    },
    [employeeIdString, isSelected, markVisibleActivitySeen, setSelectedObjectId],
  );

  const hoverScale = isHovered && !isSelected ? 1.05 : 1;
  const isGhostProjectionActive =
    activityEffectVariant === "ghost" &&
    Array.isArray(activityTargetPosition) &&
    Array.isArray(activityTargetObjectPosition);
  const isBlinkEffectActive =
    activityEffectVariant === "blink" && Array.isArray(activityTargetPosition);
  const { CharacterRenderer, config: characterRendererConfig, runtime: characterRuntime } =
    useEmployeeCharacterRenderer({
      employeeId: String(id),
      name,
      characterRenderer: appearance?.characterRenderer,
      animationMode,
      movementDirection,
      activityState: visibleActivityState,
      isSelected,
      isHovered,
      isHighlighted,
    });
  const {
    avatarRef,
    projectionRef,
    activityLineGeometryRef,
    projectionPulseRef,
    projectionRingRef,
    sourcePulseRef,
    blinkRingRef,
  } = useEmployeeVisualEffects({
    id,
    groupRef,
    hoverScale,
    animationMode,
    activityEffectVariant,
    activityTargetPosition,
    activityTargetObjectPosition,
    isGhostProjectionActive,
    isBlinkEffectActive,
  });
  const onboardingPrompt =
    isOfficeOnboardingVisible && isCEO
      ? officeOnboardingStep === "click-ceo"
        ? "Click me"
        : officeOnboardingStep === "open-chat" && isSelected
          ? "Open Chat"
          : null
      : null;
  const skillInvocationLabel = formatSkillInvocationLabel(activityTargetSkillId);

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: React Three Fiber groups receive pointer events through the 3D canvas hit target. */}
      <group
        ref={groupRef}
        name={`employee-${id}`}
        castShadow
        onClick={handleClick}
        onPointerEnter={(event) => {
          event.stopPropagation();
          setIsHovered(true);
        }}
        onPointerLeave={(event) => {
          event.stopPropagation();
          setIsHovered(false);
        }}
      >
        <mesh name={`employee-hit-target-${id}`} position={[0, 0.68, 0]}>
          <cylinderGeometry args={[0.8, 0.9, TOTAL_HEIGHT + 0.55, 20]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        <EmployeePresenceAura visual={presenceVisual} />

        <group ref={avatarRef}>
          <CharacterRenderer
            runtime={characterRuntime}
            colors={finalColors}
            profileImageUrl={profileImageUrl}
            isCEO={isCEO}
            isSupervisor={isSupervisor}
            teamId={teamId}
            activityState={visibleActivityState}
            useCompactOverlayMode={useCompactOverlayMode}
            petType={appearance?.petType}
            clothesStyle={appearance?.clothesStyle}
            presenceVisual={presenceVisual}
            config={characterRendererConfig}
            fallback={ThreeHumanCharacterRenderer}
          />
        </group>

        {isGhostProjectionActive ? (
          <mesh
            ref={sourcePulseRef}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -TOTAL_HEIGHT / 2 + 0.03, 0]}
          >
            <ringGeometry args={[0.38, 0.7, 32]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.5} />
          </mesh>
        ) : null}

        {(isHovered || isSelected) && (
          <Edges
            scale={1.1}
            color={isSelected ? "#00ff00" : "#ffffff"}
            lineWidth={isSelected ? 2 : 1}
          />
        )}

        {isGhostProjectionActive ? (
          <line>
            <bufferGeometry ref={activityLineGeometryRef} attach="geometry" />
            <lineBasicMaterial attach="material" color="#f59e0b" transparent opacity={0.75} />
          </line>
        ) : null}

        <EmployeeStatusBubbles
          statusMessage={isGhostProjectionActive ? undefined : statusMessage}
          activityState={isGhostProjectionActive ? undefined : visibleActivityState}
          activityLabel={isGhostProjectionActive ? undefined : visibleActivityLabel}
          activityDetail={isGhostProjectionActive ? undefined : visibleActivityDetail}
          isHovered={isHovered}
          isHighlighted={isHighlighted}
          name={name}
          jobTitle={jobTitle}
          team={team}
          totalHeight={TOTAL_HEIGHT}
          debugMode={debugMode}
          debugDeskDecision={debugDeskDecision}
          onboardingPrompt={onboardingPrompt}
          useCompactOverlayMode={useCompactOverlayMode}
          pinReadyActivity={isCodexThreadEmployee}
          skillInvocationLabel={isGhostProjectionActive ? undefined : skillInvocationLabel}
          bubbleMessages={isGhostProjectionActive ? undefined : bubbleMessages}
          presenceExpiresAt={presenceExpiresAt}
        />

        <ContextMenu
          isOpen={isSelected}
          onClose={() => setSelectedObjectId(null)}
          actions={employeeActions}
          title={name}
        />
      </group>

      {isGhostProjectionActive && activityTargetPosition ? (
        <group
          ref={projectionRef}
          position={activityTargetPosition}
          scale={[0.94, 0.94, 0.94]}
          name={`employee-projection-${id}`}
        >
          <mesh ref={projectionPulseRef} position={[0, TOTAL_HEIGHT * 0.5, 0]}>
            <sphereGeometry args={[0.72, 14, 14]} />
            <meshBasicMaterial color="#67e8f9" transparent opacity={0.18} />
          </mesh>
          <mesh
            ref={projectionRingRef}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -TOTAL_HEIGHT / 2 + 0.03, 0]}
          >
            <ringGeometry args={[0.44, 0.86, 36]} />
            <meshBasicMaterial color="#67e8f9" transparent opacity={0.9} />
          </mesh>
          <CharacterRenderer
            runtime={characterRuntime}
            colors={finalColors}
            isCEO={isCEO}
            isSupervisor={isSupervisor}
            projection
            clothesStyle={appearance?.clothesStyle}
            presenceVisual={presenceVisual}
            config={characterRendererConfig}
            fallback={ThreeHumanCharacterRenderer}
          />
          <EmployeeStatusBubbles
            statusMessage={statusMessage}
            activityState={visibleActivityState}
            activityLabel={visibleActivityLabel}
            activityDetail={visibleActivityDetail}
            isHovered={false}
            isHighlighted={false}
            name={name}
            jobTitle={jobTitle}
            team={team}
            totalHeight={TOTAL_HEIGHT}
            debugMode={false}
            debugDeskDecision=""
            onboardingPrompt={null}
            useCompactOverlayMode={useCompactOverlayMode}
            pinReadyActivity={false}
            skillInvocationLabel={skillInvocationLabel}
            bubbleMessages={bubbleMessages}
            presenceExpiresAt={presenceExpiresAt}
          />
        </group>
      ) : null}

      {isBlinkEffectActive && activityTargetPosition ? (
        <mesh
          ref={blinkRingRef}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[
            activityTargetPosition[0],
            activityTargetPosition[1] + 0.03,
            activityTargetPosition[2],
          ]}
        >
          <ringGeometry args={[0.5, 1.0, 40]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.96} />
        </mesh>
      ) : null}

      {debugPathOverlay && (debugPathData.originalPath || debugPathData.remainingPath) ? (
        <PathVisualizer
          originalPath={debugPathData.originalPath}
          remainingPath={debugPathData.remainingPath}
          isGoingToDesk={isGoingToDesk}
          employeeId={id}
        />
      ) : null}
    </>
  );
});

export { Employee };
