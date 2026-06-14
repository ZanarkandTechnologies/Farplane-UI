import { describe, expect, it } from "vitest";
import { buildSkillWorkbenchModel } from "./skill-workbench-model";

describe("buildSkillWorkbenchModel", () => {
  it("derives special-file artifacts from an embedded skill document", () => {
    const model = buildSkillWorkbenchModel({
      doc: {
        body: [
          "# Example",
          "",
          "## Todo List",
          "- [ ] Write implementation",
          "- [x] Keep proof",
          "",
          "## References",
          "- [Docs](https://example.com)",
        ].join("\n"),
        frontmatter: {
          name: "example",
          skill_template_version: "0.2.0",
        },
        path: "skills/example/SKILL.md",
      },
      edges: [{ source: "example", target: "advise", type: "markdown-ref" }],
      invocationCount: 7,
      node: {
        description: "Example skill",
        id: "example",
        path: "skills/example/SKILL.md",
        source: "local",
        tier: 1,
      },
    });

    expect(model.invocationCount).toBe(7);
    expect(model.todo).toContain("Write implementation");
    expect(model.checklist).toContain("Keep proof");
    expect(model.references).toContain("https://example.com");
    expect(model.outgoing).toHaveLength(1);
    expect(model.artifacts.find((artifact) => artifact.id === "todo")?.available).toBe(true);
    expect(model.artifacts.find((artifact) => artifact.id === "frontmatter")?.detail).toBe(
      "2 keys",
    );
  });
});
