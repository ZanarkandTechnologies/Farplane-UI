"use client";

/**
 * RUNTIME UI BINDING CARD
 * =======================
 * Compact form card for object click UI bindings.
 *
 * KEY CONCEPTS:
 * - Supports none/embed/skill-ui modes without changing metadata ownership
 * - Renders deeper fields only for the selected runtime UI type
 */

import { CheckCircle2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  OFFICE_INTERNAL_PANEL_CATALOG,
  type OfficeInternalPanelId,
} from "@/modules/office/panels/internal-panel-catalog";

import type { UiBindingMode } from "./types";

export type SkillOption = {
  id: string;
  label: string;
  category?: string;
  uiTagged?: boolean;
};

type RuntimeUiBindingCardProps = {
  mode: UiBindingMode;
  setMode: (mode: UiBindingMode) => void;
  summary: { label: string; detail: string };
  hasRuntimeUi: boolean;
  embedTitle: string;
  setEmbedTitle: (value: string) => void;
  embedUrl: string;
  setEmbedUrl: (value: string) => void;
  aspectRatio: "wide" | "square" | "tall";
  setAspectRatio: (value: "wide" | "square" | "tall") => void;
  skillShelfTitle: string;
  setSkillShelfTitle: (value: string) => void;
  skillShelfAspectRatio: "wide" | "square" | "tall";
  setSkillShelfAspectRatio: (value: "wide" | "square" | "tall") => void;
  skillShelfCategory: string;
  setSkillShelfCategory: (value: string) => void;
  skillShelfIdsText: string;
  setSkillShelfIdsText: (value: string) => void;
  internalPanelId: OfficeInternalPanelId;
  setInternalPanelId: (value: OfficeInternalPanelId) => void;
  skillOptions: SkillOption[];
  uiTaggedSkillOptions: SkillOption[];
};

export function RuntimeUiBindingCard({
  mode,
  setMode,
  summary,
  hasRuntimeUi,
  embedTitle,
  setEmbedTitle,
  embedUrl,
  setEmbedUrl,
  aspectRatio,
  setAspectRatio,
  skillShelfTitle,
  setSkillShelfTitle,
  skillShelfAspectRatio,
  setSkillShelfAspectRatio,
  skillShelfCategory,
  setSkillShelfCategory,
  skillShelfIdsText,
  setSkillShelfIdsText,
  internalPanelId,
  setInternalPanelId,
  skillOptions,
  uiTaggedSkillOptions,
}: RuntimeUiBindingCardProps) {
  const selectedInternalPanel = OFFICE_INTERNAL_PANEL_CATALOG.find(
    (panel) => panel.id === internalPanelId,
  );

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Runtime UI</h3>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {summary.label}: {summary.detail}
          </p>
        </div>
        {hasRuntimeUi ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="object-runtime-ui-mode">Click UI</Label>
        <select
          id="object-runtime-ui-mode"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          value={mode}
          onChange={(event) => setMode(event.target.value as UiBindingMode)}
        >
          <option value="none">None</option>
          <option value="embed">Embed URL</option>
          <option value="skillShelf">Skill UI</option>
          <option value="internalPanel">Internal Panel</option>
        </select>
      </div>

      {mode === "embed" ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="object-embed-title">Title</Label>
              <Input
                id="object-embed-title"
                value={embedTitle}
                onChange={(event) => setEmbedTitle(event.target.value)}
                placeholder="Panel title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="object-embed-aspect">Panel Size</Label>
              <select
                id="object-embed-aspect"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={aspectRatio}
                onChange={(event) =>
                  setAspectRatio(event.target.value as "wide" | "square" | "tall")
                }
              >
                <option value="wide">Wide</option>
                <option value="square">Square</option>
                <option value="tall">Tall</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="object-embed-url">URL</Label>
            <Input
              id="object-embed-url"
              value={embedUrl}
              onChange={(event) => setEmbedUrl(event.target.value)}
              placeholder="https://example.com"
            />
          </div>
        </div>
      ) : null}
      {mode === "skillShelf" ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="object-skill-shelf-title">Title</Label>
              <Input
                id="object-skill-shelf-title"
                value={skillShelfTitle}
                onChange={(event) => setSkillShelfTitle(event.target.value)}
                placeholder="Skill UI title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="object-skill-shelf-aspect">Panel Size</Label>
              <select
                id="object-skill-shelf-aspect"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={skillShelfAspectRatio}
                onChange={(event) =>
                  setSkillShelfAspectRatio(event.target.value as "wide" | "square" | "tall")
                }
              >
                <option value="wide">Wide</option>
                <option value="square">Square</option>
                <option value="tall">Tall</option>
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="object-skill-shelf-category">Category</Label>
              <Input
                id="object-skill-shelf-category"
                value={skillShelfCategory}
                onChange={(event) => setSkillShelfCategory(event.target.value)}
                placeholder="Optional category"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="object-skill-ui-suggestion">Add Skill</Label>
              <select
                id="object-skill-ui-suggestion"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value=""
                disabled={uiTaggedSkillOptions.length === 0}
                onChange={(event) => {
                  const next = event.target.value;
                  if (!next) return;
                  const current = skillShelfIdsText
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean);
                  setSkillShelfIdsText([...new Set([...current, next])].join(", "));
                }}
              >
                <option value="">
                  {uiTaggedSkillOptions.length > 0 ? "Skill UI skills" : "No Skill UI skills found"}
                </option>
                {uiTaggedSkillOptions.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.label}
                    {skill.category ? ` · ${skill.category}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="object-skill-shelf-ids">Skill IDs</Label>
            <Input
              id="object-skill-shelf-ids"
              value={skillShelfIdsText}
              onChange={(event) => setSkillShelfIdsText(event.target.value)}
              placeholder="skill-id, another-skill"
              list="object-binding-skill-options"
            />
          </div>
          {uiTaggedSkillOptions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No canonical skill UI tag is exposed by the current catalog yet, so this list stays
              empty instead of showing every skill.
            </p>
          ) : null}
          <datalist id="object-binding-skill-options">
            {skillOptions.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.label}
              </option>
            ))}
          </datalist>
        </div>
      ) : null}
      {mode === "internalPanel" ? (
        <div className="space-y-2">
          <Label htmlFor="object-internal-panel-id">Panel</Label>
          <select
            id="object-internal-panel-id"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={internalPanelId}
            onChange={(event) => setInternalPanelId(event.target.value as OfficeInternalPanelId)}
          >
            {OFFICE_INTERNAL_PANEL_CATALOG.map((panel) => (
              <option key={panel.id} value={panel.id}>
                {panel.label}
              </option>
            ))}
          </select>
          {selectedInternalPanel ? (
            <p className="text-xs text-muted-foreground">{selectedInternalPanel.description}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
