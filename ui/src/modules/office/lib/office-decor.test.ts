import { describe, expect, it } from "vitest";
import { DEFAULT_OFFICE_DECOR, OFFICE_DECOR_PACKS } from "./office-decor";

describe("office decor", () => {
  it("uses Sandstone Atelier as the canonical office default", () => {
    expect(DEFAULT_OFFICE_DECOR).toEqual({
      floorPatternId: "sandstone_tiles",
      wallColorId: "gallery_cream",
      backgroundId: "estuary_glow",
    });

    expect(OFFICE_DECOR_PACKS[0]).toMatchObject({
      id: "sandstone-atelier",
      ...DEFAULT_OFFICE_DECOR,
    });
  });
});
