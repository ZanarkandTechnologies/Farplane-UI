import { describe, expect, it } from "vitest";
import { compactSkillPath } from "./skill-invocations-types";

describe("skill invocation UI helpers", () => {
  it("compacts global and repo skill paths", () => {
    expect(compactSkillPath("/Users/me/.codex/skills/harness-advisor/SKILL.md")).toBe(
      "skills/harness-advisor/SKILL.md",
    );
    expect(compactSkillPath("/repo/custom/foo/SKILL.md")).toBe("custom/foo/SKILL.md");
  });
});
