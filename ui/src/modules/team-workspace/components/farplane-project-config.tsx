"use client";

/**
 * FARPLANE PROJECT CONFIG TABS
 * ============================
 * Ownership: Team Workspace module.
 * Inputs: file-backed Farplane project config rows from the Vite bridge plus current board state.
 * Outputs: game-style Team Panel tabs for goals, products, cadence, and source config.
 * Side effects: fetches read-only local config and opens existing Farplane module panels.
 */

import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FileCog,
  Flag,
  Gauge,
  Link2,
  ListChecks,
  Package,
  Target,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ProjectModel } from "@/modules/runtime";
import { useAppStore } from "@/store";
import { STATUS_LABELS, type PanelTask } from "./team-panel-types";

export type FarplaneConfigSection = {
  level: number;
  title: string;
  body: string;
};

export type FarplaneConfigFile = {
  id: string;
  path: string;
  absolutePath: string;
  title: string;
  kind: string;
  format: "json" | "markdown";
  exists: boolean;
  content: string;
  updatedAtMs: number | null;
  frontMatter: Record<string, string>;
  sections: FarplaneConfigSection[];
  parsedJson: unknown;
  error?: string;
};

export type FarplaneRuntimeSource = {
  id: string;
  label: string;
  path: string;
  kind: "file" | "directory";
  absolutePath: string;
  exists: boolean;
  updatedAtMs: number | null;
  childCount: number | null;
};

export type FarplaneProjectConfig = {
  ok: boolean;
  projectPath: string;
  generatedAtMs: number;
  files: FarplaneConfigFile[];
  runtimeSources: FarplaneRuntimeSource[];
};

export type ProjectConfigLoadState = "idle" | "loading" | "ready" | "error";

