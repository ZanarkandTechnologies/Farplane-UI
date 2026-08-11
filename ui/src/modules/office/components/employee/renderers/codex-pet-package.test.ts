import { describe, expect, it } from "vitest";

import {
  buildCodexPetAssetUrl,
  buildCodexPetManifestUrl,
  HATCH_PET_ATLAS,
  HATCH_PET_ATLAS_V2,
  isCodexPetManifest,
  isValidHatchPetAtlasSize,
  normalizeCodexPetManifest,
} from "./codex-pet-package";

describe("codex pet package normalization", () => {
  it("normalizes hatch-pet package metadata into a fixed office sprite manifest", () => {
    const manifest = normalizeCodexPetManifest(
      {
        id: "mini-kenji",
        displayName: "Mini Kenji",
        description: "A compact worker sprite.",
        spritesheetPath: "spritesheet.webp",
      },
      "/codex/pets/mini-kenji/spritesheet.webp",
    );

    expect(manifest.atlasUrl).toBe("/codex/pets/mini-kenji/spritesheet.webp");
    expect(manifest.dimensions).toEqual({
      width: HATCH_PET_ATLAS.width,
      height: HATCH_PET_ATLAS.height,
    });
    expect(manifest.cell).toEqual({ width: 192, height: 208 });
    expect(manifest.animations["running-right"]).toMatchObject({ row: 1, frames: 8, loop: true });
    expect(manifest.animations.review.durationsMs.at(-1)).toBe(280);
  });

  it("builds encoded bridge URLs for Codex pet packages", () => {
    expect(buildCodexPetManifestUrl("mini kenji")).toBe("/codex/pets/mini%20kenji/pet.json");
    expect(buildCodexPetAssetUrl("mini kenji", "spritesheet.webp")).toBe(
      "/codex/pets/mini%20kenji/spritesheet.webp",
    );
  });

  it("validates the minimal Codex pet manifest shape", () => {
    expect(
      isCodexPetManifest({
        id: "patch-face",
        displayName: "Patch",
        description: "Face pet.",
        spritesheetPath: "spritesheet.webp",
      }),
    ).toBe(true);
    expect(isCodexPetManifest({ id: "missing-sheet" })).toBe(false);
  });

  it("validates the fixed hatch-pet atlas size", () => {
    expect(isValidHatchPetAtlasSize(1536, 1872)).toBe(true);
    expect(isValidHatchPetAtlasSize(1536, 2288)).toBe(true);
    expect(isValidHatchPetAtlasSize(192, 208)).toBe(false);
    expect(isValidHatchPetAtlasSize(1536, 1536)).toBe(false);
  });

  it("uses the extended v2 grid while retaining standard animation rows", () => {
    const manifest = normalizeCodexPetManifest(
      {
        id: "mini-kenji",
        displayName: "Mini Kenji",
        description: "Extended directional pet.",
        spriteVersionNumber: 2,
        spritesheetPath: "spritesheet.webp",
      },
      "/codex/pets/mini-kenji/spritesheet.webp",
    );

    expect(manifest.dimensions).toEqual({
      width: HATCH_PET_ATLAS_V2.width,
      height: HATCH_PET_ATLAS_V2.height,
    });
    expect(manifest.grid).toEqual({ columns: 8, rows: 11 });
    expect(manifest.animations.review).toMatchObject({ row: 8, frames: 6 });
  });
});
