import { describe, expect, it } from "vitest";
import {
  elementExamples,
  promptFirstLine,
  promptStatus,
  promptTextForDraft,
  promptUnsaved,
} from "./brand-kit-workspace";
import type { BrandKitElementSnapshot, BrandKitPrompt } from "./types";

const prompt: BrandKitPrompt = {
  text: "Captioned Low-Poly Explainer\nUse Seedance 2 in 9:16.",
  revision: 3,
  updatedAtMs: 10,
};

describe("Brand Kit prompt display helpers", () => {
  it("previews the first non-empty prompt line", () => {
    expect(promptFirstLine({ ...prompt, text: "\n\n  First usable line\nSecond line" })).toBe(
      "First usable line",
    );
  });

  it("formats prompt status from revision state", () => {
    expect(promptStatus(prompt)).toBe("prompt rev 3");
  });

  it("uses the stored prompt as the edit draft", () => {
    expect(promptTextForDraft(prompt)).toBe(prompt.text);
  });

  it("detects unsaved prompt edits after trimming trailing whitespace", () => {
    expect(promptUnsaved(prompt, `${prompt.text}   `)).toBe(false);
    expect(promptUnsaved(prompt, "Changed")).toBe(true);
  });
});

describe("Brand Kit golden examples", () => {
  const element: BrandKitElementSnapshot = {
    elementId: "resource:visual",
    kind: "visual",
    title: "Low-poly market tower",
    description: "A literal low-poly scene makes an abstract market mechanism concrete.",
    whyItWorks: "The physical metaphor is understood before the narration has to explain it.",
    goldenExample: {
      assetId: "asset-frame",
      title: "Golden market frame",
      assetKind: "frame",
      storageUrl: "https://example.com/frame.jpg",
      description: "Use the readable silhouette and rough photo-texture contrast.",
    },
    goldenRecipe:
      "Create a new 9:16 low-poly scene that literalizes the current narration beat.",
    tags: ["low-poly"],
    provenance: {
      promotedFrom: "resource_bank",
      promotedAtMs: 10,
    },
    sourceSnapshotHash: "hash",
    approvedAtMs: 10,
  };

  it("uses the stored golden example as the approved element media", () => {
    expect(elementExamples(element, new Map())).toEqual([
      expect.objectContaining({
        assetId: "asset-frame",
        storageUrl: "https://example.com/frame.jpg",
        title: "Golden market frame",
      }),
    ]);
  });

  it("keeps the golden example ahead of a live Resource Bank preview fallback", () => {
    const previews = new Map([
      ["resource-element", { title: "Live preview", assetKind: "image", sourceUrl: "live" }],
    ]);
    const examples = elementExamples(
      {
        ...element,
        provenance: { ...element.provenance, resourceElementId: "resource-element" },
      },
      previews,
    );
    expect(examples.map((example) => example.title)).toEqual([
      "Golden market frame",
      "Live preview",
    ]);
  });
});
