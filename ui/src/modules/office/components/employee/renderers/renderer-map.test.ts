import { describe, expect, it } from "vitest";

import {
  characterGraphicsRendererMap,
  getCharacterRendererDefinition,
} from "./renderer-map";

describe("character graphics renderer map", () => {
  it("keeps Three.js humans and sprite sheets behind the same renderer interface", () => {
    expect(Object.keys(characterGraphicsRendererMap).sort()).toEqual([
      "sprite-sheet-2d",
      "three-human",
    ]);
    expect(getCharacterRendererDefinition("three-human").Render).toBeTypeOf("function");
    expect(getCharacterRendererDefinition("sprite-sheet-2d").Render).toBeTypeOf("function");
  });
});
