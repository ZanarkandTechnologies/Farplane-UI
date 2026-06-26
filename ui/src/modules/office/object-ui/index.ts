"use client";

export {
  getObjectBindingHealth,
  getObjectBindingHealthLabel,
  type ObjectBindingHealth,
  summarizeOfficeObjectUiBinding,
} from "./binding-summary";
export {
  buildOfficeObjectMetadata,
  hasOfficeObjectRuntimeUi,
  normalizeHttpUrl,
  parseOfficeObjectIdleInteraction,
  parseOfficeObjectInteractionConfig,
  parseOfficeObjectSkillBinding,
  parseOfficeObjectUiBinding,
} from "./metadata";
export {
  buildOfficeObjectPanelState,
  buildOfficeObjectRuntimeLaunch,
  type OfficeObjectRuntimeLaunch,
} from "./runtime-panel";
export type {
  OfficeObjectIdleInteraction,
  OfficeObjectInteractionConfig,
  OfficeObjectPanelAspectRatio,
  OfficeObjectPanelKind,
  OfficeObjectPanelOpenMode,
  OfficeObjectSkillBinding,
  OfficeObjectSkillEffectMode,
  OfficeObjectSkillEffectVariant,
  OfficeObjectUiBinding,
} from "./types";
