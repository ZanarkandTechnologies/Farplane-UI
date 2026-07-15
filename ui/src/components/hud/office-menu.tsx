"use client";

/**
 * OFFICE MENU
 * ===========
 * Global office launcher for top-level HUD surfaces.
 *
 * KEY CONCEPTS:
 * - Keeps the operator menu focused on current Farplane workflows.
 * - Global launcher entries are registry-driven so HUD, palette, and QA hooks stay aligned.
 *
 * USAGE:
 * - Mounted from `office-simulation.tsx`.
 *
 * MEMORY REFERENCES:
 * - MEM-0155
 * - MEM-0192
 * - MEM-0220
 */

import { Menu } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SpeedDial, type SpeedDialItem } from "@/components/ui/speed-dial";
import { useOfficeAccessMode } from "@/providers/office-access-mode-provider";
import { useAppStore } from "@/store";
import { getOfficeQaState } from "@/modules/office/qa/office-qa-state";
import { FurnitureShop } from "./furniture-shop";
import { OfficeCommandPalette } from "./office-command-palette";
import {
  createOfficeLauncherActions,
  createOfficePanelActions,
  eventMatchesShortcut,
  isEditableEventTarget,
  OFFICE_COMMAND_PALETTE_SHORTCUT,
  type OfficePanelAction,
  type OfficePanelActionId,
} from "./office-panel-registry";
import { OrganizationPanel } from "./organization-panel";

interface SpeedDialProps {
  className?: string;
}

