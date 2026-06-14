"use client";

/**
 * Sprite animation state mapping for employee character renderers.
 *
 * Ownership: pure office runtime state to sprite-row selection.
 * Inputs: locomotion mode, movement direction, and employee activity state.
 * Outputs: hatch-pet-compatible animation row ids.
 * Side effects: none.
 */

import type { EmployeeActivityState } from "@/modules/office/lib/types";
import type { EmployeeAnimationMode, EmployeeMovementDirection } from "../employee-motion";

export type SpriteAnimationKey =
  | "idle"
  | "running-right"
  | "running-left"
  | "waving"
  | "jumping"
  | "failed"
  | "waiting"
  | "running"
  | "review";

export type SpriteStateInput = {
  animationMode: EmployeeAnimationMode;
  movementDirection?: EmployeeMovementDirection;
  activityState?: EmployeeActivityState;
};

export function selectSpriteAnimationKey(input: SpriteStateInput): SpriteAnimationKey {
  if (input.activityState === "failed") return "failed";
  if (input.activityState === "waiting") return "waiting";
  if (input.activityState === "review") return "review";
  if (input.activityState === "running") return "running";

  if (input.animationMode === "walking") {
    return "running";
  }

  return "idle";
}
