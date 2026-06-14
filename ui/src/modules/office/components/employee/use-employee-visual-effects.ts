"use client";

/**
 * Employee visual effects system.
 *
 * Ownership: per-frame visual motion for employee group scale, avatar pose, ghost projection,
 * blink rings, and activity connector lines.
 * Inputs: R3F group refs, activity effect state, target positions, and animation mode.
 * Outputs: refs consumed by the Employee entity shell.
 * Side effects: mutates Three.js object transforms/material opacity inside `useFrame`.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { RefObject } from "react";
import * as THREE from "three";
import { TOTAL_HEIGHT } from "@/constants";
import type { Id } from "@/lib/entity-types";
import { getEmployeeAnimationPose, type EmployeeAnimationMode } from "./employee-motion";
import { recordDevEmployeePosition } from "./use-dev-employee-position-probe";

export function useEmployeeVisualEffects(input: {
  id: Id<"employees">;
  groupRef: RefObject<THREE.Group | null>;
  hoverScale: number;
  animationMode: EmployeeAnimationMode;
  activityEffectVariant?: "ghost" | "blink";
  activityTargetPosition?: [number, number, number];
  activityTargetObjectPosition?: [number, number, number];
  isGhostProjectionActive: boolean;
  isBlinkEffectActive: boolean;
}): {
  avatarRef: RefObject<THREE.Group | null>;
  projectionRef: RefObject<THREE.Group | null>;
  activityLineGeometryRef: RefObject<THREE.BufferGeometry | null>;
  projectionPulseRef: RefObject<THREE.Mesh | null>;
  projectionRingRef: RefObject<THREE.Mesh | null>;
  sourcePulseRef: RefObject<THREE.Mesh | null>;
  blinkRingRef: RefObject<THREE.Mesh | null>;
} {
  const {
    id,
    groupRef,
    hoverScale,
    animationMode,
    activityEffectVariant,
    activityTargetPosition,
    activityTargetObjectPosition,
    isGhostProjectionActive,
    isBlinkEffectActive,
  } = input;
  const avatarRef = useRef<THREE.Group>(null);
  const projectionRef = useRef<THREE.Group>(null);
  const activityLineGeometryRef = useRef<THREE.BufferGeometry>(null);
  const projectionPulseRef = useRef<THREE.Mesh>(null);
  const projectionRingRef = useRef<THREE.Mesh>(null);
  const sourcePulseRef = useRef<THREE.Mesh>(null);
  const blinkRingRef = useRef<THREE.Mesh>(null);
  const activityEffectStartedAtRef = useRef<number>(0);
  const lastActivityEffectKeyRef = useRef("");
  const animationPhase = useMemo(() => {
    return Array.from(String(id)).reduce((phase, character, index) => {
      return phase + character.charCodeAt(0) * (index + 1) * 0.01;
    }, 0);
  }, [id]);
  const activityEffectKey = useMemo(
    () =>
      [
        activityEffectVariant ?? "",
        activityTargetPosition?.join(",") ?? "",
      ].join("|"),
    [activityEffectVariant, activityTargetPosition],
  );

  useEffect(() => {
    if (!activityEffectKey.replace(/\|/g, "")) {
      lastActivityEffectKeyRef.current = "";
      return;
    }
    if (lastActivityEffectKeyRef.current === activityEffectKey) {
      return;
    }
    lastActivityEffectKeyRef.current = activityEffectKey;
    activityEffectStartedAtRef.current = performance.now();
  }, [activityEffectKey]);

  useFrame((state) => {
    if (groupRef.current) {
      recordDevEmployeePosition(id, groupRef);
      const isAtRestScale =
        hoverScale === 1 &&
        Math.abs(groupRef.current.scale.x - 1) < 0.001 &&
        Math.abs(groupRef.current.scale.y - 1) < 0.001 &&
        Math.abs(groupRef.current.scale.z - 1) < 0.001;

      if (!isAtRestScale) {
        const targetScale = new THREE.Vector3(hoverScale, hoverScale, hoverScale);
        groupRef.current.scale.lerp(targetScale, 0.1);
      }
    }

    if (avatarRef.current) {
      const pose = getEmployeeAnimationPose(state.clock.elapsedTime, animationPhase, animationMode);
      avatarRef.current.position.y = pose.bobY;
      avatarRef.current.rotation.z = pose.rollZ;
      avatarRef.current.rotation.y = pose.yawY;
    }

    if (projectionRef.current && activityEffectVariant === "ghost" && activityTargetPosition) {
      const effectElapsed = (performance.now() - activityEffectStartedAtRef.current) / 1000;
      const shimmer = Math.sin(state.clock.elapsedTime * 3 + animationPhase) * 0.08;
      projectionRef.current.position.y = activityTargetPosition[1] + shimmer;
      const settleScale = THREE.MathUtils.lerp(0.4, 0.94, Math.min(effectElapsed / 0.28, 1));
      projectionRef.current.scale.setScalar(settleScale);
      projectionRef.current.rotation.y =
        Math.sin(state.clock.elapsedTime * 1.7 + animationPhase) * 0.08;
    }

    if (projectionPulseRef.current && isGhostProjectionActive) {
      const effectElapsed = (performance.now() - activityEffectStartedAtRef.current) / 1000;
      const pulseScale = 0.85 + Math.min(effectElapsed * 2.1, 1.45);
      projectionPulseRef.current.scale.setScalar(pulseScale);
      const material = projectionPulseRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 0.24 - effectElapsed * 0.15);
    }

    if (projectionRingRef.current && isGhostProjectionActive) {
      const effectElapsed = (performance.now() - activityEffectStartedAtRef.current) / 1000;
      const ringScale = 0.75 + Math.min(effectElapsed * 3.2, 1.95);
      projectionRingRef.current.scale.set(ringScale, ringScale, ringScale);
      const material = projectionRingRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 0.92 - effectElapsed * 1.55);
    }

    if (sourcePulseRef.current && isGhostProjectionActive) {
      const effectElapsed = (performance.now() - activityEffectStartedAtRef.current) / 1000;
      const pulseScale = 0.7 + Math.min(effectElapsed * 1.9, 1.3);
      sourcePulseRef.current.scale.set(pulseScale, 1, pulseScale);
      const material = sourcePulseRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 0.58 - effectElapsed * 1.1);
    }

    if (blinkRingRef.current && isBlinkEffectActive) {
      const effectElapsed = (performance.now() - activityEffectStartedAtRef.current) / 1000;
      const ringScale = 0.7 + Math.min(effectElapsed * 4.6, 2.8);
      blinkRingRef.current.scale.set(ringScale, ringScale, ringScale);
      const material = blinkRingRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 0.96 - effectElapsed * 1.9);
    }

    if (
      activityLineGeometryRef.current &&
      isGhostProjectionActive &&
      activityTargetObjectPosition &&
      groupRef.current
    ) {
      const currentPosition = groupRef.current.position;
      activityLineGeometryRef.current.setFromPoints([
        new THREE.Vector3(0, TOTAL_HEIGHT * 0.62, 0),
        new THREE.Vector3(
          activityTargetObjectPosition[0] - currentPosition.x,
          activityTargetObjectPosition[1] - currentPosition.y + TOTAL_HEIGHT * 0.2,
          activityTargetObjectPosition[2] - currentPosition.z,
        ),
      ]);
    }
  });

  return {
    avatarRef,
    projectionRef,
    activityLineGeometryRef,
    projectionPulseRef,
    projectionRingRef,
    sourcePulseRef,
    blinkRingRef,
  };
}
