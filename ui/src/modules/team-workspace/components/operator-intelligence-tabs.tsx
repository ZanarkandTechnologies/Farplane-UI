"use client";

/**
 * OPERATOR INTELLIGENCE TABS
 * ==========================
 * Ownership: Team Workspace module.
 * Inputs: current project, company tasks, project memory Markdown, and Team Panel scope.
 * Outputs: quick-pass Team Panel views for goals, docs, skills, evals, automations, guard, and hardcases.
 * Side effects: none. These shells intentionally reuse current local data instead of adding backend state.
 */

import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  FileText,
  Flag,
  Goal,
  ListChecks,
  Lock,
  Map,
  ShieldCheck,
  Sparkles,
  Trophy,
  Workflow,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Response } from "@/components/ai-elements/response";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CompanyModel, ProjectModel } from "@/modules/runtime";
import { useAppStore } from "@/store";
import { STATUS_LABELS, type PanelTask, type TeamMemoryRow } from "./team-panel-types";

type IntelligenceTabProps = {
  project: ProjectModel | null;
  companyModel: CompanyModel | null;
  projectTasks: PanelTask[];
  memoryRows: TeamMemoryRow[];
  globalMode: boolean;
};

type MetricCard = {
  label: string;
  value: string;
  detail: string;
};

type SkillCatalogRow = {
  skillId: string;
  displayName?: string;
  description?: string;
  category?: string;
  sourcePath?: string;
  hasManifest?: boolean;
  hasTests?: boolean;
  hasDiagram?: boolean;
  hasSkillMemory?: boolean;
};

function getSkillSourceKind(sourcePath: string | undefined): "local" | "repo" | "global" {
  const normalized = sourcePath ?? "";
  if (normalized.includes(".codex/skills")) return "local";
  if (normalized.startsWith("skills/")) return "repo";
  return "global";
}

function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const keep = Math.max(4, Math.floor((maxLength - 1) / 2));
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}

function taskStatusCount(tasks: PanelTask[], status: PanelTask["status"]): number {
  return tasks.filter((task) => task.status === status).length;
}

function findMemoryByName(rows: TeamMemoryRow[], name: string): TeamMemoryRow | null {
  const lowerName = name.toLowerCase();
  return (
    rows.find((row) => row.sourcePath?.toLowerCase().endsWith(lowerName)) ??
    rows.find((row) => row.title?.toLowerCase().includes(lowerName.replace(".md", ""))) ??
    null
  );
}

