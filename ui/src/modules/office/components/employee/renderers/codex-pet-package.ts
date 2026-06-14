"use client";

/**
 * Codex hatch-pet package normalization for office character renderers.
 *
 * Ownership: client-safe manifest normalization for already-packaged Codex pets.
 * Inputs: `pet.json` payloads served by the Vite state bridge.
 * Outputs: normalized sprite-sheet manifest with fixed hatch-pet row timings.
 * Side effects: none.
 */

import type { SpriteAnimationKey } from "./sprite-state";

export type CodexPetManifest = {
  id: string;
  displayName: string;
  description: string;
  spritesheetPath: string;
};

export type SpriteSheetAnimationDefinition = {
  row: number;
  frames: number;
  durationsMs: number[];
  loop: boolean;
};

export type SpriteSheetCharacterManifest = {
  id: string;
  displayName: string;
  description: string;
  atlasUrl: string;
  cell: { width: number; height: number };
  grid: { columns: number; rows: number };
  dimensions: { width: number; height: number };
  anchor: { x: number; y: number };
  scale: number;
  animations: Record<SpriteAnimationKey, SpriteSheetAnimationDefinition>;
};

export const HATCH_PET_ATLAS = {
  width: 1536,
  height: 1872,
  columns: 8,
  rows: 9,
  cellWidth: 192,
  cellHeight: 208,
} as const;

export const HATCH_PET_ANIMATIONS: Record<SpriteAnimationKey, SpriteSheetAnimationDefinition> = {
  idle: { row: 0, frames: 6, durationsMs: [280, 110, 110, 140, 140, 320], loop: true },
  "running-right": {
    row: 1,
    frames: 8,
    durationsMs: [120, 120, 120, 120, 120, 120, 120, 220],
    loop: true,
  },
  "running-left": {
    row: 2,
    frames: 8,
    durationsMs: [120, 120, 120, 120, 120, 120, 120, 220],
    loop: true,
  },
  waving: { row: 3, frames: 4, durationsMs: [140, 140, 140, 280], loop: true },
  jumping: { row: 4, frames: 5, durationsMs: [140, 140, 140, 140, 280], loop: true },
  failed: {
    row: 5,
    frames: 8,
    durationsMs: [140, 140, 140, 140, 140, 140, 140, 240],
    loop: true,
  },
  waiting: { row: 6, frames: 6, durationsMs: [150, 150, 150, 150, 150, 260], loop: true },
  running: { row: 7, frames: 6, durationsMs: [120, 120, 120, 120, 120, 220], loop: true },
  review: { row: 8, frames: 6, durationsMs: [150, 150, 150, 150, 150, 280], loop: true },
};

export function isCodexPetManifest(value: unknown): value is CodexPetManifest {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    row.id.trim().length > 0 &&
    typeof row.displayName === "string" &&
    typeof row.description === "string" &&
    typeof row.spritesheetPath === "string" &&
    row.spritesheetPath.trim().length > 0
  );
}

export function isValidHatchPetAtlasSize(width: number, height: number): boolean {
  return width === HATCH_PET_ATLAS.width && height === HATCH_PET_ATLAS.height;
}

export function buildCodexPetManifestUrl(petId: string): string {
  return `/codex/pets/${encodeURIComponent(petId)}/pet.json`;
}

export function buildCodexPetAssetUrl(petId: string, fileName: string): string {
  return `/codex/pets/${encodeURIComponent(petId)}/${encodeURIComponent(fileName)}`;
}

export function normalizeCodexPetManifest(
  manifest: CodexPetManifest,
  atlasUrl: string,
): SpriteSheetCharacterManifest {
  return {
    id: manifest.id,
    displayName: manifest.displayName,
    description: manifest.description,
    atlasUrl,
    cell: { width: HATCH_PET_ATLAS.cellWidth, height: HATCH_PET_ATLAS.cellHeight },
    grid: { columns: HATCH_PET_ATLAS.columns, rows: HATCH_PET_ATLAS.rows },
    dimensions: { width: HATCH_PET_ATLAS.width, height: HATCH_PET_ATLAS.height },
    anchor: { x: 0.5, y: 0 },
    scale: 1.08,
    animations: HATCH_PET_ANIMATIONS,
  };
}