export function useFarplaneProjectConfig({
  projectPath,
  enabled,
}: {
  projectPath?: string | null;
  enabled: boolean;
}): {
  config: FarplaneProjectConfig | null;
  state: ProjectConfigLoadState;
  error: string | null;
} {
  const [config, setConfig] = useState<FarplaneProjectConfig | null>(null);
  const [state, setState] = useState<ProjectConfigLoadState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (projectPath?.trim()) params.set("projectPath", projectPath.trim());
    setState("loading");
    setError(null);
    fetch(`/farplane/project-config${params.toString() ? `?${params.toString()}` : ""}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as FarplaneProjectConfig & { error?: string };
        if (!response.ok || !payload.ok) throw new Error(payload.error ?? "config_load_failed");
        setConfig(payload);
        setState("ready");
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) return;
        setError(fetchError instanceof Error ? fetchError.message : "config_load_failed");
        setState("error");
      });
    return () => controller.abort();
  }, [enabled, projectPath]);

  return { config, state, error };
}

export function findConfigFile(
  config: FarplaneProjectConfig | null | undefined,
  kindOrPath: string,
): FarplaneConfigFile | null {
  return config?.files.find((file) => file.kind === kindOrPath || file.path === kindOrPath) ?? null;
}

export function getConfigSection(
  file: FarplaneConfigFile | null | undefined,
  title: string,
): string {
  const normalized = title.trim().toLowerCase();
  return (
    file?.sections.find((section) => section.title.trim().toLowerCase() === normalized)?.body ?? ""
  );
}

export function parseMarkdownTable(markdown: string): string[][] {
  const rows = markdown
    .split(/\r?\n/g)
    .filter((line) => line.trim().startsWith("|") && line.trim().endsWith("|"))
    .map((line) =>
      line
        .trim()
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim().replace(/^`|`$/g, "")),
    )
    .filter((cells) => !cells.every((cell) => /^:?-{2,}:?$/.test(cell)));
  return rows.length > 1 ? rows : [];
}

function bulletLines(markdown: string, limit = 6): string[] {
  return markdown
    .split(/\r?\n/g)
    .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function shortText(value: string, fallback: string, limit = 240): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  return normalized.length > limit ? `${normalized.slice(0, limit - 3)}...` : normalized;
}

function statusBadge(file: FarplaneConfigFile | null): ReactElement {
  if (!file) return <Badge variant="destructive">provider_missing</Badge>;
  if (file.error) return <Badge variant="destructive">{file.error}</Badge>;
  return file.exists ? (
    <Badge variant="outline">loaded</Badge>
  ) : (
    <Badge variant="secondary">missing</Badge>
  );
}

function sourceFreshness(updatedAtMs: number | null): string {
  if (!updatedAtMs) return "no file timestamp";
  const days = Math.max(0, Math.floor((Date.now() - updatedAtMs) / 86_400_000));
  if (days === 0) return "updated today";
  if (days === 1) return "updated yesterday";
  return `updated ${days}d ago`;
}

function ConfigLoadingState({
  state,
  error,
}: {
  state: ProjectConfigLoadState;
  error: string | null;
}): ReactElement | null {
  if (state === "loading") return <Badge variant="secondary">loading project config</Badge>;
  if (state === "error")
    return <Badge variant="destructive">{error ?? "config unavailable"}</Badge>;
  return null;
}

function MetricTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}): ReactElement {
  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="break-words text-2xl font-semibold tabular-nums [overflow-wrap:anywhere]">
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function InlineStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}): ReactElement {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

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

function SparkBars({ seed, active = false }: { seed: string; active?: boolean }): ReactElement {
  const code = Array.from(seed).reduce((total, character) => total + character.charCodeAt(0), 0);
  const bars = [0, 1, 2, 3, 4, 5, 6, 7].map((offset) => ({
    key: `${seed}-${offset}`,
    height: 24 + ((code + offset * 17) % 54),
  }));
  return (
    <div className="flex h-12 items-end gap-1" aria-hidden="true">
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

function FileSourceRow({ file }: { file: FarplaneConfigFile }): ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{file.title}</p>
        <p className="truncate text-xs text-muted-foreground">{file.path}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant="secondary">{file.format}</Badge>
        {statusBadge(file)}
      </div>
    </div>
  );
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

export function ProjectProductsTab({
  config,
}: {
  config: FarplaneProjectConfig | null;
}): ReactElement {
  const products = findConfigFile(config, "products");
  const productRows = parseMarkdownTable(getConfigSection(products, "Products")).slice(1);
  const laneRows = parseMarkdownTable(getConfigSection(products, "Work Lanes")).slice(1);
  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Product Shop</h3>
            <p className="text-xs text-muted-foreground">
              Each shelf is a real Farplane product surface with its buyer and reward signal.
            </p>
          </div>
          {statusBadge(products)}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <MetricTile
            label="Shop Items"
            value={String(productRows.length)}
            detail="products.md product rows"
          />
          <MetricTile
            label="Departments"
            value={String(laneRows.length)}
            detail="work-lane routing weights"
          />
          <MetricTile
            label="Top Reward"
            value={productRows[0]?.[4]?.split(",")[0] ?? "reward missing"}
            detail={productRows[0]?.[0] ?? "first product row"}
          />
        </div>
        <div className="space-y-3">
          {productRows.map((row, index) => (
            <div
              key={row[0]}
              className="grid min-w-0 grid-cols-1 gap-3 rounded-md border bg-card p-4 lg:grid-cols-[10rem_minmax(0,1fr)_minmax(14rem,0.62fr)]"
            >
              <div className="flex items-start gap-3 rounded-md border bg-muted/20 p-3 lg:block">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-background lg:mb-3">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Shelf {String(index + 1).padStart(2, "0")}
                  </p>
                  <Badge
                    variant="secondary"
                    className="mt-2 max-w-full whitespace-normal break-words"
                  >
                    {row[0] ?? "product"}
                  </Badge>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Rank {index < 2 ? "S" : index < 5 ? "A" : "B"} item
                  </p>
                </div>
              </div>
              <div className="min-w-0 space-y-2">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Product Package
                  </p>
                  <h4 className="mt-1 break-words text-base font-semibold [overflow-wrap:anywhere]">
                    {row[1] ?? row[0] ?? "Untitled product"}
                  </h4>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="rounded-md border bg-muted/10 p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Buyer
                    </p>
                    <p className="mt-1 break-words text-sm [overflow-wrap:anywhere]">
                      {row[2] ?? "Audience pending"}
                    </p>
                  </div>
                  <div className="rounded-md border bg-muted/10 p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Output
                    </p>
                    <p className="mt-1 break-words text-sm [overflow-wrap:anywhere]">
                      {row[3] ?? "Output pending"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="min-w-0 rounded-md border bg-muted/20 p-3">
                <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  <Trophy className="h-3.5 w-3.5" />
                  Reward Signal
                </p>
                <p className="mt-2 break-words text-sm [overflow-wrap:anywhere]">
                  {row[4] ?? "reward missing"}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3 rounded-md border bg-background/50 px-3 py-2">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Demand
                  </span>
                  <SparkBars seed={`${row[0]}:${row[4]}`} active />
                </div>
              </div>
            </div>
          ))}
        </div>
        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Flag className="h-4 w-4" />
              Shop Departments
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {laneRows.map((row) => (
              <div key={row[0]} className="rounded-md border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{row[0]}</p>
                  <Badge variant="secondary">{row[1]}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{row[2]}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

export function ProjectCadenceTab({
  config,
}: {
  config: FarplaneProjectConfig | null;
}): ReactElement {
  const automations = findConfigFile(config, "automations");
  const pm = findConfigFile(config, "pm");
  const pulse = parseMarkdownTable(getConfigSection(automations, "Pulse")).slice(1);
  const daily = parseMarkdownTable(getConfigSection(automations, "Daily Interval")).slice(1);
  const weekly = parseMarkdownTable(getConfigSection(automations, "Weekly Interval")).slice(1);
  const pmJson =
    pm?.parsedJson && typeof pm.parsedJson === "object"
      ? (pm.parsedJson as Record<string, unknown>)
      : {};
  const threads =
    pmJson.threads && typeof pmJson.threads === "object"
      ? (pmJson.threads as Record<string, unknown>)
      : {};
  const automationThreads = Array.isArray(threads.automations)
    ? threads.automations.map(String)
    : [];
  const sections = [
    { title: "Pulse", icon: <Activity className="h-4 w-4" />, rows: pulse },
    { title: "Daily Interval", icon: <CalendarClock className="h-4 w-4" />, rows: daily },
    { title: "Weekly Interval", icon: <CalendarClock className="h-4 w-4" />, rows: weekly },
  ];

  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Cadence Console</h3>
          <div className="flex items-center gap-2">
            {statusBadge(automations)}
            {statusBadge(pm)}
          </div>
        </div>
        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Link2 className="h-4 w-4" />
              Project PM
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <InlineStat
              label="PM"
              value={String(pmJson.name ?? "missing")}
              detail={String(pmJson.role ?? "role unavailable")}
            />
            <InlineStat
              label="Automation Threads"
              value={String(automationThreads.length)}
              detail={automationThreads[0] ?? "no PM thread linked"}
            />
            <InlineStat
              label="Runtime Reports"
              value={String(
                config?.runtimeSources.find((source) => source.id === "reports")?.childCount ?? 0,
              )}
              detail=".farplane/reports availability"
            />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {sections.map((section) => (
            <Card key={section.title} className="rounded-md">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  {section.icon}
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {section.rows.length > 0 ? (
                  section.rows.map((row) => (
                    <div
                      key={`${section.title}-${row[0]}`}
                      className="rounded-md border bg-muted/20 p-2"
                    >
                      <p className="text-xs font-medium text-muted-foreground">{row[0]}</p>
                      <p className="break-words text-sm">{row[1]}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No cadence table found.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}

export function ProjectConfigTab({
  config,
  project,
  teamScopeId,
  convexEnabled,
  hasBusinessConfig,
}: {
  config: FarplaneProjectConfig | null;
  project: ProjectModel | null;
  teamScopeId: string | null;
  convexEnabled: boolean;
  hasBusinessConfig: boolean;
}): ReactElement {
  const setIsSkillsPanelOpen = useAppStore((state) => state.setIsSkillsPanelOpen);
  const setSkillStudioSurface = useAppStore((state) => state.setSkillStudioSurface);
  const setSelectedSkillStudioSkillId = useAppStore((state) => state.setSelectedSkillStudioSkillId);
  const setSkillStudioFocusAgentId = useAppStore((state) => state.setSkillStudioFocusAgentId);
  const setIsTelemetryPanelOpen = useAppStore((state) => state.setIsTelemetryPanelOpen);
  const harness = findConfigFile(config, "harness");
  const hooks = findConfigFile(config, "hooks");
  const manifest = findConfigFile(config, "manifest");
  const principles = bulletLines(getConfigSection(harness, "Operating Principles"));
  const nonTradeoffs = bulletLines(getConfigSection(harness, "Non-Tradeoffs"));
  const openSkillSurface = (surface: "skill-os" | "evals" | "harness"): void => {
    setSelectedSkillStudioSkillId(null);
    setSkillStudioFocusAgentId(null);
    setSkillStudioSurface(surface);
    setIsSkillsPanelOpen(true);
  };

  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <MetricTile
            label="Project"
            value={project?.name ?? "unmapped"}
            detail={config?.projectPath ?? project?.trackingContext ?? "path unavailable"}
          />
          <MetricTile
            label="Config Files"
            value={String(config?.files.filter((file) => file.exists).length ?? 0)}
            detail="loaded Farplane files"
          />
          <MetricTile
            label="Team Scope"
            value={teamScopeId ?? "global"}
            detail={convexEnabled ? "Convex board connected" : "local board fallback"}
          />
          <MetricTile
            label="Business"
            value={hasBusinessConfig ? "ready" : "builder"}
            detail="business config source state"
          />
        </div>
        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileCog className="h-4 w-4" />
              Manifest and Harness Config
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {statusBadge(manifest)}
                {statusBadge(hooks)}
              </div>
              {(config?.files ?? []).map((file) => (
                <FileSourceRow key={file.path} file={file} />
              ))}
            </div>
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                  Operating Principles
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {principles.map((line) => (
                    <li key={line}>- {line}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                  Non-Tradeoffs
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {nonTradeoffs.map((line) => (
                    <li key={line}>- {line}</li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => openSkillSurface("harness")}>
                  <ListChecks className="mr-2 h-4 w-4" />
                  Harness
                </Button>
                <Button size="sm" variant="outline" onClick={() => openSkillSurface("skill-os")}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Skills
                </Button>
                <Button size="sm" variant="outline" onClick={() => openSkillSurface("evals")}>
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Evals
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsTelemetryPanelOpen(true)}>
                  <Gauge className="mr-2 h-4 w-4" />
                  Telemetry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Runtime Sources</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            {(config?.runtimeSources ?? []).map((source) => (
              <div key={source.id} className="rounded-md border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{source.label}</p>
                  <Badge variant={source.exists ? "outline" : "secondary"}>
                    {source.exists ? "available" : "missing"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{source.path}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {sourceFreshness(source.updatedAtMs)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