function metricCards(cards: MetricCard[]): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="gap-3 rounded-md py-4">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
              {card.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <div className="text-2xl font-semibold tabular-nums">{card.value}</div>
            <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactElement;
  children: ReactElement;
}): ReactElement {
  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

type QuestNodeState = "complete" | "active" | "blocked" | "locked";

type QuestNodeModel = {
  label: string;
  detail: string;
  state: QuestNodeState;
  icon: ReactElement;
};

function questNodeClasses(state: QuestNodeState): string {
  if (state === "complete") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700";
  if (state === "active") return "border-primary/45 bg-primary/10 text-primary";
  if (state === "blocked") return "border-destructive/45 bg-destructive/10 text-destructive";
  return "border-border bg-muted/30 text-muted-foreground";
}

function questNodeIcon(state: QuestNodeState): ReactElement {
  if (state === "complete") return <CheckCircle2 className="h-4 w-4" />;
  if (state === "blocked") return <ShieldCheck className="h-4 w-4" />;
  if (state === "locked") return <Lock className="h-4 w-4" />;
  return <CircleDot className="h-4 w-4" />;
}

function QuestNode({ node }: { node: QuestNodeModel }): ReactElement {
  return (
    <div className={`min-h-[104px] rounded-md border p-3 ${questNodeClasses(node.state)}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md border bg-background/70">
          {node.icon}
        </span>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-background/70">
          {questNodeIcon(node.state)}
        </span>
      </div>
      <p className="mt-3 text-sm font-medium">{node.label}</p>
      <p className="mt-1 line-clamp-2 text-xs opacity-80">{node.detail}</p>
    </div>
  );
}

function CampaignMapGrid({ nodes }: { nodes: QuestNodeModel[] }): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
      {nodes.map((node, index) => (
        <div key={node.label} className="relative min-w-0">
          <QuestNode node={node} />
          {index < nodes.length - 1 ? (
            <span className="absolute -right-2 top-1/2 hidden h-px w-4 bg-border xl:block" />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ProgressMeter({
  value,
  label,
  detail,
}: {
  value: number;
  label: string;
  detail: string;
}): ReactElement {
  const boundedValue = Math.min(100, Math.max(0, value));
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{boundedValue}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${boundedValue}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function SourceBadge({
  label,
  state,
}: {
  label: string;
  state: "ready" | "partial" | "missing";
}): ReactElement {
  const variant =
    state === "missing" ? "destructive" : state === "partial" ? "secondary" : "outline";
  return (
    <Badge variant={variant} className="rounded-md">
      {label}
    </Badge>
  );
}

export function GoalsTab({
  project,
  companyModel,
  projectTasks,
  globalMode,
}: IntelligenceTabProps): ReactElement {
  const activeProjects = companyModel?.projects.filter((entry) => entry.status === "active") ?? [];
  const kpis = project?.kpis ?? [];
  const blockedTasks = taskStatusCount(projectTasks, "blocked");
  const reviewTasks = taskStatusCount(projectTasks, "review");
  const doneTasks = projectTasks.filter((task) => task.status === "done");
  const openTasks = projectTasks.filter((task) => task.status !== "done");
  const activeTasks = projectTasks.filter(
    (task) =>
      task.status === "in_progress" || task.status === "review" || task.status === "blocked",
  );
  const totalTasks = projectTasks.length;
  const taskProgress = totalTasks > 0 ? Math.round((doneTasks.length / totalTasks) * 100) : 0;
  const goalText =
    project?.goal?.trim() ||
    openTasks[0]?.title ||
    "Define the first campaign objective for this team.";
  const sourceGoalState = project?.goal?.trim()
    ? "ready"
    : openTasks.length > 0
      ? "partial"
      : "missing";
  const sourceTaskState = projectTasks.length > 0 ? "ready" : "missing";
  const sourceKpiState = kpis.length > 0 ? "ready" : "missing";
  const trophyTasks = doneTasks.slice(0, 5);
  const questNodes: QuestNodeModel[] = [
    {
      label: "North Star",
      detail: project?.name ?? (globalMode ? "Company rollup" : "Project mapping missing"),
      state: project?.goal?.trim() ? "complete" : "active",
      icon: <Flag className="h-4 w-4" />,
    },
    {
      label: "Active Quest",
      detail: truncateMiddle(goalText, 70),
      state: blockedTasks > 0 ? "blocked" : "active",
      icon: <Goal className="h-4 w-4" />,
    },
    {
      label: "Proof Gate",
      detail:
        reviewTasks > 0
          ? `${reviewTasks} review task${reviewTasks === 1 ? "" : "s"} waiting`
          : doneTasks.length > 0
            ? `${doneTasks.length} completed task${doneTasks.length === 1 ? "" : "s"}`
            : "No proof task yet",
      state: reviewTasks > 0 ? "active" : doneTasks.length > 0 ? "complete" : "locked",
      icon: <ShieldCheck className="h-4 w-4" />,
    },
    {
      label: "Next Unlock",
      detail: kpis[0] ?? "Waiting for KPI or next-phase config",
      state: kpis.length > 0 ? "active" : "locked",
      icon: <Sparkles className="h-4 w-4" />,
    },
    {
      label: "Trophy Shelf",
      detail:
        trophyTasks.length > 0
          ? `${trophyTasks.length} task-backed troph${trophyTasks.length === 1 ? "y" : "ies"} visible`
          : "Completed goals stay here once stored",
      state: trophyTasks.length > 0 ? "complete" : "locked",
      icon: <Trophy className="h-4 w-4" />,
    },
  ];
  const sideObjectives = activeTasks.length > 0 ? activeTasks : openTasks.slice(0, 5);

  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        {metricCards([
          {
            label: "Campaigns",
            value: String(globalMode ? activeProjects.length : project ? 1 : 0),
            detail: globalMode ? "company rollup" : (project?.name ?? "no selected project"),
          },
          {
            label: "Quest progress",
            value: `${taskProgress}%`,
            detail:
              totalTasks > 0
                ? `${doneTasks.length}/${totalTasks} task-backed steps done`
                : "task source missing",
          },
          {
            label: "Blocker gates",
            value: String(blockedTasks),
            detail: blockedTasks > 0 ? "needs operator attention" : "no blocked tasks",
          },
          {
            label: "Trophies",
            value: String(trophyTasks.length),
            detail: "completed task evidence visible",
          },
        ])}

        <SectionCard title="Campaign Map" icon={<Map className="h-4 w-4 text-primary" />}>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <SourceBadge label={`goal: ${sourceGoalState}`} state={sourceGoalState} />
              <SourceBadge label={`tasks: ${sourceTaskState}`} state={sourceTaskState} />
              <SourceBadge label={`kpis: ${sourceKpiState}`} state={sourceKpiState} />
            </div>
            <CampaignMapGrid nodes={questNodes} />
          </div>
        </SectionCard>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <SectionCard title="Active Quest" icon={<Goal className="h-4 w-4 text-primary" />}>
            <div className="space-y-3 text-sm">
              <div className="rounded-md border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={blockedTasks > 0 ? "destructive" : "secondary"}
                    className="rounded-md"
                  >
                    {blockedTasks > 0 ? "attention" : (project?.status ?? "active")}
                  </Badge>
                  <Badge variant="outline" className="rounded-md">
                    {globalMode ? "all teams" : (project?.name ?? "unmapped team")}
                  </Badge>
                </div>
                <p className="mt-3 text-base font-medium leading-relaxed">{goalText}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  This is the earliest playable chunk. Later campaign nodes stay locked until there
                  is a stored goal packet or explicit project config.
                </p>
              </div>
              <ProgressMeter
                value={taskProgress}
                label="Task-backed progress"
                detail={
                  totalTasks > 0
                    ? `${doneTasks.length} done, ${openTasks.length} open, ${blockedTasks} blocked`
                    : "No scoped tasks loaded for this project."
                }
              />
              <div className="grid gap-2 md:grid-cols-3">
                <div className="rounded-md border p-3">
                  <p className="text-[11px] uppercase text-muted-foreground">Now</p>
                  <p className="mt-1 line-clamp-2 text-sm">
                    {openTasks[0]?.title || "Define active project target"}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-[11px] uppercase text-muted-foreground">Next unlock</p>
                  <p className="mt-1 line-clamp-2 text-sm">
                    {kpis[0] ?? "Add KPI or next-phase marker"}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-[11px] uppercase text-muted-foreground">Archive rule</p>
                  <p className="mt-1 line-clamp-2 text-sm">
                    Completed goals remain visible once goal records exist.
                  </p>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Side Objectives"
            icon={<ListChecks className="h-4 w-4 text-primary" />}
          >
            <div className="space-y-2">
              {sideObjectives.slice(0, 6).map((task) => (
                <div key={task.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate font-medium">{task.title}</p>
                    <Badge variant={task.status === "blocked" ? "destructive" : "secondary"}>
                      {STATUS_LABELS[task.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {task.ownerAgentId ? `owner ${task.ownerAgentId}` : "unassigned"} -{" "}
                    {task.priority} priority
                  </p>
                </div>
              ))}
              {sideObjectives.length === 0 ? (
                <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                  No task-backed side objectives loaded yet. Add scoped project tasks or a Goal
                  Packet to populate this lane.
                </p>
              ) : null}
              {kpis.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {kpis.slice(0, 6).map((kpi) => (
                    <Badge key={kpi} variant="outline" className="rounded-md">
                      {kpi}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Trophy Shelf" icon={<Trophy className="h-4 w-4 text-primary" />}>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {trophyTasks.map((task) => (
              <div key={task.id} className="rounded-md border bg-emerald-500/5 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-emerald-600" />
                  <p className="min-w-0 truncate font-medium">{task.title}</p>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Task-backed trophy -{" "}
                  {task.artefactPath ? truncateMiddle(task.artefactPath, 48) : "no proof path"}
                </p>
              </div>
            ))}
            {trophyTasks.length === 0 ? (
              <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
                No completed work trophies in this scope yet. When the completed-goal model lands,
                this shelf should keep done goals visible instead of disappearing them from the run.
              </p>
            ) : null}
          </div>
        </SectionCard>
      </div>
    </ScrollArea>
  );
}

export function DocsTab({ project, memoryRows }: IntelligenceTabProps): ReactElement {
  const docs = memoryRows.length > 0 ? memoryRows : [];
  const activeDoc = docs[0] ?? null;

  return (
    <div className="grid h-full grid-cols-1 gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="h-full rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BookOpen className="h-4 w-4 text-primary" />
            Files / Docs
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-[calc(100%-3rem)] min-h-0 flex-col gap-3">
          <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
            <p>Project: {project?.name ?? "none"}</p>
            <p className="break-all">Path: {project?.trackingContext ?? "not set"}</p>
          </div>
          <ScrollArea className="min-h-0 flex-1 pr-3">
            <div className="space-y-2">
              {docs.map((doc) => (
                <div key={doc.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{doc.title ?? doc.sourcePath ?? doc.id}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {doc.sourcePath ?? "memory source"}
                  </p>
                </div>
              ))}
              {docs.length === 0 ? (
                <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                  No docs loaded yet. Generated files will appear here when project memory indexes
                  them.
                </p>
              ) : null}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="h-full rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{activeDoc?.title ?? "Project Docs Preview"}</CardTitle>
        </CardHeader>
        <CardContent className="h-[calc(100%-3rem)] min-h-0">
          <ScrollArea className="h-full rounded-md border p-4">
            {activeDoc ? (
              <Response className="prose prose-sm max-w-none dark:prose-invert">
                {activeDoc.body}
              </Response>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a project memory/doc source after files load.
              </p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

export function SkillsReadinessTab({ project, projectTasks }: IntelligenceTabProps): ReactElement {
  const setIsSkillsPanelOpen = useAppStore((state) => state.setIsSkillsPanelOpen);
  const setSelectedSkillStudioSkillId = useAppStore((state) => state.setSelectedSkillStudioSkillId);
  const setSkillStudioFocusAgentId = useAppStore((state) => state.setSkillStudioFocusAgentId);
  const [catalog, setCatalog] = useState<SkillCatalogRow[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const proofTasks = projectTasks.filter((task) =>
    `${task.title} ${task.notes ?? ""}`.toLowerCase().includes("skill"),
  );
  const openGlobalSkills = (skillId?: string): void => {
    setSelectedSkillStudioSkillId(skillId ?? null);
    setSkillStudioFocusAgentId(null);
    setIsSkillsPanelOpen(true);
  };
  useEffect(() => {
    let cancelled = false;
    async function loadCatalog(): Promise<void> {
      setLoadState("loading");
      try {
        const response = await fetch("/openclaw/skills/catalog");
        if (!response.ok) throw new Error(`skills_catalog_${response.status}`);
        const payload = (await response.json()) as { skills?: SkillCatalogRow[] };
        if (cancelled) return;
        const nextCatalog = (payload.skills ?? []).sort((a, b) =>
          a.skillId.localeCompare(b.skillId),
        );
        setCatalog(nextCatalog);
        setSelectedSkillId((current) => current ?? nextCatalog[0]?.skillId ?? null);
        setLoadState("ready");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    }
    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);
  const filteredCatalog = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return catalog;
    return catalog.filter((row) =>
      `${row.skillId} ${row.displayName ?? ""} ${row.description ?? ""} ${row.category ?? ""} ${row.sourcePath ?? ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [catalog, search]);
  const selectedSkill =
    catalog.find((row) => row.skillId === selectedSkillId) ?? filteredCatalog[0] ?? null;
  const localCount = catalog.filter((row) => getSkillSourceKind(row.sourcePath) === "local").length;
  const repoCount = catalog.filter((row) => getSkillSourceKind(row.sourcePath) === "repo").length;

  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        {metricCards([
          { label: "Catalog skills", value: String(catalog.length), detail: loadState },
          {
            label: "Local / repo",
            value: `${localCount}/${repoCount}`,
            detail: "override and project packages",
          },
          { label: "Skill tasks", value: String(proofTasks.length), detail: "local work evidence" },
          {
            label: "Project",
            value: truncateMiddle(project?.name ?? "global", 18),
            detail: "team entrypoint scope",
          },
        ])}
        <SectionCard title="Skill Graph" icon={<Workflow className="h-4 w-4 text-primary" />}>
          <div className="grid min-h-[44rem] gap-3 text-sm xl:grid-cols-[280px_minmax(0,1fr)_340px]">
            <div className="flex min-h-0 flex-col rounded-md border">
              <div className="border-b p-3">
                <input
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search skills"
                />
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-1 p-2">
                  {filteredCatalog.map((row) => (
                    <button
                      key={row.skillId}
                      type="button"
                      onClick={() => setSelectedSkillId(row.skillId)}
                      className={`block w-full rounded-md border px-3 py-2 text-left transition ${
                        selectedSkill?.skillId === row.skillId
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-medium">
                          {row.displayName ?? row.skillId}
                        </span>
                        <Badge variant="outline">{getSkillSourceKind(row.sourcePath)}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {row.description || row.sourcePath || row.skillId}
                      </p>
                    </button>
                  ))}
                  {filteredCatalog.length === 0 ? (
                    <p className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                      No skills match this search.
                    </p>
                  ) : null}
                </div>
              </ScrollArea>
            </div>

            <div className="min-h-[44rem] overflow-hidden rounded-md border bg-background">
              <iframe
                title="Skill maintenance graph"
                src="/codex/skill-maintenance-graph/index.html"
                className="h-[44rem] w-full border-0"
              />
            </div>

            <div className="rounded-md border p-4">
              {selectedSkill ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="min-w-0 text-lg font-semibold">
                        {selectedSkill.displayName ?? selectedSkill.skillId}
                      </h3>
                      <Badge>{getSkillSourceKind(selectedSkill.sourcePath)}</Badge>
                      {selectedSkill.hasTests ? <Badge variant="outline">tests</Badge> : null}
                      {selectedSkill.hasDiagram ? <Badge variant="outline">diagram</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {selectedSkill.description || "No description provided."}
                    </p>
                    <p className="mt-3 break-all rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
                      {selectedSkill.sourcePath || "source path unavailable"}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md border p-3">
                      <p className="text-[11px] uppercase text-muted-foreground">Category</p>
                      <p className="mt-1 truncate">{selectedSkill.category ?? "workflow"}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-[11px] uppercase text-muted-foreground">Memory</p>
                      <p className="mt-1">{selectedSkill.hasSkillMemory ? "yes" : "no"}</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => openGlobalSkills(selectedSkill.skillId)}>
                    Open Full Skill
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {loadState === "error"
                    ? "Skill catalog failed to load from the local bridge."
                    : "Loading skill catalog..."}
                </p>
              )}
            </div>
          </div>
        </SectionCard>
      </div>
    </ScrollArea>
  );
}

export {
  AutomationsTab,
  EvalsQaTab,
  GuardTab,
  HardcasesTab,
} from "./operator-intelligence-secondary-tabs";
