/**
 * Pure target helpers for employee locomotion.
 *
 * Inputs: employee scene position props, heartbeat/wander state, and current
 * avatar coordinates. Outputs: desk target decisions without React or Three.js.
 * Side effects: none. Keep this as the unit-test seam for desk target syncing.
 */
import { TOTAL_HEIGHT } from "@/constants";
import type { AgentState } from "@/modules/runtime";

export type EmployeeTargetPosition = [number, number, number];

export const DESK_TARGET_CHANGE_EPSILON = 0.001;
export const DESK_REPOSITION_SNAP_THRESHOLD = 0.35;

export function toEmployeeDeskTarget(
  position: EmployeeTargetPosition,
): EmployeeTargetPosition {
  return [position[0], TOTAL_HEIGHT / 2, position[2]];
}

export function getEmployeeTargetDistance(
  left: EmployeeTargetPosition,
  right: EmployeeTargetPosition,
): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}

export function hasEmployeeDeskTargetChanged(
  previousTarget: EmployeeTargetPosition,
  nextTarget: EmployeeTargetPosition,
  epsilon = DESK_TARGET_CHANGE_EPSILON,
): boolean {
  return getEmployeeTargetDistance(previousTarget, nextTarget) > epsilon;
}

export function shouldHeartbeatRouteToDesk(
  heartbeatState?: AgentState,
): boolean {
  return (
    heartbeatState === "running" ||
    heartbeatState === "planning" ||
    heartbeatState === "executing" ||
    heartbeatState === "blocked" ||
    heartbeatState === "error"
  );
}

export function shouldEmployeeRouteToDesk(input: {
  hasActivityTarget: boolean;
  heartbeatState?: AgentState;
  isBusy?: boolean;
  isCEO?: boolean;
  wantsToWander: boolean;
}): boolean {
  const hasHeartbeatState = typeof input.heartbeatState === "string";
  return (
    input.hasActivityTarget ||
    Boolean(input.isCEO) ||
    !input.wantsToWander ||
    (hasHeartbeatState
      ? shouldHeartbeatRouteToDesk(input.heartbeatState)
      : Boolean(input.isBusy))
  );
}

export function shouldSnapEmployeeToUpdatedDeskTarget(input: {
  currentPosition: EmployeeTargetPosition;
  previousDeskTarget: EmployeeTargetPosition;
  nextDeskTarget: EmployeeTargetPosition;
  snapThreshold?: number;
}): boolean {
  if (!hasEmployeeDeskTargetChanged(input.previousDeskTarget, input.nextDeskTarget)) {
    return false;
  }
  return (
    getEmployeeTargetDistance(input.currentPosition, input.previousDeskTarget) <=
    (input.snapThreshold ?? DESK_REPOSITION_SNAP_THRESHOLD)
  );
}
