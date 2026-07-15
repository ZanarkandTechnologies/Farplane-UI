"use client";

/**
 * Team character preview bridge used by the Team Panel.
 *
 * Inputs: employee team/presence identity and browser preview events.
 * Outputs: a temporary semantic skill id consumed by the normal character-policy resolver.
 * Side effects: subscribes to a window event and clears previews after their requested duration.
 */

import { useEffect, useState } from "react";
import type { TeamCharacterRef } from "@/modules/runtime";

export const TEAM_CHARACTER_PREVIEW_EVENT = "farplane:team-character-preview";

export type TeamCharacterPreviewDetail = {
  eventId: string;
  startedAt: number;
  teamId: string;
  targetEmployeeId: string;
  skillId: string;
  destinationSkillId?: string;
  activityEffectVariant?: "ghost" | "blink";
  character?: TeamCharacterRef;
  durationMs?: number;
  persistUntilReplaced?: boolean;
};

export function previewTeamCharacter(detail: TeamCharacterPreviewDetail): void {
  window.dispatchEvent(new CustomEvent(TEAM_CHARACTER_PREVIEW_EVENT, { detail }));
}

export function useSyntheticTeamSkillDemo(): TeamCharacterPreviewDetail | undefined {
  const [demo, setDemo] = useState<TeamCharacterPreviewDetail>();

  useEffect(() => {
    const handleDemo = (event: Event): void => {
      const detail = (event as CustomEvent<TeamCharacterPreviewDetail>).detail;
      if (!detail?.targetEmployeeId || !detail.skillId.trim()) return;
      setDemo(detail);
    };
    window.addEventListener(TEAM_CHARACTER_PREVIEW_EVENT, handleDemo);
    return () => {
      window.removeEventListener(TEAM_CHARACTER_PREVIEW_EVENT, handleDemo);
    };
  }, []);

  useEffect(() => {
    if (!demo || demo.persistUntilReplaced) return;
    const remainingMs = Math.max(0, demo.startedAt + (demo.durationMs ?? 5000) - Date.now());
    const timer = window.setTimeout(() => setDemo(undefined), remainingMs);
    return () => window.clearTimeout(timer);
  }, [demo]);

  return demo;
}

export function getTeamCharacterPreviewForEmployee(
  preview: TeamCharacterPreviewDetail | undefined,
  input: {
    employeeId: string;
    teamId?: string;
    presencePersistent?: boolean;
  },
): TeamCharacterPreviewDetail | undefined {
  if (!preview?.teamId || !preview.skillId?.trim()) return undefined;
  const targetsEmployee =
    preview.teamId === input.teamId &&
    input.presencePersistent !== false &&
    preview.targetEmployeeId === input.employeeId;
  return targetsEmployee ? preview : undefined;
}
