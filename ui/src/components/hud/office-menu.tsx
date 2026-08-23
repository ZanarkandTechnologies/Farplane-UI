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
import { getOfficeQaState } from "@/modules/office/qa/office-qa-state";
import { useOfficeAccessMode } from "@/providers/office-access-mode-provider";
import { useAppStore } from "@/store";
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
  const setGlobalTeamPanelInitialTab = useAppStore((state) => state.setGlobalTeamPanelInitialTab);
  const setIsSkillsPanelOpen = useAppStore((state) => state.setIsSkillsPanelOpen);
  const setSkillStudioSurface = useAppStore((state) => state.setSkillStudioSurface);
  const setIsTelemetryPanelOpen = useAppStore((state) => state.setIsTelemetryPanelOpen);
  const setTelemetryPanelTab = useAppStore((state) => state.setTelemetryPanelTab);
  const setIsLeveragePanelOpen = useAppStore((state) => state.setIsLeveragePanelOpen);
  const setIsSkillInvocationsPanelOpen = useAppStore(
    (state) => state.setIsSkillInvocationsPanelOpen,
  );
  const setIsResourceBankPanelOpen = useAppStore((state) => state.setIsResourceBankPanelOpen);
  const setIsContentIntelligencePanelOpen = useAppStore(
    (state) => state.setIsContentIntelligencePanelOpen,
  );
  const setContentIntelligenceInitialTab = useAppStore(
    (state) => state.setContentIntelligenceInitialTab,
  );
  const setIsDocumentLibraryPanelOpen = useAppStore((state) => state.setIsDocumentLibraryPanelOpen);
  const setSelectedSkillStudioSkillId = useAppStore((state) => state.setSelectedSkillStudioSkillId);
  const setSkillStudioFocusAgentId = useAppStore((state) => state.setSkillStudioFocusAgentId);
  const setActiveTeamId = useAppStore((state) => state.setActiveTeamId);
  const setSelectedTeamId = useAppStore((state) => state.setSelectedTeamId);
  const setKanbanFocusAgentId = useAppStore((state) => state.setKanbanFocusAgentId);
  const setIsSettingsModalOpen = useAppStore((state) => state.setIsSettingsModalOpen);
  const setSettingsDialogTab = useAppStore((state) => state.setSettingsDialogTab);
  const setIsCeoWorkbenchOpen = useAppStore((state) => state.setIsCeoWorkbenchOpen);
  const setCeoWorkbenchView = useAppStore((state) => state.setCeoWorkbenchView);
  const placementMode = useAppStore((state) => state.placementMode);
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

  const openGlobalTeamWorkspace = useCallback(
    (initialTab: "overview" | "thread-data" = "overview") => {
      setActiveTeamId(null);
      setSelectedTeamId(null);
      setKanbanFocusAgentId(null);
      setGlobalTeamPanelInitialTab(initialTab);
      setIsGlobalTeamPanelOpen(true);
    },
    [
      setActiveTeamId,
      setGlobalTeamPanelInitialTab,
      setIsGlobalTeamPanelOpen,
      setKanbanFocusAgentId,
      setSelectedTeamId,
    ],
  );

  const shouldGuideMenu =
    isOfficeOnboardingVisible &&
    (officeOnboardingStep === "open-shop" || officeOnboardingStep === "open-team");
  const highlightedMenuActionId =
    officeOnboardingStep === "open-shop"
      ? "builder-mode"
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
        openUserCommunications: () => {
          setSettingsDialogTab("communications");
          setIsSettingsModalOpen(true);
        },
        openDecoration: () => {
          if (!isBuilderMode && !isAnimatingCamera) setBuilderMode(true);
          setIsFurnitureShopOpen(true);
        },
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
        openCeoWorkbench: () => {
          setCeoWorkbenchView("board");
          setIsCeoWorkbenchOpen(true);
        },
        openHumanReview: () => {
          setCeoWorkbenchView("review");
          setIsCeoWorkbenchOpen(true);
        },
        openOrganization: () => setIsOrganizationPanelOpen(true),
        openSettings: () => {
          setSettingsDialogTab("general");
          setIsSettingsModalOpen(true);
        },
        openSkillInvocations: () => setIsSkillInvocationsPanelOpen(true),
        openResourceBank: () => setIsResourceBankPanelOpen(true),
        openContentIntelligence: () => {
          setContentIntelligenceInitialTab("content");
          setIsContentIntelligencePanelOpen(true);
        },
        openWorld: () => {
          setContentIntelligenceInitialTab("world");
          setIsContentIntelligencePanelOpen(true);
        },
        openDocumentLibrary: () => setIsDocumentLibraryPanelOpen(true),
        openSelfImprovementRuns: () => {
          setSelectedSkillStudioSkillId(null);
          setSkillStudioFocusAgentId(null);
          setSkillStudioSurface("self-improvement-runs");
          setIsSkillsPanelOpen(true);
        },
        openTelemetry: () => {
          setTelemetryPanelTab("usage");
          setIsTelemetryPanelOpen(true);
        },
        openLeverage: () => setIsLeveragePanelOpen(true),
        openRawTelemetry: () => {
          setTelemetryPanelTab("events");
          setIsTelemetryPanelOpen(true);
        },
        openThreadData: () => openGlobalTeamWorkspace("thread-data"),
        toggleBuilderMode: handleBuilderModeToggle,
      }),
    [
      highlightedMenuActionId,
      isAnimatingCamera,
      isBuilderMode,
      setIsFurnitureShopOpen,
      setBuilderMode,
      setSelectedSkillStudioSkillId,
      setSkillStudioFocusAgentId,
      setSkillStudioSurface,
      setIsSkillsPanelOpen,
      openGlobalTeamWorkspace,
      setCeoWorkbenchView,
      setIsCeoWorkbenchOpen,
      setIsSettingsModalOpen,
      setSettingsDialogTab,
      setIsOrganizationPanelOpen,
      setIsSkillInvocationsPanelOpen,
      setIsResourceBankPanelOpen,
      setContentIntelligenceInitialTab,
      setIsContentIntelligencePanelOpen,
      setIsDocumentLibraryPanelOpen,
      setIsTelemetryPanelOpen,
      setTelemetryPanelTab,
      setIsLeveragePanelOpen,
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
        getRoomActivity: () => unknown;
        getObservedSkillFlow: () => unknown;
        seedRoomActivity: (
          groups: Parameters<
            NonNullable<ReturnType<typeof getOfficeQaState>["seedRoomActivity"]>
          >[0],
        ) => boolean;
        seedLineageEvent: (
          edge: Parameters<NonNullable<ReturnType<typeof getOfficeQaState>["seedLineage"]>>[0],
        ) => boolean;
        seedObservedSkillFlow: (
          events: Parameters<
            NonNullable<ReturnType<typeof getOfficeQaState>["seedObservedSkillFlow"]>
          >[0],
        ) => boolean;
        runStoryCameraFixture: (target: [number, number, number] | null) => boolean;
        applyBuilderCustomizationFixture: () => Promise<boolean>;
        getOfficeQualityReport: () => unknown;
        getArchipelagoState: () => unknown;
        getProjectCouncilState: () => unknown;
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
      getRoomActivity: () => getOfficeQaState().roomActivity ?? null,
      getObservedSkillFlow: () => getOfficeQaState().observedSkillFlow ?? null,
      seedRoomActivity: (groups) => {
        const seed = getOfficeQaState().seedRoomActivity;
        if (!seed) return false;
        seed(groups);
        return true;
      },
      getOfficeQualityReport: () => getOfficeQaState().quality ?? null,
      getArchipelagoState: () => getOfficeQaState().archipelago ?? null,
      getProjectCouncilState: () => getOfficeQaState().projectCouncil ?? null,
      seedLineageEvent: (edge) => {
        const seed = getOfficeQaState().seedLineage;
        if (!seed) return false;
        seed(edge);
        return true;
      },
      seedObservedSkillFlow: (events) => {
        const seed = getOfficeQaState().seedObservedSkillFlow;
        if (!seed) return false;
        seed(events);
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
