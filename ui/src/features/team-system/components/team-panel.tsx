"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessBuilderForm } from "@/components/hud/business-builder-form";
import { computeBusinessReadinessIssues, createBusinessBuilderDraft, projectToBusinessBuilderDraft } from "@/lib/business-builder";
import { useAppStore } from "@/lib/app-store";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";
import { UI_Z } from "@/lib/z-index";
import { isConvexEnabled } from "@/providers/convex-provider";
import { api } from "../../../../../convex/_generated/api";

/**
 * TEAM PANEL
 * ==========
 * Ported team workspace panel for team-cluster interactions.
 *
 * KEY CONCEPTS:
 * - Opens from team-cluster click with selected team context
 * - Uses OpenClaw-backed office context only (no legacy backend dependency)
 * - Preserves parity-oriented tabbed shell for operations
 *
 * USAGE:
 * - Render in Office simulation root
 * - Drive with app-store activeTeamId + isTeamPanelOpen
 *
 * MEMORY REFERENCES:
 * - MEM-0100
 * - MEM-0107
 */

interface TeamPanelProps {
  teamId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: "overview" | "kanban" | "projects" | "communications" | "business";
  focusAgentId?: string | null;
  globalMode?: boolean;
}

type CommunicationsFilter = "all" | "planning" | "executing" | "blocked" | "handoff";

type PanelTask = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "blocked" | "done";
  ownerAgentId?: string;
  priority: string;
  provider: "internal" | "notion" | "vibe" | "linear";
  providerUrl?: string;
  syncState: "healthy" | "pending" | "conflict" | "error";
  syncError?: string;
};

type ActivityRow = {
  _id: string;
  agentId: string;
  activityType: string;
  label: string;
  detail?: string;
  taskId?: string;
  occurredAt: number;
};

function deriveProjectId(teamId: string | null): string | null {
  if (!teamId) return null;
  return teamId.startsWith("team-") ? teamId.replace(/^team-/, "") : null;
}

function statusColumns(tasks: PanelTask[]): Record<"todo" | "in_progress" | "blocked" | "done", PanelTask[]> {
  return {
    todo: tasks.filter((task) => task.status === "todo"),
    in_progress: tasks.filter((task) => task.status === "in_progress"),
    blocked: tasks.filter((task) => task.status === "blocked"),
    done: tasks.filter((task) => task.status === "done"),
  };
}

