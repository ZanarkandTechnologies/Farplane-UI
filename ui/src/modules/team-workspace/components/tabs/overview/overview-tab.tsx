"use client";

/**
 * OVERVIEW TAB
 * ============
 * Team charter, stats grid, and compact roster-first member oversight for the Team Panel overview tab.
 */

import { AlertTriangle, FileText, Flag, Gauge, Target } from "lucide-react";
import { type ReactElement, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AgentPresenceRow, PanelTask } from "../../team-panel-types";
import {
  type FarplaneProjectConfig,
  findConfigFile,
  getConfigSection,
  type ProjectConfigLoadState,
} from "../project-config";
import { findMetricsSnapshot, parseGoalAxesFromFile } from "./goal-kpi-model";
import { HudMetric, SignalCard } from "./overview-cards";
import { bulletLines, compactMarkdownText } from "./overview-helpers";
import { buildSocialContentInsightsModel } from "./social-content-insights";

type WorkloadSummary = {
  projectId: string;
  openTickets: number;
  queuePressure: string;
};

type ProjectModel = {
  id: string;
  name: string;
  status: string;
  goal?: string;
  businessConfig?: unknown;
};

type TeamModel = {
  _id: string;
  name: string;
  description?: string;
};

interface OverviewTabProps {
  team: TeamModel | null;
  panelTitle: string;
  project: ProjectModel | null;
  projectTasks: PanelTask[];
  workload: WorkloadSummary[];
  companyModel: { projects: ProjectModel[] } | null;
  setSelectedProjectId: (id: string | null) => void;
  globalMode: boolean;
  hasBusinessConfig: boolean;
  aiBurn24hUsd: number;
  aiUsageUnavailableText?: string | null;
  presenceRows: AgentPresenceRow[];
  projectConfig: FarplaneProjectConfig | null;
  projectConfigState: ProjectConfigLoadState;
  projectConfigError: string | null;
}

