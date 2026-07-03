import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GoalKpiCockpit } from "@/modules/team-workspace/components/dashboard-projections/goal-kpi-cockpit";
import {
  buildGoalAxisViewsFromProjectUi,
  buildGoalAxisViews,
  findMetricsSnapshot,
  parseGoalAxesFromFile,
} from "@/modules/team-workspace/lib/dashboard-projections/goal-kpi-model";
import { findProjectUiSnapshot } from "@/modules/team-workspace/lib/dashboard-projections/project-ui-snapshot";
import { findConfigFile, getConfigSection } from "./config-parsing";
import type { FarplaneProjectConfig, ProjectConfigLoadState } from "./config-types";
import { ConfigLoadingState } from "./shared";
import { GoalSourceGapsCard, buildGoalSourceGapCards } from "./goals-source-gaps-card";
import { GoalStrategyCard } from "./goal-strategy-card";

export function ProjectGoalsTab({
  config,
  state,
  error,
}: {
  config: FarplaneProjectConfig | null;
  state: ProjectConfigLoadState;
  error: string | null;
}): ReactElement {
  const goals = findConfigFile(config, "goals");
  const projectUiSnapshot = findProjectUiSnapshot(config);
  const northStar = projectUiSnapshot
    ? String(projectUiSnapshot.project.name ?? projectUiSnapshot.project.id ?? "Project goals")
    : getConfigSection(goals, "North Star");
  const currentBet =
    projectUiSnapshot?.tabs.overview.teamFocus.currentBet ?? getConfigSection(goals, "Current Bet");
  const axes = projectUiSnapshot ? [] : parseGoalAxesFromFile(goals);
  const snapshot = findMetricsSnapshot(config);
  const goalAxisViews = projectUiSnapshot
    ? buildGoalAxisViewsFromProjectUi(config)
    : buildGoalAxisViews(axes, snapshot);
  const availableMetricCount =
    snapshot?.metrics.filter((metric) => metric.status === "available").length ?? 0;
  const sourceGapCount =
    snapshot?.sourceGaps.length ??
    snapshot?.metrics.filter((metric) => metric.status === "source_gap").length ??
    0;
  const snapshotLabel = snapshot
    ? `${snapshot.snapshotDate || "latest"} · ${availableMetricCount} live · ${sourceGapCount} gap`
    : "metric readings missing";
  const goalSourceGaps = buildGoalSourceGapCards(projectUiSnapshot);

  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Goal Board</h3>
            <p className="text-xs text-muted-foreground">
              Strategy, SMART goals, KPI readings, and source gaps.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={snapshot ? "outline" : "secondary"}>
              {snapshot ? snapshotLabel : "snapshot missing"}
            </Badge>
            <ConfigLoadingState state={state} error={error} />
          </div>
        </div>
        <GoalStrategyCard northStar={northStar} currentBet={currentBet} />
        <GoalSourceGapsCard gaps={goalSourceGaps} />
        <GoalKpiCockpit axes={goalAxisViews} snapshotLabel={snapshotLabel} />
      </div>
    </ScrollArea>
  );
}
