import { describe, expect, it } from "vitest";

import {
  buildOfficeObjectMetadata,
  buildOfficeObjectPanelState,
  getObjectBindingHealth,
  getObjectBindingHealthLabel,
  hasOfficeObjectRuntimeUi,
  normalizeHttpUrl,
  parseOfficeObjectInteractionConfig,
  parseOfficeObjectUiBinding,
  summarizeOfficeObjectUiBinding,
} from "./office-object-ui";

describe("office object ui helpers", () => {
  it("normalizes and validates http urls", () => {
    expect(normalizeHttpUrl("https://earth.nullschool.net")).toBe("https://earth.nullschool.net/");
    expect(normalizeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeHttpUrl("")).toBeNull();
  });

  it("parses embed bindings from metadata", () => {
    expect(
      parseOfficeObjectUiBinding({
        uiBinding: {
          kind: "embed",
          title: "World Monitor",
          url: "https://earth.nullschool.net",
          aspectRatio: "wide",
        },
      }),
    ).toEqual({
      kind: "embed",
      title: "World Monitor",
      url: "https://earth.nullschool.net/",
      openMode: "panel",
      aspectRatio: "wide",
    });
  });

  it("falls back to none for invalid bindings", () => {
    expect(
      parseOfficeObjectUiBinding({
        uiBinding: {
          kind: "embed",
          title: "Blocked",
          url: "ftp://example.com",
        },
      }),
    ).toEqual({ kind: "none" });
  });

  it("parses skill shelf bindings from metadata", () => {
    expect(
      parseOfficeObjectUiBinding({
        uiBinding: {
          kind: "skillShelf",
          title: "Documentation",
          aspectRatio: "square",
          category: "docs",
          skillIds: ["openai-docs", "reference-grounding", "openai-docs", ""],
        },
      }),
    ).toEqual({
      kind: "skillShelf",
      title: "Documentation",
      openMode: "panel",
      aspectRatio: "square",
      category: "docs",
      skillIds: ["openai-docs", "reference-grounding"],
    });
  });

  it("falls back to none for empty skill shelves", () => {
    expect(
      parseOfficeObjectUiBinding({
        uiBinding: {
          kind: "skillShelf",
          title: "   ",
          category: "docs",
        },
      }),
    ).toEqual({ kind: "none" });
  });

  it("builds metadata without dropping unrelated keys", () => {
    const metadata = buildOfficeObjectMetadata(
      {
        meshPublicPath: "/assets/globe.glb",
      },
      {
        displayName: "Ops Globe",
        uiBinding: {
          kind: "embed",
          title: "World Monitor",
          url: "https://earth.nullschool.net/",
          openMode: "panel",
          aspectRatio: "wide",
        },
        skillBinding: null,
      },
    );

    expect(metadata.meshPublicPath).toBe("/assets/globe.glb");
    expect(metadata.displayName).toBe("Ops Globe");
    expect(hasOfficeObjectRuntimeUi(metadata)).toBe(true);
  });

  it("treats skill shelves as runtime object UI", () => {
    const metadata = buildOfficeObjectMetadata(undefined, {
      displayName: "Bookshelf",
      uiBinding: {
        kind: "skillShelf",
        title: "Documentation",
        openMode: "panel",
        aspectRatio: "tall",
        category: "docs",
        skillIds: ["openai-docs"],
      },
      skillBinding: null,
    });

    expect(hasOfficeObjectRuntimeUi(metadata)).toBe(true);
    expect(parseOfficeObjectInteractionConfig(metadata).uiBinding).toEqual({
      kind: "skillShelf",
      title: "Documentation",
      openMode: "panel",
      aspectRatio: "tall",
      category: "docs",
      skillIds: ["openai-docs"],
    });
  });

  it("parses project document library bindings from metadata", () => {
    expect(
      parseOfficeObjectUiBinding({
        uiBinding: {
          kind: "documentLibrary",
          title: "Project Docs",
          aspectRatio: "wide",
        },
      }),
    ).toEqual({
      kind: "documentLibrary",
      title: "Project Docs",
      openMode: "panel",
      aspectRatio: "wide",
    });
  });

  it("parses full interaction config", () => {
    expect(
      parseOfficeObjectInteractionConfig({
        displayName: "Ops Globe",
        uiBinding: {
          kind: "embed",
          title: "World Monitor",
          url: "https://earth.nullschool.net",
        },
        skillBinding: {
          skillId: "world-monitor",
          label: "World Monitor",
          effectMode: "random",
          effectPool: ["ghost", "blink"],
        },
      }),
    ).toEqual({
      displayName: "Ops Globe",
      uiBinding: {
        kind: "embed",
        title: "World Monitor",
        url: "https://earth.nullschool.net/",
        openMode: "panel",
        aspectRatio: undefined,
      },
      skillBinding: {
        skillId: "world-monitor",
        label: "World Monitor",
        effectMode: "random",
        effectVariant: undefined,
        effectPool: ["ghost", "blink"],
      },
    });
  });

  it("drops invalid skill effect variants", () => {
    expect(
      parseOfficeObjectInteractionConfig({
        skillBinding: {
          skillId: "world-monitor",
          effectMode: "fixed",
          effectVariant: "nope",
          effectPool: ["ghost", "bad"],
        },
      }),
    ).toEqual({
      displayName: undefined,
      uiBinding: { kind: "none" },
      skillBinding: {
        skillId: "world-monitor",
        label: undefined,
        effectMode: "fixed",
        effectVariant: undefined,
        effectPool: ["ghost"],
      },
    });
  });

  it("builds skill shelf runtime panel state", () => {
    expect(
      buildOfficeObjectPanelState({
        objectId: "object-1" as never,
        openedAtMs: 123,
        config: {
          displayName: "Bookshelf",
          uiBinding: {
            kind: "skillShelf",
            title: "Documentation",
            openMode: "panel",
            aspectRatio: "square",
            category: "docs",
            skillIds: ["openai-docs"],
          },
          skillBinding: null,
        },
      }),
    ).toEqual({
      kind: "skillShelf",
      objectId: "object-1",
      title: "Documentation",
      displayName: "Bookshelf",
      aspectRatio: "square",
      category: "docs",
      skillIds: ["openai-docs"],
      openedAtMs: 123,
    });
  });

  it("builds project document library runtime panel state", () => {
    expect(
      buildOfficeObjectPanelState({
        objectId: "object-1" as never,
        openedAtMs: 123,
        config: {
          displayName: "Bookshelf",
          uiBinding: {
            kind: "documentLibrary",
            title: "Project Docs",
            openMode: "panel",
            aspectRatio: "wide",
          },
          skillBinding: null,
        },
      }),
    ).toEqual({
      kind: "documentLibrary",
      objectId: "object-1",
      title: "Project Docs",
      displayName: "Bookshelf",
      aspectRatio: "wide",
      openedAtMs: 123,
    });
  });

  it("summarizes object binding health for inspector headers", () => {
    const unbound = {
      displayName: undefined,
      uiBinding: { kind: "none" as const },
      skillBinding: null,
    };
    const uiBound = {
      displayName: undefined,
      uiBinding: {
        kind: "skillShelf" as const,
        title: "Documentation",
        openMode: "panel" as const,
        skillIds: ["openai-docs"],
      },
      skillBinding: null,
    };
    const complete = {
      ...uiBound,
      skillBinding: { skillId: "openai-docs" },
    };

    expect(getObjectBindingHealth(unbound)).toBe("unbound");
    expect(getObjectBindingHealth(uiBound)).toBe("ui-bound");
    expect(getObjectBindingHealth(complete)).toBe("complete");
    expect(getObjectBindingHealthLabel("skill-bound")).toBe("Skill target");
  });

  it("summarizes bound UI for compact inspector rows", () => {
    expect(
      summarizeOfficeObjectUiBinding({
        kind: "embed",
        title: "World Monitor",
        url: "https://earth.nullschool.net/",
        openMode: "panel",
      }),
    ).toEqual({
      label: "Embed",
      detail: "World Monitor · earth.nullschool.net",
    });
    expect(
      summarizeOfficeObjectUiBinding({
        kind: "skillShelf",
        title: "Documentation",
        openMode: "panel",
        category: "documentation",
        skillIds: ["openai-docs", "reference-grounding"],
      }),
    ).toEqual({
      label: "Skill UI",
      detail: "Documentation · category: documentation · 2 IDs",
    });
    expect(
      summarizeOfficeObjectUiBinding({
        kind: "documentLibrary",
        title: "Project Docs",
        openMode: "panel",
      }),
    ).toEqual({
      label: "Project Docs",
      detail: "Project Docs",
    });
  });
});
