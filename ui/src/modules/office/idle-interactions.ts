"use client";

/**
 * OFFICE IDLE INTERACTIONS
 * ========================
 * Derives presentation-only object-interest targets for employees with no active thread.
 *
 * KEY CONCEPTS:
 * - Office object metadata can opt in with `idleInteraction.phrases`
 * - Common furniture gets lightweight default phrases so idle motion has a baseline
 * - Targets are transient scene hints and never rewrite object, desk, or runtime state
 */

import type {
  EmployeeIdleInteractionTarget,
  OfficeId,
  OfficeObject,
} from "@/modules/office/lib/types";
import { resolveActivityScenePresentation } from "./activity-scenes";
import { parseOfficeObjectInteractionConfig } from "./office-object-ui";
import { getOfficeSkillAnchorPosition } from "./skill-targeting";

const DEFAULT_IDLE_PHRASES_BY_MESH_TYPE: Record<string, string[]> = {
  bookshelf: ["Skimming the docs shelf", "Found a useful pattern", "Bookmarking this for later"],
  couch: ["Taking a short think break", "Letting the plan settle", "Back in a minute"],
  pantry: ["Refilling focus", "Snack-driven architecture", "Quick pantry check"],
  plant: [
    "Inspecting office morale",
    "This corner feels calmer",
    "Photosynthesis status: promising",
  ],
  "custom-mesh": ["Checking this station", "Noting the nearby context", "This object looks useful"],
};

const NON_INTERACTION_MESH_TYPES = new Set([
  "team-cluster",
  "wall-art",
  "office-divider",
  "glass-wall",
]);

function getObjectLabel(object: OfficeObject): string {
  const config = parseOfficeObjectInteractionConfig(object.metadata);
  if (config.idleInteraction?.label) return config.idleInteraction.label;
  if (config.displayName) return config.displayName;
  const uiBinding = config.uiBinding;
  if (uiBinding.kind !== "none" && "title" in uiBinding) return uiBinding.title;
  return object.meshType.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function buildIdleInteractionTargets(
  officeObjects: OfficeObject[],
): EmployeeIdleInteractionTarget[] {
  const targets: EmployeeIdleInteractionTarget[] = [];

  for (const object of officeObjects) {
    if (NON_INTERACTION_MESH_TYPES.has(object.meshType)) continue;

    const config = parseOfficeObjectInteractionConfig(object.metadata);
    if (config.idleInteraction?.enabled === false) continue;

    const activityScene =
      object.meshType === "activity-landmark"
        ? resolveActivityScenePresentation(object.metadata)
        : undefined;

    const phrases =
      config.idleInteraction?.phrases ??
      activityScene?.ambientPhrases ??
      DEFAULT_IDLE_PHRASES_BY_MESH_TYPE[object.meshType];
    if (!phrases || phrases.length === 0) continue;

    targets.push({
      objectId: object._id as OfficeId<"officeObjects">,
      label: getObjectLabel(object),
      position: getOfficeSkillAnchorPosition(object),
      objectPosition: object.position,
      phrases,
      activityScene,
    });
  }

  return targets;
}
