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
import type { ThreeEvent } from "@react-three/fiber";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { TOTAL_HEIGHT } from "@/constants";
import type { Id } from "@/lib/entity-types";
import PathVisualizer from "@/modules/navigation/components/path-visualizer";
import type { StatusType } from "@/modules/navigation/components/status-indicator";
import type { ActivityScenePresentation } from "@/modules/office/activity-scenes";
import type {
  EmployeeActivityState,
  EmployeeData,
  EmployeeIdleInteractionTarget,
} from "@/modules/office/lib/types";
import type { AgentState, TeamCharacterPolicy } from "@/modules/runtime";
import { useRealtimeCallStore } from "@/modules/realtime-call";
import { useAppStore } from "@/store";
import { resolveTeamCharacter } from "../../team-character-policy";
import { ContextMenu } from "../context-menu";
import { ActivitySceneProps } from "./activity-scene-props";
import { CharacterTransformPoof } from "./character-transform-poof";
import { EMPLOYEE_HIT_CAPSULE_WIDTH, EMPLOYEE_VISUAL_SCALE } from "./employee-scene-scale";
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
import type { TeamCharacterPreviewDetail } from "./use-team-character-preview";

export interface EmployeeProps {
  _id: Id<"employees">;
  name: string;
  position: [number, number, number];
  activityTargetPosition?: [number, number, number];
  activityTargetObjectPosition?: [number, number, number];
  activityTargetSkillId?: string;
  activityEffectVariant?: "ghost" | "blink";
  activityScenePresentation?: ActivityScenePresentation;
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
  bubbleMessages?: Array<{
    threadId: string;
    message: string;
    eventAt: number;
  }>;
  heartbeatState?: AgentState;
  heartbeatBubbles?: Array<{ label: string; weight?: number }>;
  idleInteractionTargets?: EmployeeIdleInteractionTarget[];
  presencePersistent?: boolean;
  persistenceTag?: EmployeeData["persistenceTag"];
  presenceExpiresAt?: number;
  observedRuntime?: EmployeeData["observedRuntime"];
  teamCharacterPolicy?: TeamCharacterPolicy;
  teamCharacterPreview?: TeamCharacterPreviewDetail;
  profileImageUrl?: string;
  useCompactOverlayMode?: boolean;
  appearance?: {
    clothesStyle?: "default" | "dj" | "professional" | "techBro";
    hairColor?: string;
    skinColor?: string;
    shirtColor?: string;
    pantsColor?: string;
    petType?: "none" | "dog" | "cat" | "goldfish" | "rabbit" | "lobster";
    characterRenderer?: CharacterRendererConfig;
  };
}

