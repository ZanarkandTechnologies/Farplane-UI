"use client";

/**
 * Employee character renderer selection.
 *
 * Ownership: resolve one employee's graphics renderer and expose the shared runtime contract.
 * Inputs: employee identity, appearance config, presentation state, and movement/activity state.
 * Outputs: selected renderer component, renderer config, and CharacterRuntimeState.
 * Side effects: listens to renderer setting changes and records dev QA diagnostics.
 */

import { type ComponentType, useEffect, useMemo, useState } from "react";
import type { ActivityScenePresentation } from "@/modules/office/activity-scenes";
import type { EmployeeActivityState } from "@/modules/office/lib/types";
import type { EmployeeAnimationMode, EmployeeMovementDirection } from "./employee-motion";
import {
  CHARACTER_RENDERER_SETTINGS_EVENT,
  readDevCharacterRendererOverride,
  resolveEmployeeCharacterRenderer,
} from "./renderers/registry";
import { getCharacterRendererDefinition } from "./renderers/renderer-map";
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
  preferConfiguredRenderer?: boolean;
  animationMode: EmployeeAnimationMode;
  movementDirection: EmployeeMovementDirection;
  activityState?: EmployeeActivityState;
  activityScene?: ActivityScenePresentation;
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
    preferConfiguredRenderer,
    animationMode,
    movementDirection,
    activityState,
    activityScene,
    isSelected,
    isHovered,
    isHighlighted,
  } = input;
  const [devCharacterRendererOverride, setDevCharacterRendererOverride] = useState(() =>
    readDevCharacterRendererOverride(employeeId),
  );
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

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
        preferConfigured: preferConfiguredRenderer,
      }),
    [characterRenderer, devCharacterRendererOverride, employeeId, preferConfiguredRenderer],
  );

  const runtime = useMemo(
    () => ({
      employeeId,
      name,
      animationMode,
      movementDirection,
      activityState,
      activityScene,
      reducedMotion,
      isSelected,
      isHovered,
      isHighlighted,
    }),
    [
      activityState,
      activityScene,
      animationMode,
      employeeId,
      isHighlighted,
      isHovered,
      isSelected,
      movementDirection,
      name,
      reducedMotion,
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
