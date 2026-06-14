import { describe, expect, it } from "vitest";

import {
  buildCodexPetAssetUrl,
  buildCodexPetManifestUrl,
  HATCH_PET_ATLAS,
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
    expect(manifest.dimensions).toEqual({ width: HATCH_PET_ATLAS.width, height: HATCH_PET_ATLAS.height });
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
    expect(isValidHatchPetAtlasSize(192, 208)).toBe(false);
    expect(isValidHatchPetAtlasSize(1536, 1536)).toBe(false);
  });
});
