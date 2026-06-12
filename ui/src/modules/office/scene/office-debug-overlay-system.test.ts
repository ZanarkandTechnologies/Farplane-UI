import { describe, expect, it } from "vitest";
import type { OfficeOverlaySettings } from "@/store";
import { getOfficeDebugOverlayPlan } from "./office-debug-overlay-system";

const OFF: OfficeOverlaySettings = {
  grid: false,
  occupancy: false,
  paths: false,
  destinations: false,
  areas: false,
  layout: false,
};

describe("office debug overlay plan", () => {
  it("does not enable diagnostic overlays from debug mode alone", () => {
    const plan = getOfficeDebugOverlayPlan({
      debugMode: true,
      officeOverlays: OFF,
      sceneBuilderMode: false,
      placementActive: false,
    });

    expect(plan.showAreaOverlay).toBe(false);
    expect(plan.showAgentPaths).toBe(false);
    expect(plan.showDestinationOverlay).toBe(false);
    expect(plan.showLayoutDebugLabels).toBe(false);
    expect(plan.grid).toEqual({
      showDebugGrid: false,
      showBuilderGrid: false,
      showOccupancy: false,
    });
  });

  it("keeps builder helper layers independent from debug diagnostics", () => {
    const plan = getOfficeDebugOverlayPlan({
      debugMode: false,
      officeOverlays: OFF,
      sceneBuilderMode: true,
      placementActive: false,
    });

    expect(plan.grid).toEqual({
      showDebugGrid: false,
      showBuilderGrid: true,
      showOccupancy: true,
    });
  });

  it("enables only selected diagnostic categories when debug mode is on", () => {
    const plan = getOfficeDebugOverlayPlan({
      debugMode: true,
      officeOverlays: {
        ...OFF,
        paths: true,
        layout: true,
      },
      sceneBuilderMode: false,
      placementActive: false,
    });

    expect(plan.showAgentPaths).toBe(true);
    expect(plan.showLayoutDebugLabels).toBe(true);
    expect(plan.showAreaOverlay).toBe(false);
    expect(plan.showDestinationOverlay).toBe(false);
    expect(plan.grid.showDebugGrid).toBe(false);
  });
});
