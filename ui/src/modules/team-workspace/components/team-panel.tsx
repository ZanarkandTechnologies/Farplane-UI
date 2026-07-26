"use client";

/**
 * TEAM PANEL
 * ==========
 * Shell component that composes all Team Panel tab components.
 * Opens from team-cluster click with selected team context.
 *
 * KEY CONCEPTS:
 * - Owns shared state: team, project lookups, and filesystem task projection.
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UI_Z } from "@/lib/z-index";
import { useChatActions } from "@/modules/chat/chat-store";
import { useOfficeRuntimeAdapter } from "@/modules/runtime";
import { findMetricsSnapshot } from "@/modules/team-workspace/lib/dashboard-projections/goal-kpi-model";
import { buildSocialContentInsightsModel } from "@/modules/team-workspace/lib/dashboard-projections/social-content-insights";
import { ThreadDataPanel } from "@/modules/thread-data";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useAppStore } from "@/store";
import { KanbanTab } from "./kanban-tab";
import { DistributionTab } from "./tabs/distribution";
import { HighlightsGalleryTab } from "./tabs/highlights";
import { NewsTab } from "./tabs/news";
import { SkillsReadinessTab } from "./tabs/operator-intelligence";
import { OverviewTab } from "./tabs/overview";
import { TeamMembersSection } from "./tabs/overview/team-members-section";
import {
  ProjectAutomationsTab,
  ProjectCharterTab,
  ProjectObjectivesTab,
  useFarplaneProjectConfig,
} from "./tabs/project-config";
import { ReportsTab } from "./tabs/reports";
import { TeamCharactersTab } from "./tabs/team-characters-tab";
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

type TabGroupId = "overview" | "work" | "team" | "history" | "intel";

type TabGroup = {
  children: { label: string; value: TabKey }[];
  id: TabGroupId;
  label: string;
};

const TAB_GROUPS: TabGroup[] = [
  {
    id: "overview",
    label: "Overview",
    children: [
      { label: "Overview", value: "overview" },
      { label: "Wins", value: "wins" },
      { label: "Failures", value: "failures" },
    ],
  },
  {
    id: "work",
    label: "Work",
    children: [
      { label: "Charter", value: "charter" },
      { label: "Objectives", value: "objectives" },
      { label: "Kanban", value: "kanban" },
      { label: "Distribution", value: "distribution" },
    ],
  },
  {
    id: "team",
    label: "Team",
    children: [
      { label: "Members", value: "members" },
      { label: "Characters", value: "characters" },
      { label: "Skills", value: "skills" },
      { label: "Automations", value: "cadence" },
    ],
  },
  {
    id: "history",
    label: "History",
    children: [
      { label: "Timeline", value: "timeline" },
      { label: "Reports", value: "reports" },
      { label: "Thread Data", value: "thread-data" },
      { label: "Telemetry", value: "telemetry" },
    ],
  },
  { id: "intel", label: "Intel", children: [{ label: "News", value: "news" }] },
];

function tabGroupFor(tab: TabKey): TabGroup {
  return (
    TAB_GROUPS.find((group) => group.children.some((child) => child.value === tab)) ?? TAB_GROUPS[0]
  );
}

export function TeamPanel({
  teamId,
  isOpen,
  onOpenChange,
  initialTab = "overview",
  focusAgentId = null,
  globalMode = false,
}: TeamPanelProps) {
  const { teams, employees, officeObjects, companyModel, refresh } = useOfficeDataContext();
  const adapter = useOfficeRuntimeAdapter();
  const { openEmployeeChat } = useChatActions();
  const selectedProjectId = useAppStore((state) => state.selectedProjectId);
  const setSelectedProjectId = useAppStore((state) => state.setSelectedProjectId);
  const setIsAgentSessionPanelOpen = useAppStore((state) => state.setIsAgentSessionPanelOpen);
  const setIsRawTelemetryPanelOpen = useAppStore((state) => state.setIsRawTelemetryPanelOpen);
  const setSelectedAgentId = useAppStore((state) => state.setSelectedAgentId);
  const setHighlightedEmployeeIds = useAppStore((state) => state.setHighlightedEmployeeIds);
  const highlightedEmployeeIds = useAppStore((state) => state.highlightedEmployeeIds);

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
  const teamDemoEmployeeId = useMemo(() => {
    const target =
      visibleRoster.find(
        (employee) => employee.isSupervisor && employee.presencePersistent !== false,
      ) ?? visibleRoster.find((employee) => employee.presencePersistent !== false);
    return target ? String(target._id) : undefined;
  }, [visibleRoster]);

  const activeProjectPath =
    typeof project?.trackingContext === "string" && project.trackingContext.trim()
      ? project.trackingContext.trim()
      : undefined;
  const projectKanban = useProjectKanban({
    projectPath: activeProjectPath,
    projectId: project?.id,
    enabled: isOpen,
  });

  const { convexEnabled, projectTasks, communicationRows } = useTeamPanelBoardState({
    teamScopeId,
    providerTasks: projectKanban.tasks,
  });

  const projectConfigState = useFarplaneProjectConfig({
    projectPath: activeProjectPath,
    enabled: isOpen,
  });
  const metricsSnapshot = findMetricsSnapshot(projectConfigState.config);
  const socialContent = buildSocialContentInsightsModel(projectConfigState.config, metricsSnapshot);
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
  const activeTabGroup = tabGroupFor(activeTab);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (!isOpen || !globalMode || selectedProjectId || !companyModel?.projects?.length) return;
    setSelectedProjectId(companyModel.projects[0].id);
  }, [companyModel?.projects, globalMode, isOpen, selectedProjectId, setSelectedProjectId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reset the thread-data selection when the active project changes.
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
          <div className="mt-4 max-w-full overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max flex-col items-start gap-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-1 rounded-md border bg-muted/20 p-1">
                {TAB_GROUPS.map((group) => {
                  const active = group.id === activeTabGroup.id;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      className={`h-8 rounded px-3 text-sm font-medium transition-colors ${
                        active
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-background/60"
                      }`}
                      onClick={() => setActiveTab(group.children[0].value)}
                    >
                      {group.label}
                    </button>
                  );
                })}
              </div>
              <TabsList className="flex h-9 w-max flex-nowrap justify-start gap-4 rounded-none border-0 border-b bg-transparent p-0">
                {activeTabGroup.children.map((child) => (
                  <TabsTrigger
                    className="h-9 flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    key={child.value}
                    value={child.value}
                  >
                    {child.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>

          <TabsContent value="overview" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <OverviewTab
              team={team}
              panelTitle={panelTitle}
              project={project}
              companyModel={companyModel}
              setSelectedProjectId={setSelectedProjectId}
              globalMode={globalMode}
              hasBusinessConfig={hasBusinessConfig}
              aiBurn24hUsd={teamAiUsageSummary.cost24hUsd}
              aiUsageUnavailableText={teamUsageError}
              projectConfig={projectConfigState.config}
              projectConfigState={projectConfigState.state}
              projectConfigError={projectConfigState.error}
              projectTasks={projectTasks}
            />
          </TabsContent>

          <TabsContent value="wins" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <HighlightsGalleryTab
              kind="wins"
              projectConfig={projectConfigState.config}
              projectConfigState={projectConfigState.state}
              teamScope={team?._id ?? project?.id}
            />
          </TabsContent>

          <TabsContent value="failures" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <HighlightsGalleryTab
              kind="failures"
              projectConfig={projectConfigState.config}
              projectConfigState={projectConfigState.state}
              teamScope={team?._id ?? project?.id}
            />
          </TabsContent>

          <TabsContent value="charter" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <ProjectCharterTab
              config={projectConfigState.config}
              state={projectConfigState.state}
              error={projectConfigState.error}
            />
          </TabsContent>

          <TabsContent value="objectives" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <ProjectObjectivesTab
              config={projectConfigState.config}
              state={projectConfigState.state}
              error={projectConfigState.error}
            />
          </TabsContent>

          <TabsContent value="kanban" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <KanbanTab
              projectTasks={projectTasks}
              focusAgentId={focusAgentId}
              ownerLabelById={ownerLabelById}
              kanbanSnapshot={projectKanban.snapshot}
              kanbanState={projectKanban.state}
              kanbanError={projectKanban.error}
              onRefreshKanban={projectKanban.refresh}
            />
          </TabsContent>

          <TabsContent value="timeline" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <TimelineTab
              convexEnabled={convexEnabled}
              projectId={project?.id ?? null}
              projectPath={activeProjectPath ?? null}
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

          <TabsContent value="reports" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <ReportsTab
              projectConfig={projectConfigState.config}
              projectConfigState={projectConfigState.state}
              projectConfigError={projectConfigState.error}
            />
          </TabsContent>

          <TabsContent value="members" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full pr-3">
              <TeamMembersSection
                highlightedEmployeeIds={highlightedEmployeeIds}
                onMessageAgent={handleOpenDirectChat}
                onOpenAgentSession={handleOpenAgentSession}
                presenceRows={presenceRows}
                setHighlightedEmployeeIds={setHighlightedEmployeeIds}
              />
            </ScrollArea>
          </TabsContent>

          {project && companyModel && teamScopeId ? (
            <TabsContent value="characters" className="mt-4 min-h-0 flex-1 overflow-hidden">
              <TeamCharactersTab
                adapter={adapter}
                company={companyModel}
                project={project}
                officeObjects={officeObjects}
                teamId={teamScopeId}
                targetEmployeeId={teamDemoEmployeeId}
                onDemo={() => onOpenChange(false)}
                onSaved={refresh}
              />
            </TabsContent>
          ) : null}

          <TabsContent value="distribution" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <DistributionTab snapshot={metricsSnapshot} socialContent={socialContent} />
          </TabsContent>

          <TabsContent value="news" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <NewsTab
              enabled={isOpen && activeTab === "news"}
              projectId={project?.id ?? null}
              projectName={project?.name ?? null}
              projectPath={activeProjectPath ?? null}
            />
          </TabsContent>

          <TabsContent value="skills" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <SkillsReadinessTab
              project={project}
              companyModel={companyModel}
              projectTasks={projectTasks}
              memoryRows={memoryRows}
              globalMode={globalMode}
            />
          </TabsContent>

          <TabsContent value="cadence" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <ProjectAutomationsTab config={projectConfigState.config} />
          </TabsContent>

          <TabsContent value="thread-data" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <ThreadDataPanel
              initialRunId={threadDataTarget?.runId ?? null}
              initialOutputId={threadDataTarget?.outputId ?? null}
              projectPath={threadDataTarget?.projectPath ?? activeProjectPath ?? null}
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
