/**
 * Team character policy resolution for office employees.
 *
 * Ownership: converts durable team defaults and semantic skill activity into renderer config.
 * Inputs: team policy, persistent/ephemeral presence, and active skill id.
 * Outputs: one presentation-only character plus optional poof transition.
 * Side effects: none; runtime identity and persisted agent records are never mutated.
 */

import type { TeamCharacterPolicy, TeamCharacterRef } from "@/modules/runtime";
import type { EmployeeCharacterRendererConfig } from "./lib/types";

export type ResolvedTeamCharacter = {
  config?: EmployeeCharacterRendererConfig;
  transformationSkillId?: string;
  transition: "poof" | "none";
};

function toRendererConfig(character: TeamCharacterRef): EmployeeCharacterRendererConfig {
  if (character.renderer === "sprite-sheet-2d" && character.petId?.trim()) {
    return {
      id: "sprite-sheet-2d",
      source: { type: "codex-pet", petId: character.petId.trim() },
    };
  }
  return { id: "three-human" };
}

export function resolveTeamCharacter(input: {
  policy?: TeamCharacterPolicy;
  presencePersistent?: boolean;
  activeSkillId?: string;
  previewCharacter?: TeamCharacterRef;
  fallback?: EmployeeCharacterRendererConfig;
}): ResolvedTeamCharacter {
  const skillId = input.activeSkillId?.trim();
  if (skillId && input.previewCharacter) {
    return {
      config: toRendererConfig(input.previewCharacter),
      transformationSkillId: skillId,
      transition: "poof",
    };
  }
  const transformation = skillId ? input.policy?.skillTransformations[skillId] : undefined;
  if (transformation) {
    return {
      config: toRendererConfig(transformation.character),
      transformationSkillId: skillId,
      transition: transformation.enterAnimation,
    };
  }
  const baseCharacter =
    input.presencePersistent === false ? input.policy?.ephemeral : input.policy?.persistent;
  return {
    config: baseCharacter ? toRendererConfig(baseCharacter) : input.fallback,
    transition: "none",
  };
}

export function upsertTeamSkillTransformation(input: {
  policy: TeamCharacterPolicy;
  skillId: string;
  character: TeamCharacterRef;
}): TeamCharacterPolicy {
  return {
    ...input.policy,
    skillTransformations: {
      ...input.policy.skillTransformations,
      [input.skillId.trim()]: {
        character: input.character,
        enterAnimation: "poof",
      },
    },
  };
}
