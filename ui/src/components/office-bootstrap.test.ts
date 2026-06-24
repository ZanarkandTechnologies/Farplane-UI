import { describe, expect, it } from "vitest";

import {
  buildOfficeBootstrapStages,
  getOfficeBootstrapState,
  shouldRenderOfficeSceneShell,
} from "./office-bootstrap";

describe("office bootstrap", () => {
  it("orders readiness stages deterministically", () => {
    const stages = buildOfficeBootstrapStages({
      dataReady: true,
      meshesReady: false,
      navigationReady: false,
    });

    expect(stages.map((stage) => stage.id)).toEqual([
      "data",
      "meshes",
      "navigation",
    ]);
    expect(stages.map((stage) => stage.isReady)).toEqual([true, false, false]);
  });

  it("reports the first incomplete stage as active", () => {
    const state = getOfficeBootstrapState(
      buildOfficeBootstrapStages({
        dataReady: true,
        meshesReady: true,
        navigationReady: false,
      }),
    );

    expect(state.isReady).toBe(false);
    expect(state.activeStage.id).toBe("navigation");
    expect(state.completionRatio).toBeCloseTo(2 / 3);
  });

  it("keeps the scene shell mounted after the first successful render", () => {
    expect(
      shouldRenderOfficeSceneShell({
        isLoading: true,
        meshesReady: true,
        hasRenderedScene: false,
      }),
    ).toBe(false);
    expect(
      shouldRenderOfficeSceneShell({
        isLoading: false,
        meshesReady: true,
        hasRenderedScene: false,
      }),
    ).toBe(true);
    expect(
      shouldRenderOfficeSceneShell({
        isLoading: true,
        meshesReady: false,
        hasRenderedScene: true,
      }),
    ).toBe(true);
  });
});
