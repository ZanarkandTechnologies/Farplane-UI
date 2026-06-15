import { useCallback, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Badge } from "@/components/ui/badge";
import ChatDialog from "@/modules/chat/components/chat-dialog";
import {
  AgentMemoryPanel,
  AgentSessionPanel,
  LayoutEditorHudProvider,
  ManageAgentModal,
  ObjectConfigPanel,
  ObjectInteractionPanel,
  ObjectTransformPanel,
  OfficeScene,
  preloadMeshes,
  SkillsPanel,
} from "@/modules/office";
import { selectOfficeWorldContextData, useOfficeWorldStore } from "@/modules/office/store";
import { gatewayBase } from "@/modules/runtime";
import { SettingsDialog } from "@/modules/settings";
import { SkillInvocationsPanel } from "@/modules/skill-invocations";
import { ResourceBankPanel } from "@/modules/resource-bank";
import { TeamPanel } from "@/modules/team-workspace";
import { TelemetryPanel } from "@/modules/telemetry";
import { useOfficeAccessMode } from "@/providers/office-access-mode-provider";
import { OfficeDataProvider, useOptionalOfficeDataContext } from "@/providers/office-data-provider";
import { useAppStore } from "@/store";
import { TeamOptionsDialog } from "./dialogs/team-options-dialog";
import { BuilderToolbar } from "./hud/builder-toolbar";
import { CeoWorkbenchPanel } from "./hud/ceo-workbench-panel";
import { GatewayStatusPill } from "./hud/gateway-status-pill";
import { LogsDrawer } from "./hud/logs-drawer";
import { LogsToggleButton } from "./hud/logs-toggle-button";
import { OfficeMenu } from "./hud/office-menu";
import { OfficeOnboardingPanel } from "./hud/office-onboarding-panel";
import { UserTasksPanel } from "./hud/user-tasks-panel";
import { buildOfficeBootstrapStages, getOfficeBootstrapState } from "./office-bootstrap";
import { OfficeLoader } from "./office-loader";

export default function OfficeSimulation() {
  const officeDataContext = useOptionalOfficeDataContext();
  if (!officeDataContext) {
    return (
      <OfficeDataProvider>
        <OfficeSimulationContent />
      </OfficeDataProvider>
    );
  }
  return <OfficeSimulationContent />;
}

