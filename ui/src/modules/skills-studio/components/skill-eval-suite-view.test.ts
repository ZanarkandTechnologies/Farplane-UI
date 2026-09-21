import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SkillEvalSuiteView } from "./skill-eval-suite-view";

describe("SkillEvalSuiteView", () => {
  it("renders canonical fields and lean Farplane metadata", () => {
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
            tags: ["migration"], notes: "Keep harness tasks separate.",
            feature_id: "FEAT-0007", workspace_fixture: "evals/files/toy",
            extensions: { "x-example": { enabled: true } },
          } },
        }],
      },
    }));
    for (const value of [
      "evals/evals.json", "Migration hardcase", "Evaluate the migration.",
      "A grounded verdict.", "audit.md", "Checks the canonical path",
      "Portable Agent Skills suite", "migration", "Keep harness tasks separate.",
      "FEAT-0007", "evals/files/toy",
    ]) expect(html).toContain(value);
  });
});
