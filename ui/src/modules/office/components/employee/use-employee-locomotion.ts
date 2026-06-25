"use client";

/**
 * USE EMPLOYEE LOCOMOTION
 * =======================
 * Encapsulates employee pathing, idle wandering, and debug path visualization.
 *
 * KEY CONCEPTS:
 * - Keep locomotion state local to each employee instance
 * - Heartbeat state can override raw busy status for desk-routing decisions
 * - Debug overlays are throttled to avoid per-frame React churn
 *
 * MEMORY REFERENCES:
 * - MEM-0144
 */

import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Group } from "three";
import * as THREE from "three";

import { IDLE_DESTINATIONS, TOTAL_HEIGHT } from "@/constants";
import {
  findPathAStar,
  getNearestValidPlacement,
  isGridInitialized,
  isWorldPositionWalkable,
} from "@/modules/navigation/pathfinding/a-star-pathfinding";
import {
  findAvailableDestination,
  releaseEmployeeReservations,
} from "@/modules/navigation/pathfinding/destination-registry";
import type { Id } from "@/lib/entity-types";
import type { AgentState } from "@/modules/runtime";
import { getRandomItem } from "@/lib/utils";
import {
  getEmployeeMovementDirection,
  type EmployeeAnimationMode,
  type EmployeeMovementDirection,
} from "./employee-motion";
import {
  hasEmployeeDeskTargetChanged,
  shouldEmployeeRouteToDesk,
  shouldSnapEmployeeToUpdatedDeskTarget,
  toEmployeeDeskTarget,
} from "./employee-locomotion-targets";

const IDLE_DESTINATION_ATTEMPTS = Math.max(8, IDLE_DESTINATIONS.length * 2);
const PATH_RETRY_COOLDOWN_MS = 2500;
const DESTINATION_KEY_PRECISION = 2;

type DebugPathData = {
  originalPath: THREE.Vector3[] | null;
  remainingPath: THREE.Vector3[] | null;
};

type UseEmployeeLocomotionOptions = {
  id: Id<"employees">;
  position: [number, number, number];
  activityTargetPosition?: [number, number, number];
  activityTargetSkillId?: string;
  activityEffectVariant?: "ghost" | "blink";
  isBusy?: boolean;
  isCEO?: boolean;
  wantsToWander: boolean;
  heartbeatState?: AgentState;
  debugMode: boolean;
};

type UseEmployeeLocomotionResult = {
  groupRef: React.RefObject<Group | null>;
  debugPathData: DebugPathData;
  debugDeskDecision: string;
  isGoingToDesk: boolean;
  animationMode: EmployeeAnimationMode;
  movementDirection: EmployeeMovementDirection;
};

function getDestinationKey(destination: THREE.Vector3, mode: "desk" | "idle"): string {
  return [
    mode,
    destination.x.toFixed(DESTINATION_KEY_PRECISION),
    destination.z.toFixed(DESTINATION_KEY_PRECISION),
  ].join(":");
}

