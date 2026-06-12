/**
 * OFFICE DEBUG OVERLAY SYSTEM
 * ===========================
 * Shared compositor for office scene diagnostic overlays.
 *
 * KEY CONCEPTS:
 * - Debug mode is only a master gate; individual overlay categories opt in.
 * - Builder/placement helper visuals are operational and stay independent from
 *   debug-only diagnostic layers.
 *
 * USAGE:
 * - Build an overlay plan in `SceneContents`, then render this system once near
 *   the end of the scene composition.
 */

"use client";

import type React from "react";
import { DestinationDebugger } from "@/components/debug/destination-debugger";
import { SmartGrid } from "@/components/debug/unified-grid-helper";
import type { OfficeOverlaySettings } from "@/store";
import type { OfficeAreaNode } from "@/modules/office/lib/office-area-layout";
import { OfficeAreaOverlay } from "./office-area-overlay";

export type OfficeDebugOverlayPlan = {
  showAreaOverlay: boolean;
  showAgentPaths: boolean;
  showDestinationOverlay: boolean;
  showLayoutDebugLabels: boolean;
  grid: {
    showDebugGrid: boolean;
    showBuilderGrid: boolean;
    showOccupancy: boolean;
  };
};

export function getOfficeDebugOverlayPlan(input: {
  debugMode: boolean;
  officeOverlays: OfficeOverlaySettings;
  sceneBuilderMode: boolean;
  placementActive: boolean;
}): OfficeDebugOverlayPlan {
  const { debugMode, officeOverlays, sceneBuilderMode, placementActive } = input;
  const showOperationalBuilderGrid = sceneBuilderMode || placementActive;
  return {
    showAreaOverlay: debugMode && officeOverlays.areas,
    showAgentPaths: debugMode && officeOverlays.paths,
    showDestinationOverlay: debugMode && officeOverlays.destinations,
    showLayoutDebugLabels: debugMode && officeOverlays.layout,
    grid: {
      showDebugGrid: debugMode && officeOverlays.grid,
      showBuilderGrid: showOperationalBuilderGrid,
      showOccupancy: showOperationalBuilderGrid || (debugMode && officeOverlays.occupancy),
    },
  };
}

export function OfficeDebugOverlaySystem({
  officeAreas,
  plan,
  sceneBuilderMode,
}: {
  officeAreas: OfficeAreaNode[];
  plan: OfficeDebugOverlayPlan;
  sceneBuilderMode: boolean;
}): React.JSX.Element | null {
  const shouldRenderGrid =
    plan.grid.showDebugGrid || plan.grid.showBuilderGrid || plan.grid.showOccupancy;
  if (!plan.showAreaOverlay && !plan.showDestinationOverlay && !shouldRenderGrid) return null;

  return (
    <>
      {plan.showAreaOverlay ? (
        <OfficeAreaOverlay officeAreas={officeAreas} sceneBuilderMode={sceneBuilderMode} />
      ) : null}
      {shouldRenderGrid ? (
        <SmartGrid
          showDebugGrid={plan.grid.showDebugGrid}
          showBuilderGrid={plan.grid.showBuilderGrid}
          showOccupancy={plan.grid.showOccupancy}
        />
      ) : null}
      {plan.showDestinationOverlay ? <DestinationDebugger /> : null}
    </>
  );
}
