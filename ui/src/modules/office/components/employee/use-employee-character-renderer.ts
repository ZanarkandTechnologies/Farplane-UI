"use client";

/**
 * Employee character renderer selection.
 *
 * Ownership: resolve one employee's graphics renderer and expose the shared runtime contract.
 * Inputs: employee identity, appearance config, presentation state, and movement/activity state.
 * Outputs: selected renderer component, renderer config, and CharacterRuntimeState.
 * Side effects: listens to renderer setting changes and records dev QA diagnostics.
 */

import { useEffect, useMemo, useState, type ComponentType } from "react";
import type { EmployeeActivityState } from "@/modules/office/lib/types";
import {
  type EmployeeAnimationMode,
  type EmployeeMovementDirection,
} from "./employee-motion";
import { getCharacterRendererDefinition } from "./renderers/renderer-map";
import {
  CHARACTER_RENDERER_SETTINGS_EVENT,
  readDevCharacterRendererOverride,
  resolveEmployeeCharacterRenderer,
} from "./renderers/registry";
import type {
  CharacterRendererConfig,
  CharacterRendererProps,
  CharacterRuntimeState,
} from "./renderers/types";
import { recordDevCharacterRenderer } from "./use-dev-character-renderer-probe";

export function useEmployeeCharacterRenderer(input: {
  employeeId: string;
  name: string;
  characterRenderer?: CharacterRendererConfig;
  animationMode: EmployeeAnimationMode;
  movementDirection: EmployeeMovementDirection;
  activityState?: EmployeeActivityState;
  isSelected: boolean;
  isHovered: boolean;
  isHighlighted: boolean;
}): {
  CharacterRenderer: ComponentType<CharacterRendererProps>;
  config: CharacterRendererConfig;
  runtime: CharacterRuntimeState;
} {
  const {
    employeeId,
    name,
    characterRenderer,
    animationMode,
    movementDirection,
    activityState,
    isSelected,
    isHovered,
    isHighlighted,
  } = input;
  const [devCharacterRendererOverride, setDevCharacterRendererOverride] = useState(() =>
    readDevCharacterRendererOverride(employeeId),
  );

  useEffect(() => {
    setDevCharacterRendererOverride(readDevCharacterRendererOverride(employeeId));
    if (typeof window === "undefined") return undefined;
    const handleSettingsChange = () => {
      setDevCharacterRendererOverride(readDevCharacterRendererOverride(employeeId));
    };
    window.addEventListener(CHARACTER_RENDERER_SETTINGS_EVENT, handleSettingsChange);
    window.addEventListener("storage", handleSettingsChange);
    return () => {
      window.removeEventListener(CHARACTER_RENDERER_SETTINGS_EVENT, handleSettingsChange);
      window.removeEventListener("storage", handleSettingsChange);
    };
  }, [employeeId]);

  const selectedCharacterRenderer = useMemo(
    () =>
      resolveEmployeeCharacterRenderer({
        employeeId,
        characterRenderer,
        devOverride: devCharacterRendererOverride,
      }),
    [characterRenderer, devCharacterRendererOverride, employeeId],
  );

  const runtime = useMemo(
    () => ({
      employeeId,
      name,
      animationMode,
      movementDirection,
      activityState,
      isSelected,
      isHovered,
      isHighlighted,
    }),
    [
      activityState,
      animationMode,
      employeeId,
      isHighlighted,
      isHovered,
      isSelected,
      movementDirection,
      name,
    ],
  );

  useEffect(() => {
    recordDevCharacterRenderer({
      employeeId,
      name,
      rendererId: selectedCharacterRenderer.id,
      config: selectedCharacterRenderer.config,
    });
  }, [employeeId, name, selectedCharacterRenderer]);

  return {
    CharacterRenderer: getCharacterRendererDefinition(selectedCharacterRenderer.id).Render,
    config: selectedCharacterRenderer.config,
    runtime,
  };
}
