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
  const setIsOrganizationPanelOpen = useAppStore((state) => state.setIsOrganizationPanelOpen);
  const setIsGlobalTeamPanelOpen = useAppStore((state) => state.setIsGlobalTeamPanelOpen);
  const setGlobalTeamPanelInitialTab = useAppStore((state) => state.setGlobalTeamPanelInitialTab);
  const setIsTelemetryPanelOpen = useAppStore((state) => state.setIsTelemetryPanelOpen);
  const setTelemetryPanelTab = useAppStore((state) => state.setTelemetryPanelTab);
  const setIsFinancePanelOpen = useAppStore((state) => state.setIsFinancePanelOpen);
  const setIsLeveragePanelOpen = useAppStore((state) => state.setIsLeveragePanelOpen);
  const setIsResourceBankPanelOpen = useAppStore((state) => state.setIsResourceBankPanelOpen);
  const setIsContentIntelligencePanelOpen = useAppStore(
    (state) => state.setIsContentIntelligencePanelOpen,
  );
  const setContentIntelligenceInitialTab = useAppStore(
    (state) => state.setContentIntelligenceInitialTab,
  );
  const setIsDocumentLibraryPanelOpen = useAppStore((state) => state.setIsDocumentLibraryPanelOpen);
  const setIsSkillsPanelOpen = useAppStore((state) => state.setIsSkillsPanelOpen);
  const setSkillStudioSurface = useAppStore((state) => state.setSkillStudioSurface);
  const setSelectedSkillStudioSkillId = useAppStore((state) => state.setSelectedSkillStudioSkillId);
  const setSkillStudioFocusAgentId = useAppStore((state) => state.setSkillStudioFocusAgentId);
  const setIsCeoWorkbenchOpen = useAppStore((state) => state.setIsCeoWorkbenchOpen);
  const setCeoWorkbenchView = useAppStore((state) => state.setCeoWorkbenchView);
  const setIsFurnitureShopOpen = useAppStore((state) => state.setIsFurnitureShopOpen);
  const setBuilderMode = useAppStore((state) => state.setBuilderMode);
  const setIsSettingsModalOpen = useAppStore((state) => state.setIsSettingsModalOpen);
  const setSettingsDialogTab = useAppStore((state) => state.setSettingsDialogTab);
  const setActiveTeamId = useAppStore((state) => state.setActiveTeamId);
  const setSelectedTeamId = useAppStore((state) => state.setSelectedTeamId);
  const setKanbanFocusAgentId = useAppStore((state) => state.setKanbanFocusAgentId);

  return useCallback(
    (panelId: OfficeInternalPanelId) => {
      switch (panelId) {
        case "organization":
          setIsOrganizationPanelOpen(true);
          break;
        case "team-workspace":
          setActiveTeamId(null);
          setSelectedTeamId(null);
          setKanbanFocusAgentId(null);
          setGlobalTeamPanelInitialTab("overview");
          setIsGlobalTeamPanelOpen(true);
          break;
        case "telemetry":
          setTelemetryPanelTab("usage");
          setIsTelemetryPanelOpen(true);
          break;
        case "finance":
          setIsFinancePanelOpen(true);
          break;
        case "leverage":
          setIsLeveragePanelOpen(true);
          break;
        case "raw-telemetry":
          setTelemetryPanelTab("events");
          setIsTelemetryPanelOpen(true);
          break;
        case "thread-data":
          setActiveTeamId(null);
          setSelectedTeamId(null);
          setKanbanFocusAgentId(null);
          setGlobalTeamPanelInitialTab("thread-data");
          setIsGlobalTeamPanelOpen(true);
          break;
        case "resource-bank":
          setIsResourceBankPanelOpen(true);
          break;
        case "content-intelligence":
          setContentIntelligenceInitialTab("content");
          setIsContentIntelligencePanelOpen(true);
          break;
        case "world":
          setContentIntelligenceInitialTab("world");
          setIsContentIntelligencePanelOpen(true);
          break;
        case "document-library":
          setIsDocumentLibraryPanelOpen(true);
          break;
        case "self-improvement-runs":
          setSelectedSkillStudioSkillId(null);
          setSkillStudioFocusAgentId(null);
          setSkillStudioSurface("self-improvement-runs");
          setIsSkillsPanelOpen(true);
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
          setSettingsDialogTab("communications");
          setIsSettingsModalOpen(true);
          break;
        case "office-shop":
          setBuilderMode(true);
          setIsFurnitureShopOpen(true);
          break;
        case "settings":
          setSettingsDialogTab("general");
          setIsSettingsModalOpen(true);
          break;
      }
    },
    [
      setIsOrganizationPanelOpen,
      setActiveTeamId,
      setGlobalTeamPanelInitialTab,
      setCeoWorkbenchView,
      setIsCeoWorkbenchOpen,
      setIsDocumentLibraryPanelOpen,
      setIsFurnitureShopOpen,
      setBuilderMode,
      setIsFinancePanelOpen,
      setIsLeveragePanelOpen,
      setIsGlobalTeamPanelOpen,
      setIsResourceBankPanelOpen,
      setContentIntelligenceInitialTab,
      setIsContentIntelligencePanelOpen,
      setIsSettingsModalOpen,
      setSettingsDialogTab,
      setIsSkillsPanelOpen,
      setIsTelemetryPanelOpen,
      setTelemetryPanelTab,
      setKanbanFocusAgentId,
      setSelectedSkillStudioSkillId,
      setSelectedTeamId,
      setSkillStudioFocusAgentId,
      setSkillStudioSurface,
    ],
  );
}
