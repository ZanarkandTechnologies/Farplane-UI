import { describe, expect, it } from "vitest";
import { stripMarkdownFrontmatter } from "./skill-markdown";

describe("stripMarkdownFrontmatter", () => {
  it("removes YAML metadata from rendered Markdown", () => {
    expect(stripMarkdownFrontmatter("---\nname: example\nowner: team\n---\n\n# Example")).toBe(
      "# Example",
    );
  });

  it("leaves ordinary Markdown unchanged", () => {
    expect(stripMarkdownFrontmatter("# Example\n\nBody")).toBe("# Example\n\nBody");
  });
});
