"use client";

/**
 * OFFICE OBJECT BINDING SUMMARY
 * =============================
 * Pure view helpers for compact object-binding inspector states.
 *
 * KEY CONCEPTS:
 * - Derives display health from normalized object interaction config
 * - Keeps builder UI labels independent from persisted metadata shape
 * - Avoids React/scene dependencies so tests can cover binding summaries
 *
 * USAGE:
 * - Use in builder panels to show whether an object is unbound, partial, or complete
 */

import { getOfficeInternalPanelEntry } from "../panels/internal-panel-catalog";
import type { OfficeObjectInteractionConfig, OfficeObjectUiBinding } from "./types";

export type ObjectBindingHealth = "unbound" | "ui-bound" | "skill-bound" | "complete";

export function getObjectBindingHealth(config: OfficeObjectInteractionConfig): ObjectBindingHealth {
  const hasUi = config.uiBinding.kind !== "none";
  const hasSkill = Boolean(config.skillBinding?.skillId);
  if (hasUi && hasSkill) return "complete";
  if (hasUi) return "ui-bound";
  if (hasSkill) return "skill-bound";
  return "unbound";
}

export function getObjectBindingHealthLabel(health: ObjectBindingHealth): string {
  switch (health) {
    case "complete":
      return "Complete";
    case "ui-bound":
      return "UI bound";
    case "skill-bound":
      return "Skill target";
    default:
      return "Unbound";
  }
}

export function summarizeOfficeObjectUiBinding(binding: OfficeObjectUiBinding): {
  label: string;
  detail: string;
} {
  if (binding.kind === "embed") {
    let host = "Embed URL";
    try {
      host = new URL(binding.url).host;
    } catch {
      host = binding.url;
    }
    return {
      label: "Embed",
      detail: `${binding.title} · ${host}`,
    };
  }
  if (binding.kind === "skillShelf") {
    const count = binding.skillIds?.length ?? 0;
    const scope = binding.category ? `category: ${binding.category}` : "custom skills";
    return {
      label: "Skill UI",
      detail: `${binding.title} · ${scope}${count > 0 ? ` · ${count} IDs` : ""}`,
    };
  }
  if (binding.kind === "documentLibrary") {
    return {
      label: "Project Docs",
      detail: binding.title,
    };
  }
  if (binding.kind === "internalPanel") {
    const entry = getOfficeInternalPanelEntry(binding.panelId);
    return {
      label: "Internal Panel",
      detail: entry.label,
    };
  }
  return {
    label: "No UI",
    detail: "Clicking this object has no bound panel.",
  };
}
