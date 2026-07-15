/**
 * BUILDER TOOLBAR
 * ===============
 * Builder-only controls for tile-based office layout editing.
 *
 * KEY CONCEPTS:
 * - Builder actions stay outside the speed-dial so layout editing remains one click away.
 * - The scene handles drag painting; this toolbar only selects the active builder tool.
 *
 * USAGE:
 * - Render from `office-simulation.tsx` as a fixed HUD overlay.
 *
 * MEMORY REFERENCES:
 * - MEM-0165
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { DoorOpen, Eye, PackageCheck, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useLayoutEditorHud } from "@/modules/office/scene/layout-editor-hud-context";
import { useOfficeRuntimeAdapter, type OfficeSettingsModel } from "@/modules/runtime";
import {
  COMMAND_OFFICE_PROJECT_CAPACITY,
  materializeCommandOfficeKit,
} from "@/modules/office/lib/office-kit";
import { updateOfficeQaState } from "@/modules/office/qa/office-qa-state";

export function BuilderToolbar(): React.JSX.Element | null {
  const {
    officeSettings,
    officeObjects,
    teams,
    applyOfficeSettings,
    refresh,
  } = useOfficeDataContext();
  const adapter = useOfficeRuntimeAdapter();
  const isBuilderMode = useAppStore((state) => state.isBuilderMode);
  const activeBuilderTool = useAppStore((state) => state.activeBuilderTool);
  const setActiveBuilderTool = useAppStore((state) => state.setActiveBuilderTool);
  const setBuilderMode = useAppStore((state) => state.setBuilderMode);
  const layoutHud = useLayoutEditorHud();
  const previewRestoreRef = useRef<OfficeSettingsModel | null>(null);
  const [kitStatus, setKitStatus] = useState<
    "idle" | "preview" | "reset-preview" | "saving" | "confirm"
  >("idle");
  const [kitError, setKitError] = useState<string | null>(null);
  const isPainting = layoutHud.paintMode === "add" || layoutHud.paintMode === "remove";
  const projectCount = teams.filter((team) => team.name !== "Management").length;
  const projectClusterCount = officeObjects.filter((object) => object.meshType === "team-cluster").length;
  const semanticObjectSignature = officeObjects
    .filter((object) => object.meshType === "team-cluster" || object.meshType === "command-commons")
    .map((object) => `${String(object._id)}@${object.position.join(",")}`)
    .sort()
    .join("|");

  useEffect(() => {
    if (isBuilderMode) return;
    setActiveBuilderTool(null);
    if (previewRestoreRef.current) {
      applyOfficeSettings(previewRestoreRef.current);
      previewRestoreRef.current = null;
      setKitStatus("idle");
    }
  }, [applyOfficeSettings, isBuilderMode, setActiveBuilderTool]);

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    updateOfficeQaState({ kit: {
      builderMode: isBuilderMode,
      uiStatus: kitStatus,
      persisted: officeSettings.officeKit ?? null,
      layoutStrategy: officeSettings.layoutStrategy,
      projectCount,
      capacity: COMMAND_OFFICE_PROJECT_CAPACITY,
      seatedProjectCount: Math.min(projectCount, COMMAND_OFFICE_PROJECT_CAPACITY),
      overflowProjectCount: Math.max(0, projectCount - COMMAND_OFFICE_PROJECT_CAPACITY),
      projectClusterCount,
      semanticObjectSignature,
    } });
  }, [isBuilderMode, kitStatus, officeSettings.layoutStrategy, officeSettings.officeKit, officeObjects, projectClusterCount, projectCount, semanticObjectSignature]);

  const setTool = (tool: "paint-floor" | "remove-floor"): void => {
    setActiveBuilderTool(activeBuilderTool === tool ? null : tool);
  };

  const previewCommandOffice = (): void => {
    if (!previewRestoreRef.current) previewRestoreRef.current = officeSettings;
    setKitError(null);
    setKitStatus("preview");
    applyOfficeSettings({
      ...officeSettings,
      layoutStrategy: "team_neighborhoods",
      viewProfile: "fixed_2_5d",
      orbitControlsEnabled: true,
      cameraOrientation: "south_east",
    });
  };

  const cancelPreview = (): void => {
    if (previewRestoreRef.current) applyOfficeSettings(previewRestoreRef.current);
    previewRestoreRef.current = null;
    setKitStatus("idle");
    setKitError(null);
  };

  const persistCurrentCommandOffice = useCallback(async (): Promise<void> => {
    setKitStatus("saving");
    setKitError(null);
    const persistedObjects = await adapter.getOfficeObjects();
    const materialized = materializeCommandOfficeKit({
      sceneObjects: officeObjects,
      persistedObjects,
      settings: officeSettings,
    });
    const result = await adapter.saveOfficeKitState({
      expectedRevision: officeSettings.officeKit?.revision ?? 0,
      expectedObjects: persistedObjects,
      settings: materialized.settings,
      objects: materialized.objects,
    });
    if (!result.ok) {
      setKitStatus("preview");
      setKitError(
        result.status === "conflict"
          ? "The office changed elsewhere. Refresh and preview again."
          : (result.error ?? "Could not equip the office kit."),
      );
      return;
    }
    previewRestoreRef.current = null;
    applyOfficeSettings(result.settings ?? materialized.settings);
    await refresh();
    setKitStatus("idle");
  }, [adapter, applyOfficeSettings, officeObjects, officeSettings, refresh]);

  useEffect(() => {
    if (kitStatus !== "reset-preview" || officeSettings.layoutStrategy !== "team_neighborhoods") {
      return;
    }
    void persistCurrentCommandOffice();
  }, [kitStatus, officeSettings.layoutStrategy, persistCurrentCommandOffice]);

  const equipCommandOffice = async (): Promise<void> => {
    if (officeSettings.officeKit?.status === "customized" && kitStatus !== "confirm") {
      setKitStatus("confirm");
      return;
    }
    if (kitStatus === "confirm") {
      previewCommandOffice();
      setKitStatus("reset-preview");
      return;
    }
    await persistCurrentCommandOffice();
  };

  if (!isBuilderMode) return null;

  return (
    <div className="pointer-events-auto flex w-60 flex-col gap-3 rounded-2xl border border-border/80 bg-background/92 p-3 shadow-xl backdrop-blur">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Builder
        </p>
        <h3 className="mt-1 text-sm font-semibold text-foreground">Office Area</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Bounds {officeSettings.officeFootprint.width} x {officeSettings.officeFootprint.depth}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        <div className="rounded-xl border border-border/70 bg-muted/25 p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-foreground">Command Office</p>
              <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                Central commons, one durable station per project, fixed isometric framing.
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {projectCount}/{COMMAND_OFFICE_PROJECT_CAPACITY} project slots
                {projectCount > COMMAND_OFFICE_PROJECT_CAPACITY
                  ? " · overflow pulses wait unseated"
                  : ""}
              </p>
            </div>
            <span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
              {officeSettings.officeKit?.status ?? "available"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {kitStatus === "preview" || kitStatus === "confirm" || kitStatus === "reset-preview" ? (
              <Button type="button" size="sm" variant="outline" onClick={cancelPreview}>
                <X className="size-3.5" /> Cancel
              </Button>
            ) : (
              <Button type="button" size="sm" variant="outline" onClick={previewCommandOffice}>
                <Eye className="size-3.5" /> Preview
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => void equipCommandOffice()}
              disabled={kitStatus === "saving"}
            >
              {officeSettings.officeKit ? (
                <RotateCcw className="size-3.5" />
              ) : (
                <PackageCheck className="size-3.5" />
              )}
              {kitStatus === "saving"
                ? "Equipping..."
                : kitStatus === "confirm"
                  ? "Replace edits"
                  : officeSettings.officeKit
                    ? "Reset kit"
                    : "Equip"}
            </Button>
          </div>
          {kitStatus === "confirm" ? (
            <p className="mt-2 text-[11px] leading-4 text-amber-600 dark:text-amber-400">
              This office was customized. Equip again to replace kit-owned placements; your own
              objects remain.
            </p>
          ) : null}
          {kitError ? <p className="mt-2 text-[11px] text-destructive">{kitError}</p> : null}
        </div>
        <Button
          type="button"
          variant={activeBuilderTool === "paint-floor" ? "default" : "outline"}
          className="h-auto justify-start px-3 py-2.5 text-left"
          onClick={() => setTool("paint-floor")}
        >
          <Plus className="size-4" />
          Add Tiles
        </Button>
        <Button
          type="button"
          variant={activeBuilderTool === "remove-floor" ? "destructive" : "outline"}
          className="h-auto justify-start px-3 py-2.5 text-left"
          onClick={() => setTool("remove-floor")}
        >
          <Trash2 className="size-4" />
          Remove Tiles
        </Button>
      </div>
      {isPainting ? (
        <>
          <p className="text-xs font-medium text-foreground">
            {layoutHud.paintMode === "add"
              ? "Drag to add floor tiles"
              : "Drag to remove floor tiles"}
          </p>
          <p className="text-[11px] leading-4 text-muted-foreground">
            Painted tiles stay in preview until you click Apply. Exiting builder mode does not
            auto-save the current stroke.
          </p>
          {layoutHud.error ? (
            <p className="text-[11px] text-destructive">{layoutHud.error}</p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              {layoutHud.previewCount} tile{layoutHud.previewCount === 1 ? "" : "s"} selected
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => layoutHud.onCancel()}
                disabled={layoutHud.isSaving || layoutHud.previewCount === 0}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => layoutHud.onApply()}
                disabled={layoutHud.isSaving || layoutHud.previewCount === 0}
              >
                {layoutHud.isSaving ? "Saving..." : "Apply"}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <p className="text-[11px] leading-4 text-muted-foreground">
          Drag on the floor to paint new tiles or remove existing ones, then use Apply to commit.
          Walls wrap the floor plan automatically.
        </p>
      )}
      <Button
        type="button"
        variant="secondary"
        className="justify-start"
        onClick={() => {
          setActiveBuilderTool(null);
          setBuilderMode(false);
        }}
      >
        <DoorOpen className="size-4" />
        Exit Builder Mode
      </Button>
    </div>
  );
}
