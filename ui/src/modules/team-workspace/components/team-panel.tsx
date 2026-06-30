"use client";

/**
 * TEAM PANEL
 * ==========
 * Shell component that composes all Team Panel tab components.
 * Opens from team-cluster click with selected team context.
 *
 * KEY CONCEPTS:
 * - Owns shared state: team, project lookups, board actions, builder draft.
 * - Each tab is a modular component receiving derived props.
 * - Kanban is redesigned as a Notion-style board with a task detail modal.
 *
 * USAGE:
 * - Render in Office simulation root.
 * - Drive with app-store activeTeamId + isTeamPanelOpen.
 *
 * MEMORY REFERENCES:
 * - MEM-0100
 * - MEM-0107
 * - MEM-0209
 */

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UI_Z } from "@/lib/z-index";
import { useChatActions } from "@/modules/chat/chat-store";
import { useOfficeRuntimeAdapter } from "@/modules/runtime";
import { ThreadDataPanel } from "@/modules/thread-data";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useAppStore } from "@/store";
import { KanbanTab } from "./kanban-tab";
import { OverviewTab } from "./tabs/overview";
import {
  ProjectCadenceTab,
  ProjectGoalsTab,
  ProjectProductsTab,
  useFarplaneProjectConfig,
} from "./tabs/project-config";
import { deriveProjectId, type TabKey } from "./team-panel-types";
import { TelemetryTab } from "./telemetry-tab";
import { TimelineTab } from "./timeline-tab";
import { useProjectKanban } from "./use-project-kanban";
import { useTeamPanelBoardState } from "./use-team-panel-board";
import { useTeamPanelBusinessState } from "./use-team-panel-business";
import { useTeamPanelMemoryState } from "./use-team-panel-memory";
import { useTeamPanelRuntimeState } from "./use-team-panel-runtime";

interface TeamPanelProps {
  teamId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: TabKey;
  focusAgentId?: string | null;
  globalMode?: boolean;
}

