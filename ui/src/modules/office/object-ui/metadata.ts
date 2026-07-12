"use client";

/**
 * OFFICE OBJECT UI METADATA
 * =========================
 * Pure normalizers for object-bound UI and skill metadata.
 *
 * KEY CONCEPTS:
 * - Reject invalid panel payloads at parse time
 * - Preserve unrelated metadata keys on write
 * - Keep click-routing helpers side-effect free for scene safety
 *
 * USAGE:
 * - Parse persisted office-object metadata before scene/runtime routing
 * - Build metadata payloads before adapter upsert flows
 */

import {
  getOfficeInternalPanelEntry,
  isOfficeInternalPanelId,
} from "../panels/internal-panel-catalog";
import type {
  OfficeObjectIdleInteraction,
  OfficeObjectInteractionConfig,
  OfficeObjectPanelAspectRatio,
  OfficeObjectSkillBinding,
  OfficeObjectSkillEffectVariant,
  OfficeObjectUiBinding,
} from "./types";

const DEFAULT_UI_BINDING: OfficeObjectUiBinding = { kind: "none" };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeAspectRatio(value: unknown): OfficeObjectPanelAspectRatio | undefined {
  return value === "wide" || value === "square" || value === "tall" ? value : undefined;
}

function isSkillEffectVariant(value: unknown): value is OfficeObjectSkillEffectVariant {
  return value === "ghost" || value === "blink";
}

function normalizeOptionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeSkillIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return normalized.length > 0 ? [...new Set(normalized)] : undefined;
}

function normalizePhrases(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
  return normalized.length > 0 ? [...new Set(normalized)] : undefined;
}

function normalizeOptionalWeight(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, value);
}

export function normalizeHttpUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function parseOfficeObjectUiBinding(
  metadata: Record<string, unknown> | undefined,
): OfficeObjectUiBinding {
  const raw = metadata?.uiBinding;
  if (!isPlainObject(raw)) return DEFAULT_UI_BINDING;

  if (raw.kind === "embed") {
    const title = normalizeOptionalText(raw.title);
    const url = typeof raw.url === "string" ? normalizeHttpUrl(raw.url) : null;
    if (!title || !url) return DEFAULT_UI_BINDING;
    return {
      kind: "embed",
      title,
      url,
      openMode: "panel",
      aspectRatio: normalizeAspectRatio(raw.aspectRatio),
    };
  }

  if (raw.kind === "skillShelf") {
    const title = normalizeOptionalText(raw.title);
    if (!title) return DEFAULT_UI_BINDING;
    return {
      kind: "skillShelf",
      title,
      openMode: "panel",
      aspectRatio: normalizeAspectRatio(raw.aspectRatio),
      category: normalizeOptionalText(raw.category),
      skillIds: normalizeSkillIds(raw.skillIds),
    };
  }

  if (raw.kind === "documentLibrary") {
    const title = normalizeOptionalText(raw.title);
    return {
      kind: "internalPanel",
      panelId: "document-library",
      title: title ?? getOfficeInternalPanelEntry("document-library").label,
      openMode: "panel",
    };
  }

  if (raw.kind === "internalPanel") {
    const panelId = isOfficeInternalPanelId(raw.panelId) ? raw.panelId : null;
    if (!panelId) return DEFAULT_UI_BINDING;
    return {
      kind: "internalPanel",
      panelId,
      title: normalizeOptionalText(raw.title) ?? getOfficeInternalPanelEntry(panelId).label,
      openMode: "panel",
    };
  }

  return DEFAULT_UI_BINDING;
}

export function parseOfficeObjectSkillBinding(
  metadata: Record<string, unknown> | undefined,
): OfficeObjectSkillBinding {
  const raw = metadata?.skillBinding;
  if (!isPlainObject(raw)) return null;
  if (typeof raw.skillId !== "string" || !raw.skillId.trim()) return null;
  const effectMode =
    raw.effectMode === "fixed" || raw.effectMode === "random" ? raw.effectMode : undefined;
  const effectVariant = isSkillEffectVariant(raw.effectVariant) ? raw.effectVariant : undefined;
  const effectPool = Array.isArray(raw.effectPool)
    ? raw.effectPool.filter(isSkillEffectVariant)
    : undefined;
  return {
    skillId: raw.skillId.trim(),
    skillIds: normalizeSkillIds(raw.skillIds),
    label: normalizeOptionalText(raw.label),
    effectMode,
    effectVariant,
    effectPool: effectPool && effectPool.length > 0 ? [...new Set(effectPool)] : undefined,
  };
}

export function parseOfficeObjectIdleInteraction(
  metadata: Record<string, unknown> | undefined,
): OfficeObjectIdleInteraction {
  const raw = metadata?.idleInteraction;
  if (!isPlainObject(raw)) {
    const phrases = normalizePhrases(metadata?.commonPhrases);
    return phrases ? { enabled: true, phrases } : null;
  }
  if (raw.enabled === false) {
    return { enabled: false };
  }

  const phrases =
    normalizePhrases(raw.phrases) ??
    normalizePhrases(raw.commonPhrases) ??
    normalizePhrases(metadata?.commonPhrases);
  const label = normalizeOptionalText(raw.label);
  const weight = normalizeOptionalWeight(raw.weight);
  if (raw.enabled !== true && !phrases && !label) {
    return null;
  }

  return {
    enabled: true,
    label,
    phrases,
    weight,
  };
}

export function parseOfficeObjectInteractionConfig(
  metadata: Record<string, unknown> | undefined,
): OfficeObjectInteractionConfig {
  const displayName = normalizeOptionalText(metadata?.displayName);
  const idleInteraction = parseOfficeObjectIdleInteraction(metadata);
  return {
    displayName,
    uiBinding: parseOfficeObjectUiBinding(metadata),
    skillBinding: parseOfficeObjectSkillBinding(metadata),
    ...(idleInteraction ? { idleInteraction } : {}),
  };
}

export function hasOfficeObjectRuntimeUi(metadata: Record<string, unknown> | undefined): boolean {
  return parseOfficeObjectUiBinding(metadata).kind !== "none";
}

export function buildOfficeObjectMetadata(
  metadata: Record<string, unknown> | undefined,
  next: OfficeObjectInteractionConfig,
): Record<string, unknown> {
  const base = metadata ? { ...metadata } : {};
  if (next.displayName) {
    base.displayName = next.displayName;
  } else {
    delete base.displayName;
  }
  base.uiBinding = next.uiBinding;
  if (next.skillBinding) {
    base.skillBinding = next.skillBinding;
  } else {
    delete base.skillBinding;
  }
  if ("idleInteraction" in next) {
    if (next.idleInteraction) {
      base.idleInteraction = next.idleInteraction;
    } else {
      delete base.idleInteraction;
    }
  }
  return base;
}
