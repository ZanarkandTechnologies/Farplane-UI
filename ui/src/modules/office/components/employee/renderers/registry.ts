"use client";

/**
 * Employee character renderer registry.
 *
 * Ownership: maps employee appearance config to visual renderer implementations.
 * Inputs: optional appearance renderer config and dev override query/localStorage.
 * Outputs: renderer id/source with a strict `three-human` fallback.
 * Side effects: reads browser URL/localStorage for dev-only sprite pilot overrides.
 */

import type { CharacterRendererConfig, CharacterRendererId } from "./types";
import {
  characterGraphicsRendererMap,
  DEFAULT_CHARACTER_RENDERER_ID,
} from "./renderer-map";

export const CHARACTER_SPRITE_PET_ID_STORAGE_KEY = "farplane.office.characterSpritePetId";
export const CHARACTER_SPRITE_EMPLOYEE_ID_STORAGE_KEY =
  "farplane.office.characterSpriteEmployeeId";
export const CHARACTER_RENDERER_SETTINGS_EVENT = "farplane:office-character-renderer-settings";

export const characterRendererRegistry = characterGraphicsRendererMap;

export function isCharacterRendererId(value: unknown): value is CharacterRendererId {
  return value === "three-human" || value === "sprite-sheet-2d";
}

function normalizeRendererConfig(value: unknown): CharacterRendererConfig | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const id = isCharacterRendererId(row.id) ? row.id : undefined;
  let source: CharacterRendererConfig["source"];
  if (row.source && typeof row.source === "object") {
    const sourceRow = row.source as Record<string, unknown>;
    if (sourceRow.type === "codex-pet" && typeof sourceRow.petId === "string") {
      source = { type: "codex-pet", petId: sourceRow.petId };
    }
    if (sourceRow.type === "url" && typeof sourceRow.atlasUrl === "string") {
      source = {
        type: "url",
        atlasUrl: sourceRow.atlasUrl,
        manifestUrl: typeof sourceRow.manifestUrl === "string" ? sourceRow.manifestUrl : undefined,
      };
    }
  }
  return id || source ? { id, source } : undefined;
}

export function readOfficeCharacterRendererSettings(): {
  petId: string;
  employeeId: string;
} {
  if (typeof window === "undefined") return { petId: "", employeeId: "" };
  return {
    petId: window.localStorage.getItem(CHARACTER_SPRITE_PET_ID_STORAGE_KEY) ?? "",
    employeeId: window.localStorage.getItem(CHARACTER_SPRITE_EMPLOYEE_ID_STORAGE_KEY) ?? "",
  };
}

export function saveOfficeCharacterRendererSettings(input: {
  petId: string;
  employeeId?: string;
}): { petId: string; employeeId: string } {
  const saved = {
    petId: input.petId.trim(),
    employeeId: input.employeeId?.trim() ?? "",
  };
  if (typeof window === "undefined") return saved;
  if (saved.petId) {
    window.localStorage.setItem(CHARACTER_SPRITE_PET_ID_STORAGE_KEY, saved.petId);
  } else {
    window.localStorage.removeItem(CHARACTER_SPRITE_PET_ID_STORAGE_KEY);
  }
  if (saved.employeeId) {
    window.localStorage.setItem(CHARACTER_SPRITE_EMPLOYEE_ID_STORAGE_KEY, saved.employeeId);
  } else {
    window.localStorage.removeItem(CHARACTER_SPRITE_EMPLOYEE_ID_STORAGE_KEY);
  }
  window.dispatchEvent(new CustomEvent(CHARACTER_RENDERER_SETTINGS_EVENT, { detail: saved }));
  return saved;
}

export function readDevCharacterRendererOverride(employeeId: string): CharacterRendererConfig | undefined {
  if (typeof window === "undefined") return undefined;
  const params = new URLSearchParams(window.location.search);
  const saved = readOfficeCharacterRendererSettings();
  const targetEmployeeId =
    params.get("characterSpriteEmployeeId") ??
    saved.employeeId ??
    "";
  const petId =
    params.get("characterSpritePetId") ??
    saved.petId ??
    "";
  if (!petId.trim()) return undefined;
  if (targetEmployeeId.trim() && targetEmployeeId.trim() !== employeeId) return undefined;
  return { id: "sprite-sheet-2d", source: { type: "codex-pet", petId: petId.trim() } };
}

export function resolveEmployeeCharacterRenderer(input: {
  employeeId: string;
  characterRenderer?: unknown;
  devOverride?: CharacterRendererConfig;
}): { id: CharacterRendererId; config: CharacterRendererConfig } {
  const configured = normalizeRendererConfig(input.characterRenderer);
  const chosen = input.devOverride ?? configured;
  const id = isCharacterRendererId(chosen?.id) ? chosen.id : DEFAULT_CHARACTER_RENDERER_ID;
  if (id === "sprite-sheet-2d" && !chosen?.source) {
    return { id: DEFAULT_CHARACTER_RENDERER_ID, config: { id: DEFAULT_CHARACTER_RENDERER_ID } };
  }
  return { id, config: { ...(chosen ?? {}), id } };
}
