import { useCallback, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { TeamOptionsDialog } from "./dialogs/team-options-dialog";
import { SettingsDialog } from "@/modules/settings";
import { TelemetryPanel } from "@/modules/telemetry";
import { LogsDrawer } from "./hud/logs-drawer";
import { LogsToggleButton } from "./hud/logs-toggle-button";
import { GatewayStatusPill } from "./hud/gateway-status-pill";
import { OfficeMenu } from "./hud/office-menu";
import { OfficeOnboardingPanel } from "./hud/office-onboarding-panel";
import { BuilderToolbar } from "./hud/builder-toolbar";
import { CeoWorkbenchPanel } from "./hud/ceo-workbench-panel";
import {
  OfficeDataProvider,
  useOptionalOfficeDataContext,
} from "@/providers/office-data-provider";
import { useAppStore } from "@/store";
import { gatewayBase } from "@/modules/runtime";
import {
  selectOfficeWorldContextData,
  useOfficeWorldStore,
} from "@/modules/office/store";
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
import { TeamPanel } from "@/modules/team-workspace";
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
  const { company, teams, employees, desks, officeObjects, officeAreas, officeSettings, isLoading } =
    useOfficeWorldStore(useShallow(selectOfficeWorldContextData));

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
  const setKanbanFocusAgentId = useAppStore((state) => state.setKanbanFocusAgentId);
  const isSettingsModalOpen = useAppStore((state) => state.isSettingsModalOpen);
  const setIsSettingsModalOpen = useAppStore((state) => state.setIsSettingsModalOpen);
  const isTelemetryPanelOpen = useAppStore((state) => state.isTelemetryPanelOpen);
  const setIsTelemetryPanelOpen = useAppStore((state) => state.setIsTelemetryPanelOpen);
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
          <ChatDialog />
          <AgentMemoryPanel />
          <ManageAgentModal />
          {/* Keep mounted so close/reopen preserves in-panel draft state; TeamPanel gates its expensive queries when closed. */}
          <TeamPanel
            teamId={activeTeamId}
            isOpen={isTeamPanelOpen}
            onOpenChange={(open) => setIsTeamPanelOpen(open)}
            initialTab={kanbanFocusAgentId ? "kanban" : "overview"}
            focusAgentId={kanbanFocusAgentId}
          />
          <TeamPanel
            teamId={null}
            isOpen={isGlobalTeamPanelOpen}
            onOpenChange={(open) => {
              setIsGlobalTeamPanelOpen(open);
              if (!open) setKanbanFocusAgentId(null);
            }}
            globalMode
          />
          <AgentSessionPanel />
          <SkillsPanel />
          <ObjectConfigPanel />
          <div className="pointer-events-none absolute inset-0 z-[69]">
            <ObjectTransformPanel />
          </div>
          <ObjectInteractionPanel />
          <CeoWorkbenchPanel />
          <SettingsDialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen} />
          <TelemetryPanel open={isTelemetryPanelOpen} onOpenChange={setIsTelemetryPanelOpen} />

          <div className="pointer-events-none absolute top-4 left-4 z-[70]">
            <div className="pointer-events-auto">
              <OfficeMenu />
            </div>
          </div>
          <OfficeOnboardingPanel />
          <div className="pointer-events-none absolute top-24 right-4 z-[69]">
            <BuilderToolbar />
          </div>

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
          {activeTeamForOptions && (
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
