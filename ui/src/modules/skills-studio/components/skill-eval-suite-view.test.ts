import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SkillEvalSuiteView } from "./skill-eval-suite-view";

describe("SkillEvalSuiteView", () => {
  it("renders canonical fields and useful Farplane metadata", () => {
    const html = renderToStaticMarkup(createElement(SkillEvalSuiteView, {
      path: "evals/evals.json",
      suite: {
        skill_name: "eval",
        evals: [{
          id: "hardcase-01", prompt: "Evaluate the migration.",
          expected_output: "A grounded verdict.", files: ["audit.md"],
          assertions: ["Checks the canonical path"],
          metadata: { farplane: {
            title: "Migration hardcase", context: "Portable Agent Skills suite",
            tags: ["migration"], notes: "Keep harness tasks separate.", hardcase: true,
            difficulty: "high", failure_modes: ["Uses a retired alias"],
          } },
        }],
      },
    }));
    for (const value of [
      "evals/evals.json", "Migration hardcase", "Evaluate the migration.",
      "A grounded verdict.", "audit.md", "Checks the canonical path", "hardcase",
      "Portable Agent Skills suite", "migration", "Keep harness tasks separate.",
      "high", "Uses a retired alias",
    ]) expect(html).toContain(value);
  });
});
