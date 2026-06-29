"use client";

/**
 * OVERVIEW TAB
 * ============
 * Team charter, stats grid, and compact roster-first member oversight for the Team Panel overview tab.
 *
 * KEY CONCEPTS:
 * - Displays team metadata, KPIs, and a compact member card grid.
 * - Each roster card embeds a lightweight 3D character preview plus quick actions.
 *
 * USAGE:
 * - Rendered inside TeamPanel as the "overview" TabsContent.
 *
 * MEMORY REFERENCES:
 * - MEM-0196
 */

import { Box } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import { FileCog, Flag, Gauge, MessageSquare, Radio, Send, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BODY_HEIGHT,
  BODY_WIDTH,
  HAIR_HEIGHT,
  HAIR_WIDTH,
  HEAD_HEIGHT,
  HEAD_WIDTH,
  LEG_HEIGHT,
  TOTAL_HEIGHT,
} from "@/constants";
import { useAppStore } from "@/store";
import {
  PRIORITY_COLORS,
  STATUS_LABELS,
  type AgentPresenceRow,
  type PanelTask,
} from "./team-panel-types";
import {
  findConfigFile,
  getConfigSection,
  parseMarkdownTable,
  type FarplaneProjectConfig,
  type ProjectConfigLoadState,
} from "./farplane-project-config";
import {
  formatRelativeTime,
  resolvePreviewPalette,
  type AvatarPalette,
} from "./overview-tab.helpers";

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

function EmployeePreviewMesh({ palette }: { palette: AvatarPalette }): JSX.Element {
  const baseY = -TOTAL_HEIGHT / 2;
  return (
    <group position={[0, -0.18, 0]} rotation={[0.08, -0.38, 0]}>
      <Box
        args={[BODY_WIDTH, LEG_HEIGHT, BODY_WIDTH * 0.6]}
        position={[0, baseY + LEG_HEIGHT / 2, 0]}
        castShadow
      >
        <meshStandardMaterial color={palette.pants} />
      </Box>
      <Box
        args={[BODY_WIDTH, BODY_HEIGHT, BODY_WIDTH * 0.6]}
        position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT / 2, 0]}
        castShadow
      >
        <meshStandardMaterial color={palette.shirt} />
      </Box>
      <Box
        args={[HEAD_WIDTH, HEAD_HEIGHT, HEAD_WIDTH]}
        position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT / 2, 0]}
        castShadow
      >
        <meshStandardMaterial color={palette.skin} />
      </Box>
      <Box
        args={[HAIR_WIDTH, HAIR_HEIGHT, HAIR_WIDTH]}
        position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT + HAIR_HEIGHT / 2, 0]}
        castShadow
      >
        <meshStandardMaterial color={palette.hair} />
      </Box>
    </group>
  );
}

function MiniEmployeePreview({ seed }: { seed: string }): JSX.Element {
  const palette = useMemo(() => resolvePreviewPalette(seed), [seed]);

  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <div className="h-28 w-28">
        <Canvas camera={{ position: [0, 0.5, 3.1], fov: 24 }}>
          <ambientLight intensity={1.4} />
          <directionalLight position={[2, 3, 4]} intensity={2.1} />
          <directionalLight position={[-2, 1.5, 2]} intensity={0.7} />
          <group scale={1.65}>
            <EmployeePreviewMesh palette={palette} />
          </group>
        </Canvas>
      </div>
    </div>
  );
}

function compactMarkdownText(value: string, fallback: string, limit = 220): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  return normalized.length > limit ? `${normalized.slice(0, limit - 3)}...` : normalized;
}

