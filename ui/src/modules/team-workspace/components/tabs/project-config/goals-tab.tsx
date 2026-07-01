import { Target, Trophy } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type PanelTask, STATUS_LABELS } from "../../team-panel-types";
import { GoalKpiCockpit } from "../overview/goal-kpi-cockpit";
import {
  buildGoalAxisViews,
  findMetricsSnapshot,
  parseGoalAxesFromFile,
} from "../overview/goal-kpi-model";
import { findConfigFile, getConfigSection } from "./config-parsing";
import type { FarplaneProjectConfig, ProjectConfigLoadState } from "./config-types";
import { ConfigLoadingState, MetricTile, shortText, statusBadge } from "./shared";

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
  const axes = parseGoalAxesFromFile(goals);
  const snapshot = findMetricsSnapshot(config);
  const goalAxisViews = buildGoalAxisViews(axes, snapshot);
  const availableMetricCount =
    snapshot?.metrics.filter((metric) => metric.status === "available").length ?? 0;
  const sourceGapCount =
    snapshot?.sourceGaps.length ??
    snapshot?.metrics.filter((metric) => metric.status === "source_gap").length ??
    0;
  const snapshotLabel = snapshot
    ? `${snapshot.snapshotDate || "latest"} · ${availableMetricCount} live · ${sourceGapCount} gap`
    : "metrics snapshot missing";
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <MetricTile
            label="KPI Axes"
            value={String(axes.length)}
            detail="goal axes from goals.md"
          />
          <MetricTile
            label="Live Metrics"
            value={snapshot ? String(availableMetricCount) : "missing"}
            detail=".farplane/metrics/ui/latest.json"
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
        <GoalKpiCockpit axes={goalAxisViews} snapshotLabel={snapshotLabel} />
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
