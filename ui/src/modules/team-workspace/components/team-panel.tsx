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

import { type ReactElement, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChatActions } from "@/modules/chat/chat-store";
import { useAppStore } from "@/store";
import { UI_Z } from "@/lib/z-index";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { type CompanyModel, useOfficeRuntimeAdapter } from "@/modules/runtime";
import { KanbanTab } from "./kanban-tab";
import {
  AutomationsTab,
  DocsTab,
  EvalsQaTab,
  GoalsTab,
  GuardTab,
  HardcasesTab,
  SkillsReadinessTab,
} from "./operator-intelligence-tabs";
import { OverviewTab } from "./overview-tab";
import { TeamMemoryTab } from "./team-memory-tab";
import { TelemetryTab } from "./telemetry-tab";
import {
  deriveProjectId,
  type PanelTask,
  type TabKey,
  type TeamMemoryRow,
} from "./team-panel-types";
import { ThreadLineageTab } from "./thread-lineage-tab";
import { TimelineTab } from "./timeline-tab";
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

type ProjectModel = CompanyModel["projects"][number];

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
  const setSelectedAgentId = useAppStore((state) => state.setSelectedAgentId);

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [pulseTab, setPulseTab] = useState("activity");
  const [proofTab, setProofTab] = useState("evals");
  const [memoryTab, setMemoryTab] = useState("memory");
  const [configTab, setConfigTab] = useState("manifest");

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

  const { convexEnabled, projectTasks, communicationRows, boardActionState, handleBoardCommand } =
    useTeamPanelBoardState({
      companyModel,
      globalMode,
      project,
      activeProjectId,
      teamScopeId,
    });

  const { memoryRows, composeState, reloadMemory } = useTeamPanelMemoryState({
    activeProjectId,
    activeProjectPath:
      typeof project?.trackingContext === "string" && project.trackingContext.trim()
        ? project.trackingContext.trim()
        : undefined,
  });

  const {
    ownerLabelById,
    activityFeedCandidates,
    presenceRows,
    teamAiUsageSummary,
    teamUsageError,
  } = useTeamPanelRuntimeState({
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

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [],
  );

  const panelTitle = globalMode ? "All Teams" : (team?.name ?? "Team");

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (!isOpen || !globalMode || selectedProjectId || !companyModel?.projects?.length) return;
    setSelectedProjectId(companyModel.projects[0].id);
  }, [companyModel?.projects, globalMode, isOpen, selectedProjectId, setSelectedProjectId]);

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
              <TabsTrigger className="flex-none" value="kanban">
                Kanban
              </TabsTrigger>
              <TabsTrigger className="flex-none" value="goals">
                Goals
              </TabsTrigger>
              <TabsTrigger className="flex-none" value="pulse">
                Pulse
              </TabsTrigger>
              {activeTab === "pulse" ? (
                <InlineSubTabs
                  activeValue={pulseTab}
                  tabs={[
                    { value: "activity", label: "Activity" },
                    { value: "threads", label: "Threads" },
                    { value: "usage", label: "Usage" },
                    { value: "steer", label: "Steer" },
                  ]}
                  onSelect={setPulseTab}
                />
              ) : null}
              <TabsTrigger className="flex-none" value="proof">
                Proof
              </TabsTrigger>
              {activeTab === "proof" ? (
                <InlineSubTabs
                  activeValue={proofTab}
                  tabs={[
                    { value: "evals", label: "Evals/QA" },
                    { value: "guard", label: "Guard" },
                    { value: "hardcases", label: "Hardcases" },
                  ]}
                  onSelect={setProofTab}
                />
              ) : null}
              <TabsTrigger className="flex-none" value="memory">
                Memory
              </TabsTrigger>
              {activeTab === "memory" ? (
                <InlineSubTabs
                  activeValue={memoryTab}
                  tabs={[
                    { value: "memory", label: "Memory" },
                    { value: "docs", label: "Files/Docs" },
                  ]}
                  onSelect={setMemoryTab}
                />
              ) : null}
              <TabsTrigger className="flex-none" value="config">
                Config
              </TabsTrigger>
              {activeTab === "config" ? (
                <InlineSubTabs
                  activeValue={configTab}
                  tabs={[
                    { value: "manifest", label: "Manifest" },
                    { value: "skills", label: "Skills" },
                  ]}
                  onSelect={setConfigTab}
                />
              ) : null}
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
              currencyFormatter={currencyFormatter}
              aiBurn24hUsd={teamAiUsageSummary.cost24hUsd}
              aiUsageUnavailableText={teamUsageError}
              presenceRows={presenceRows}
              onMessageAgent={handleOpenDirectChat}
              onOpenAgentSession={handleOpenAgentSession}
            />
          </TabsContent>

          <TabsContent value="kanban" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <KanbanTab
              projectTasks={projectTasks}
              focusAgentId={focusAgentId}
              teamEmployees={teamEmployees}
              ownerLabelById={ownerLabelById}
              convexEnabled={convexEnabled}
              boardActionState={boardActionState}
              onBoardCommand={handleBoardCommand}
            />
          </TabsContent>

          <TabsContent value="goals" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <GoalsTab
              project={project}
              companyModel={companyModel}
              projectTasks={projectTasks}
              memoryRows={memoryRows}
              globalMode={globalMode}
            />
          </TabsContent>

          <TabsContent value="pulse" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <InlineTabContent
              activeValue={pulseTab}
              tabs={[
                {
                  value: "activity",
                  label: "Activity",
                  content: (
                    <TimelineTab
                      convexEnabled={convexEnabled}
                      teamScopeId={teamScopeId}
                      activityFeedCandidates={activityFeedCandidates}
                      communicationRows={communicationRows}
                    />
                  ),
                },
                {
                  value: "threads",
                  label: "Threads",
                  content: (
                    <ThreadLineageTab
                      isActive={isOpen && activeTab === "pulse"}
                      projectId={project?.id ?? null}
                      projectName={project?.name ?? panelTitle}
                    />
                  ),
                },
                {
                  value: "usage",
                  label: "Usage",
                  content: (
                    <TelemetryTab
                      projectId={project?.id ?? null}
                      teamId={teamScopeId}
                      title={project?.name ?? panelTitle}
                    />
                  ),
                },
                {
                  value: "steer",
                  label: "Steer",
                  content: <AutomationsTab />,
                },
              ]}
            />
          </TabsContent>

          <TabsContent value="proof" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <InlineTabContent
              activeValue={proofTab}
              tabs={[
                {
                  value: "evals",
                  label: "Evals/QA",
                  content: (
                    <EvalsQaTab
                      project={project}
                      companyModel={companyModel}
                      projectTasks={projectTasks}
                      memoryRows={memoryRows}
                      globalMode={globalMode}
                    />
                  ),
                },
                {
                  value: "guard",
                  label: "Guard",
                  content: (
                    <GuardTab
                      project={project}
                      companyModel={companyModel}
                      projectTasks={projectTasks}
                      memoryRows={memoryRows}
                      globalMode={globalMode}
                    />
                  ),
                },
                {
                  value: "hardcases",
                  label: "Hardcases",
                  content: (
                    <HardcasesTab
                      project={project}
                      companyModel={companyModel}
                      projectTasks={projectTasks}
                      memoryRows={memoryRows}
                      globalMode={globalMode}
                    />
                  ),
                },
              ]}
            />
          </TabsContent>

          <TabsContent value="memory" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <InlineTabContent
              activeValue={memoryTab}
              tabs={[
                {
                  value: "memory",
                  label: "Memory",
                  content: (
                    <TeamMemoryTab
                      projectId={project?.id ?? null}
                      projectPath={
                        typeof project?.trackingContext === "string" &&
                        project.trackingContext.trim()
                          ? project.trackingContext.trim()
                          : null
                      }
                      teamId={teamScopeId}
                      memoryRows={memoryRows}
                      composeState={composeState}
                      onReloadMemory={reloadMemory}
                    />
                  ),
                },
                {
                  value: "docs",
                  label: "Files/Docs",
                  content: (
                    <DocsTab
                      project={project}
                      companyModel={companyModel}
                      projectTasks={projectTasks}
                      memoryRows={memoryRows}
                      globalMode={globalMode}
                    />
                  ),
                },
              ]}
            />
          </TabsContent>

          <TabsContent value="config" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <InlineTabContent
              activeValue={configTab}
              tabs={[
                {
                  value: "manifest",
                  label: "Manifest",
                  content: (
                    <ConfigTab
                      project={project}
                      companyModel={companyModel}
                      projectTasks={projectTasks}
                      memoryRows={memoryRows}
                      globalMode={globalMode}
                      hasBusinessConfig={hasBusinessConfig}
                      teamScopeId={teamScopeId}
                      convexEnabled={convexEnabled}
                      teamUsageError={teamUsageError}
                    />
                  ),
                },
                {
                  value: "skills",
                  label: "Skills",
                  content: (
                    <SkillsReadinessTab
                      project={project}
                      companyModel={companyModel}
                      projectTasks={projectTasks}
                      memoryRows={memoryRows}
                      globalMode={globalMode}
                    />
                  ),
                },
              ]}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function InlineSubTabs({
  activeValue,
  tabs,
  onSelect,
}: {
  activeValue: string;
  tabs: Array<{ value: string; label: string }>;
  onSelect: (value: string) => void;
}): ReactElement {
  return (
    <span className="mx-1 flex h-7 items-center gap-1 border-l border-border pl-2">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onSelect(tab.value)}
          className={`h-7 rounded-sm px-2 text-xs transition ${
            activeValue === tab.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </span>
  );
}

function InlineTabContent({
  activeValue,
  tabs,
}: {
  activeValue: string;
  tabs: Array<{ value: string; label: string; content: ReactElement }>;
}): ReactElement {
  const activeContent = tabs.find((tab) => tab.value === activeValue)?.content ?? tabs[0]?.content;
  return <div className="h-full min-h-0 overflow-hidden">{activeContent}</div>;
}

function ConfigTab({
  project,
  companyModel,
  projectTasks,
  memoryRows,
  globalMode,
  hasBusinessConfig,
  teamScopeId,
  convexEnabled,
  teamUsageError,
}: {
  project: ProjectModel | null;
  companyModel: CompanyModel | null;
  projectTasks: PanelTask[];
  memoryRows: TeamMemoryRow[];
  globalMode: boolean;
  hasBusinessConfig: boolean;
  teamScopeId: string | null;
  convexEnabled: boolean;
  teamUsageError: string | null;
}): ReactElement {
  const setIsSkillsPanelOpen = useAppStore((state) => state.setIsSkillsPanelOpen);
  const setSkillStudioSurface = useAppStore((state) => state.setSkillStudioSurface);
  const setSelectedSkillStudioSkillId = useAppStore((state) => state.setSelectedSkillStudioSkillId);
  const setSkillStudioFocusAgentId = useAppStore((state) => state.setSkillStudioFocusAgentId);
  const setIsTelemetryPanelOpen = useAppStore((state) => state.setIsTelemetryPanelOpen);
  const manifest = findMemoryByName(memoryRows, "manifest.json");
  const automations = findMemoryByName(memoryRows, "automations.md");
  const goals = findMemoryByName(memoryRows, "goals.md");
  const openSkillSurface = (surface: "skill-os" | "evals" | "harness"): void => {
    setSelectedSkillStudioSkillId(null);
    setSkillStudioFocusAgentId(null);
    setSkillStudioSurface(surface);
    setIsSkillsPanelOpen(true);
  };
  const sourceRows = [
    {
      label: "Manifest",
      value: manifest ? "loaded" : "missing",
      detail: manifest?.sourcePath ?? "farplane/manifest.json not loaded for this scope",
    },
    {
      label: "Automations",
      value: automations ? "loaded" : "unavailable",
      detail: automations?.sourcePath ?? "farplane/automations.md not loaded",
    },
    {
      label: "Goals file",
      value: goals ? "loaded" : "project goal",
      detail: goals?.sourcePath ?? project?.goal ?? "no explicit goal source",
    },
    {
      label: "Runtime",
      value: "codex",
      detail: teamUsageError ?? "default office runtime adapter",
    },
  ];

  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ConfigMetric
            label="Project"
            value={project?.name ?? "unmapped"}
            detail={project?.id ?? "no project id"}
          />
          <ConfigMetric
            label="Team scope"
            value={teamScopeId ?? "none"}
            detail={globalMode ? "global mode" : "team mode"}
          />
          <ConfigMetric
            label="Board source"
            value={convexEnabled ? "convex" : "fallback"}
            detail={`${projectTasks.length} scoped task(s)`}
          />
          <ConfigMetric
            label="Business config"
            value={hasBusinessConfig ? "ready" : "missing"}
            detail={`${companyModel?.projects.length ?? 0} project(s) loaded`}
          />
        </div>

        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Manifest / Runtime Sources</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            {sourceRows.map((row) => (
              <div key={row.label} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{row.label}</p>
                  <Badge
                    variant={
                      row.value === "missing" || row.value === "unavailable"
                        ? "destructive"
                        : "outline"
                    }
                  >
                    {row.value}
                  </Badge>
                </div>
                <p className="mt-2 break-all text-xs text-muted-foreground">{row.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Deep Links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => openSkillSurface("skill-os")}>
              Skill OS
            </Button>
            <Button variant="outline" size="sm" onClick={() => openSkillSurface("evals")}>
              Eval OS
            </Button>
            <Button variant="outline" size="sm" onClick={() => openSkillSurface("harness")}>
              Harness OS
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsTelemetryPanelOpen(true)}>
              Telemetry
            </Button>
            <p className="basis-full text-xs text-muted-foreground">
              Primary details stay in their global OS panels; Config keeps scoped wiring and source
              health visible.
            </p>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

function ConfigMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}): JSX.Element {
  return (
    <Card className="gap-3 rounded-md py-4">
      <CardHeader className="px-4 pb-0">
        <CardTitle className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <div className="truncate text-2xl font-semibold tabular-nums">{value}</div>
        <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function findMemoryByName(rows: TeamMemoryRow[], name: string): TeamMemoryRow | null {
  const lowerName = name.toLowerCase();
  return (
    rows.find((row) => row.sourcePath?.toLowerCase().endsWith(lowerName)) ??
    rows.find((row) => row.title?.toLowerCase().includes(lowerName.replace(".md", ""))) ??
    null
  );
}
