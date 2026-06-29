"use client";

/**
 * OVERVIEW TAB
 * ============
 * Team charter, stats grid, and compact roster-first member oversight for the Team Panel overview tab.
 */

import { FileCog, Flag, Gauge, Target } from "lucide-react";
import { type ReactElement, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/store";
import type { AgentPresenceRow, PanelTask } from "../../team-panel-types";
import {
  type FarplaneProjectConfig,
  findConfigFile,
  getConfigSection,
  type ProjectConfigLoadState,
  parseMarkdownTable,
} from "../project-config";
import { HudMetric, OverviewTrendBars, SignalCard } from "./overview-cards";
import {
  bulletLines,
  compactMarkdownText,
  findKpiAxis,
  overviewKpiFromRow,
} from "./overview-helpers";
import { TeamMembersSection } from "./team-members-section";

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
  kpis?: string[];
  businessConfig?: unknown;
  ledger?: { type: string; amount: number }[];
  account?: unknown;
  accountEvents?: unknown[];
};

type TeamModel = {
  _id: string;
  name: string;
  description?: string;
  businessReadiness?: { ready: boolean; issues: string[] };
};

type EmployeeModel = {
  _id: string;
  name: string;
  teamId?: string;
  jobTitle?: string;
  profileImageUrl?: string;
  status?: string;
  statusMessage?: string;
};

interface OverviewTabProps {
  team: TeamModel | null;
  panelTitle: string;
  project: ProjectModel | null;
  projectTasks: PanelTask[];
  employees: EmployeeModel[];
  teamEmployees: EmployeeModel[];
  workload: WorkloadSummary[];
  companyModel: { projects: ProjectModel[] } | null;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  globalMode: boolean;
  hasBusinessConfig: boolean;
  aiBurn24hUsd: number;
  aiUsageUnavailableText?: string | null;
  presenceRows: AgentPresenceRow[];
  projectConfig: FarplaneProjectConfig | null;
  projectConfigState: ProjectConfigLoadState;
  projectConfigError: string | null;
  onMessageAgent: (agentId: string) => void;
  onOpenAgentSession: (agentId: string) => void;
}

export function OverviewTab({
  team,
  project,
  projectTasks,
  employees,
  teamEmployees,
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
  onMessageAgent,
  onOpenAgentSession,
}: OverviewTabProps): ReactElement {
  const setHighlightedEmployeeIds = useAppStore((state) => state.setHighlightedEmployeeIds);
  const highlightedEmployeeIds = useAppStore((state) => state.highlightedEmployeeIds);

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
  const kpiRows = parseMarkdownTable(getConfigSection(goalsFile, "KPI Axes")).slice(1);
  const kpiAxes = kpiRows.map(overviewKpiFromRow);
  const revenueEntries =
    project?.ledger?.filter((entry) => /revenue|sale|income|money/i.test(entry.type)) ?? [];
  const moneyMade = revenueEntries.reduce((total, entry) => total + entry.amount, 0);
  const viewersKpi = findKpiAxis(kpiAxes, [/view/i, /attention/i]);
  const userGrowthKpi = findKpiAxis(kpiAxes, [/user/i, /signup/i, /qualified/i, /curiosity/i]);
  const smartGoalKpi = findKpiAxis(kpiAxes, [/feature/i, /quality/i, /showcase/i]) ?? kpiAxes[0];
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
  const topSignals = [
    {
      label: "Money Made",
      value: revenueEntries.length > 0 ? aiCurrencyFormatter.format(moneyMade) : "not bound",
      detail:
        revenueEntries.length > 0
          ? `${revenueEntries.length} revenue ledger entr${revenueEntries.length === 1 ? "y" : "ies"}`
          : "Bind revenue ledger, Stripe, invoices, or a manual metric provider.",
      target: "business outcome",
      provider: revenueEntries.length > 0 ? "project ledger" : "provider_missing",
    },
    {
      label: "User Growth",
      value: userGrowthKpi ? "target set" : "not set",
      detail: userGrowthKpi?.target ?? "No user/signup KPI axis is configured yet.",
      target: userGrowthKpi?.axis ?? "growth signal",
      provider: userGrowthKpi?.provider ?? "provider_missing",
    },
    {
      label: "Viewer Growth",
      value: viewersKpi ? "target set" : "not set",
      detail: viewersKpi?.target ?? "No attention/viewer KPI axis is configured yet.",
      target: viewersKpi?.axis ?? "attention signal",
      provider: viewersKpi?.provider ?? "provider_missing",
    },
    {
      label: "SMART Goal Health",
      value: `${taskCounts.done}/${Math.max(1, taskCounts.open + taskCounts.done)}`,
      detail: smartGoalKpi?.currentBet ?? "Use goals.md KPI Axes to bind operating goals.",
      target: smartGoalKpi?.axis ?? "operating KPI",
      provider: smartGoalKpi?.provider ?? "provider_missing",
    },
  ];
  const configBadge =
    projectConfigState === "ready"
      ? "config loaded"
      : projectConfigState === "loading"
        ? "loading config"
        : projectConfigError || "config unavailable";

  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
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
                <FileCog className="h-4 w-4 text-muted-foreground" />
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
                KPI Cockpit
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                ultimate signals plus SMART-goal operating health
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                  Operating KPI Board
                </p>
                <Badge variant="outline">{kpiAxes.length} configured</Badge>
              </div>
              {kpiAxes.length > 0 ? (
                <div className="space-y-2">
                  {kpiAxes.slice(0, 6).map((kpi) => (
                    <div
                      key={`${kpi.axis}-${kpi.weight}`}
                      className="grid min-w-0 grid-cols-1 gap-3 rounded-md border bg-muted/20 p-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_8rem]"
                    >
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <Badge variant="outline" className="shrink-0">
                            {kpi.weight}
                          </Badge>
                          <p className="min-w-0 break-words text-sm font-medium [overflow-wrap:anywhere]">
                            {kpi.axis}
                          </p>
                        </div>
                        <p className="mt-2 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                          {kpi.target}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                          Why It Matters
                        </p>
                        <p className="mt-1 break-words text-xs [overflow-wrap:anywhere]">
                          {kpi.currentBet}
                        </p>
                        <p className="mt-2 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                          Evidence: {kpi.evidence}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3 xl:flex-col xl:items-start">
                        <Badge
                          variant={kpi.provider === "provider_missing" ? "secondary" : "outline"}
                          className="max-w-full whitespace-normal break-words text-left [overflow-wrap:anywhere]"
                        >
                          {kpi.provider}
                        </Badge>
                        <OverviewTrendBars
                          seed={`${kpi.axis}:${kpi.provider}`}
                          active={kpi.provider !== "provider_missing"}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                  No KPI Axes table found in farplane/goals.md yet.
                </p>
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

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <HudMetric
            label="KPI Axes"
            value={String(kpiRows.length)}
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

        <TeamMembersSection
          employees={employees}
          globalMode={globalMode}
          highlightedEmployeeIds={highlightedEmployeeIds}
          onMessageAgent={onMessageAgent}
          onOpenAgentSession={onOpenAgentSession}
          presenceRows={presenceRows}
          setHighlightedEmployeeIds={setHighlightedEmployeeIds}
          teamEmployees={teamEmployees}
        />
      </div>
    </ScrollArea>
  );
}
