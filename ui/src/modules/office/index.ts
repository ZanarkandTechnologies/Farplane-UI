export { default as OfficeScene } from "./office-scene";
export { AgentMemoryPanel } from "./components/agent-memory-panel";
export { AgentSessionPanel } from "./components/agent-session-panel";
export { ManageAgentModal } from "./components/manage-agent-modal";
export { ObjectConfigPanel } from "./components/object-config-panel";
export { ObjectInteractionPanel } from "./components/object-interaction-panel";
export { ObjectTransformPanel } from "./components/object-transform-panel";
export { SkillsPanel } from "./components/skills-panel";
export { preloadMeshes } from "./systems/mesh-cache";
export { usePlacementSystem } from "./systems/placement-system";
export { getGameObjectDefinition } from "./components/object-registry";
export { LayoutEditorHudProvider, useLayoutEditorHud } from "./scene/layout-editor-hud-context";
export { normalizeOfficeObjectId } from "./components/office-object-id";
export { parseOfficeObjectInteractionConfig } from "./office-object-ui";
export {
  buildSkillTargetObjectMap,
  getOfficeSkillAnchorPosition,
  getOfficeSkillAnchorPositionForOccupant,
} from "./skill-targeting";
export {
  buildSkillEffectSeed,
  normalizeSkillEffectPool,
  resolveSkillEffectVariant,
  type SkillEffectConfig,
  type SkillEffectMode,
  type SkillEffectVariant,
} from "./skill-effects";
