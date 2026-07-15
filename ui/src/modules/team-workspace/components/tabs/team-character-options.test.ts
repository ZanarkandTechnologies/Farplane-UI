import { describe, expect, it } from "vitest";
import type { OfficeObject } from "@/modules/office/lib/types";
import { buildTeamCharacterSkillOptions } from "./team-character-options";

describe("buildTeamCharacterSkillOptions", () => {
  it("uses all skill-bound objects for destinations and exposes their skill aliases", () => {
    const result = buildTeamCharacterSkillOptions([
      {
        _id: "library",
        meshType: "activity-landmark",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        metadata: {
          displayName: "Research Library",
          skillBinding: { skillId: "research", skillIds: ["summarize"] },
        },
      },
      {
        _id: "legacy-shelf",
        meshType: "bookshelf",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        metadata: { skillBinding: { skillId: "farplane-map" } },
      },
    ] as OfficeObject[]);

    expect(result.destinations).toEqual([
      { label: "farplane-map", value: "farplane-map" },
      { label: "Research Library", value: "research" },
    ]);
    expect(result.skills.map((option) => option.value)).toEqual([
      "farplane-map",
      "research",
      "summarize",
    ]);
  });
});