export function OverviewTab({
  team,
  project,
  projectTasks,
  workload,
  companyModel,
  setSelectedProjectId,
  globalMode,
  hasBusinessConfig,
  aiBurn24hUsd,
  aiUsageUnavailableText,
  presenceRows,
  projectConfig,
  projectConfigState,
  projectConfigError,
}: OverviewTabProps): ReactElement {
  const summary = workload.find((entry) => entry.projectId === (project?.id ?? ""));

  const aiCurrencyFormatter = useMemo(
    () => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
    [],
  );

  const normalizedProjectGoal = project?.goal?.trim() ?? "";
  const normalizedTeamDescription = team?.description?.trim() ?? "";
  const cleanedTeamDescription = normalizedTeamDescription
    .replace(/\s*\|\s*open=\d+\s*closed=\d+\s*$/i, "")
    .trim();
  const teamBusinessDescription =
    cleanedTeamDescription.length > 0 && cleanedTeamDescription !== normalizedProjectGoal
      ? cleanedTeamDescription
      : "";
  const teamGoal =
    normalizedProjectGoal || "No goal set yet. Use the team CLI to define a clear business target.";
  const harnessFile = findConfigFile(projectConfig, "harness");
  const goalsFile = findConfigFile(projectConfig, "goals");
  const evalsFile = findConfigFile(projectConfig, "evals");
  const pmFile = findConfigFile(projectConfig, "pm");
  const northStar = compactMarkdownText(getConfigSection(goalsFile, "North Star"), teamGoal, 260);
  const currentBet = compactMarkdownText(
    getConfigSection(goalsFile, "Current Bet"),
    "No current bet configured in farplane/goals.md.",
    260,
  );
  const mission = compactMarkdownText(
    getConfigSection(harnessFile, "Mission"),
    teamBusinessDescription || "No harness mission configured.",
    260,
  );
  const principles = bulletLines(getConfigSection(harnessFile, "Operating Principles"));
  const goalAxes = parseGoalAxesFromFile(goalsFile);
  const metricsSnapshot = findMetricsSnapshot(projectConfig);
  const availableMetricCount =
    metricsSnapshot?.metrics.filter((metric) => metric.status === "available").length ?? 0;
  const sourceGapCount =
    metricsSnapshot?.sourceGaps.length ??
    metricsSnapshot?.metrics.filter((metric) => metric.status === "source_gap").length ??
    0;
  const taskCounts = {
    open: projectTasks.filter((task) => task.status !== "done").length,
    review: projectTasks.filter((task) => task.status === "review").length,
    blocked: projectTasks.filter((task) => task.status === "blocked").length,
    done: projectTasks.filter((task) => task.status === "done").length,
  };
  const pmJson =
    pmFile?.parsedJson && typeof pmFile.parsedJson === "object"
      ? (pmFile.parsedJson as Record<string, unknown>)
      : {};
  const pmThreads =
    pmJson.threads && typeof pmJson.threads === "object"
      ? (pmJson.threads as Record<string, unknown>)
      : {};
  const pmAutomationCount = Array.isArray(pmThreads.automations) ? pmThreads.automations.length : 0;
  const reportCount =
    projectConfig?.runtimeSources.find((source) => source.id === "reports")?.childCount ?? 0;
  const evalRunCount =
    projectConfig?.runtimeSources.find((source) => source.id === "eval-runs")?.childCount ?? 0;
  const reportsSource = projectConfig?.runtimeSources.find((source) => source.id === "reports");
  const reportBaseHref = reportsSource?.absolutePath
    ? pathToFileHref(reportsSource.absolutePath)
    : null;
  const socialContent = buildSocialContentInsightsModel(projectConfig);
  const distributionViews = socialContent.items.reduce(
    (total, item) => total + (item.content_metrics.views ?? 0),
    0,
  );
  const distributionGaps = socialContent.items.reduce(
    (total, item) =>
      total +
      item.gaps.length +
      (item.content_metrics.retention_score === null && item.kind.toLowerCase() === "reels"
        ? 1
        : 0),
    0,
  );
  const latestDailyDiff = metricsSnapshot?.metrics
    .flatMap((metric) => metric.series.slice(-1).map((point) => point.dailyDiff))
    .filter((value): value is number => typeof value === "number")
    .reduce((total, value) => total + value, 0);
  const openGaps = [
    ...(metricsSnapshot?.sourceGaps ?? []).slice(0, 4).map((gap) => ({
      id: gap.metricId,
      label: gap.metricId,
      detail: gap.reason || "not connected yet",
    })),
    ...socialContent.items
      .flatMap((item) =>
        item.gaps.map((gap) => ({
          id: `${item.content_id}:${gap}`,
          label: `${item.platform} ${item.kind}`,
          detail: gap,
        })),
      )
      .slice(0, 2),
  ];
  const topSignals = [
    {
      label: "Goal Health",
      value: metricsSnapshot ? `${availableMetricCount} live` : "missing",
      detail:
        sourceGapCount > 0
          ? `${sourceGapCount} source gap${sourceGapCount === 1 ? "" : "s"}`
          : "no metric source gaps",
      target: "strategy contract",
      provider: metricsSnapshot ? "latest.json" : "provider_missing",
    },
    {
      label: "Today Move",
      value:
        typeof latestDailyDiff === "number"
          ? `${latestDailyDiff >= 0 ? "+" : ""}${numberText(latestDailyDiff)}`
          : "n/a",
      detail: "sum of latest daily KPI diffs",
      target: "daily motion",
      provider: metricsSnapshot ? "series.daily_diff" : "provider_missing",
    },
    {
      label: "Distribution",
      value: numberText(distributionViews),
      detail: `${socialContent.items.length} selected content item(s), ${distributionGaps} gap(s)`,
      target: "content reach",
      provider: socialContent.sourceLabel,
    },
    {
      label: "Agents",
      value: String(presenceRows.length),
      detail: `${presenceRows.filter((row) => row.blockedTaskCount > 0).length} blocked, ${presenceRows.filter((row) => row.liveState).length} live`,
      target: "persistent roster",
      provider: "runtime presence",
    },
  ];
  const configBadge =
    projectConfigState === "ready"
      ? "config loaded"
      : projectConfigState === "loading"
        ? "loading config"
        : projectConfigError || "config unavailable";
  const openGapsCard = (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4" />
            Open Gaps + Reports
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            {reportBaseHref ? (
              <>
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`${reportBaseHref}/interval/daily_interval`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileText className="h-4 w-4" />
                    Daily report
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`${reportBaseHref}/interval/weekly_interval`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileText className="h-4 w-4" />
                    Weekly report
                  </a>
                </Button>
              </>
            ) : (
              <Badge variant="secondary">reports source missing</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {openGaps.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {openGaps.map((gap) => (
              <div key={gap.id} className="rounded-md border bg-muted/20 p-3">
                <p className="break-all font-mono text-xs font-medium [overflow-wrap:anywhere]">
                  {gap.label}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{gap.detail}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
            No source gaps in the latest available snapshot.
          </p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        {openGapsCard}

        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4" />
                CEO Overview
              </CardTitle>
              <div className="flex items-center gap-2">
                {hasBusinessConfig ? (
                  <Badge variant="outline">Business configured</Badge>
                ) : (
                  <Badge variant="secondary">Builder mode</Badge>
                )}
                <Badge variant="secondary">{project?.status ?? "active"}</Badge>
                <Badge variant={projectConfigState === "ready" ? "outline" : "secondary"}>
                  {configBadge}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-3 rounded-md border bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                  North Star
                </p>
              </div>
              <p className="text-base font-medium leading-6">{northStar}</p>
              <div className="rounded-md border bg-background/50 p-3">
                <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                  Current Bet
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{currentBet}</p>
              </div>
            </div>
            <div className="space-y-3 rounded-md border bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                  Harness Mission
                </p>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{mission}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant={harnessFile?.exists ? "outline" : "secondary"}>harness.md</Badge>
                <Badge variant={goalsFile?.exists ? "outline" : "secondary"}>goals.md</Badge>
                <Badge variant={evalsFile?.exists ? "outline" : "secondary"}>evals.md</Badge>
              </div>
              {principles.length > 0 ? (
                <div className="space-y-1">
                  {principles.map((principle) => (
                    <p key={principle} className="text-xs text-muted-foreground">
                      - {principle}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Gauge className="h-4 w-4" />
                Signal Summary
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                CEO scan; drill into Goals or Distribution for detail
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4">
              {topSignals.map((signal) => (
                <SignalCard
                  key={signal.label}
                  label={signal.label}
                  value={signal.value}
                  detail={signal.detail}
                  target={signal.target}
                  provider={signal.provider}
                />
              ))}
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

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <HudMetric
            label="KPI Axes"
            value={String(goalAxes.length)}
            detail="from farplane/goals.md"
          />
          <HudMetric
            label="Open Tickets"
            value={String(summary?.openTickets ?? taskCounts.open)}
            detail={`${taskCounts.review} review, ${taskCounts.blocked} blocked`}
          />
          <HudMetric
            label="Completed"
            value={String(taskCounts.done)}
            detail="done tickets in scope"
          />
          <HudMetric
            label="PM Threads"
            value={String(pmAutomationCount)}
            detail={String(pmJson.name ?? "PM missing")}
          />
          <HudMetric label="Reports" value={String(reportCount)} detail=".farplane/reports" />
          <HudMetric
            label="AI Burn 24h"
            value={aiCurrencyFormatter.format(aiBurn24hUsd)}
            detail={aiUsageUnavailableText ?? `${evalRunCount} eval run source(s)`}
          />
        </div>
      </div>
    </ScrollArea>
  );
}

function numberText(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function pathToFileHref(path: string): string {
  return `file://${path.split("/").map(encodeURIComponent).join("/")}`;
}