function recordDevActivityScene(
  employeeId: string,
  scene: ActivityScenePresentation | undefined,
  probeName: "__farplaneOfficeActivityScenes" | "__farplaneOfficeActivitySceneTargets",
): () => void {
  if (!import.meta.env.DEV || typeof window === "undefined") return () => {};
  const probeWindow = window as typeof window & {
    __farplaneOfficeActivityScenes?: Record<
      string,
      Pick<ActivityScenePresentation, "sceneKey" | "label" | "propKind" | "baseSpriteAnimation">
    >;
    __farplaneOfficeActivitySceneTargets?: Record<
      string,
      Pick<ActivityScenePresentation, "sceneKey" | "label" | "propKind" | "baseSpriteAnimation">
    >;
  };
  const probe = (probeWindow[probeName] ??= {});
  if (scene) {
    probe[employeeId] = {
      sceneKey: scene.sceneKey,
      label: scene.label,
      propKind: scene.propKind,
      baseSpriteAnimation: scene.baseSpriteAnimation,
    };
  } else {
    delete probe[employeeId];
  }
  return () => {
    delete probe[employeeId];
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
  activityScenePresentation,
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
  idleInteractionTargets,
  presencePersistent,
  persistenceTag,
  presenceExpiresAt,
  observedRuntime,
  teamCharacterPolicy,
  teamCharacterPreview,
  useCompactOverlayMode = false,
  appearance,
}: EmployeeProps) {
  const employeeIdString = `employee-${id}`;
  const isSelected = useAppStore((state) => state.selectedObjectId === employeeIdString);
  const controlledEmployeeId = useAppStore((state) => state.controlledEmployeeId);
  const controlledEmployeeDestination = useAppStore((state) => state.controlledEmployeeDestination);
  const setSelectedObjectId = useAppStore((state) => state.setSelectedObjectId);
  const highlightedEmployeeIds = useAppStore((state) => state.highlightedEmployeeIds);
  const isOfficeOnboardingVisible = useAppStore((state) => state.isOfficeOnboardingVisible);
  const officeOnboardingStep = useAppStore((state) => state.officeOnboardingStep);
  const isCallSelected = useRealtimeCallStore((state) =>
    state.selectedEmployeeIds.includes(String(id)),
  );
  const toggleCallEmployee = useRealtimeCallStore((state) => state.toggleEmployee);

  const [isHovered, setIsHovered] = useState(false);
  const isHighlighted = highlightedEmployeeIds.has(id);
  const isManuallyControlled = controlledEmployeeId === id;
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

  const {
    groupRef,
    debugDeskDecision,
    debugPathData,
    isGoingToDesk,
    animationMode,
    movementDirection,
    idleInteractionMessage,
    engagedActivityScene,
  } = useEmployeeLocomotion({
    id,
    position,
    activityTargetPosition,
    activityTargetSkillId,
    activityEffectVariant,
    activityScenePresentation,
    isBusy,
    isCEO,
    wantsToWander,
    heartbeatState,
    idleInteractionTargets,
    manualControlActive: isManuallyControlled,
    manualControlDestination: isManuallyControlled ? controlledEmployeeDestination : null,
    debugMode,
  });
  useEffect(
    () =>
      recordDevActivityScene(String(id), engagedActivityScene, "__farplaneOfficeActivityScenes"),
    [engagedActivityScene, id],
  );
  useEffect(
    () =>
      recordDevActivityScene(
        String(id),
        activityScenePresentation,
        "__farplaneOfficeActivitySceneTargets",
      ),
    [activityScenePresentation, id],
  );
  const finalColors = useEmployeeAvatarPalette({ isCEO, appearance });
  const employeeActions = useEmployeeActions({ id, isCEO, observedRuntime, onClick });
  const presenceVisual = useMemo(
    () => resolveEmployeePresenceVisual({ presencePersistent, heartbeatState }),
    [heartbeatState, presencePersistent],
  );

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      if (event.nativeEvent.ctrlKey || event.nativeEvent.metaKey) {
        toggleCallEmployee(String(id));
        setSelectedObjectId(null);
        markVisibleActivitySeen();
        return;
      }
      setSelectedObjectId(isSelected ? null : employeeIdString);
      markVisibleActivitySeen();
    },
    [
      employeeIdString,
      id,
      isSelected,
      markVisibleActivitySeen,
      setSelectedObjectId,
      toggleCallEmployee,
    ],
  );

  const hoverScale = isHovered && !isSelected ? 1.05 : 1;
  const isGhostProjectionActive =
    activityEffectVariant === "ghost" &&
    Array.isArray(activityTargetPosition) &&
    Array.isArray(activityTargetObjectPosition);
  const isBlinkEffectActive =
    activityEffectVariant === "blink" && Array.isArray(activityTargetPosition);
  const effectiveSkillId = teamCharacterPreview?.skillId ?? activityTargetSkillId;
  const resolvedTeamCharacter = useMemo(
    () =>
      resolveTeamCharacter({
        policy: teamCharacterPolicy,
        presencePersistent,
        activeSkillId: effectiveSkillId,
        previewCharacter: teamCharacterPreview?.character,
        fallback: appearance?.characterRenderer,
      }),
    [
      appearance?.characterRenderer,
      effectiveSkillId,
      presencePersistent,
      teamCharacterPolicy,
      teamCharacterPreview?.character,
    ],
  );
  const {
    CharacterRenderer,
    config: characterRendererConfig,
    runtime: characterRuntime,
  } = useEmployeeCharacterRenderer({
    employeeId: String(id),
    name,
    characterRenderer: resolvedTeamCharacter.config,
    preferConfiguredRenderer: Boolean(resolvedTeamCharacter.transformationSkillId),
    animationMode,
    movementDirection,
    activityState: visibleActivityState,
    activityScene: engagedActivityScene,
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
  const presentedBubbleMessages = idleInteractionMessage
    ? [idleInteractionMessage, ...(bubbleMessages ?? [])]
    : bubbleMessages;

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
          <cylinderGeometry
            args={[
              EMPLOYEE_HIT_CAPSULE_WIDTH / 2 - 0.1,
              EMPLOYEE_HIT_CAPSULE_WIDTH / 2,
              TOTAL_HEIGHT + 0.55,
              20,
            ]}
          />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        <EmployeePresenceAura visual={presenceVisual} />

        <group ref={avatarRef} scale={EMPLOYEE_VISUAL_SCALE}>
          {resolvedTeamCharacter.transition === "poof" &&
          resolvedTeamCharacter.transformationSkillId ? (
            <CharacterTransformPoof
              key={`${resolvedTeamCharacter.transformationSkillId}:${characterRendererConfig.source && "petId" in characterRendererConfig.source ? characterRendererConfig.source.petId : characterRendererConfig.id}`}
            />
          ) : null}
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
            suppressLoadingFallback={Boolean(resolvedTeamCharacter.transformationSkillId)}
            fallback={ThreeHumanCharacterRenderer}
          />
          {!isGhostProjectionActive && engagedActivityScene ? (
            <ActivitySceneProps scene={engagedActivityScene} />
          ) : null}
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

        {(isHovered || isSelected || isManuallyControlled || isCallSelected) && (
          <Edges
            scale={1.1}
            color={
              isCallSelected
                ? "#a855f7"
                : isManuallyControlled
                  ? "#38bdf8"
                  : isSelected
                    ? "#00ff00"
                    : "#ffffff"
            }
            lineWidth={isManuallyControlled || isSelected || isCallSelected ? 2 : 1}
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
          activityLabel={
            isGhostProjectionActive
              ? undefined
              : (engagedActivityScene?.label ?? visibleActivityLabel)
          }
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
          persistenceTag={persistenceTag}
          skillInvocationLabel={
            isGhostProjectionActive
              ? undefined
              : (engagedActivityScene?.label ?? skillInvocationLabel)
          }
          bubbleMessages={isGhostProjectionActive ? undefined : presentedBubbleMessages}
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
          {engagedActivityScene ? <ActivitySceneProps scene={engagedActivityScene} /> : null}
          <EmployeeStatusBubbles
            statusMessage={statusMessage}
            activityState={visibleActivityState}
            activityLabel={engagedActivityScene?.label ?? visibleActivityLabel}
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
            persistenceTag={persistenceTag}
            skillInvocationLabel={engagedActivityScene?.label ?? skillInvocationLabel}
            bubbleMessages={presentedBubbleMessages}
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

      {(debugPathOverlay || isManuallyControlled) &&
      (debugPathData.originalPath ||
        debugPathData.remainingPath ||
        (isManuallyControlled && controlledEmployeeDestination)) ? (
        <PathVisualizer
          originalPath={debugPathData.originalPath}
          remainingPath={debugPathData.remainingPath}
          isGoingToDesk={isGoingToDesk}
          employeeId={id}
          variant={isManuallyControlled ? "manual" : "debug"}
          destination={isManuallyControlled ? controlledEmployeeDestination : null}
        />
      ) : null}
    </>
  );
});

export { Employee };
