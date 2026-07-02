import { describe, expect, it } from "vitest";
import { getSkillSourceKind } from "./shared";

describe("getSkillSourceKind", () => {
  it("classifies operator, project-developed, repo, and global skill paths", () => {
    expect(getSkillSourceKind("/Users/demo/.codex/skills/advise/SKILL.md")).toBe("local");
    expect(getSkillSourceKind("./.agents/skills/agent-browser/SKILL.md")).toBe("project");
    expect(getSkillSourceKind("/workspace/app/.agents/skills/qa/SKILL.md")).toBe("project");
    expect(getSkillSourceKind("skills/frontend-craft/SKILL.md")).toBe("repo");
    expect(getSkillSourceKind("/plugin/cache/openai-bundled/skills/imagegen/SKILL.md")).toBe(
      "global",
    );
  });
});
