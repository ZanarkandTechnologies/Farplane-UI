import { describe, expect, it } from "vitest";

import { getRuntimeHoverLabel } from "./interactive-object";
import { getBuilderClickAction } from "./interactive-object.builder";

describe("interactive object hover labels", () => {
  for (const { name, object, expected } of [
    {
      name: "uses the UI title for shelf-style objects",
      object: {
        displayName: "Research Shelf",
        uiBinding: {
          kind: "internalPanel",
          panelId: "document-library",
          title: "Docs Library",
          openMode: "panel",
        },
        skillBinding: null,
      },
      expected: "Docs Library",
    },
    {
      name: "does not infer labels from skill semantics",
      object: {
        displayName: "Growth Gym",
        uiBinding: { kind: "none" },
        skillBinding: { skillId: "self-improve", label: "Growth Gym" },
      },
      expected: null,
    },
    {
      name: "keeps unbound furniture unlabeled",
      object: {
        displayName: "Plant",
        uiBinding: { kind: "none" },
        skillBinding: null,
      },
      expected: null,
    },
  ] as const) {
    it(name, () => {
      expect(getRuntimeHoverLabel(object)).toBe(expected);
    });
  }
});

describe("interactive object builder click logic", () => {
  for (const { name, input, expected } of [
    {
      name: "opens config on repeat click when settings are allowed",
      input: { isSelected: true, allowSettings: true },
      expected: "open-config",
    },
    {
      name: "clears selection on repeat click when settings are disabled",
      input: { isSelected: true, allowSettings: false },
      expected: "clear-selection",
    },
    {
      name: "selects the object on first click",
      input: { isSelected: false, allowSettings: false },
      expected: "select",
    },
    {
      name: "still treats the first click as selection when settings are available",
      input: { isSelected: false, allowSettings: true },
      expected: "select",
    },
  ] as const) {
    it(name, () => {
      expect(getBuilderClickAction(input)).toBe(expected);
    });
  }
});
