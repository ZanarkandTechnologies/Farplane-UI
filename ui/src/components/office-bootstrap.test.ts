import { describe, expect, it } from "vitest";

import {
  buildOfficeBootstrapStages,
  getOfficeBootstrapState,
} from "./office-bootstrap";

describe("office bootstrap", () => {
  it("orders readiness stages deterministically", () => {
    const stages = buildOfficeBootstrapStages({
      dataReady: true,
      meshesReady: false,
      navigationReady: false,
    });

    expect(stages.map((stage) => stage.id)).toEqual(["data", "meshes", "navigation"]);
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
});
