"use client";

/**
 * OBJECT BINDING INSPECTOR
 * ========================
 * Compact builder-mode inspector for object-bound runtime UI and skill targets.
 *
 * KEY CONCEPTS:
 * - Settings dial opens an inspect-first workflow instead of a form-first modal
 * - Preview shortcuts reuse app-store panel state and Skills panel focus
 * - Save still writes normalized office-object metadata through the runtime adapter
 *
 * USAGE:
 * - Exported through `ObjectConfigPanel` for the existing builder settings path
 */

import { Crosshair, ExternalLink, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UI_Z } from "@/lib/z-index";
import { type SkillStudioCatalogEntry, useOfficeRuntimeAdapter } from "@/modules/runtime";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useAppStore } from "@/store";

import type { OfficeObject } from "../../lib/types";
import {
  buildOfficeObjectMetadata,
  buildOfficeObjectRuntimeLaunch,
  getObjectBindingHealth,
  getObjectBindingHealthLabel,
  normalizeHttpUrl,
  type OfficeObjectInteractionConfig,
  type OfficeObjectSkillBinding,
  type OfficeObjectSkillEffectMode,
  type OfficeObjectSkillEffectVariant,
  type OfficeObjectUiBinding,
  parseOfficeObjectInteractionConfig,
  summarizeOfficeObjectUiBinding,
} from "../../object-ui";
import {
  getOfficeInternalPanelEntry,
  type OfficeInternalPanelId,
} from "../../panels/internal-panel-catalog";
import { useOfficeInternalPanelLauncher } from "../../panels/use-internal-panel-launcher";
import { endObjectInteractionTrace } from "../../utils/object-interaction-perf";
import { resolvePersistedOfficeObjectId } from "../office-object-id";
import { RuntimeUiBindingCard, type SkillOption } from "./runtime-ui-binding-card";
import { SkillTargetBindingCard } from "./skill-target-binding-card";
import type { UiBindingMode } from "./types";

type DraftValidation =
  | { ok: true; config: OfficeObjectInteractionConfig }
  | { ok: false; error: string };