function bulletLines(markdown: string, limit = 4): string[] {
  return markdown
    .split(/\r?\n/g)
    .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function HudMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}): JSX.Element {
  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="truncate text-2xl font-semibold tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

type OverviewKpiAxis = {
  axis: string;
  weight: string;
  currentBet: string;
  target: string;
  provider: string;
  evidence: string;
  heartbeat: string;
};

function isKpiWeightCell(value: string | undefined): boolean {
  return /^\d+(?:\.\d+)?%?$/.test(value?.trim() ?? "");
}

function overviewKpiFromRow(row: string[]): OverviewKpiAxis {
  const hasWeight = isKpiWeightCell(row[1]);
  return {
    axis: row[0] ?? "KPI",
    weight: hasWeight ? (row[1] ?? "?") : "goal",
    currentBet: hasWeight ? (row[2] ?? "Bet pending") : (row[1] ?? "Bet pending"),
    target: hasWeight ? (row[3] ?? "Target pending") : (row[1] ?? "Target pending"),
    provider: hasWeight ? (row[4] ?? "provider_missing") : (row[3] ?? "provider_missing"),
    evidence: hasWeight ? (row[5] ?? "evidence missing") : (row[2] ?? "evidence missing"),
    heartbeat: hasWeight ? (row[7] ?? "cadence missing") : (row[5] ?? "cadence missing"),
  };
}

function findKpiAxis(kpis: OverviewKpiAxis[], patterns: RegExp[]): OverviewKpiAxis | null {
  return (
    kpis.find((kpi) =>
      patterns.some((pattern) => pattern.test(`${kpi.axis} ${kpi.target} ${kpi.currentBet}`)),
    ) ?? null
  );
}

function OverviewTrendBars({
  seed,
  active = false,
}: {
  seed: string;
  active?: boolean;
}): JSX.Element {
  const code = Array.from(seed).reduce((total, character) => total + character.charCodeAt(0), 0);
  const bars = [0, 1, 2, 3, 4, 5, 6].map((offset) => ({
    key: `${seed}-${offset}`,
    height: 25 + ((code + offset * 19) % 52),
  }));
  return (
    <div className="flex h-10 items-end gap-1" aria-hidden="true">
      {bars.map((bar) => (
        <span
          key={bar.key}
          className={
            active ? "w-2 rounded-sm bg-primary/70" : "w-2 rounded-sm bg-muted-foreground/25"
          }
          style={{ height: `${bar.height}%` }}
        />
      ))}
    </div>
  );
}

function SignalCard({
  label,
  value,
  detail,
  target,
  provider,
}: {
  label: string;
  value: string;
  detail: string;
  target: string;
  provider: string;
}): JSX.Element {
  const hasProvider = provider !== "provider_missing";
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md border bg-card p-3">
      <div className="min-w-0 space-y-2">
        <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
          {label}
        </p>
        <p className="break-words text-2xl font-semibold tabular-nums [overflow-wrap:anywhere]">
          {value}
        </p>
        <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {detail}
        </p>
        <Badge
          variant={hasProvider ? "outline" : "secondary"}
          className="max-w-full whitespace-normal break-words text-left [overflow-wrap:anywhere]"
        >
          {provider}
        </Badge>
      </div>
      <div className="flex min-w-24 flex-col items-end justify-between gap-2">
        <OverviewTrendBars seed={`${label}:${target}:${provider}`} active={hasProvider} />
        <p className="max-w-28 break-words text-right text-[10px] uppercase tracking-[0.12em] text-muted-foreground [overflow-wrap:anywhere]">
          {target}
        </p>
      </div>
    </div>
  );
}

export function OverviewTab({
  team,
  panelTitle,
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
}: OverviewTabProps): JSX.Element {
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
                  const ids = (globalMode ? employees : teamEmployees).map((entry) => entry._id);
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

            {presenceRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No team members assigned.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {presenceRows.map((presence) => (
                  <div
                    key={presence.employeeId}
                    className="rounded-md border bg-muted/20 p-3 transition hover:border-border hover:bg-muted/30"
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0">
                        <MiniEmployeePreview seed={`${presence.employeeId}:${presence.name}`} />
                      </div>
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="truncate text-sm font-medium">{presence.name}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-[10px] uppercase">
                                {presence.roleLabel}
                              </Badge>
                              {presence.liveState ? (
                                <Badge variant="secondary" className="text-[10px] uppercase">
                                  {presence.liveState}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {formatRelativeTime(presence.latestOccurredAt)}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={() => setHighlightedEmployeeIds([presence.employeeId])}
                          >
                            Locate
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground">Current State</p>
                            <p className="text-sm font-medium">{presence.statusText}</p>
                          </div>
                          <div className="rounded-md border bg-background/40 p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                Latest Task
                              </p>
                              {presence.latestTaskStatus ? (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] uppercase ${PRIORITY_COLORS[presence.latestTaskPriority ?? "medium"]}`}
                                >
                                  {STATUS_LABELS[presence.latestTaskStatus]}
                                </Badge>
                              ) : null}
                            </div>
                            {presence.latestTaskTitle ? (
                              <>
                                <p className="text-sm font-medium">{presence.latestTaskTitle}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {presence.latestTaskDetail ?? "No task detail yet."}
                                </p>
                              </>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                No assigned task yet. This agent is currently available for new
                                work.
                              </p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                              <span>{presence.openTaskCount} open</span>
                              <span>{presence.blockedTaskCount} blocked</span>
                              <span>{presence.completedTaskCount} done</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => onMessageAgent(presence.agentId)}>
                            <MessageSquare className="mr-2 h-3.5 w-3.5" />
                            Message
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenAgentSession(presence.agentId)}
                          >
                            <Radio className="mr-2 h-3.5 w-3.5" />
                            Open Session
                          </Button>
                          <Badge variant="secondary" className="px-2 py-1 text-[10px] uppercase">
                            <Send className="mr-1 h-3 w-3" />
                            Board-first
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
