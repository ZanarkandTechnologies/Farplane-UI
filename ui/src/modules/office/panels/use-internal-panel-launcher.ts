"use client";

/**
 * OFFICE INTERNAL PANEL LAUNCHER
 * ==============================
 * Opens registered office panels through the same app-store paths as global launchers.
 *
 * KEY CONCEPTS:
 * - Object bindings store only a panel id; launch behavior stays centralized here.
 * - Skill Studio sub-surfaces are normalized before opening the shared Skills panel.
 * - Team/global workspaces clear stale focused ids before opening.
 */

import { useCallback } from "react";
import { useAppStore } from "@/store";
import type { OfficeInternalPanelId } from "./internal-panel-catalog";

export function useOfficeInternalPanelLauncher(): (panelId: OfficeInternalPanelId) => void {
  const setIsGlobalTeamPanelOpen = useAppStore((state) => state.setIsGlobalTeamPanelOpen);
  const setIsTelemetryPanelOpen = useAppStore((state) => state.setIsTelemetryPanelOpen);
  const setIsRawTelemetryPanelOpen = useAppStore((state) => state.setIsRawTelemetryPanelOpen);
  const setIsThreadDataPanelOpen = useAppStore((state) => state.setIsThreadDataPanelOpen);
  const setIsResourceBankPanelOpen = useAppStore((state) => state.setIsResourceBankPanelOpen);
  const setIsDocumentLibraryPanelOpen = useAppStore((state) => state.setIsDocumentLibraryPanelOpen);
  const setIsSkillsPanelOpen = useAppStore((state) => state.setIsSkillsPanelOpen);
  const setSkillStudioSurface = useAppStore((state) => state.setSkillStudioSurface);
  const setSelectedSkillStudioSkillId = useAppStore((state) => state.setSelectedSkillStudioSkillId);
  const setSkillStudioFocusAgentId = useAppStore((state) => state.setSkillStudioFocusAgentId);
  const setIsCeoWorkbenchOpen = useAppStore((state) => state.setIsCeoWorkbenchOpen);
  const setCeoWorkbenchView = useAppStore((state) => state.setCeoWorkbenchView);
  const setIsUserTasksModalOpen = useAppStore((state) => state.setIsUserTasksModalOpen);
  const setIsFurnitureShopOpen = useAppStore((state) => state.setIsFurnitureShopOpen);
  const setIsSettingsModalOpen = useAppStore((state) => state.setIsSettingsModalOpen);
  const setActiveTeamId = useAppStore((state) => state.setActiveTeamId);
  const setSelectedTeamId = useAppStore((state) => state.setSelectedTeamId);
  const setKanbanFocusAgentId = useAppStore((state) => state.setKanbanFocusAgentId);

  return useCallback(
    (panelId: OfficeInternalPanelId) => {
      switch (panelId) {
        case "team-workspace":
          setActiveTeamId(null);
          setSelectedTeamId(null);
          setKanbanFocusAgentId(null);
          setIsGlobalTeamPanelOpen(true);
          break;
        case "telemetry":
          setIsTelemetryPanelOpen(true);
          break;
        case "raw-telemetry":
          setIsRawTelemetryPanelOpen(true);
          break;
        case "thread-data":
          setIsThreadDataPanelOpen(true);
          break;
        case "resource-bank":
          setIsResourceBankPanelOpen(true);
          break;
        case "document-library":
          setIsDocumentLibraryPanelOpen(true);
          break;
        case "skill-os":
        case "evals":
        case "harness":
        case "rollout":
        case "skill-rollout":
        case "template-tracking":
          setSelectedSkillStudioSkillId(null);
          setSkillStudioFocusAgentId(null);
          setSkillStudioSurface(panelId);
          setIsSkillsPanelOpen(true);
          break;
        case "harness-graph":
          setSelectedSkillStudioSkillId(null);
          setSkillStudioFocusAgentId(null);
          setSkillStudioSurface("harness");
          setIsSkillsPanelOpen(true);
          break;
        case "harness-rollout":
          setSelectedSkillStudioSkillId(null);
          setSkillStudioFocusAgentId(null);
          setSkillStudioSurface("rollout");
          setIsSkillsPanelOpen(true);
          break;
        case "template-rollout":
          setSelectedSkillStudioSkillId(null);
          setSkillStudioFocusAgentId(null);
          setSkillStudioSurface("template-tracking");
          setIsSkillsPanelOpen(true);
          break;
        case "ceo-workbench":
          setCeoWorkbenchView("board");
          setIsCeoWorkbenchOpen(true);
          break;
        case "human-review":
          setCeoWorkbenchView("review");
          setIsCeoWorkbenchOpen(true);
          break;
        case "user-communications":
          setIsUserTasksModalOpen(true);
          break;
        case "office-shop":
          setIsFurnitureShopOpen(true);
          break;
        case "settings":
          setIsSettingsModalOpen(true);
          break;
      }
    },
    [
      setActiveTeamId,
      setCeoWorkbenchView,
      setIsCeoWorkbenchOpen,
      setIsDocumentLibraryPanelOpen,
      setIsFurnitureShopOpen,
      setIsGlobalTeamPanelOpen,
      setIsResourceBankPanelOpen,
      setIsRawTelemetryPanelOpen,
      setIsSettingsModalOpen,
      setIsSkillsPanelOpen,
      setIsTelemetryPanelOpen,
      setIsThreadDataPanelOpen,
      setIsUserTasksModalOpen,
      setKanbanFocusAgentId,
      setSelectedSkillStudioSkillId,
      setSelectedTeamId,
      setSkillStudioFocusAgentId,
      setSkillStudioSurface,
    ],
  );
}
