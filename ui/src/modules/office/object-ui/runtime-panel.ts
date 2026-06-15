"use client";

/**
 * OFFICE OBJECT RUNTIME PANEL BRIDGE
 * ==================================
 * Converts normalized object UI metadata into app-store runtime panel state.
 *
 * KEY CONCEPTS:
 * - Scene components ask for a panel payload instead of branching on panel kinds
 * - Stored object metadata remains the source of truth for runtime object affordances
 * - Panel state is plain data so renderer code stays cheap and serializable
 *
 * USAGE:
 * - Called from `InteractiveObject` when a non-builder scene click occurs
 */

import type { ActiveObjectPanelState } from "@/store/app-store";
import type { OfficeId } from "../lib/types";
import type { OfficeInternalPanelId } from "../panels/internal-panel-catalog";
import type { OfficeObjectInteractionConfig } from "./types";

export type OfficeObjectRuntimeLaunch =
  | { kind: "objectPanel"; panel: ActiveObjectPanelState }
  | {
      kind: "internalPanel";
      panelId: OfficeInternalPanelId;
      objectId: OfficeId<"officeObjects">;
      title: string;
      displayName?: string;
      openedAtMs: number;
    };

export function buildOfficeObjectPanelState(input: {
  objectId: OfficeId<"officeObjects">;
  config: OfficeObjectInteractionConfig;
  openedAtMs: number;
}): ActiveObjectPanelState | null {
  const { objectId, config, openedAtMs } = input;
  const { uiBinding } = config;
  if (uiBinding.kind === "none") return null;
  if (uiBinding.kind === "internalPanel") return null;
  if (uiBinding.kind === "embed") {
    return {
      kind: "embed",
      objectId,
      title: uiBinding.title,
      url: uiBinding.url,
      displayName: config.displayName,
      aspectRatio: uiBinding.aspectRatio,
      openedAtMs,
    };
  }
  if (uiBinding.kind === "documentLibrary") {
    return {
      kind: "documentLibrary",
      objectId,
      title: uiBinding.title,
      displayName: config.displayName,
      aspectRatio: uiBinding.aspectRatio,
      openedAtMs,
    };
  }
  return {
    kind: "skillShelf",
    objectId,
    title: uiBinding.title,
    displayName: config.displayName,
    aspectRatio: uiBinding.aspectRatio,
    category: uiBinding.category,
    skillIds: uiBinding.skillIds,
    openedAtMs,
  };
}

export function buildOfficeObjectRuntimeLaunch(input: {
  objectId: OfficeId<"officeObjects">;
  config: OfficeObjectInteractionConfig;
  openedAtMs: number;
}): OfficeObjectRuntimeLaunch | null {
  const { objectId, config, openedAtMs } = input;
  const { uiBinding } = config;
  if (uiBinding.kind === "none") return null;
  if (uiBinding.kind === "internalPanel") {
    return {
      kind: "internalPanel",
      panelId: uiBinding.panelId,
      objectId,
      title: uiBinding.title,
      displayName: config.displayName,
      openedAtMs,
    };
  }
  const panel = buildOfficeObjectPanelState(input);
  return panel ? { kind: "objectPanel", panel } : null;
}
