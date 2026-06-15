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
  parseOfficeObjectInteractionConfig,
  parseOfficeObjectSkillBinding,
  parseOfficeObjectUiBinding,
} from "./metadata";
export { buildOfficeObjectPanelState } from "./runtime-panel";
export type {
  OfficeObjectInteractionConfig,
  OfficeObjectPanelAspectRatio,
  OfficeObjectPanelKind,
  OfficeObjectPanelOpenMode,
  OfficeObjectSkillBinding,
  OfficeObjectSkillEffectMode,
  OfficeObjectSkillEffectVariant,
  OfficeObjectUiBinding,
} from "./types";
