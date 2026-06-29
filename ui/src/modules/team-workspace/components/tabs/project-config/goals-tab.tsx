import { Gauge, Target, Trophy } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type PanelTask, STATUS_LABELS } from "../../team-panel-types";
import { findConfigFile, getConfigSection, parseMarkdownTable } from "./config-parsing";
import type { FarplaneProjectConfig, ProjectConfigLoadState } from "./config-types";
import { ConfigLoadingState, MetricTile, SparkBars, shortText, statusBadge } from "./shared";

type GoalKpiAxis = {
  axis: string;
  weight: string;
  currentBet: string;
  target: string;
  provider: string;
  evidence: string;
  antiMetric: string;
  heartbeat: string;
  updateRule: string;
};

function isWeightCell(value: string | undefined): boolean {
  return /^\d+(?:\.\d+)?%?$/.test(value?.trim() ?? "");
}

function goalKpiFromRow(row: string[]): GoalKpiAxis {
  const hasWeight = isWeightCell(row[1]);
  return {
    axis: row[0] ?? "KPI",
    weight: hasWeight ? (row[1] ?? "?") : "goal",
    currentBet: hasWeight ? (row[2] ?? "Goal link pending") : (row[1] ?? "Goal link pending"),
    target: hasWeight ? (row[3] ?? "Metric pending") : (row[1] ?? "Metric pending"),
    provider: hasWeight ? (row[4] ?? "provider_missing") : (row[3] ?? "provider_missing"),
    evidence: hasWeight ? (row[5] ?? "evidence missing") : (row[2] ?? "evidence missing"),
    antiMetric: hasWeight ? (row[6] ?? "anti-metric missing") : (row[4] ?? "anti-metric missing"),
    heartbeat: hasWeight ? (row[7] ?? "cadence missing") : (row[5] ?? "cadence missing"),
    updateRule: hasWeight ? (row[8] ?? "update rule missing") : (row[6] ?? "update rule missing"),
  };
}

export function ProjectGoalsTab({
  config,
  state,
  error,
  projectTasks,
}: {
  config: FarplaneProjectConfig | null;
  state: ProjectConfigLoadState;
  error: string | null;
  projectTasks: PanelTask[];
}): ReactElement {
  const goals = findConfigFile(config, "goals");
  const northStar = getConfigSection(goals, "North Star");
  const currentBet = getConfigSection(goals, "Current Bet");
  const kpiRows = parseMarkdownTable(getConfigSection(goals, "KPI Axes"));
  const kpis = kpiRows.slice(1).map(goalKpiFromRow);
  const doneTasks = projectTasks.filter((task) => task.status === "done").slice(0, 4);
  const openTasks = projectTasks.filter((task) => task.status !== "done");

  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Goal Board</h3>
            <p className="text-xs text-muted-foreground">
              North star, KPI axes, and active quest state.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {statusBadge(goals)}
            <ConfigLoadingState state={state} error={error} />
          </div>
        </div>
        <Card className="min-w-0 rounded-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4" />
              North Star
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="break-words text-sm leading-6 [overflow-wrap:anywhere]">
              {shortText(northStar, "farplane/goals.md has no North Star section yet.")}
            </p>
            <div className="rounded-md border bg-muted/20 p-3">
              <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                Current Bet
              </p>
              <p className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                {shortText(currentBet, "Current bet not configured.")}
              </p>
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <MetricTile
            label="KPI Axes"
            value={String(kpis.length)}
            detail="weighted goal gauges from goals.md"
          />
          <MetricTile
            label="Active Tickets"
            value={String(openTasks.length)}
            detail="current board pressure"
          />
          <MetricTile
            label="Completed Trophies"
            value={String(doneTasks.length)}
            detail="recent done tickets shown as proof trophies"
          />
        </div>
        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Gauge className="h-4 w-4" />
              KPI Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {kpis.length > 0 ? (
              kpis.map((kpi) => (
                <div
                  key={`${kpi.axis}-${kpi.weight}`}
                  className="grid min-w-0 grid-cols-1 gap-3 rounded-md border bg-muted/20 p-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)_9rem]"
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Badge variant="outline" className="shrink-0">
                        {kpi.weight}
                      </Badge>
                      <p className="min-w-0 break-words text-sm font-semibold [overflow-wrap:anywhere]">
                        {kpi.axis}
                      </p>
                    </div>
                    <p className="break-words text-sm leading-6 [overflow-wrap:anywhere]">
                      {kpi.target}
                    </p>
                    <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                      Linked bet: {kpi.currentBet}
                    </p>
                  </div>
                  <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-md border bg-background/40 p-2">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        Provider
                      </p>
                      <Badge
                        variant={kpi.provider === "provider_missing" ? "secondary" : "outline"}
                        className="mt-2 max-w-full whitespace-normal break-words text-left [overflow-wrap:anywhere]"
                      >
                        {kpi.provider}
                      </Badge>
                    </div>
                    <div className="rounded-md border bg-background/40 p-2">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        Evidence / Cadence
                      </p>
                      <p className="mt-1 break-words text-xs [overflow-wrap:anywhere]">
                        {kpi.evidence}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{kpi.heartbeat}</p>
                    </div>
                  </div>
                  <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border bg-background/40 p-3 xl:flex-col xl:items-start">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        Trend
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {kpi.provider === "provider_missing" ? "not bound" : "provider-ready"}
                      </p>
                    </div>
                    <SparkBars
                      seed={`${kpi.axis}:${kpi.provider}`}
                      active={kpi.provider !== "provider_missing"}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No KPI Axes table found in farplane/goals.md.
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Trophy className="h-4 w-4" />
              Completed Goal Shelf
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {doneTasks.length > 0 ? (
              doneTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 p-3"
                >
                  <span className="min-w-0 break-words text-sm [overflow-wrap:anywhere]">
                    {task.title}
                  </span>
                  <Badge variant="outline" className="shrink-0">
                    {STATUS_LABELS[task.status]}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No completed goals are available from the current board scope yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
