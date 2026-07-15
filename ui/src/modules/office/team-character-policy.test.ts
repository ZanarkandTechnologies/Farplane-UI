import { describe, expect, it } from "vitest";
import type { TeamCharacterPolicy } from "@/modules/runtime";
import { resolveTeamCharacter, upsertTeamSkillTransformation } from "./team-character-policy";

const policy: TeamCharacterPolicy = {
  persistent: { renderer: "sprite-sheet-2d", petId: "mini-kenji" },
  ephemeral: { renderer: "sprite-sheet-2d", petId: "patch-face" },
  skillTransformations: {
    research: {
      character: { renderer: "sprite-sheet-2d", petId: "mini-chua" },
      enterAnimation: "poof",
    },
  },
};

describe("resolveTeamCharacter", () => {
  it("uses one persistent and one ephemeral team default", () => {
    expect(resolveTeamCharacter({ policy, presencePersistent: true }).config).toMatchObject({
      source: { petId: "mini-kenji" },
    });
    expect(resolveTeamCharacter({ policy, presencePersistent: false }).config).toMatchObject({
      source: { petId: "patch-face" },
    });
  });

  it("temporarily replaces either presence character for a configured skill", () => {
    expect(
      resolveTeamCharacter({ policy, presencePersistent: false, activeSkillId: "research" }),
    ).toEqual({
      config: {
        id: "sprite-sheet-2d",
        source: { type: "codex-pet", petId: "mini-chua" },
      },
      transformationSkillId: "research",
      transition: "poof",
    });
  });

  it("previews an unsaved character and preserves other skill mappings when saving", () => {
    expect(
      resolveTeamCharacter({
        policy,
        activeSkillId: "research",
        previewCharacter: { renderer: "sprite-sheet-2d", petId: "draft-pet" },
      }).config,
    ).toMatchObject({ source: { petId: "draft-pet" } });

    const next = upsertTeamSkillTransformation({
      policy: {
        ...policy,
        skillTransformations: {
          ...policy.skillTransformations,
          review: {
            character: { renderer: "sprite-sheet-2d", petId: "review-pet" },
            enterAnimation: "poof",
          },
        },
      },
      skillId: "research",
      character: { renderer: "sprite-sheet-2d", petId: "mini-chua-v2" },
    });
    expect(next.skillTransformations.review.character.petId).toBe("review-pet");
    expect(next.skillTransformations.research.character.petId).toBe("mini-chua-v2");
  });
});
