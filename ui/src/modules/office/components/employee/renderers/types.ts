"use client";

/**
 * Character renderer contracts for office employees.
 *
 * Ownership: office employee presentation only.
 * Inputs: normalized employee runtime state, palette, appearance source, and renderer metadata.
 * Outputs: React Three Fiber visual body nodes.
 * Side effects: renderers may animate local textures/meshes; they must not move the employee group or mutate agent state.
 */

import type { ComponentType } from "react";
import type { EmployeeActivityState } from "@/modules/office/lib/types";
import type { EmployeePresenceVisual } from "../presence-visuals";
import type { EmployeeAnimationMode, EmployeeMovementDirection } from "../employee-motion";

export type CharacterRendererId = "three-human" | "sprite-sheet-2d";

export type CharacterRendererSource =
  | { type: "codex-pet"; petId: string }
  | { type: "url"; atlasUrl: string; manifestUrl?: string };

export type CharacterRendererConfig = {
  id?: CharacterRendererId;
  source?: CharacterRendererSource;
};

export type AvatarPalette = {
  hair: string;
  skin: string;
  shirt: string;
  pants: string;
};

export type CharacterRuntimeState = {
  employeeId: string;
  name: string;
  animationMode: EmployeeAnimationMode;
  movementDirection: EmployeeMovementDirection;
  activityState?: EmployeeActivityState;
  isSelected: boolean;
  isHovered: boolean;
  isHighlighted: boolean;
};

export type CharacterRendererProps = {
  runtime: CharacterRuntimeState;
  colors: AvatarPalette;
  profileImageUrl?: string;
  isCEO?: boolean;
  isSupervisor?: boolean;
  teamId?: string;
  activityState?: EmployeeActivityState;
  useCompactOverlayMode?: boolean;
  projection?: boolean;
  presenceVisual?: EmployeePresenceVisual;
  petType?: "none" | "dog" | "cat" | "goldfish" | "rabbit" | "lobster";
  clothesStyle?: "default" | "dj" | "professional" | "techBro";
  config?: CharacterRendererConfig;
  fallback?: ComponentType<Omit<CharacterRendererProps, "fallback">>;
};

export type CharacterRendererDefinition = {
  id: CharacterRendererId;
  displayName: string;
  Render: ComponentType<CharacterRendererProps>;
};
