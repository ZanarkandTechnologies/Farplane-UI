import { describe, expect, it } from "vitest";
import { groupCreativeElementsByRecency } from "./elements-workspace-model";
import type { ResourceBankCreativeElement } from "./types";

function element(title: string, createdAtMs: number): ResourceBankCreativeElement {
  return {
    assetId: `${title}-asset`,
    kind: "visual",
    title,
    description: "A compact reusable visual direction.",
    whyItWorks: "It creates a memorable production cue.",
    goldenExample: { assetId: `${title}-example` },
    goldenRecipe: "Recreate the visual language for the current project.",
    tags: [],
    createdAtMs,
  };
}

describe("groupCreativeElementsByRecency", () => {
  it("groups entries by recency and keeps each group newest first", () => {
    const now = new Date(2026, 7, 11, 12).getTime();
    const groups = groupCreativeElementsByRecency(
      [
        element("earlier", new Date(2026, 6, 10, 12).getTime()),
        element("week-old", new Date(2026, 7, 8, 12).getTime()),
        element("today-old", new Date(2026, 7, 11, 1).getTime()),
        element("today-new", new Date(2026, 7, 11, 11).getTime()),
        element("month-old", new Date(2026, 7, 1, 12).getTime()),
      ],
      now,
    );

    expect(groups.map((group) => [group.key, group.elements.map((item) => item.title)])).toEqual([
      ["today", ["today-new", "today-old"]],
      ["week", ["week-old"]],
      ["month", ["month-old"]],
      ["earlier", ["earlier"]],
    ]);
  });
});