export function OfficeMenu({ className }: SpeedDialProps) {
  const { isReadOnly } = useOfficeAccessMode();
  // Use selectors to prevent unnecessary re-renders
  const isBuilderMode = useAppStore((state) => state.isBuilderMode);
  const setBuilderMode = useAppStore((state) => state.setBuilderMode);
  const isAnimatingCamera = useAppStore((state) => state.isAnimatingCamera);
  const setIsGlobalTeamPanelOpen = useAppStore((state) => state.setIsGlobalTeamPanelOpen);
  const setIsSkillsPanelOpen = useAppStore((state) => state.setIsSkillsPanelOpen);
  const setSkillStudioSurface = useAppStore((state) => state.setSkillStudioSurface);
  const setIsTelemetryPanelOpen = useAppStore((state) => state.setIsTelemetryPanelOpen);
  const setIsRawTelemetryPanelOpen = useAppStore((state) => state.setIsRawTelemetryPanelOpen);
  const setIsThreadDataPanelOpen = useAppStore((state) => state.setIsThreadDataPanelOpen);
  const setIsSkillInvocationsPanelOpen = useAppStore(
    (state) => state.setIsSkillInvocationsPanelOpen,
  );
  const setIsResourceBankPanelOpen = useAppStore((state) => state.setIsResourceBankPanelOpen);
  const setIsWorldMapPanelOpen = useAppStore((state) => state.setIsWorldMapPanelOpen);
  const setIsDocumentLibraryPanelOpen = useAppStore((state) => state.setIsDocumentLibraryPanelOpen);
  const setSelectedSkillStudioSkillId = useAppStore((state) => state.setSelectedSkillStudioSkillId);
  const setSkillStudioFocusAgentId = useAppStore((state) => state.setSkillStudioFocusAgentId);
  const setActiveTeamId = useAppStore((state) => state.setActiveTeamId);
  const setSelectedTeamId = useAppStore((state) => state.setSelectedTeamId);
  const setKanbanFocusAgentId = useAppStore((state) => state.setKanbanFocusAgentId);
  const setIsSettingsModalOpen = useAppStore((state) => state.setIsSettingsModalOpen);
  const placementMode = useAppStore((state) => state.placementMode);
  const setIsUserTasksModalOpen = useAppStore((state) => state.setIsUserTasksModalOpen);
  const isFurnitureShopOpen = useAppStore((state) => state.isFurnitureShopOpen);
  const setIsFurnitureShopOpen = useAppStore((state) => state.setIsFurnitureShopOpen);
  const isOrganizationPanelOpen = useAppStore((state) => state.isOrganizationPanelOpen);
  const setIsOrganizationPanelOpen = useAppStore((state) => state.setIsOrganizationPanelOpen);
  const isOfficeOnboardingVisible = useAppStore((state) => state.isOfficeOnboardingVisible);
  const officeOnboardingStep = useAppStore((state) => state.officeOnboardingStep);

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  // Legacy team/agent manager dialogs were intentionally stripped from this UI flow.
  const canOpenAgentManager = false;
  const canOpenTeamManager = false;
  useEffect(() => {
    if (!placementMode.active) return;
    setIsFurnitureShopOpen(false);
    setIsOrganizationPanelOpen(false);
  }, [placementMode.active, setIsFurnitureShopOpen, setIsOrganizationPanelOpen]);

  // Handle builder mode toggle - let the scene handle animation
  const handleBuilderModeToggle = useCallback(() => {
    if (isAnimatingCamera) return; // Prevent clicks during animation

    setBuilderMode(!isBuilderMode); // This will trigger the animation in OfficeScene
  }, [isAnimatingCamera, isBuilderMode, setBuilderMode]);

  const openGlobalTeamWorkspace = useCallback(() => {
    setActiveTeamId(null);
    setSelectedTeamId(null);
    setKanbanFocusAgentId(null);
    setIsGlobalTeamPanelOpen(true);
  }, [setActiveTeamId, setIsGlobalTeamPanelOpen, setKanbanFocusAgentId, setSelectedTeamId]);

  const shouldGuideMenu =
    isOfficeOnboardingVisible &&
    (officeOnboardingStep === "open-shop" || officeOnboardingStep === "open-team");
  const highlightedMenuActionId =
    officeOnboardingStep === "open-shop"
      ? "office-shop"
      : officeOnboardingStep === "open-team"
        ? "team-workspace"
        : null;

  const officeActions = useMemo(
    () =>
      createOfficePanelActions({
        accessPolicy: isReadOnly ? "read-only" : "operator",
        highlightedMenuActionId,
        isAnimatingCamera,
        isBuilderMode,
        openUserCommunications: () => setIsUserTasksModalOpen(true),
        openDecoration: () => setIsFurnitureShopOpen(true),
        openSkillOs: () => {
          setSelectedSkillStudioSkillId(null);
          setSkillStudioFocusAgentId(null);
          setSkillStudioSurface("skill-os");
          setIsSkillsPanelOpen(true);
        },
        openEvals: () => {
          setSelectedSkillStudioSkillId(null);
          setSkillStudioFocusAgentId(null);
          setSkillStudioSurface("evals");
          setIsSkillsPanelOpen(true);
        },
        openHarness: () => {
          setSelectedSkillStudioSkillId(null);
          setSkillStudioFocusAgentId(null);
          setSkillStudioSurface("harness");
          setIsSkillsPanelOpen(true);
        },
        openRollout: () => {
          setSelectedSkillStudioSkillId(null);
          setSkillStudioFocusAgentId(null);
          setSkillStudioSurface("rollout");
          setIsSkillsPanelOpen(true);
        },
        openTemplateTracking: () => {
          setSelectedSkillStudioSkillId(null);
          setSkillStudioFocusAgentId(null);
          setSkillStudioSurface("template-tracking");
          setIsSkillsPanelOpen(true);
        },
        openGlobalTeamWorkspace,
        openOrganization: () => setIsOrganizationPanelOpen(true),
        openSettings: () => setIsSettingsModalOpen(true),
        openSkillInvocations: () => setIsSkillInvocationsPanelOpen(true),
        openResourceBank: () => setIsResourceBankPanelOpen(true),
        openWorld: () => setIsWorldMapPanelOpen(true),
        openDocumentLibrary: () => setIsDocumentLibraryPanelOpen(true),
        openTelemetry: () => setIsTelemetryPanelOpen(true),
        openRawTelemetry: () => setIsRawTelemetryPanelOpen(true),
        openThreadData: () => setIsThreadDataPanelOpen(true),
        toggleBuilderMode: handleBuilderModeToggle,
      }),
    [
      highlightedMenuActionId,
      isAnimatingCamera,
      isBuilderMode,
      setIsUserTasksModalOpen,
      setIsFurnitureShopOpen,
      setSelectedSkillStudioSkillId,
      setSkillStudioFocusAgentId,
      setSkillStudioSurface,
      setIsSkillsPanelOpen,
      openGlobalTeamWorkspace,
      setIsSettingsModalOpen,
      setIsOrganizationPanelOpen,
      setIsSkillInvocationsPanelOpen,
      setIsResourceBankPanelOpen,
      setIsWorldMapPanelOpen,
      setIsDocumentLibraryPanelOpen,
      setIsTelemetryPanelOpen,
      setIsRawTelemetryPanelOpen,
      setIsThreadDataPanelOpen,
      handleBuilderModeToggle,
      isReadOnly,
    ],
  );

  const speedDialItems: SpeedDialItem[] = useMemo(
    () =>
      createOfficeLauncherActions(officeActions).map((action) => ({
        id: action.id,
        icon: action.icon,
        label: action.label,
        onClick: action.perform,
        badge: action.badge,
        color: action.color,
        disabled: action.disabled,
        buttonClassName: action.buttonClassName,
      })),
    [officeActions],
  );
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || isEditableEventTarget(event.target)) {
        return;
      }

      if (eventMatchesShortcut(event, OFFICE_COMMAND_PALETTE_SHORTCUT)) {
        event.preventDefault();
        setIsCommandPaletteOpen((previous) => !previous);
        return;
      }

      const matchingAction = officeActions.find(
        (action) => action.shortcut && eventMatchesShortcut(event, action.shortcut),
      );
      if (!matchingAction || matchingAction.disabled) {
        return;
      }

      event.preventDefault();
      matchingAction.perform();
      setIsCommandPaletteOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [officeActions]);

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") {
      return;
    }

    const qaWindow = window as typeof window & {
      __FARPLANE_QA__?: {
        listPanels: () => Array<{
          description: string;
          id: OfficePanelActionId;
          label: string;
          shortcut: string | null;
        }>;
        openPanel: (id: OfficePanelActionId) => boolean;
        runCommand: (id: OfficePanelActionId) => boolean;
        getOfficeKitState: () => unknown;
        getCameraState: () => unknown;
        getStoryCameraTiming: () => unknown;
        getThreadEffects: () => unknown;
        seedLineageEvent: (edge: Parameters<NonNullable<ReturnType<typeof getOfficeQaState>["seedLineage"]>>[0]) => boolean;
        runStoryCameraFixture: (target: [number, number, number] | null) => boolean;
        applyBuilderCustomizationFixture: () => Promise<boolean>;
        getOfficeQualityReport: () => unknown;
      };
    };

    const runAction = (id: OfficePanelActionId, allowedGroups: OfficePanelAction["group"][]) => {
      const action = officeActions.find(
        (candidate) => candidate.id === id && allowedGroups.includes(candidate.group),
      );
      if (!action || action.disabled) {
        return false;
      }
      action.perform();
      setIsCommandPaletteOpen(false);
      return true;
    };

    qaWindow.__FARPLANE_QA__ = {
      listPanels: () =>
        officeActions
          .filter(
            (action) =>
              action.group === "panel" && !action.disabled && action.showInPalette !== false,
          )
          .map((action) => ({
            id: action.id,
            label: action.label,
            description: action.description,
            shortcut: action.shortcut?.label ?? null,
          }))
          .sort((left, right) => left.label.localeCompare(right.label)),
      openPanel: (id) => runAction(id, ["panel"]),
      runCommand: (id) => runAction(id, ["action", "navigation", "panel"]),
      getOfficeKitState: () => getOfficeQaState().kit ?? null,
      getCameraState: () => getOfficeQaState().camera ?? null,
      getStoryCameraTiming: () => getOfficeQaState().storyTiming ?? null,
      getThreadEffects: () => getOfficeQaState().effects ?? [],
      getOfficeQualityReport: () => getOfficeQaState().quality ?? null,
      seedLineageEvent: (edge) => {
        const seed = getOfficeQaState().seedLineage;
        if (!seed) return false;
        seed(edge);
        return true;
      },
      runStoryCameraFixture: (target) => {
        const run = getOfficeQaState().runStoryFixture;
        if (!run) return false;
        run(target);
        return true;
      },
      applyBuilderCustomizationFixture: async () => {
        const apply = getOfficeQaState().applyBuilderFixture;
        return apply ? apply() : false;
      },
    };

    return () => {
      delete qaWindow.__FARPLANE_QA__;
    };
  }, [officeActions]);

  return (
    <>
      <SpeedDial
        items={speedDialItems}
        position="top-left"
        direction="vertical"
        triggerIcon={Menu}
        triggerColor="bg-accent hover:bg-accent/90 text-accent-foreground"
        triggerClassName={
          shouldGuideMenu
            ? "ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse"
            : undefined
        }
        forceOpen={shouldGuideMenu}
        className={className}
      />
      <OfficeCommandPalette
        actions={officeActions}
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
      />
      <OrganizationPanel
        isOpen={isOrganizationPanelOpen}
        onOpenChange={setIsOrganizationPanelOpen}
        canOpenTeamManager={canOpenTeamManager}
        canOpenAgentManager={canOpenAgentManager}
      />
      {isFurnitureShopOpen && !isReadOnly ? (
        <FurnitureShop isOpen={isFurnitureShopOpen} onOpenChange={setIsFurnitureShopOpen} />
      ) : null}
    </>
  );
}
