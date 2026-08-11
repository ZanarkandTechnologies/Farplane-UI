/**
 * OFFICE RENDER POLICY
 * ====================
 * Derives whether the 3D office should keep rendering behind an operator panel.
 * The policy is pure so panel coverage and Story-mode exceptions remain testable.
 */

import type { Frameloop } from "@react-three/fiber";

export type OfficeBlockingPanelState = {
  activeObjectConfigId: unknown;
  activeObjectPanel: unknown;
  isCeoWorkbenchOpen: boolean;
  isDocumentLibraryPanelOpen: boolean;
  isFurnitureShopOpen: boolean;
  isFinancePanelOpen: boolean;
  isAgentSessionPanelOpen: boolean;
  isGlobalTeamPanelOpen: boolean;
  isOrganizationPanelOpen: boolean;
  isResourceBankPanelOpen: boolean;
  isVideoIntelligencePanelOpen: boolean;
  isSettingsModalOpen: boolean;
  isSkillInvocationsPanelOpen: boolean;
  isSkillsPanelOpen: boolean;
  isTeamPanelOpen: boolean;
  isTelemetryPanelOpen: boolean;
  isWorldMapPanelOpen: boolean;
  manageAgentEmployeeId: unknown;
  memoryPanelEmployeeId: unknown;
  viewComputerEmployeeId: unknown;
};

export function hasBlockingOfficePanel(state: OfficeBlockingPanelState): boolean {
  return Boolean(
    state.activeObjectConfigId ||
      state.activeObjectPanel ||
      state.isCeoWorkbenchOpen ||
      state.isDocumentLibraryPanelOpen ||
      state.isFurnitureShopOpen ||
      state.isFinancePanelOpen ||
      state.isAgentSessionPanelOpen ||
      state.isGlobalTeamPanelOpen ||
      state.isOrganizationPanelOpen ||
      state.isResourceBankPanelOpen ||
      state.isVideoIntelligencePanelOpen ||
      state.isSettingsModalOpen ||
      state.isSkillInvocationsPanelOpen ||
      state.isSkillsPanelOpen ||
      state.isTeamPanelOpen ||
      state.isTelemetryPanelOpen ||
      state.isWorldMapPanelOpen ||
      state.manageAgentEmployeeId ||
      state.memoryPanelEmployeeId ||
      state.viewComputerEmployeeId,
  );
}

export function getOfficeFrameloop(input: {
  blockingPanelOpen: boolean;
  chatOpen: boolean;
  presentationMode: string | null;
}): Frameloop {
  const storyModeOpen = input.chatOpen && input.presentationMode === "story";
  return input.blockingPanelOpen || (input.chatOpen && !storyModeOpen) ? "never" : "always";
}
