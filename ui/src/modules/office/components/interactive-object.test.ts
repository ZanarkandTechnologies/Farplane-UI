import { describe, expect, it } from "vitest";

import { getBuilderClickAction } from "./interactive-object.builder";
import { getRuntimeHoverLabel } from "./interactive-object";

describe("interactive object hover labels", () => {
  it("uses the UI title for shelf-style objects", () => {
    expect(
      getRuntimeHoverLabel({
        displayName: "Research Shelf",
        uiBinding: {
          kind: "internalPanel",
          panelId: "document-library",
          title: "Docs Library",
          openMode: "panel",
        },
        skillBinding: null,
      }),
    ).toBe("Docs Library");
  });

  it("does not infer labels from skill semantics", () => {
    expect(
      getRuntimeHoverLabel({
        displayName: "Growth Gym",
        uiBinding: { kind: "none" },
        skillBinding: { skillId: "self-improve", label: "Growth Gym" },
      }),
    ).toBeNull();
  });

  it("keeps unbound furniture unlabeled", () => {
    expect(
      getRuntimeHoverLabel({
        displayName: "Plant",
        uiBinding: { kind: "none" },
        skillBinding: null,
      }),
    ).toBeNull();
  });
});

describe("interactive object builder click logic", () => {
  it("opens config on repeat click when settings are allowed", () => {
    expect(getBuilderClickAction({ isSelected: true, allowSettings: true })).toBe("open-config");
  });

  it("clears selection on repeat click when settings are disabled", () => {
    expect(getBuilderClickAction({ isSelected: true, allowSettings: false })).toBe(
      "clear-selection",
    );
  });

  it("selects the object on first click", () => {
    expect(getBuilderClickAction({ isSelected: false, allowSettings: false })).toBe("select");
  });

  it("still treats the first click as selection when settings are available", () => {
    expect(getBuilderClickAction({ isSelected: false, allowSettings: true })).toBe("select");
  });
});