export function TeamPanel({
  teamId,
  isOpen,
  onOpenChange,
  initialTab = "overview",
  focusAgentId = null,
  globalMode = false,
}: TeamPanelProps) {
  const {
    teams,
    employees,
    companyModel,
    workload,
    refresh,
  } =
    useOfficeDataContext();
  const adapter = useOpenClawAdapter();
  const setHighlightedEmployeeIds = useAppStore((state) => state.setHighlightedEmployeeIds);
  const highlightedEmployeeIds = useAppStore((state) => state.highlightedEmployeeIds);
  const selectedProjectId = useAppStore((state) => state.selectedProjectId);
  const setSelectedProjectId = useAppStore((state) => state.setSelectedProjectId);
  const [activeTab, setActiveTab] = useState<"overview" | "kanban" | "projects" | "communications" | "business">(initialTab);
  const [communicationsFilter, setCommunicationsFilter] = useState<CommunicationsFilter>("all");
  const [boardActionState, setBoardActionState] = useState<{ pending: boolean; error?: string; ok?: string }>({ pending: false });
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high">("medium");
  const [newTaskOwner, setNewTaskOwner] = useState("");
  const [builderDraft, setBuilderDraft] = useState(() => createBusinessBuilderDraft("none"));
  const [builderSaveState, setBuilderSaveState] = useState<{ pending: boolean; error?: string; ok?: string }>({ pending: false });
  const [previewState, setPreviewState] = useState<{
    pending: boolean;
    role?: "biz_pm" | "biz_executor";
    text?: string;
    error?: string;
  }>({ pending: false });

  const team = useMemo(() => {
    if (!teamId || globalMode) return null;
    return teams.find((entry) => String(entry._id) === teamId) ?? null;
  }, [globalMode, teamId, teams]);

  const teamEmployees = useMemo(() => {
    if (!team) return [];
    return employees.filter((employee) => String(employee.teamId) === String(team._id));
  }, [employees, team]);

  const projectId = globalMode ? selectedProjectId : deriveProjectId(teamId);
  const project = useMemo(() => {
    if (!companyModel) return null;
    if (!projectId) return companyModel.projects[0] ?? null;
    return companyModel.projects.find((entry) => entry.id === projectId) ?? companyModel.projects[0] ?? null;
  }, [companyModel, projectId]);

  const convexEnabled = isConvexEnabled();
  const boardCommand = convexEnabled ? useMutation(api.board.boardCommand) : null;
  const convexBoard = convexEnabled
    ? useQuery(api.board.getProjectBoard, project?.id ? { projectId: project.id } : "skip")
    : undefined;
  const convexActivity = convexEnabled
    ? useQuery(api.board.getProjectActivity, project?.id ? { projectId: project.id, limit: 60 } : "skip")
    : undefined;

  const projectTasks = useMemo(() => {
    if (convexEnabled && convexBoard?.tasks) {
      return convexBoard.tasks.map((task) => ({
        id: task.taskId,
        title: task.title,
        status: task.status as PanelTask["status"],
        ownerAgentId: task.ownerAgentId,
        priority: (task.priority as PanelTask["priority"]) ?? "medium",
        provider: (task.provider as PanelTask["provider"]) ?? "internal",
        providerUrl: task.providerUrl,
        syncState: (task.syncState as PanelTask["syncState"]) ?? "healthy",
        syncError: task.syncError,
      }));
    }
    if (!companyModel) return [];
    if (globalMode && !project) return companyModel.tasks;
    if (!project?.id) return [];
    return companyModel.tasks
      .filter((task) => task.projectId === project.id)
      .map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        ownerAgentId: task.ownerAgentId,
        priority: task.priority,
        provider: task.provider,
        providerUrl: task.providerUrl,
        syncState: task.syncState,
        syncError: task.syncError,
      }));
  }, [companyModel, convexBoard?.tasks, convexEnabled, globalMode, project]);

  const activityRows = useMemo(() => {
    if (!Array.isArray(convexActivity)) return [];
    return convexActivity as ActivityRow[];
  }, [convexActivity]);
  const communicationRows = useMemo(() => {
    if (convexEnabled) {
      return activityRows.map((row) => ({
        id: row._id,
        agentId: row.agentId,
        activityType: row.activityType,
        label: row.label,
        detail: row.detail,
        occurredAt: row.occurredAt,
        taskId: row.taskId,
      }));
    }
    return projectTasks.slice(0, 60).map((task) => ({
      id: task.id,
      agentId: task.ownerAgentId ?? "unassigned",
      activityType: task.status === "blocked" ? "blocked" : task.status === "in_progress" ? "executing" : "planning",
      label: task.title,
      detail: `Priority ${task.priority}`,
      occurredAt: Date.now(),
      taskId: task.id,
    }));
  }, [activityRows, convexEnabled, projectTasks]);
  const filteredCommunicationRows = useMemo(() => {
    if (communicationsFilter === "all") return communicationRows;
    return communicationRows.filter((row) => row.activityType === communicationsFilter);
  }, [communicationRows, communicationsFilter]);

  const visibleTasks = useMemo(() => {
    return focusAgentId ? projectTasks.filter((task) => task.ownerAgentId === focusAgentId) : projectTasks;
  }, [focusAgentId, projectTasks]);
  const columns = statusColumns(visibleTasks);
  const summary = workload.find((entry) => entry.projectId === (project?.id ?? projectId ?? ""));
  const panelTitle = globalMode ? "All Teams" : team?.name ?? "Team";
  const projectRevenueCents = (project?.ledger ?? [])
    .filter((entry) => entry.type === "revenue")
    .reduce((total, entry) => total + Math.max(0, Math.round(entry.amount)), 0);
  const projectCostCents = (project?.ledger ?? [])
    .filter((entry) => entry.type === "cost")
    .reduce((total, entry) => total + Math.max(0, Math.round(entry.amount)), 0);
  const projectProfitCents = projectRevenueCents - projectCostCents;
  const hasBusinessConfig = Boolean(project?.businessConfig);
  const resourceRows = (project?.resources ?? []).map((resource) => {
    const softLimit = resource.policy.softLimit;
    const hardLimit = resource.policy.hardLimit;
    const health =
      typeof hardLimit === "number" && resource.remaining <= hardLimit
        ? "depleted"
        : typeof softLimit === "number" && resource.remaining <= softLimit
          ? "warning"
          : "healthy";
    return { ...resource, health };
  });
  const resourceEvents = (project?.resourceEvents ?? []).slice().reverse().slice(0, 12);
  const allProjects = globalMode ? companyModel?.projects ?? [] : project ? [project] : [];
  const projectTaskCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of companyModel?.tasks ?? []) {
      const current = counts.get(task.projectId) ?? 0;
      if (task.status !== "done") counts.set(task.projectId, current + 1);
    }
    if (project?.id) {
      const convexOpen = projectTasks.filter((task) => task.status !== "done").length;
      counts.set(project.id, Math.max(counts.get(project.id) ?? 0, convexOpen));
    }
    return counts;
  }, [companyModel?.tasks, project?.id, projectTasks]);
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
  const ownerLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const employee of globalMode ? employees : teamEmployees) {
      map.set(employee._id, employee.name);
      if (employee._id.startsWith("employee-")) {
        map.set(employee._id.replace(/^employee-/, ""), employee.name);
      }
    }
    return map;
  }, [employees, globalMode, teamEmployees]);
  const normalizedProjectGoal = project?.goal?.trim() ?? "";
  const normalizedTeamDescription = team?.description?.trim() ?? "";
  const cleanedTeamDescription = normalizedTeamDescription.replace(/\s*\|\s*open=\d+\s*closed=\d+\s*$/i, "").trim();
  const teamBusinessDescription =
    cleanedTeamDescription.length > 0 && cleanedTeamDescription !== normalizedProjectGoal
      ? cleanedTeamDescription
      : "";
  const teamGoal = normalizedProjectGoal || "No goal set yet. Use the team CLI to define a clear business target.";
  const teamKpis = project?.kpis ?? [];

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    setBuilderDraft(projectToBusinessBuilderDraft(project));
    setBuilderSaveState({ pending: false });
    setPreviewState({ pending: false });
  }, [project?.id]);

  useEffect(() => {
    if (!isOpen || !globalMode || selectedProjectId || !companyModel?.projects?.length) return;
    setSelectedProjectId(companyModel.projects[0].id);
  }, [companyModel?.projects, globalMode, isOpen, selectedProjectId, setSelectedProjectId]);

  useEffect(() => {
    if (!isOpen) return;
    setCommunicationsFilter("all");
  }, [isOpen, project?.id]);

  if (!globalMode && !team) return null;

  async function handleSaveBusinessBuilder(): Promise<void> {
    if (!project?.id || builderDraft.businessType === "none") return;
    setBuilderSaveState({ pending: true });
    const saved = await adapter.saveBusinessBuilderConfig({
      projectId: project.id,
      businessType: builderDraft.businessType,
      capabilitySkills: builderDraft.capabilitySkills,
      resources: builderDraft.resources,
      source: "ui.team_panel.builder",
    });
    if (!saved.ok) {
      setBuilderSaveState({ pending: false, error: saved.error ?? "business_builder_save_failed" });
      return;
    }
    await refresh();
    setBuilderSaveState({ pending: false, ok: "Saved." });
  }

  async function handleBoardCommand(command: string, payload: Record<string, unknown>, successMessage: string): Promise<void> {
    if (!convexEnabled || !boardCommand || !project?.id) return;
    setBoardActionState({ pending: true });
    try {
      await boardCommand({
        projectId: project.id,
        command,
        actorType: "operator",
        actorAgentId: "operator-ui",
        ...payload,
      });
      setBoardActionState({ pending: false, ok: successMessage });
      if (command === "task_add") {
        setNewTaskTitle("");
        setNewTaskOwner("");
        setNewTaskPriority("medium");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "board_command_failed";
      setBoardActionState({ pending: false, error: message });
    }
  }

  async function handlePreview(role: "biz_pm" | "biz_executor"): Promise<void> {
    if (!project?.id || !teamId) return;
    if (previewState.role === role && previewState.text) {
      setPreviewState({ pending: false });
      return;
    }
    setPreviewState({ pending: true, role });
    const preview = await adapter.renderBusinessHeartbeatPreview({ teamId, role });
    if (!preview.ok) {
      setPreviewState({ pending: false, role, error: preview.error ?? "heartbeat_preview_failed" });
      return;
    }
    setPreviewState({ pending: false, role, text: preview.rendered });
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-[70vw] max-w-none h-[90vh] overflow-hidden p-0 flex flex-col" style={{ zIndex: UI_Z.panelElevated }}>
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <span>{panelTitle}</span>
            {project ? <Badge variant="secondary">{project.status}</Badge> : null}
            {project?.businessConfig ? <Badge variant="outline">{project.businessConfig.type}</Badge> : null}
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(value as "overview" | "kanban" | "projects" | "communications" | "business")
          }
          className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-6"
        >
          <TabsList className="mt-4 w-fit">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="communications">Communications</TabsTrigger>
            <TabsTrigger value="business">Business</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full pr-3">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-sm">Team Charter</CardTitle>
                      <div className="flex items-center gap-2">
                        {hasBusinessConfig ? <Badge variant="outline">Business configured</Badge> : <Badge variant="secondary">Builder mode</Badge>}
                        <Badge variant="secondary">{project?.status ?? "active"}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm md:grid-cols-2">
                    <div className="space-y-1 rounded-md border bg-muted/20 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Team Name</p>
                      <p className="font-medium">{team?.name ?? panelTitle}</p>
                    </div>
                    <div className="space-y-1 rounded-md border bg-muted/20 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Business Description</p>
                      <p className="text-muted-foreground">
                        {teamBusinessDescription || "No business description set yet. Use `team update --description` to define what this team does."}
                      </p>
                    </div>
                    <div className="space-y-1 rounded-md border bg-muted/20 p-3 md:col-span-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Goal</p>
                      <p>{teamGoal}</p>
                    </div>
                    <div className="space-y-2 rounded-md border bg-muted/20 p-3 md:col-span-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">KPIs</p>
                      {teamKpis.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {teamKpis.map((kpi) => (
                            <Badge key={`overview-kpi-${kpi}`} variant="outline">
                              {kpi}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No KPIs set yet. Add KPI targets with `team kpi set` for this team.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {globalMode && companyModel?.projects?.length ? (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Project Scope</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <select
                        className="rounded-md border bg-background px-2 py-1 text-sm"
                        value={project?.id ?? ""}
                        onChange={(event) => setSelectedProjectId(event.target.value || null)}
                      >
                        {companyModel.projects.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                      </select>
                    </CardContent>
                  </Card>
                ) : null}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Members</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">{globalMode ? employees.length : teamEmployees.length}</CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Open Tickets</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">{summary?.openTickets ?? projectTasks.filter((task) => task.status !== "done").length}</CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Queue Pressure</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold capitalize">{summary?.queuePressure ?? "low"}</CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Profit Pulse</CardTitle>
                    </CardHeader>
                    <CardContent className={`text-2xl font-semibold ${projectProfitCents >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {hasBusinessConfig ? currencyFormatter.format(projectProfitCents / 100) : "--"}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm">Team Members</CardTitle>
                      <span className="text-xs text-muted-foreground">Mission crew</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          const ids = globalMode ? employees.map((employee) => employee._id) : teamEmployees.map((employee) => employee._id);
                          setHighlightedEmployeeIds(ids);
                        }}
                      >
                        Locate All
                      </Button>
                      {highlightedEmployeeIds.size > 0 ? (
                        <Button variant="outline" size="sm" onClick={() => setHighlightedEmployeeIds(null)}>
                          Clear Highlight
                        </Button>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {(globalMode ? employees : teamEmployees).map((employee) => (
                        <div key={employee._id} className="rounded-md border bg-muted/20 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">{employee.name}</p>
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {employee.jobTitle ?? "operator"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{employee.jobTitle ?? "Operator"}</p>
                        </div>
                      ))}
                      {(globalMode ? employees.length : teamEmployees.length) === 0 ? (
                        <p className="text-sm text-muted-foreground">No team members assigned.</p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="kanban" className="mt-4 min-h-0 flex-1 overflow-hidden">
            {focusAgentId ? (
              <div className="mb-3 rounded-md border bg-muted/40 p-2 text-xs">
                Showing tasks owned by `{focusAgentId}` in this panel scope.
              </div>
            ) : null}
            <div className="mb-3 rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
              Internal board mode: team execution runs on ShellCorp canonical tasks in this phase.
            </div>
            {convexEnabled ? (
              <div className="mb-3 rounded-md border bg-muted/20 p-2">
                <p className="mb-2 text-xs text-muted-foreground">Operator actions (Convex canonical board)</p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="min-w-52 rounded-md border bg-background px-2 py-1 text-xs"
                    placeholder="New task title"
                    value={newTaskTitle}
                    onChange={(event) => setNewTaskTitle(event.target.value)}
                  />
                  <select
                    className="rounded-md border bg-background px-2 py-1 text-xs"
                    value={newTaskPriority}
                    onChange={(event) => setNewTaskPriority(event.target.value as "low" | "medium" | "high")}
                  >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                  <select
                    className="rounded-md border bg-background px-2 py-1 text-xs"
                    value={newTaskOwner}
                    onChange={(event) => setNewTaskOwner(event.target.value)}
                  >
                    <option value="">unassigned</option>
                    {teamEmployees.map((employee) => (
                      <option key={employee._id} value={employee._id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    disabled={boardActionState.pending || !newTaskTitle.trim()}
                    onClick={() =>
                      void handleBoardCommand(
                        "task_add",
                        {
                          title: newTaskTitle.trim(),
                          priority: newTaskPriority,
                          status: "todo",
                          ownerAgentId: newTaskOwner || undefined,
                        },
                        "Task added.",
                      )
                    }
                  >
                    {boardActionState.pending ? "Saving..." : "Create Task"}
                  </Button>
                </div>
                {boardActionState.error ? <p className="mt-1 text-xs text-destructive">{boardActionState.error}</p> : null}
                {boardActionState.ok ? <p className="mt-1 text-xs text-emerald-500">{boardActionState.ok}</p> : null}
              </div>
            ) : null}
            <ScrollArea className="h-full pr-2">
              <div className="grid grid-cols-1 gap-3 pb-2 md:grid-cols-2 xl:grid-cols-4">
                {(["todo", "in_progress", "blocked", "done"] as const).map((status) => (
                  <Card key={status}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm capitalize">
                        {status.replace("_", " ")} ({columns[status].length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {columns[status].map((task) => (
                        <div key={task.id} className="rounded-md border p-2 text-sm">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="truncate">{task.title}</p>
                            <Badge variant="outline" className="text-[10px] uppercase">
                              internal
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {(task.ownerAgentId ? ownerLabelById.get(task.ownerAgentId) ?? task.ownerAgentId : "unassigned")} · {task.priority}
                          </p>
                          {convexEnabled ? (
                            <div className="mt-2 space-y-1 border-t pt-2">
                              <div className="flex flex-wrap items-center gap-1">
                                <span className="text-[10px] text-muted-foreground">assign</span>
                                <select
                                  className="rounded border bg-background px-1 py-0.5 text-[10px]"
                                  value={task.ownerAgentId ?? ""}
                                  onChange={(event) =>
                                    void handleBoardCommand(
                                      "task_assign",
                                      { taskId: task.id, ownerAgentId: event.target.value || undefined },
                                      "Task assignee updated.",
                                    )
                                  }
                                >
                                  <option value="">unassigned</option>
                                  {teamEmployees.map((employee) => (
                                    <option key={employee._id} value={employee._id}>
                                      {employee.name}
                                    </option>
                                  ))}
                                </select>
                                <span className="text-[10px] text-muted-foreground">priority</span>
                                <select
                                  className="rounded border bg-background px-1 py-0.5 text-[10px]"
                                  value={task.priority}
                                  onChange={(event) =>
                                    void handleBoardCommand(
                                      "task_reprioritize",
                                      { taskId: task.id, priority: event.target.value },
                                      "Task priority updated.",
                                    )
                                  }
                                >
                                  <option value="low">low</option>
                                  <option value="medium">medium</option>
                                  <option value="high">high</option>
                                </select>
                              </div>
                              <div className="flex flex-wrap items-center gap-1">
                                {task.status !== "blocked" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-[10px]"
                                    disabled={boardActionState.pending}
                                    onClick={() => void handleBoardCommand("task_block", { taskId: task.id }, "Task blocked.")}
                                  >
                                    Block
                                  </Button>
                                ) : null}
                                {task.status === "done" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-[10px]"
                                    disabled={boardActionState.pending}
                                    onClick={() => void handleBoardCommand("task_reopen", { taskId: task.id }, "Task reopened.")}
                                  >
                                    Reopen
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-[10px]"
                                    disabled={boardActionState.pending}
                                    onClick={() => void handleBoardCommand("task_done", { taskId: task.id }, "Task marked done.")}
                                  >
                                    Done
                                  </Button>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ))}
                      {columns[status].length === 0 ? <p className="text-xs text-muted-foreground">No tasks.</p> : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="projects" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full pr-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {allProjects.map((entry) => {
                  const isActiveProject = project?.id === entry.id;
                  const openCount = projectTaskCounts.get(entry.id) ?? 0;
                  const entryRevenue = (entry.ledger ?? [])
                    .filter((row) => row.type === "revenue")
                    .reduce((total, row) => total + Math.max(0, Math.round(row.amount)), 0);
                  const entryCost = (entry.ledger ?? [])
                    .filter((row) => row.type === "cost")
                    .reduce((total, row) => total + Math.max(0, Math.round(row.amount)), 0);
                  const entryProfit = entryRevenue - entryCost;
                  return (
                    <Card key={entry.id} className={isActiveProject ? "border-primary/60" : undefined}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-sm">{entry.name}</CardTitle>
                          <Badge variant="secondary">{entry.status}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <p className="line-clamp-2 text-muted-foreground">{entry.goal || "No goal available."}</p>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Open tasks</span>
                          <span className="font-medium">{openCount}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Profit pulse</span>
                          <span className={entryProfit >= 0 ? "font-medium text-emerald-500" : "font-medium text-red-500"}>
                            {currencyFormatter.format(entryProfit / 100)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(entry.kpis ?? []).slice(0, 4).map((kpi) => (
                            <Badge key={`${entry.id}-${kpi}`} variant="outline">
                              {kpi}
                            </Badge>
                          ))}
                          {(entry.kpis ?? []).length === 0 ? <span className="text-xs text-muted-foreground">No KPIs yet.</span> : null}
                        </div>
                        {globalMode ? (
                          <Button
                            size="sm"
                            variant={isActiveProject ? "secondary" : "outline"}
                            onClick={() => setSelectedProjectId(entry.id)}
                          >
                            {isActiveProject ? "Active scope" : "Focus project"}
                          </Button>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
                {allProjects.length === 0 ? (
                  <Card>
                    <CardContent className="pt-4 text-sm text-muted-foreground">No projects available yet.</CardContent>
                  </Card>
                ) : null}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="communications" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <div className="grid h-full grid-cols-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Channels</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  {([
                    { id: "all", label: "all activity" },
                    { id: "planning", label: "planning" },
                    { id: "executing", label: "executing" },
                    { id: "blocked", label: "blocked" },
                    { id: "handoff", label: "handoff" },
                  ] as const).map((item) => (
                    <Button
                      key={item.id}
                      size="sm"
                      variant={communicationsFilter === item.id ? "secondary" : "ghost"}
                      className="w-full justify-start text-xs"
                      onClick={() => setCommunicationsFilter(item.id)}
                    >
                      # {item.label}
                    </Button>
                  ))}
                </CardContent>
              </Card>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm"># team-internal</CardTitle>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {communicationsFilter}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex h-[calc(100%-3rem)] min-h-0 flex-col gap-3 overflow-hidden">
                  <ScrollArea className="min-h-0 flex-1 rounded-md border p-3">
                    <div className="space-y-2">
                      {filteredCommunicationRows.map((row) => (
                        <div key={row.id} className="rounded-md border bg-muted/20 p-2 text-sm">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{row.agentId}</span>
                              <Badge variant="secondary" className="text-[10px] uppercase">
                                {row.activityType}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">{new Date(row.occurredAt).toLocaleTimeString()}</span>
                          </div>
                          <p className="font-medium">{row.label}</p>
                          {row.detail ? <p className="text-xs text-muted-foreground">{row.detail}</p> : null}
                          {row.taskId ? <p className="text-[11px] text-muted-foreground">task: {row.taskId}</p> : null}
                        </div>
                      ))}
                      {filteredCommunicationRows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No activity yet. Agents should log updates with `shellcorp team bot log` during each heartbeat turn.
                        </p>
                      ) : null}
                    </div>
                  </ScrollArea>
                  <div className="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
                    Internal ops feed. Use `shellcorp team bot log` for structured updates and timeline replay.
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="business" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full pr-2">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm">Business Command Deck</CardTitle>
                      <Badge variant="outline">{builderDraft.businessType}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <BusinessBuilderForm value={builderDraft} onChange={setBuilderDraft} disabled={builderSaveState.pending} />
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => void handleSaveBusinessBuilder()} disabled={builderSaveState.pending || builderDraft.businessType === "none"}>
                        {builderSaveState.pending ? "Saving..." : "Save Business Config"}
                      </Button>
                      <Button variant="outline" onClick={() => void handlePreview("biz_pm")} disabled={previewState.pending || builderDraft.businessType === "none"}>
                        Preview PM Heartbeat
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => void handlePreview("biz_executor")}
                        disabled={previewState.pending || builderDraft.businessType === "none"}
                      >
                        Preview Executor Heartbeat
                      </Button>
                      {previewState.text ? (
                        <Button variant="ghost" onClick={() => setPreviewState({ pending: false })} disabled={previewState.pending}>
                          Close Preview
                        </Button>
                      ) : null}
                    </div>
                    {builderSaveState.error ? <p className="text-sm text-destructive">{builderSaveState.error}</p> : null}
                    {builderSaveState.ok ? <p className="text-sm text-emerald-500">{builderSaveState.ok}</p> : null}
                    {previewState.error ? <p className="text-sm text-destructive">{previewState.error}</p> : null}
                    {previewState.text ? (
                      <ScrollArea className="max-h-44 rounded-md border p-2">
                        <pre className="text-xs whitespace-pre-wrap">{previewState.text}</pre>
                      </ScrollArea>
                    ) : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Readiness Checklist</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {(team?.businessReadiness?.issues && team.businessReadiness.issues.length > 0
                      ? team.businessReadiness.issues.map((issue) => ({ message: issue }))
                      : computeBusinessReadinessIssues(builderDraft)
                    ).map((issue, index) => (
                      <p key={`${issue.message}-${index}`} className="text-amber-500">
                        - {issue.message}
                      </p>
                    ))}
                    {(team?.businessReadiness?.ready ?? computeBusinessReadinessIssues(builderDraft).length === 0) ? (
                      <p className="text-emerald-500">Ready to run.</p>
                    ) : null}
                  </CardContent>
                </Card>
                {hasBusinessConfig ? (
                  <div className="space-y-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Financial + Capability + Telemetry</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Revenue</CardTitle>
                      </CardHeader>
                      <CardContent className="text-2xl font-semibold text-emerald-500">
                        {currencyFormatter.format(projectRevenueCents / 100)}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Costs</CardTitle>
                      </CardHeader>
                      <CardContent className="text-2xl font-semibold text-amber-500">
                        {currencyFormatter.format(projectCostCents / 100)}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Profit</CardTitle>
                      </CardHeader>
                      <CardContent className={`text-2xl font-semibold ${projectProfitCents >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {currencyFormatter.format(projectProfitCents / 100)}
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Capability Slots</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-3 text-sm">
                      <div className="rounded-md border p-2">
                        <p className="font-medium">Measure</p>
                        <p className="text-muted-foreground">{project?.businessConfig?.slots.measure.skillId ?? "not-set"}</p>
                      </div>
                      <div className="rounded-md border p-2">
                        <p className="font-medium">Execute</p>
                        <p className="text-muted-foreground">{project?.businessConfig?.slots.execute.skillId ?? "not-set"}</p>
                      </div>
                      <div className="rounded-md border p-2">
                        <p className="font-medium">Distribute</p>
                        <p className="text-muted-foreground">{project?.businessConfig?.slots.distribute.skillId ?? "not-set"}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Resources</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {resourceRows.map((resource) => (
                        <div key={resource.id} className="rounded-md border p-2 text-sm">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="font-medium">{resource.name}</p>
                            <Badge
                              variant={
                                resource.health === "healthy" ? "secondary" : resource.health === "warning" ? "outline" : "destructive"
                              }
                            >
                              {resource.health}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {resource.remaining} / {resource.limit} {resource.unit}
                            {typeof resource.reserved === "number" ? ` (reserved ${resource.reserved})` : ""}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            tracker: {resource.trackerSkillId} | low-policy: {resource.policy.whenLow}
                          </p>
                        </div>
                      ))}
                      {resourceRows.length === 0 ? <p className="text-xs text-muted-foreground">No resources configured yet.</p> : null}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Experiments</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {(project?.experiments ?? []).slice().reverse().slice(0, 8).map((experiment) => (
                        <div key={experiment.id} className="rounded-md border p-2 text-sm">
                          <div className="mb-1 flex items-center justify-between">
                            <p className="font-medium">{experiment.hypothesis}</p>
                            <Badge variant="outline">{experiment.status}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            started {new Date(experiment.startedAt).toLocaleString()}
                            {experiment.endedAt ? ` -> ended ${new Date(experiment.endedAt).toLocaleString()}` : ""}
                          </p>
                          {experiment.results ? <p className="mt-1 text-xs">{experiment.results}</p> : null}
                        </div>
                      ))}
                      {(project?.experiments ?? []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">No experiments logged yet.</p>
                      ) : null}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Recent Metrics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {(project?.metricEvents ?? []).slice().reverse().slice(0, 10).map((event) => (
                        <div key={event.id} className="rounded-md border p-2 text-xs">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="font-medium">{event.source}</span>
                            <span className="text-muted-foreground">{new Date(event.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="text-muted-foreground break-all">{JSON.stringify(event.metrics)}</p>
                        </div>
                      ))}
                      {(project?.metricEvents ?? []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">No metric events recorded yet.</p>
                      ) : null}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Resource Events</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {resourceEvents.map((event) => (
                        <div key={event.id} className="rounded-md border p-2 text-xs">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="font-medium">{event.kind}</span>
                            <span className="text-muted-foreground">{new Date(event.ts).toLocaleString()}</span>
                          </div>
                          <p className="text-muted-foreground">
                            {event.resourceId} | delta {event.delta} | remaining {event.remainingAfter}
                          </p>
                          <p className="text-muted-foreground">{event.source}</p>
                          {event.note ? <p className="text-muted-foreground">{event.note}</p> : null}
                        </div>
                      ))}
                      {resourceEvents.length === 0 ? <p className="text-xs text-muted-foreground">No resource events yet.</p> : null}
                    </CardContent>
                  </Card>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="pt-4 text-sm text-muted-foreground">
                      Configure business type, capability skills, and resources above, then save to initialize Business telemetry.
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