export function useEmployeeLocomotion({
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
}: UseEmployeeLocomotionOptions): UseEmployeeLocomotionResult {
  const groupRef = useRef<Group>(null);
  const initialPositionRef = useRef<THREE.Vector3>(
    new THREE.Vector3(...toEmployeeDeskTarget(position)),
  );

  const [path, setPath] = useState<THREE.Vector3[] | null>(null);
  const [pathIndex, setPathIndex] = useState(0);
  const [currentDestination, setCurrentDestination] = useState<THREE.Vector3 | null>(null);
  const [idleState, setIdleState] = useState<"wandering" | "waiting">("wandering");
  const [isGoingToDesk, setIsGoingToDesk] = useState(false);
  const [debugPathData, setDebugPathData] = useState<DebugPathData>({
    originalPath: null,
    remainingPath: null,
  });
  const [debugDeskDecision, setDebugDeskDecision] = useState("");
  const [animationMode, setAnimationMode] = useState<EmployeeAnimationMode>("idle");
  const [movementDirection, setMovementDirection] = useState<EmployeeMovementDirection>("none");

  const idleTimerRef = useRef(0);
  const debugPathUpdateRef = useRef(0);
  const activityTargetRef = useRef<THREE.Vector3 | null>(null);
  const failedPathRef = useRef<{ key: string; retryAfter: number } | null>(null);

  const movementSpeed = 1.5;
  const arrivalThreshold = 0.1;

  useEffect(() => {
    return () => {
      releaseEmployeeReservations(id);
    };
  }, [id]);

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.copy(initialPositionRef.current);
    }
  }, []);

  useEffect(() => {
    const previousTarget = initialPositionRef.current;
    const nextTargetTuple = toEmployeeDeskTarget(position);
    const previousTargetTuple: [number, number, number] = [
      previousTarget.x,
      previousTarget.y,
      previousTarget.z,
    ];
    if (!hasEmployeeDeskTargetChanged(previousTargetTuple, nextTargetTuple)) {
      return;
    }

    const group = groupRef.current;
    const shouldSnap =
      group &&
      shouldSnapEmployeeToUpdatedDeskTarget({
        currentPosition: [group.position.x, group.position.y, group.position.z],
        previousDeskTarget: previousTargetTuple,
        nextDeskTarget: nextTargetTuple,
      });

    initialPositionRef.current = new THREE.Vector3(...nextTargetTuple);

    if (activityTargetRef.current) {
      return;
    }

    setPath(null);
    setPathIndex(0);
    setCurrentDestination(null);
    setIsGoingToDesk(false);
    failedPathRef.current = null;
    releaseEmployeeReservations(id);

    if (shouldSnap) {
      group.position.copy(initialPositionRef.current);
      setIdleState("wandering");
      idleTimerRef.current = 0;
    }
  }, [id, position[0], position[1], position[2]]);

  useEffect(() => {
    const shouldSnapToTarget =
      activityEffectVariant === "blink" && Array.isArray(activityTargetPosition);
    if (!shouldSnapToTarget || !activityTargetPosition) {
      activityTargetRef.current = null;
      setCurrentDestination(null);
      setIsGoingToDesk(false);
      return;
    }
    activityTargetRef.current = new THREE.Vector3(
      activityTargetPosition[0],
      TOTAL_HEIGHT / 2,
      activityTargetPosition[2],
    );
    setPath(null);
    setPathIndex(0);
    setCurrentDestination(activityTargetRef.current);
    setIdleState("wandering");
    setIsGoingToDesk(true);
    if (groupRef.current) {
      groupRef.current.position.copy(activityTargetRef.current);
    }
  }, [activityEffectVariant, activityTargetPosition]);

  const chooseIdleDestinationCandidate = useCallback((currentPos: THREE.Vector3) => {
    let newDest: THREE.Vector3;
    do {
      newDest = getRandomItem(IDLE_DESTINATIONS).clone();
      newDest.y = TOTAL_HEIGHT / 2;
    } while (newDest.distanceTo(currentPos) < 1 && IDLE_DESTINATIONS.length > 1);

    return getNearestValidPlacement(newDest, 12) ?? newDest;
  }, []);

  const getRandomWaitTime = useCallback(() => Math.random() * 4 + 4, []);

  const findAndSetPath = useCallback(
    (startPos: THREE.Vector3, endPos: THREE.Vector3, goingToDesk = false) => {
      if (!isGridInitialized()) {
        return null;
      }

      const finalDestination = goingToDesk ? endPos : findAvailableDestination(endPos, id);
      let newPath = findPathAStar(startPos, finalDestination, { silent: true });

      if (!newPath && goingToDesk) {
        const reachableDeskNeighbor = getNearestValidPlacement(endPos, 16);
        if (reachableDeskNeighbor && reachableDeskNeighbor.distanceTo(finalDestination) > 0.05) {
          newPath = findPathAStar(startPos, reachableDeskNeighbor, { silent: true });
        }
      }

      if (newPath) {
        if (goingToDesk && newPath.length > 0 && isWorldPositionWalkable(endPos)) {
          const lastPoint = newPath[newPath.length - 1];
          if (lastPoint.distanceTo(endPos) > 0.1) {
            newPath.push(endPos.clone());
          }
        }

        setPath(newPath);
        setPathIndex(0);
        failedPathRef.current = null;
      }

      return newPath;
    },
    [id],
  );

  const findAndSetIdlePath = useCallback(
    (startPos: THREE.Vector3) => {
      if (!isGridInitialized()) {
        return null;
      }

      for (let attempt = 0; attempt < IDLE_DESTINATION_ATTEMPTS; attempt += 1) {
        const candidate = chooseIdleDestinationCandidate(startPos);
        const finalDestination = findAvailableDestination(candidate, id, 8, { silent: true });
        const newPath = findPathAStar(startPos, finalDestination, { silent: true });

        if (newPath) {
          setPath(newPath);
          setPathIndex(0);
          return finalDestination;
        }

        releaseEmployeeReservations(id);
      }

      return null;
    },
    [chooseIdleDestinationCandidate, id],
  );

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const currentPos = groupRef.current.position;
    const desiredY = TOTAL_HEIGHT / 2;
    currentPos.y = desiredY;

    const hasActivityTarget = Boolean(activityTargetRef.current);
    const shouldBeAtDesk = shouldEmployeeRouteToDesk({
      hasActivityTarget,
      heartbeatState,
      isBusy,
      isCEO,
      wantsToWander,
    });
    const deskPosition = activityTargetRef.current ?? initialPositionRef.current;
    const isAlreadyAtAssignedDesk =
      shouldBeAtDesk && currentPos.distanceTo(deskPosition) <= arrivalThreshold;

    if (isGridInitialized() && !isWorldPositionWalkable(currentPos) && !isAlreadyAtAssignedDesk) {
      const safePosition = getNearestValidPlacement(currentPos, 24);
      if (safePosition) {
        safePosition.y = desiredY;
        groupRef.current.position.copy(safePosition);
        setPath(null);
        setPathIndex(0);
        setCurrentDestination(null);
        setIsGoingToDesk(false);
        releaseEmployeeReservations(id);
      }
    }

    let targetPathNode: THREE.Vector3 | null = null;
    let isMoving = false;

    if (debugMode) {
      const nextDecision = hasActivityTarget
        ? `${activityTargetSkillId ?? "skill"} -> object`
        : `${heartbeatState ?? "none"} -> ${shouldBeAtDesk ? "desk" : "wander"}`;
      setDebugDeskDecision((prev) => (prev === nextDecision ? prev : nextDecision));
    }

    if (
      shouldBeAtDesk &&
      !path &&
      !isGoingToDesk &&
      currentDestination === null &&
      currentPos.distanceTo(activityTargetRef.current ?? initialPositionRef.current) <=
        arrivalThreshold
    ) {
      return;
    }

    if (shouldBeAtDesk) {
      if (idleState !== "wandering") {
        setIdleState("wandering");
      }
      idleTimerRef.current = 0;

      const distanceToDesk = currentPos.distanceTo(deskPosition);

      if (distanceToDesk > arrivalThreshold) {
        const needsNewPath = !path || !isGoingToDesk;
        if (needsNewPath) {
          const now = performance.now();
          const pathKey = getDestinationKey(deskPosition, "desk");
          const recentFailure = failedPathRef.current;
          const canRetry =
            !recentFailure || recentFailure.key !== pathKey || now >= recentFailure.retryAfter;

          if (canRetry) {
            if (!isGoingToDesk) {
              setIsGoingToDesk(true);
            }
            const nextPath = findAndSetPath(currentPos.clone(), deskPosition.clone(), true);
            setCurrentDestination(deskPosition);
            if (!nextPath) {
              failedPathRef.current = {
                key: pathKey,
                retryAfter: now + PATH_RETRY_COOLDOWN_MS,
              };
              setIsGoingToDesk(false);
              setCurrentDestination(null);
            }
          }
        }

        if (path && pathIndex < path.length) {
          targetPathNode = path[pathIndex];
          isMoving = true;
        }
      } else {
        if (path) {
          setPath(null);
          releaseEmployeeReservations(id);
        }
        if (isGoingToDesk) {
          setIsGoingToDesk(false);
        }
        if (currentDestination !== null) {
          setCurrentDestination(null);
        }
        if (currentPos.distanceTo(deskPosition) > 0.01) {
          currentPos.lerp(deskPosition, 0.1);
        }
      }
    } else if (idleState === "wandering") {
      if (!path) {
        const newDest = findAndSetIdlePath(currentPos);
        if (newDest) {
          if (isGoingToDesk) {
            setIsGoingToDesk(false);
          }
          setCurrentDestination(newDest);
        } else {
          setCurrentDestination(null);
          setIdleState("waiting");
          idleTimerRef.current = getRandomWaitTime();
        }
      } else if (pathIndex < path.length) {
        targetPathNode = path[pathIndex];
        isMoving = true;
      } else {
        setPath(null);
        setCurrentDestination(null);
        setIdleState("waiting");
        idleTimerRef.current = getRandomWaitTime();
      }
    } else if (idleState === "waiting") {
      idleTimerRef.current = Math.max(0, idleTimerRef.current - delta);
      if (idleTimerRef.current <= 0) {
        releaseEmployeeReservations(id);
        setIdleState("wandering");
      }
    }

    if (isMoving && targetPathNode) {
      targetPathNode = targetPathNode.clone();
      targetPathNode.y = desiredY;

      const direction = new THREE.Vector3().subVectors(targetPathNode, currentPos);
      const distance = direction.length();

      if (distance < arrivalThreshold) {
        setPathIndex((prev) => prev + 1);
      } else {
        const nextMovementDirection = getEmployeeMovementDirection(direction.x, direction.z);
        setMovementDirection((prev) =>
          prev === nextMovementDirection ? prev : nextMovementDirection,
        );
        direction.normalize();
        const moveDistance = movementSpeed * delta;
        groupRef.current.position.add(direction.multiplyScalar(Math.min(moveDistance, distance)));
      }
    } else {
      setMovementDirection((prev) => (prev === "none" ? prev : "none"));
    }

    const nextAnimationMode = isMoving ? "walking" : shouldBeAtDesk ? "working" : "idle";
    setAnimationMode((prev) => (prev === nextAnimationMode ? prev : nextAnimationMode));

    if (debugMode && path && path.length > 0) {
      const now = performance.now();
      if (now - debugPathUpdateRef.current > 500) {
        debugPathUpdateRef.current = now;

        const currentPosClone = groupRef.current.position.clone();
        const newRemainPath =
          path.length > pathIndex ? [currentPosClone, ...path.slice(pathIndex)] : null;

        if (newRemainPath && newRemainPath.length > 1) {
          setDebugPathData((prev) => {
            if (prev.remainingPath?.length === newRemainPath.length) {
              return prev;
            }
            return { originalPath: null, remainingPath: newRemainPath };
          });
        }
      }
    }
  });

  useEffect(() => {
    if (!debugMode) {
      setDebugPathData({ originalPath: null, remainingPath: null });
    }
  }, [debugMode]);

  return {
    groupRef,
    debugPathData,
    debugDeskDecision,
    isGoingToDesk,
    animationMode,
    movementDirection,
  };
}