export function TeamPanel({
  teamId,
  isOpen,
  onOpenChange,
  initialTab = "overview",
  focusAgentId = null,
  globalMode = false,
}: TeamPanelProps) {
  const { teams, employees, companyModel, workload, refresh } = useOfficeDataContext();
  const adapter = useOfficeRuntimeAdapter();
  const { openEmployeeChat } = useChatActions();
  const selectedProjectId = useAppStore((state) => state.selectedProjectId);
  const setSelectedProjectId = useAppStore((state) => state.setSelectedProjectId);
  const setIsAgentSessionPanelOpen = useAppStore((state) => state.setIsAgentSessionPanelOpen);
  const setIsRawTelemetryPanelOpen = useAppStore((state) => state.setIsRawTelemetryPanelOpen);
  const setSelectedAgentId = useAppStore((state) => state.setSelectedAgentId);

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [threadDataTarget, setThreadDataTarget] = useState<{
    outputId?: string;
    projectPath?: string;
    runId: string;
  } | null>(null);

  const team = useMemo(() => {
    if (!teamId || globalMode) return null;
    return teams.find((e) => String(e._id) === teamId) ?? null;
  }, [globalMode, teamId, teams]);

  const teamEmployees = useMemo(() => {
    if (!team) return [];
    return employees.filter((e) => String(e.teamId) === String(team._id));
  }, [employees, team]);

  const projectId = globalMode ? selectedProjectId : deriveProjectId(teamId);
  const project = useMemo(() => {
    if (!companyModel) return null;
    if (!projectId) return companyModel.projects[0] ?? null;
    return (
      companyModel.projects.find((e) => e.id === projectId) ?? companyModel.projects[0] ?? null
    );
  }, [companyModel, projectId]);
  const usageEmployees = useMemo(() => {
    if (globalMode) {
      const scopedTeamId = project?.id ? `team-${project.id}`.toLowerCase() : null;
      if (!scopedTeamId) return [];
      return employees.filter(
        (employee) =>
          String(employee.teamId ?? "")
            .trim()
            .toLowerCase() === scopedTeamId,
      );
    }
    return teamEmployees;
  }, [employees, globalMode, project?.id, teamEmployees]);

  const activeProjectId = isOpen ? project?.id : undefined;
  const teamScopeId = useMemo(() => {
    if (globalMode) return project?.id ? `team-${project.id}`.toLowerCase() : null;
    return teamId ? teamId.trim().toLowerCase() : null;
  }, [globalMode, project?.id, teamId]);

  const visibleRoster = useMemo(
    () => (globalMode ? usageEmployees : teamEmployees),
    [globalMode, teamEmployees, usageEmployees],
  );

  const activeProjectPath =
    typeof project?.trackingContext === "string" && project.trackingContext.trim()
      ? project.trackingContext.trim()
      : undefined;
  const projectKanban = useProjectKanban({
    projectPath: activeProjectPath,
    projectId: project?.id,
    enabled: isOpen && activeTab === "kanban",
  });

  const { convexEnabled, projectTasks, communicationRows, boardActionState, handleBoardCommand } =
    useTeamPanelBoardState({
      companyModel,
      globalMode,
      project,
      activeProjectId,
      teamScopeId,
      providerTasks: projectKanban.tasks,
      providerReady: projectKanban.state === "ready",
    });

  const projectConfigState = useFarplaneProjectConfig({
    projectPath: activeProjectPath,
    enabled: isOpen,
  });
  const { memoryRows } = useTeamPanelMemoryState({
    activeProjectId,
    activeProjectPath,
  });

  const { ownerLabelById, presenceRows, teamAiUsageSummary, teamUsageError } =
    useTeamPanelRuntimeState({
      adapter,
      isOpen,
      employees,
      teamEmployees,
      visibleRoster,
      usageEmployees,
      globalMode,
      communicationRows,
      projectTasks,
    });

  const { hasBusinessConfig } = useTeamPanelBusinessState({
    adapter,
    refresh,
    project,
  });
  const panelTitle = globalMode ? "All Teams" : (team?.name ?? "Team");

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (!isOpen || !globalMode || selectedProjectId || !companyModel?.projects?.length) return;
    setSelectedProjectId(companyModel.projects[0].id);
  }, [companyModel?.projects, globalMode, isOpen, selectedProjectId, setSelectedProjectId]);

  useEffect(() => {
    setThreadDataTarget(null);
  }, [activeProjectPath]);

  if (!globalMode && !team) return null;

  function handleOpenAgentSession(agentId: string): void {
    setSelectedAgentId(agentId);
    setIsAgentSessionPanelOpen(true);
  }

  function handleOpenDirectChat(agentId: string): void {
    void openEmployeeChat(`employee-${agentId}`, true);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="min-w-[70vw] max-w-none h-[90vh] overflow-hidden p-0 flex flex-col"
        style={{ zIndex: UI_Z.panelElevated }}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <span>{panelTitle}</span>
            {project ? <Badge variant="secondary">{project.status}</Badge> : null}
            {project?.businessConfig ? (
              <Badge variant="outline">{project.businessConfig.type}</Badge>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabKey)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-6"
        >
          <div className="mt-4 max-w-full overflow-x-auto pb-1">
            <TabsList className="h-9 w-max justify-start">
              <TabsTrigger className="flex-none" value="overview">
                Overview
              </TabsTrigger>
              <TabsTrigger className="flex-none" value="goals">
                Goals
              </TabsTrigger>
              <TabsTrigger className="flex-none" value="products">
                Products
              </TabsTrigger>
              <TabsTrigger className="flex-none" value="kanban">
                Kanban
              </TabsTrigger>
              <TabsTrigger className="flex-none" value="cadence">
                Cadence
              </TabsTrigger>
              <TabsTrigger className="flex-none" value="thread-data">
                Thread Data
              </TabsTrigger>
              <TabsTrigger className="flex-none" value="timeline">
                Timeline
              </TabsTrigger>
              <TabsTrigger className="flex-none" value="telemetry">
                Telemetry
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <OverviewTab
              team={team}
              panelTitle={panelTitle}
              project={project}
              projectTasks={projectTasks}
              employees={employees}
              teamEmployees={teamEmployees}
              workload={workload}
              companyModel={companyModel}
              selectedProjectId={selectedProjectId}
              setSelectedProjectId={setSelectedProjectId}
              globalMode={globalMode}
              hasBusinessConfig={hasBusinessConfig}
              aiBurn24hUsd={teamAiUsageSummary.cost24hUsd}
              aiUsageUnavailableText={teamUsageError}
              presenceRows={presenceRows}
              projectConfig={projectConfigState.config}
              projectConfigState={projectConfigState.state}
              projectConfigError={projectConfigState.error}
              onMessageAgent={handleOpenDirectChat}
              onOpenAgentSession={handleOpenAgentSession}
            />
          </TabsContent>

          <TabsContent value="goals" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <ProjectGoalsTab
              config={projectConfigState.config}
              state={projectConfigState.state}
              error={projectConfigState.error}
              projectTasks={projectTasks}
            />
          </TabsContent>

          <TabsContent value="products" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <ProjectProductsTab config={projectConfigState.config} />
          </TabsContent>

          <TabsContent value="kanban" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <KanbanTab
              projectTasks={projectTasks}
              focusAgentId={focusAgentId}
              teamEmployees={teamEmployees}
              ownerLabelById={ownerLabelById}
              convexEnabled={convexEnabled}
              kanbanSnapshot={projectKanban.snapshot}
              kanbanState={projectKanban.state}
              kanbanError={projectKanban.error}
              onRefreshKanban={projectKanban.refresh}
              boardActionState={boardActionState}
              onBoardCommand={handleBoardCommand}
            />
          </TabsContent>

          <TabsContent value="cadence" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <ProjectCadenceTab config={projectConfigState.config} />
          </TabsContent>

          <TabsContent value="thread-data" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <ThreadDataPanel
              initialRunId={threadDataTarget?.runId ?? null}
              initialOutputId={threadDataTarget?.outputId ?? null}
              projectPath={threadDataTarget?.projectPath ?? activeProjectPath ?? null}
            />
          </TabsContent>

          <TabsContent value="timeline" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <TimelineTab
              convexEnabled={convexEnabled}
              projectId={project?.id ?? null}
              teamScopeId={teamScopeId}
              memoryRows={memoryRows}
              communicationRows={communicationRows}
              onOpenMineRun={(target) => {
                setThreadDataTarget(target);
                setActiveTab("thread-data");
              }}
              onConfigureHooks={() => setIsRawTelemetryPanelOpen(true)}
            />
          </TabsContent>

          <TabsContent value="telemetry" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <TelemetryTab
              projectId={project?.id ?? null}
              teamId={teamScopeId}
              title={project?.name ?? panelTitle}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
