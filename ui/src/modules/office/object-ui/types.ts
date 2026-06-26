"use client";

/**
 * OFFICE OBJECT UI TYPES
 * ======================
 * Data-only contract for object-bound runtime panels and skill affordances.
 *
 * KEY CONCEPTS:
 * - Treat office objects as placed affordances with normalized metadata
 * - Keep scene click routing declarative and independent from panel rendering
 * - Preserve stored metadata compatibility while adding new panel kinds
 *
 * USAGE:
 * - Builder panels write these shapes into office-object metadata
 * - Runtime object clicks convert these bindings into app-store panel state
 */

import type { OfficeInternalPanelId } from "../panels/internal-panel-catalog";

export type OfficeObjectPanelKind = "embed" | "skillShelf" | "documentLibrary" | "internalPanel";
export type OfficeObjectPanelOpenMode = "panel";
export type OfficeObjectPanelAspectRatio = "wide" | "square" | "tall";

export type OfficeObjectUiBinding =
  | { kind: "none" }
  | {
      kind: "embed";
      title: string;
      url: string;
      openMode: OfficeObjectPanelOpenMode;
      aspectRatio?: OfficeObjectPanelAspectRatio;
    }
  | {
      kind: "skillShelf";
      title: string;
      openMode: OfficeObjectPanelOpenMode;
      aspectRatio?: OfficeObjectPanelAspectRatio;
      category?: string;
      skillIds?: string[];
    }
  | {
      kind: "documentLibrary";
      title: string;
      openMode: OfficeObjectPanelOpenMode;
      aspectRatio?: OfficeObjectPanelAspectRatio;
    }
  | {
      kind: "internalPanel";
      panelId: OfficeInternalPanelId;
      title: string;
      openMode: OfficeObjectPanelOpenMode;
    };

export type OfficeObjectSkillEffectVariant = "ghost" | "blink";
export type OfficeObjectSkillEffectMode = "fixed" | "random";

export type OfficeObjectSkillBinding = {
  skillId: string;
  label?: string;
  effectMode?: OfficeObjectSkillEffectMode;
  effectVariant?: OfficeObjectSkillEffectVariant;
  effectPool?: OfficeObjectSkillEffectVariant[];
} | null;

export type OfficeObjectIdleInteraction = {
  enabled: boolean;
  label?: string;
  phrases?: string[];
  weight?: number;
} | null;

export interface OfficeObjectInteractionConfig {
  displayName?: string;
  uiBinding: OfficeObjectUiBinding;
  skillBinding: OfficeObjectSkillBinding;
  idleInteraction?: OfficeObjectIdleInteraction;
}
