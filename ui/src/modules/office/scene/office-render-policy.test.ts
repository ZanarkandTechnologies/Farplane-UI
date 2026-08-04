import { describe, expect, it } from "vitest";

import {
  getOfficeFrameloop,
  hasBlockingOfficePanel,
  type OfficeBlockingPanelState,
} from "./office-render-policy";

function makePanelState(
  overrides: Partial<OfficeBlockingPanelState> = {},
): OfficeBlockingPanelState {
  return {
    activeObjectConfigId: null,
    activeObjectPanel: null,
    isAgentSessionPanelOpen: false,
    isCeoWorkbenchOpen: false,
    isDocumentLibraryPanelOpen: false,
    isFurnitureShopOpen: false,
    isFinancePanelOpen: false,
    isGlobalTeamPanelOpen: false,
    isOrganizationPanelOpen: false,
    isRawTelemetryPanelOpen: false,
    isResourceBankPanelOpen: false,
    isSelfImprovementRunsPanelOpen: false,
    isVideoIntelligencePanelOpen: false,
    isSettingsModalOpen: false,
    isSkillInvocationsPanelOpen: false,
    isSkillsPanelOpen: false,
    isTeamPanelOpen: false,
    isTelemetryPanelOpen: false,
    isThreadDataPanelOpen: false,
    isUserTasksModalOpen: false,
    isWorldMapPanelOpen: false,
    manageAgentEmployeeId: null,
    memoryPanelEmployeeId: null,
    viewComputerEmployeeId: null,
    ...overrides,
  };
}

describe("office render policy", () => {
  it.each([
    "isAgentSessionPanelOpen",
    "isCeoWorkbenchOpen",
    "isDocumentLibraryPanelOpen",
    "isFurnitureShopOpen",
    "isFinancePanelOpen",
    "isGlobalTeamPanelOpen",
    "isOrganizationPanelOpen",
    "isRawTelemetryPanelOpen",
    "isResourceBankPanelOpen",
    "isSelfImprovementRunsPanelOpen",
    "isVideoIntelligencePanelOpen",
    "isSettingsModalOpen",
    "isSkillInvocationsPanelOpen",
    "isSkillsPanelOpen",
    "isTeamPanelOpen",
    "isTelemetryPanelOpen",
    "isThreadDataPanelOpen",
    "isUserTasksModalOpen",
    "isWorldMapPanelOpen",
  ] as const)("treats %s as blocking", (key) => {
    expect(hasBlockingOfficePanel(makePanelState({ [key]: true }))).toBe(true);
  });

  it.each([
    "activeObjectConfigId",
    "activeObjectPanel",
    "manageAgentEmployeeId",
    "memoryPanelEmployeeId",
    "viewComputerEmployeeId",
  ] as const)("treats a populated %s as blocking", (key) => {
    expect(hasBlockingOfficePanel(makePanelState({ [key]: "open" }))).toBe(true);
  });

  it("keeps rendering when no blocking panel is open", () => {
    expect(hasBlockingOfficePanel(makePanelState())).toBe(false);
    expect(
      getOfficeFrameloop({
        blockingPanelOpen: false,
        chatOpen: false,
        presentationMode: null,
      }),
    ).toBe("always");
  });

  it("suspends for a blocking panel or standard chat", () => {
    expect(
      getOfficeFrameloop({
        blockingPanelOpen: true,
        chatOpen: false,
        presentationMode: null,
      }),
    ).toBe("never");
    expect(
      getOfficeFrameloop({
        blockingPanelOpen: false,
        chatOpen: true,
        presentationMode: "default",
      }),
    ).toBe("never");
  });

  it("keeps Story mode live unless another blocking panel is open", () => {
    expect(
      getOfficeFrameloop({
        blockingPanelOpen: false,
        chatOpen: true,
        presentationMode: "story",
      }),
    ).toBe("always");
    expect(
      getOfficeFrameloop({
        blockingPanelOpen: true,
        chatOpen: true,
        presentationMode: "story",
      }),
    ).toBe("never");
  });
});
