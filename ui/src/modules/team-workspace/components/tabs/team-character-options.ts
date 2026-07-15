/**
 * Dropdown option projection for team character configuration.
 *
 * Inputs: live office objects and their normalized skill bindings.
 * Outputs: transformation skill aliases and one primary destination per skill-bound object.
 * Side effects: none.
 */

import type { OfficeObject } from "@/modules/office/lib/types";
import { parseOfficeObjectInteractionConfig } from "@/modules/office/office-object-ui";

export type TeamCharacterOption = { label: string; value: string };

export function buildTeamCharacterSkillOptions(officeObjects: OfficeObject[]): {
  destinations: TeamCharacterOption[];
  skills: TeamCharacterOption[];
} {
  const destinationByValue = new Map<string, TeamCharacterOption>();
  const skillByValue = new Map<string, TeamCharacterOption>();
  for (const object of officeObjects) {
    const config = parseOfficeObjectInteractionConfig(object.metadata);
    const binding = config.skillBinding;
    if (!binding?.skillId.trim()) continue;
    const primarySkillId = binding.skillId.trim();
    const landmarkLabel = config.displayName?.trim() || binding.label?.trim() || primarySkillId;
    destinationByValue.set(primarySkillId, {
      value: primarySkillId,
      label: landmarkLabel,
    });
    for (const skillId of [primarySkillId, ...(binding.skillIds ?? [])]) {
      const normalizedSkillId = skillId.trim();
      if (!normalizedSkillId || skillByValue.has(normalizedSkillId)) continue;
      skillByValue.set(normalizedSkillId, {
        value: normalizedSkillId,
        label: `${landmarkLabel} · ${normalizedSkillId}`,
      });
    }
  }
  return {
    destinations: [...destinationByValue.values()].sort((a, b) => a.label.localeCompare(b.label)),
    skills: [...skillByValue.values()].sort((a, b) => a.label.localeCompare(b.label)),
  };
}
