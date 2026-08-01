import { beforeEach, describe, expect, it } from "vitest";

import { type ActiveObjectPanelState, useAppStore } from "./app-store";

const initialState = useAppStore.getInitialState();

function buildPanel(openedAtMs: number): ActiveObjectPanelState {
  return {
    kind: "embed",
    objectId: "object-world-monitor" as ActiveObjectPanelState["objectId"],
    title: "World Monitor",
    url: "https://www.worldmonitor.app/",
    displayName: "Globe",
    aspectRatio: "wide",
    openedAtMs,
  };
}

describe("app store perf guards", () => {
  beforeEach(() => {
    useAppStore.setState(initialState, true);
  });

  it("keeps the same state object when selectedObjectId is unchanged", () => {
    const before = useAppStore.getState();
    before.setSelectedObjectId(null);
    expect(useAppStore.getState()).toBe(before);
  });

  it("keeps the same state object when activeObjectPanel is unchanged", () => {
    useAppStore.getState().setActiveObjectPanel(buildPanel(100));
    const before = useAppStore.getState();
    before.setActiveObjectPanel(buildPanel(100));
    expect(useAppStore.getState()).toBe(before);
  });

  it("stores Skill Studio selection context", () => {
    useAppStore.getState().setSelectedSkillStudioSkillId("create-team");
    useAppStore.getState().setSkillStudioFocusAgentId("main");
    useAppStore.getState().setSkillStudioSurface("template-tracking");
    expect(useAppStore.getState().selectedSkillStudioSkillId).toBe("create-team");
    expect(useAppStore.getState().skillStudioFocusAgentId).toBe("main");
    expect(useAppStore.getState().skillStudioSurface).toBe("template-tracking");
  });

  it("stores telemetry panel open state", () => {
    useAppStore.getState().setIsTelemetryPanelOpen(true);
    useAppStore.getState().setIsFinancePanelOpen(true);
    useAppStore.getState().setIsRawTelemetryPanelOpen(true);
    useAppStore.getState().setIsThreadDataPanelOpen(true);
    expect(useAppStore.getState().isTelemetryPanelOpen).toBe(true);
    expect(useAppStore.getState().isFinancePanelOpen).toBe(true);
    expect(useAppStore.getState().isRawTelemetryPanelOpen).toBe(true);
    expect(useAppStore.getState().isThreadDataPanelOpen).toBe(true);
  });

  it("stores Video Intelligence panel open state", () => {
    useAppStore.getState().setIsVideoIntelligencePanelOpen(true);
    expect(useAppStore.getState().isVideoIntelligencePanelOpen).toBe(true);
  });

  it("stores organization panel open state for shared launch surfaces", () => {
    useAppStore.getState().setIsOrganizationPanelOpen(true);
    expect(useAppStore.getState().isOrganizationPanelOpen).toBe(true);
  });

  it("stores builder transform target", () => {
    useAppStore.getState().setActiveObjectTransformId("plant-1" as never);
    expect(useAppStore.getState().activeObjectTransformId).toBe("plant-1");
  });

  it("stores manual employee control and clears destinations when control changes", () => {
    useAppStore.getState().setControlledEmployeeId("employee-main" as never);
    useAppStore.getState().setControlledEmployeeDestination([1, 0.5, 2]);

    expect(useAppStore.getState().controlledEmployeeId).toBe("employee-main");
    expect(useAppStore.getState().controlledEmployeeDestination).toEqual([1, 0.5, 2]);

    useAppStore.getState().setControlledEmployeeId("employee-pm" as never);
    expect(useAppStore.getState().controlledEmployeeId).toBe("employee-pm");
    expect(useAppStore.getState().controlledEmployeeDestination).toBeNull();
  });

  it("keeps the same state object when manual destination is unchanged", () => {
    useAppStore.getState().setControlledEmployeeId("employee-main" as never);
    useAppStore.getState().setControlledEmployeeDestination([1, 0.5, 2]);

    const before = useAppStore.getState();
    before.setControlledEmployeeDestination([1, 0.5, 2]);

    expect(useAppStore.getState()).toBe(before);
  });

  it("stores office onboarding state", () => {
    useAppStore.getState().setIsOfficeOnboardingVisible(true);
    useAppStore.getState().setOfficeOnboardingStep("open-shop");
    useAppStore.getState().setIsFurnitureShopOpen(true);

    expect(useAppStore.getState().isOfficeOnboardingVisible).toBe(true);
    expect(useAppStore.getState().officeOnboardingStep).toBe("open-shop");
    expect(useAppStore.getState().isFurnitureShopOpen).toBe(true);
  });
});
