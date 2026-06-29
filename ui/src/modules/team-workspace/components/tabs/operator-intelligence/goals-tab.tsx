import {
  Flag,
  Goal,
  ListChecks,
  Map as MapIcon,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { STATUS_LABELS } from "../../team-panel-types";
import { CampaignMapGrid, ProgressMeter, type QuestNodeModel } from "./quest-map";
import { metricCards, SectionCard, taskStatusCount, truncateMiddle } from "./shared";
import { SourceBadge } from "./source-badge";
import type { IntelligenceTabProps } from "./types";

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

        <SectionCard title="Campaign Map" icon={<MapIcon className="h-4 w-4 text-primary" />}>
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