// Main Office Simulation Component
function OfficeSimulationContent() {
  const { isPublic, isReadOnly } = useOfficeAccessMode();
  const {
    company,
    teams,
    employees,
    desks,
    officeObjects,
    officeAreas,
    officeSettings,
    isLoading,
  } = useOfficeWorldStore(useShallow(selectOfficeWorldContextData));

  // Get team options dialog state from app store with selectors
  const isTeamOptionsDialogOpen = useAppStore((state) => state.isTeamOptionsDialogOpen);
  const setIsTeamOptionsDialogOpen = useAppStore((state) => state.setIsTeamOptionsDialogOpen);
  const activeTeamForOptions = useAppStore((state) => state.activeTeamForOptions);
  const isTeamPanelOpen = useAppStore((state) => state.isTeamPanelOpen);
  const setIsTeamPanelOpen = useAppStore((state) => state.setIsTeamPanelOpen);
  const activeTeamId = useAppStore((state) => state.activeTeamId);
  const kanbanFocusAgentId = useAppStore((state) => state.kanbanFocusAgentId);
  const isGlobalTeamPanelOpen = useAppStore((state) => state.isGlobalTeamPanelOpen);
  const setIsGlobalTeamPanelOpen = useAppStore((state) => state.setIsGlobalTeamPanelOpen);
  const isUserTasksModalOpen = useAppStore((state) => state.isUserTasksModalOpen);
  const setIsUserTasksModalOpen = useAppStore((state) => state.setIsUserTasksModalOpen);
  const setKanbanFocusAgentId = useAppStore((state) => state.setKanbanFocusAgentId);
  const isSettingsModalOpen = useAppStore((state) => state.isSettingsModalOpen);
  const setIsSettingsModalOpen = useAppStore((state) => state.setIsSettingsModalOpen);
  const isTelemetryPanelOpen = useAppStore((state) => state.isTelemetryPanelOpen);
  const setIsTelemetryPanelOpen = useAppStore((state) => state.setIsTelemetryPanelOpen);
  const isSkillInvocationsPanelOpen = useAppStore((state) => state.isSkillInvocationsPanelOpen);
  const setIsSkillInvocationsPanelOpen = useAppStore(
    (state) => state.setIsSkillInvocationsPanelOpen,
  );
  const isResourceBankPanelOpen = useAppStore((state) => state.isResourceBankPanelOpen);
  const setIsResourceBankPanelOpen = useAppStore((state) => state.setIsResourceBankPanelOpen);
  const [isLogsDrawerOpen, setIsLogsDrawerOpen] = useState(false);
  const [navigationReady, setNavigationReady] = useState(false);

  // Get company ID from the first team (all teams should have same companyId)
  const companyId = company?._id;

  const customMeshUrls = useMemo(() => {
    const urls = officeObjects
      .filter((obj) => obj.meshType === "custom-mesh")
      .map((obj) =>
        typeof obj.metadata?.meshPublicPath === "string" ? obj.metadata.meshPublicPath : "",
      )
      .filter(Boolean);
    // Keep signature stable across periodic provider refreshes.
    return [...new Set(urls)].sort();
  }, [officeObjects]);

  const customMeshSignature = useMemo(() => customMeshUrls.join("|"), [customMeshUrls]);
  const [loadedMeshSignature, setLoadedMeshSignature] = useState<string>(() =>
    customMeshUrls.length === 0 ? "" : "__pending__",
  );
  const meshesReady = customMeshUrls.length === 0 || loadedMeshSignature === customMeshSignature;
  const dataReady = !isLoading;
  const sceneShellReady = dataReady && meshesReady;

  useEffect(() => {
    if (!sceneShellReady) {
      setNavigationReady(false);
    }
  }, [sceneShellReady]);

  useEffect(() => {
    if (customMeshUrls.length === 0) {
      setLoadedMeshSignature("");
      return;
    }
    if (loadedMeshSignature === customMeshSignature) {
      return;
    }
    let cancelled = false;
    preloadMeshes(customMeshUrls)
      .catch(() => {
        // Allow scene render even if a preload fails; mesh components have local fallbacks.
      })
      .finally(() => {
        if (!cancelled) setLoadedMeshSignature(customMeshSignature);
      });
    return () => {
      cancelled = true;
    };
  }, [customMeshUrls, customMeshSignature, loadedMeshSignature]);

  const bootstrapStages = useMemo(
    () =>
      buildOfficeBootstrapStages({
        dataReady,
        meshesReady,
        navigationReady: sceneShellReady && navigationReady,
      }),
    [dataReady, meshesReady, navigationReady, sceneShellReady],
  );

  const bootstrapState = useMemo(() => getOfficeBootstrapState(bootstrapStages), [bootstrapStages]);
  const handleNavigationReady = useCallback(() => {
    setNavigationReady(true);
  }, []);

  return (
    <LayoutEditorHudProvider>
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        {sceneShellReady ? (
          <OfficeScene
            teams={teams}
            employees={employees}
            desks={desks}
            officeObjects={officeObjects}
            officeAreas={officeAreas}
            officeFootprint={officeSettings.officeFootprint}
            officeLayout={officeSettings.officeLayout}
            officeDecorSettings={officeSettings.decor}
            officeViewSettings={officeSettings}
            companyId={companyId}
            onNavigationReady={handleNavigationReady}
          />
        ) : null}

        {sceneShellReady ? (
          <>
            {!isReadOnly ? <ChatDialog /> : null}
            {!isPublic ? <AgentMemoryPanel /> : null}
            {!isReadOnly ? <ManageAgentModal /> : null}
            {/* Keep mounted so close/reopen preserves in-panel draft state; TeamPanel gates its expensive queries when closed. */}
            {!isReadOnly ? (
              <TeamPanel
                teamId={activeTeamId}
                isOpen={isTeamPanelOpen}
                onOpenChange={(open) => setIsTeamPanelOpen(open)}
                initialTab={kanbanFocusAgentId ? "kanban" : "overview"}
                focusAgentId={kanbanFocusAgentId}
              />
            ) : null}
            {!isReadOnly ? (
              <TeamPanel
                teamId={null}
                isOpen={isGlobalTeamPanelOpen}
                onOpenChange={(open) => {
                  setIsGlobalTeamPanelOpen(open);
                  if (!open) setKanbanFocusAgentId(null);
                }}
                globalMode
              />
            ) : null}
            {!isReadOnly ? <AgentSessionPanel /> : null}
            <SkillsPanel />
            {!isReadOnly ? <ObjectConfigPanel /> : null}
            {!isReadOnly ? (
              <div className="pointer-events-none absolute inset-0 z-[69]">
                <ObjectTransformPanel />
              </div>
            ) : null}
            <ObjectInteractionPanel />
            {!isReadOnly ? <CeoWorkbenchPanel /> : null}
            {!isReadOnly ? (
              <UserTasksPanel
                isOpen={isUserTasksModalOpen}
                onOpenChange={setIsUserTasksModalOpen}
              />
            ) : null}
            {!isReadOnly ? (
              <SettingsDialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen} />
            ) : null}
            <TelemetryPanel open={isTelemetryPanelOpen} onOpenChange={setIsTelemetryPanelOpen} />
            <SkillInvocationsPanel
              open={isSkillInvocationsPanelOpen}
              onOpenChange={setIsSkillInvocationsPanelOpen}
            />
            <ResourceBankPanel
              open={isResourceBankPanelOpen}
              onOpenChange={setIsResourceBankPanelOpen}
            />

            <div className="pointer-events-none absolute top-4 left-4 z-[70]">
              <div className="pointer-events-auto">
                <OfficeMenu />
              </div>
            </div>
            {isReadOnly ? (
              <div className="pointer-events-none absolute top-4 right-4 z-[70]">
                <Badge
                  variant="secondary"
                  className="border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100 shadow-lg backdrop-blur"
                >
                  {isPublic ? "Public View" : "Read-only"}
                </Badge>
              </div>
            ) : (
              <>
                <OfficeOnboardingPanel />
                <div className="pointer-events-none absolute top-24 right-4 z-[69]">
                  <BuilderToolbar />
                </div>
              </>
            )}

            <div className="pointer-events-none absolute bottom-4 right-4 z-[65]">
              <LogsToggleButton
                isOpen={isLogsDrawerOpen}
                onToggle={() => setIsLogsDrawerOpen((prev) => !prev)}
              />
            </div>
            <div className="pointer-events-none absolute bottom-4 left-4 z-[65]">
              <GatewayStatusPill />
            </div>

            <LogsDrawer
              open={isLogsDrawerOpen}
              onOpenChange={setIsLogsDrawerOpen}
              gatewayBase={gatewayBase}
            />

            {/* Team options dialog rendered outside Canvas for stable layering */}
            {!isReadOnly && activeTeamForOptions && (
              <TeamOptionsDialog
                team={activeTeamForOptions}
                isOpen={isTeamOptionsDialogOpen}
                onOpenChange={setIsTeamOptionsDialogOpen}
              />
            )}
          </>
        ) : null}

        {!bootstrapState.isReady ? (
          <OfficeLoader completionRatio={bootstrapState.completionRatio} stages={bootstrapStages} />
        ) : null}
      </div>
    </LayoutEditorHudProvider>
  );
}
