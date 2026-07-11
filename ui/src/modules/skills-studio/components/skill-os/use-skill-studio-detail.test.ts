import { describe, expect, it } from "vitest";

import type { SkillStudioDetail } from "@/modules/runtime";
import { detailForSelectedSkill } from "./use-skill-studio-detail";

describe("detailForSelectedSkill", () => {
  it("never exposes a previous skill suite after selection changes", () => {
    const detail = { skillId: "brainstorm", evalPath: "evals/evals.json" } as SkillStudioDetail;
    expect(detailForSelectedSkill({ skillId: "brainstorm", detail }, "brainstorm")).toBe(detail);
    expect(detailForSelectedSkill({ skillId: "brainstorm", detail }, "review")).toBeNull();
  });
});
