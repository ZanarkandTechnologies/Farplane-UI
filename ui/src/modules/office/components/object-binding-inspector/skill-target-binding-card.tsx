"use client";

/**
 * SKILL TARGET BINDING CARD
 * =========================
 * Compact form card for invocation-driven object targeting.
 *
 * KEY CONCEPTS:
 * - Skill target binding is separate from click-time runtime UI
 * - Effect settings remain object metadata and do not change avatar transforms
 */

import { Crosshair } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { OfficeObjectSkillEffectMode, OfficeObjectSkillEffectVariant } from "../../object-ui";
import type { SkillOption } from "./runtime-ui-binding-card";

type SkillTargetBindingCardProps = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  skillId: string;
  setSkillId: (value: string) => void;
  skillLabel: string;
  setSkillLabel: (value: string) => void;
  effectMode: OfficeObjectSkillEffectMode;
  setEffectMode: (value: OfficeObjectSkillEffectMode) => void;
  effectVariant: OfficeObjectSkillEffectVariant;
  setEffectVariant: (value: OfficeObjectSkillEffectVariant) => void;
  effectPoolGhost: boolean;
  setEffectPoolGhost: (value: boolean) => void;
  effectPoolBlink: boolean;
  setEffectPoolBlink: (value: boolean) => void;
  skillOptions: SkillOption[];
  onPreviewTarget: () => void;
};

export function SkillTargetBindingCard({
  enabled,
  setEnabled,
  skillId,
  setSkillId,
  skillLabel,
  setSkillLabel,
  effectMode,
  setEffectMode,
  effectVariant,
  setEffectVariant,
  effectPoolGhost,
  setEffectPoolGhost,
  effectPoolBlink,
  setEffectPoolBlink,
  skillOptions,
  onPreviewTarget,
}: SkillTargetBindingCardProps) {
  const selectedSkillOption = skillOptions.find((skill) => skill.id === skillId);

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Skill Target</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Routes active skill calls to this object.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="object-skill-binding-enabled"
            checked={enabled}
            onCheckedChange={(checked) => setEnabled(checked === true)}
          />
          <Label htmlFor="object-skill-binding-enabled">Enabled</Label>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="object-skill-id">Skill</Label>
          <Input
            id="object-skill-id"
            value={skillId}
            onChange={(event) => setSkillId(event.target.value)}
            placeholder="skill-id"
            disabled={!enabled}
            list="object-target-skill-options"
          />
          <datalist id="object-target-skill-options">
            {skillOptions.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.label}
              </option>
            ))}
          </datalist>
        </div>
        <div className="space-y-2">
          <Label htmlFor="object-skill-label">Label</Label>
          <Input
            id="object-skill-label"
            value={skillLabel}
            onChange={(event) => setSkillLabel(event.target.value)}
            placeholder={selectedSkillOption?.label ?? "Optional display label"}
            disabled={!enabled}
          />
        </div>
      </div>
      {skillOptions.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="object-skill-picker">Known Skill</Label>
          <select
            id="object-skill-picker"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={skillOptions.some((skill) => skill.id === skillId) ? skillId : ""}
            onChange={(event) => {
              const next = event.target.value;
              if (!next) return;
              const option = skillOptions.find((skill) => skill.id === next);
              setSkillId(next);
              if (option && !skillLabel.trim()) {
                setSkillLabel(option.label.replace(` (${option.id})`, ""));
              }
            }}
            disabled={!enabled}
          >
            <option value="">Select from catalog</option>
            {skillOptions.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.label}
                {skill.category ? ` · ${skill.category}` : ""}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="object-skill-effect-mode">Effect</Label>
          <select
            id="object-skill-effect-mode"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={effectMode}
            onChange={(event) => setEffectMode(event.target.value as OfficeObjectSkillEffectMode)}
            disabled={!enabled}
          >
            <option value="fixed">Fixed</option>
            <option value="random">Random</option>
          </select>
        </div>
        {effectMode === "fixed" ? (
          <div className="space-y-2">
            <Label htmlFor="object-skill-effect-variant">Variant</Label>
            <select
              id="object-skill-effect-variant"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={effectVariant}
              onChange={(event) =>
                setEffectVariant(event.target.value as OfficeObjectSkillEffectVariant)
              }
              disabled={!enabled}
            >
              <option value="ghost">Ghost Projection</option>
              <option value="blink">Blink Teleport</option>
            </select>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Random Pool</Label>
            <div className="flex h-9 items-center gap-4 rounded-md border px-3 text-sm">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="object-skill-effect-pool-ghost"
                  checked={effectPoolGhost}
                  onCheckedChange={(checked) => setEffectPoolGhost(checked === true)}
                  disabled={!enabled}
                />
                <Label htmlFor="object-skill-effect-pool-ghost">Ghost</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="object-skill-effect-pool-blink"
                  checked={effectPoolBlink}
                  onCheckedChange={(checked) => setEffectPoolBlink(checked === true)}
                  disabled={!enabled}
                />
                <Label htmlFor="object-skill-effect-pool-blink">Blink</Label>
              </div>
            </div>
          </div>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={!enabled || !skillId.trim()}
        onClick={onPreviewTarget}
      >
        <Crosshair className="mr-2 h-4 w-4" />
        Preview Target Effect
      </Button>
    </section>
  );
}