function parseSkillIdsText(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function getObjectTitle(officeObject: OfficeObject | null, displayName: string): string {
  if (displayName.trim()) return displayName.trim();
  if (!officeObject) return "Office Object";
  return officeObject.meshType
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function toPersistedMeshType(meshType: string) {
  return meshType as
    | "team-cluster"
    | "plant"
    | "couch"
    | "bookshelf"
    | "pantry"
    | "glass-wall"
    | "custom-mesh"
    | "wall-art";
}

function normalizeSearchText(value: unknown): string {
  if (Array.isArray(value)) return value.map(normalizeSearchText).join(" ");
  if (value && typeof value === "object")
    return Object.values(value).map(normalizeSearchText).join(" ");
  return typeof value === "string" ? value.toLowerCase() : "";
}

function isUiTaggedSkill(entry: SkillStudioCatalogEntry): boolean {
  const raw = entry as SkillStudioCatalogEntry & Record<string, unknown>;
  const haystack = normalizeSearchText([raw.tags, raw.feature_refs, raw.frontmatter]);
  return /\b(skill-ui|ui|object-ui|panel|surface)\b/.test(haystack);
}

function toSkillOption(entry: SkillStudioCatalogEntry): SkillOption {
  return {
    id: entry.skillId,
    label:
      entry.displayName && entry.displayName !== entry.skillId
        ? `${entry.displayName} (${entry.skillId})`
        : entry.skillId,
    category: entry.category,
    uiTagged: isUiTaggedSkill(entry),
  };
}

export function ObjectBindingInspector() {
  const activeObjectConfigId = useAppStore((state) => state.activeObjectConfigId);
  const setActiveObjectConfigId = useAppStore((state) => state.setActiveObjectConfigId);
  const isBuilderMode = useAppStore((state) => state.isBuilderMode);
  const setActiveObjectPanel = useAppStore((state) => state.setActiveObjectPanel);
  const { officeObjects } = useOfficeDataContext();
  const adapter = useOfficeRuntimeAdapter();
  const launchInternalPanel = useOfficeInternalPanelLauncher();

  const officeObject = useMemo(
    () => officeObjects.find((item) => item._id === activeObjectConfigId) ?? null,
    [activeObjectConfigId, officeObjects],
  );
  const parsedConfig = useMemo(
    () => parseOfficeObjectInteractionConfig(officeObject?.metadata),
    [officeObject?.metadata],
  );

  const [displayName, setDisplayName] = useState("");
  const [uiBindingMode, setUiBindingMode] = useState<UiBindingMode>("none");
  const [embedTitle, setEmbedTitle] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"wide" | "square" | "tall">("wide");
  const [skillShelfTitle, setSkillShelfTitle] = useState("");
  const [skillShelfAspectRatio, setSkillShelfAspectRatio] = useState<"wide" | "square" | "tall">(
    "wide",
  );
  const [skillShelfCategory, setSkillShelfCategory] = useState("");
  const [skillShelfIdsText, setSkillShelfIdsText] = useState("");
  const [internalPanelId, setInternalPanelId] = useState<OfficeInternalPanelId>("document-library");
  const [isSkillBindingEnabled, setIsSkillBindingEnabled] = useState(false);
  const [skillId, setSkillId] = useState("");
  const [skillLabel, setSkillLabel] = useState("");
  const [skillEffectMode, setSkillEffectMode] = useState<OfficeObjectSkillEffectMode>("fixed");
  const [skillEffectVariant, setSkillEffectVariant] =
    useState<OfficeObjectSkillEffectVariant>("ghost");
  const [effectPoolGhost, setEffectPoolGhost] = useState(true);
  const [effectPoolBlink, setEffectPoolBlink] = useState(true);
  const [statusText, setStatusText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [skillOptions, setSkillOptions] = useState<SkillOption[]>([]);

  useEffect(() => {
    let canceled = false;
    adapter
      .listSkillStudioCatalog()
      .then((entries) => {
        if (canceled) return;
        setSkillOptions(entries.map(toSkillOption).sort((a, b) => a.id.localeCompare(b.id)));
      })
      .catch(() => {
        if (!canceled) setSkillOptions([]);
      });
    return () => {
      canceled = true;
    };
  }, [adapter]);

  useEffect(() => {
    if (!activeObjectConfigId || !officeObject) return;
    setDisplayName(parsedConfig.displayName ?? "");
    setUiBindingMode(parsedConfig.uiBinding.kind);
    setEmbedTitle(parsedConfig.uiBinding.kind === "embed" ? parsedConfig.uiBinding.title : "");
    setEmbedUrl(parsedConfig.uiBinding.kind === "embed" ? parsedConfig.uiBinding.url : "");
    setAspectRatio(
      parsedConfig.uiBinding.kind === "embed" && parsedConfig.uiBinding.aspectRatio
        ? parsedConfig.uiBinding.aspectRatio
        : "wide",
    );
    setSkillShelfTitle(
      parsedConfig.uiBinding.kind === "skillShelf" ? parsedConfig.uiBinding.title : "",
    );
    setSkillShelfAspectRatio(
      parsedConfig.uiBinding.kind === "skillShelf" && parsedConfig.uiBinding.aspectRatio
        ? parsedConfig.uiBinding.aspectRatio
        : "wide",
    );
    setSkillShelfCategory(
      parsedConfig.uiBinding.kind === "skillShelf" ? (parsedConfig.uiBinding.category ?? "") : "",
    );
    setSkillShelfIdsText(
      parsedConfig.uiBinding.kind === "skillShelf"
        ? (parsedConfig.uiBinding.skillIds ?? []).join(", ")
        : "",
    );
    setInternalPanelId(
      parsedConfig.uiBinding.kind === "internalPanel"
        ? parsedConfig.uiBinding.panelId
        : "document-library",
    );
    setIsSkillBindingEnabled(Boolean(parsedConfig.skillBinding?.skillId));
    setSkillId(parsedConfig.skillBinding?.skillId ?? "");
    setSkillLabel(parsedConfig.skillBinding?.label ?? "");
    setSkillEffectMode(parsedConfig.skillBinding?.effectMode ?? "fixed");
    setSkillEffectVariant(parsedConfig.skillBinding?.effectVariant ?? "ghost");
    setEffectPoolGhost(parsedConfig.skillBinding?.effectPool?.includes("ghost") ?? true);
    setEffectPoolBlink(parsedConfig.skillBinding?.effectPool?.includes("blink") ?? true);
    setStatusText("");
    endObjectInteractionTrace("builder-panel", String(activeObjectConfigId), "ready", {
      meshType: officeObject.meshType,
    });
  }, [activeObjectConfigId, officeObject, parsedConfig]);

  useEffect(() => {
    if (isBuilderMode) return;
    setActiveObjectConfigId(null);
  }, [isBuilderMode, setActiveObjectConfigId]);

  const validateDraft = (): DraftValidation => {
    const skillShelfIds = parseSkillIdsText(skillShelfIdsText);
    let uiBinding: OfficeObjectUiBinding = { kind: "none" };
    if (uiBindingMode === "embed") {
      const normalizedUrl = normalizeHttpUrl(embedUrl);
      if (!embedTitle.trim()) return { ok: false, error: "Embed title is required." };
      if (!normalizedUrl) return { ok: false, error: "Embed URL must be a valid http(s) address." };
      uiBinding = {
        kind: "embed",
        title: embedTitle.trim(),
        url: normalizedUrl,
        openMode: "panel",
        aspectRatio,
      };
    }
    if (uiBindingMode === "skillShelf") {
      if (!skillShelfTitle.trim()) return { ok: false, error: "Skill shelf title is required." };
      if (!skillShelfCategory.trim() && skillShelfIds.length === 0) {
        return { ok: false, error: "Add a skill category or at least one skill ID." };
      }
      uiBinding = {
        kind: "skillShelf",
        title: skillShelfTitle.trim(),
        openMode: "panel",
        aspectRatio: skillShelfAspectRatio,
        category: skillShelfCategory.trim() || undefined,
        skillIds: skillShelfIds.length > 0 ? skillShelfIds : undefined,
      };
    }
    if (uiBindingMode === "internalPanel") {
      const entry = getOfficeInternalPanelEntry(internalPanelId);
      uiBinding = {
        kind: "internalPanel",
        panelId: internalPanelId,
        title: entry.label,
        openMode: "panel",
      };
    }
    if (isSkillBindingEnabled && !skillId.trim()) {
      return { ok: false, error: "Skill ID is required when skill target is enabled." };
    }
    if (
      isSkillBindingEnabled &&
      skillEffectMode === "random" &&
      !effectPoolGhost &&
      !effectPoolBlink
    ) {
      return { ok: false, error: "Choose at least one random effect variant." };
    }
    const skillBinding: OfficeObjectSkillBinding = isSkillBindingEnabled
      ? {
          skillId: skillId.trim(),
          label: skillLabel.trim() || undefined,
          effectMode: skillEffectMode,
          effectVariant: skillEffectMode === "fixed" ? skillEffectVariant : undefined,
          effectPool:
            skillEffectMode === "random"
              ? [
                  ...(effectPoolGhost ? (["ghost"] as const) : []),
                  ...(effectPoolBlink ? (["blink"] as const) : []),
                ]
              : undefined,
        }
      : null;
    return {
      ok: true,
      config: {
        displayName: displayName.trim() || undefined,
        uiBinding,
        skillBinding,
      },
    };
  };

  const draftValidation = validateDraft();
  const draftConfig = draftValidation.ok ? draftValidation.config : parsedConfig;
  const health = draftValidation.ok ? getObjectBindingHealth(draftConfig) : "unbound";
  const healthLabel = draftValidation.ok ? getObjectBindingHealthLabel(health) : "Needs fix";
  const uiSummary = summarizeOfficeObjectUiBinding(draftConfig.uiBinding);
  const objectTitle = getObjectTitle(officeObject, displayName);
  const objectTypeLabel = officeObject?.meshType.split("-").join(" ") ?? "office object";
  const uiTaggedSkillOptions = skillOptions.filter((skill) => skill.uiTagged);

  const handleUiBindingModeChange = (mode: UiBindingMode): void => {
    setUiBindingMode(mode);
    if (mode === "embed" && !embedTitle.trim()) {
      setEmbedTitle(objectTitle);
    }
    if (mode === "skillShelf" && !skillShelfTitle.trim()) {
      setSkillShelfTitle(objectTitle);
    }
  };

  const handleOpenChange = (open: boolean): void => {
    if (!open) setActiveObjectConfigId(null);
  };

  const handleOpenUi = (): void => {
    if (!officeObject || !draftValidation.ok) return;
    const launch = buildOfficeObjectRuntimeLaunch({
      objectId: officeObject._id,
      config: draftValidation.config,
      openedAtMs: typeof performance !== "undefined" ? performance.now() : Date.now(),
    });
    if (!launch) return;
    if (launch.kind === "internalPanel") {
      launchInternalPanel(launch.panelId);
      return;
    }
    setActiveObjectPanel(launch.panel);
  };

  const handleTestTarget = (): void => {
    if (!isSkillBindingEnabled || !skillId.trim()) {
      setStatusText("Choose a skill target before testing target effects.");
      return;
    }
    const effect =
      skillEffectMode === "random"
        ? [...(effectPoolGhost ? ["ghost"] : []), ...(effectPoolBlink ? ["blink"] : [])].join(" / ")
        : skillEffectVariant;
    setStatusText(`Target preview ready: ${skillId.trim()} -> ${objectTitle} (${effect}).`);
  };

  async function handleSave(): Promise<void> {
    if (!officeObject) return;
    const validated = validateDraft();
    if (!validated.ok) {
      setStatusText(validated.error);
      return;
    }
    setIsSaving(true);
    setStatusText("");
    try {
      const current = await adapter.getOfficeObjects();
      const knownIds = new Set(current.map((item) => item.id));
      const persistedId = resolvePersistedOfficeObjectId(String(officeObject._id), knownIds);
      const existing = current.find((item) => item.id === persistedId);
      const metadata = buildOfficeObjectMetadata(
        existing?.metadata ?? officeObject.metadata,
        validated.config,
      );
      const result = await adapter.upsertOfficeObject(
        {
          id: persistedId,
          identifier: existing?.identifier ?? persistedId,
          meshType: toPersistedMeshType(existing?.meshType ?? officeObject.meshType),
          position: existing?.position ?? officeObject.position,
          rotation: existing?.rotation ?? officeObject.rotation,
          scale: existing?.scale ?? officeObject.scale,
          metadata,
        },
        { currentObjects: current },
      );
      setStatusText(
        result.ok ? "Object binding saved." : (result.error ?? "Failed to save binding."),
      );
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "object_binding_save_failed");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={!!activeObjectConfigId && isBuilderMode} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex h-[min(88vh,820px)] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[640px]"
        style={{ zIndex: UI_Z.panelElevated }}
      >
        <div className="border-b px-5 py-4">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="truncate">Object Binding Inspector</DialogTitle>
                <DialogDescription className="truncate">
                  {objectTitle} · mesh: {objectTypeLabel} · id: {String(activeObjectConfigId ?? "")}
                </DialogDescription>
              </div>
              <Badge variant={draftValidation.ok && health === "complete" ? "default" : "outline"}>
                {healthLabel}
              </Badge>
            </div>
          </DialogHeader>
        </div>

        <div className="flex flex-wrap gap-2 border-b px-5 py-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={draftConfig.uiBinding.kind === "none" || !draftValidation.ok}
            onClick={handleOpenUi}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open UI
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!isSkillBindingEnabled || !skillId.trim()}
            title="Validate this object as the target for the selected skill effect."
            onClick={handleTestTarget}
          >
            <Crosshair className="mr-2 h-4 w-4" />
            Test Target
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-4 px-5 py-4">
            <RuntimeUiBindingCard
              mode={uiBindingMode}
              setMode={handleUiBindingModeChange}
              summary={uiSummary}
              hasRuntimeUi={draftConfig.uiBinding.kind !== "none"}
              embedTitle={embedTitle}
              setEmbedTitle={setEmbedTitle}
              embedUrl={embedUrl}
              setEmbedUrl={setEmbedUrl}
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              skillShelfTitle={skillShelfTitle}
              setSkillShelfTitle={setSkillShelfTitle}
              skillShelfAspectRatio={skillShelfAspectRatio}
              setSkillShelfAspectRatio={setSkillShelfAspectRatio}
              skillShelfCategory={skillShelfCategory}
              setSkillShelfCategory={setSkillShelfCategory}
              skillShelfIdsText={skillShelfIdsText}
              setSkillShelfIdsText={setSkillShelfIdsText}
              internalPanelId={internalPanelId}
              setInternalPanelId={setInternalPanelId}
              skillOptions={skillOptions}
              uiTaggedSkillOptions={uiTaggedSkillOptions}
            />

            <SkillTargetBindingCard
              enabled={isSkillBindingEnabled}
              setEnabled={setIsSkillBindingEnabled}
              skillId={skillId}
              setSkillId={setSkillId}
              skillLabel={skillLabel}
              setSkillLabel={setSkillLabel}
              effectMode={skillEffectMode}
              setEffectMode={setSkillEffectMode}
              effectVariant={skillEffectVariant}
              setEffectVariant={setSkillEffectVariant}
              effectPoolGhost={effectPoolGhost}
              setEffectPoolGhost={setEffectPoolGhost}
              effectPoolBlink={effectPoolBlink}
              setEffectPoolBlink={setEffectPoolBlink}
              skillOptions={skillOptions}
              onPreviewTarget={handleTestTarget}
            />

            <section className="space-y-2 rounded-lg border p-4">
              <Label htmlFor="object-display-name">Label Override</Label>
              <Input
                id="object-display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Optional custom object label"
              />
            </section>
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            {statusText || (!draftValidation.ok ? draftValidation.error : "Ready")}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setActiveObjectConfigId(null)}>
              Done
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={!officeObject || isSaving || !draftValidation.ok}
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
