"use client";

/**
 * Ownership: Harness OS project rollout scanner view.
 * Inputs: read-only project adoption payload from the Vite bridge.
 * Outputs: active-project framework adoption charts, manifest rows, and project index.
 * Side effects: none.
 */

import { AlertTriangle, CheckCircle2, FileCheck2, GitPullRequestArrow, Layers3 } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Cell, Pie, PieChart } from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { HarnessAdoptionPayload, HarnessAdoptionProject } from "./harness-os-types";

type ProjectFilter = "all" | "active" | "retired" | "missing";
type BaselineStatus = "current" | "behind" | "missing" | "retired";

type ProjectRolloutRow = {
  activeState: "active" | "retired";
  baselineStatus: BaselineStatus;
  blockerCount: number;
  expectedSpec: string;
  installedSpec: string;
  nextAction: string;
  project: HarnessAdoptionProject;
  templateLatestCount: number;
  templateTotal: number;
};

type DistributionRow = {
  active: number;
  retired: number;
  status: BaselineStatus;
  version: string;
};

const donutConfig = {
  count: { color: "var(--chart-1)", label: "Projects" },
} satisfies ChartConfig;

function Scorecard({
  icon,
  label,
  sublabel,
  value,
}: {
  icon: ReactElement;
  label: string;
  sublabel: string;
  value: string;
}): ReactElement {
  return (
    <div className="min-w-[10rem] rounded-md border bg-card px-3 py-2">
      <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{sublabel}</p>
    </div>
  );
}

function EmptyState({ error, label }: { error: string | null; label: string }): ReactElement {
  return (
    <div className="grid h-full min-h-[20rem] place-items-center rounded-md border border-dashed bg-muted/10">
      <div className="max-w-md p-6 text-center">
        <AlertTriangle className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-3 font-semibold">{label}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {error ?? "The bridge has no project rollout payload yet."}
        </p>
      </div>
    </div>
  );
}

function projectId(project: HarnessAdoptionProject): string {
  return project.projectId ?? project.root ?? "unknown project";
}

function percent(numerator: number, denominator: number): string {
  if (!denominator) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function isRetired(project: HarnessAdoptionProject): boolean {
  const candidate = project as HarnessAdoptionProject & {
    active?: boolean;
    lifecycle?: string;
    state?: string;
    status?: string;
  };
  if (candidate.active === false) return true;
  return [candidate.lifecycle, candidate.state, candidate.status]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase() === "retired");
}

function projectBaselineStatus(
  project: HarnessAdoptionProject,
  expectedSpec: string,
): BaselineStatus {
  if (isRetired(project)) return "retired";
  if (!project.manifestExists || !project.specVersion) return "missing";
  return project.specVersion === expectedSpec ? "current" : "behind";
}

function nextActionFor(row: Omit<ProjectRolloutRow, "nextAction">): string {
  if (row.baselineStatus === "retired") return "none";
  if (row.baselineStatus === "missing") return "init manifest";
  if (row.baselineStatus === "behind") return "bump manifest";
  if (row.templateLatestCount < row.templateTotal) return "refresh pins";
  if (row.blockerCount > 0) return "clear blockers";
  return "none";
}

function buildRows(adoption: HarnessAdoptionPayload): ProjectRolloutRow[] {
  const expectedTemplates = adoption.globalTemplateUses ?? {};
  const templateKeys = Object.keys(expectedTemplates);
  const fallbackExpectedSpec = adoption.globalSpecVersion ?? "unknown";

  return (adoption.projects ?? []).map((project) => {
    const expectedSpec = project.expectedSpecVersion ?? fallbackExpectedSpec;
    const installedSpec = project.specVersion ?? "missing";
    const baselineStatus = projectBaselineStatus(project, expectedSpec);
    const uses = project.templateUses ?? {};
    const templateLatestCount = templateKeys.filter(
      (key) => uses[key] === expectedTemplates[key],
    ).length;
    const templateTotal = templateKeys.length;
    const templateDriftCount = Math.max(0, templateTotal - templateLatestCount);
    const blockerCount = (project.issues?.length ?? 0) + templateDriftCount;
    const rowBase = {
      activeState: baselineStatus === "retired" ? "retired" : "active",
      baselineStatus,
      blockerCount,
      expectedSpec,
      installedSpec,
      project,
      templateLatestCount,
      templateTotal,
    } satisfies Omit<ProjectRolloutRow, "nextAction">;

    return {
      ...rowBase,
      nextAction: nextActionFor(rowBase),
    };
  });
}

function statusBadge(status: BaselineStatus): ReactElement {
  if (status === "current") return <Badge variant="secondary">current</Badge>;
  if (status === "missing") return <Badge variant="destructive">missing</Badge>;
  if (status === "retired") return <Badge variant="outline">retired</Badge>;
  return <Badge variant="outline">behind</Badge>;
}

function colorFor(status: BaselineStatus): string {
  if (status === "current") return "var(--chart-1)";
  if (status === "behind") return "var(--chart-3)";
  if (status === "missing") return "var(--chart-5)";
  return "var(--muted-foreground)";
}

function buildDistribution(rows: ProjectRolloutRow[]): DistributionRow[] {
  const byVersion = new Map<string, DistributionRow>();
  for (const row of rows) {
    const version = row.baselineStatus === "missing" ? "missing" : row.installedSpec;
    const existing =
      byVersion.get(version) ??
      ({ active: 0, retired: 0, status: row.baselineStatus, version } satisfies DistributionRow);
    if (row.activeState === "retired") existing.retired += 1;
    else existing.active += 1;
    if (existing.status === "current" && row.baselineStatus === "behind") existing.status = "behind";
    byVersion.set(version, existing);
  }
  return [...byVersion.values()].sort((a, b) => b.active - a.active || a.version.localeCompare(b.version));
}

function ManifestDonut({ rows }: { rows: ProjectRolloutRow[] }): ReactElement {
  const data = buildDistribution(rows.filter((row) => row.activeState === "active")).map((row) => ({
    count: row.active,
    status: row.status,
    version: row.version,
  }));
  if (!data.length) return <EmptyState error={null} label="No active manifest data" />;

  return (
    <div className="rounded-md border bg-card p-3">
      <div className="mb-2">
        <p className="text-sm font-semibold">Active Manifest Donut</p>
        <p className="text-xs text-muted-foreground">Active projects by installed framework version.</p>
      </div>
      <ChartContainer className="aspect-auto h-[220px] w-full" config={donutConfig}>
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey="version" />} />
          <Pie data={data} dataKey="count" innerRadius={54} outerRadius={86} paddingAngle={2}>
            {data.map((row) => (
              <Cell fill={colorFor(row.status)} key={row.version} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {data.map((row) => (
          <div key={row.version} className="flex items-center justify-between rounded-md border px-2 py-1 text-xs">
            <span className="font-mono">{row.version}</span>
            <span className="tabular-nums text-muted-foreground">{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ManifestVersions({ rows }: { rows: ProjectRolloutRow[] }): ReactElement {
  const distribution = buildDistribution(rows);
  return (
    <div className="rounded-md border bg-card">
      <div className="border-b px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
        Manifest Versions
      </div>
      <div className="divide-y">
        {distribution.map((row) => (
          <div key={row.version} className="grid grid-cols-[8rem_8rem_8rem_1fr] gap-3 px-4 py-2 text-sm">
            <span className="font-mono">{row.version}</span>
            <Badge variant={row.status === "current" ? "secondary" : "outline"} className="w-fit">
              {row.status === "current" ? "latest" : row.status}
            </Badge>
            <span className="text-muted-foreground">active {row.active}</span>
            <span className="text-muted-foreground">retired {row.retired}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TemplatePins({ adoption, rows }: { adoption: HarnessAdoptionPayload; rows: ProjectRolloutRow[] }): ReactElement {
  const activeRows = rows.filter((row) => row.activeState === "active");
  const pins = Object.entries(adoption.globalTemplateUses ?? {});
  return (
    <div className="rounded-md border bg-card">
      <div className="border-b px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
        Template Pins In Manifests
      </div>
      <div className="divide-y">
        {pins.length ? (
          pins.map(([templateId, latest]) => {
            const current = activeRows.filter((row) => row.project.templateUses?.[templateId] === latest).length;
            return (
              <div key={templateId} className="grid grid-cols-[minmax(12rem,1fr)_8rem_9rem] gap-3 px-4 py-2 text-sm">
                <span className="truncate font-medium">{templateId}</span>
                <Badge variant="secondary" className="w-fit">
                  {latest}
                </Badge>
                <span className="text-muted-foreground">
                  active {current}/{activeRows.length}
                </span>
              </div>
            );
          })
        ) : (
          <div className="px-4 py-3 text-sm text-muted-foreground">No template pins in manifest payload.</div>
        )}
      </div>
    </div>
  );
}

function ProjectsTable({
  rows,
  selectedId,
  onSelect,
}: {
  rows: ProjectRolloutRow[];
  selectedId: string;
  onSelect: (id: string) => void;
}): ReactElement {
  if (!rows.length) return <EmptyState error={null} label="No projects scanned" />;
  return (
    <div className="min-h-0 rounded-md border bg-card">
      <div className="grid grid-cols-[minmax(11rem,1fr)_7rem_8rem_8rem_minmax(9rem,0.8fr)] gap-3 border-b px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
        <span>Project</span>
        <span>Active</span>
        <span>Manifest</span>
        <span>Status</span>
        <span>Next</span>
      </div>
      <ScrollArea className="h-[38vh]">
        {rows.map((row) => {
          const id = projectId(row.project);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`grid w-full grid-cols-[minmax(11rem,1fr)_7rem_8rem_8rem_minmax(9rem,0.8fr)] gap-3 border-b px-4 py-2 text-left text-sm transition last:border-b-0 hover:bg-muted/30 ${
                selectedId === id ? "bg-muted/40" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{id}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{row.project.root}</p>
              </div>
              <span className="text-muted-foreground">{row.activeState === "active" ? "yes" : "no"}</span>
              <Badge variant={row.baselineStatus === "missing" ? "destructive" : "secondary"}>
                {row.installedSpec}
              </Badge>
              {statusBadge(row.baselineStatus)}
              <span className="truncate text-muted-foreground">{row.nextAction}</span>
            </button>
          );
        })}
      </ScrollArea>
    </div>
  );
}

function ProjectInspector({ row }: { row: ProjectRolloutRow | null }): ReactElement {
  if (!row) {
    return <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Select a project.</div>;
  }
  const pins = Object.entries(row.project.templateUses ?? {});
  return (
    <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-md border bg-card">
      <div className="border-b p-4">
        <p className="break-words text-xl font-semibold">{projectId(row.project)}</p>
        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{row.project.root}</p>
      </div>
      <ScrollArea className="min-h-0">
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border p-3">
              <p className="text-[10px] uppercase text-muted-foreground">Manifest</p>
              <p className="text-lg font-semibold">{row.installedSpec}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-[10px] uppercase text-muted-foreground">Active</p>
              <p className="text-lg font-semibold">{row.activeState === "active" ? "yes" : "no"}</p>
            </div>
          </div>
          <section>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Template Pins</h4>
            <div className="mt-2 space-y-2">
              {pins.length ? (
                pins.map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-md border px-3 py-2 text-sm">
                    <span className="truncate">{key}</span>
                    <Badge variant="outline">{value}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No template pins recorded.</p>
              )}
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

export function HarnessRolloutPanel({
  adoption,
  adoptionError,
}: {
  adoption: HarnessAdoptionPayload | null;
  adoptionError: string | null;
}): ReactElement {
  const [filter, setFilter] = useState<ProjectFilter>("active");
  const [selectedId, setSelectedId] = useState("");
  const rows = useMemo(() => (adoption ? buildRows(adoption) : []), [adoption]);

  if (!adoption) {
    return <EmptyState error={adoptionError} label="Adoption scan unavailable" />;
  }

  const filteredRows = rows.filter((row) => {
    if (filter === "all") return true;
    if (filter === "active") return row.activeState === "active";
    if (filter === "retired") return row.activeState === "retired";
    return row.baselineStatus === "missing";
  });
  const activeRows = rows.filter((row) => row.activeState === "active");
  const currentActive = activeRows.filter((row) => row.baselineStatus === "current").length;
  const missingRows = rows.filter((row) => row.baselineStatus === "missing").length;
  const selectedRow =
    filteredRows.find((row) => projectId(row.project) === selectedId) ?? filteredRows[0] ?? null;
  const selectedRowId = selectedRow ? projectId(selectedRow.project) : "";

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-3 py-2">
        <div className="flex flex-wrap gap-2">
          {[
            ["all", "All"],
            ["active", "Active"],
            ["retired", "Retired"],
            ["missing", "Missing manifest"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id as ProjectFilter)}
              className={`rounded-md border px-2.5 py-1 text-xs transition ${
                filter === id ? "border-primary bg-primary text-primary-foreground" : "bg-background"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">Active only defaults on</span>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_0.7fr_0.7fr]">
        <ManifestDonut rows={rows} />
        <Scorecard
          icon={<CheckCircle2 className="size-4" />}
          label="active project score"
          sublabel={`${currentActive}/${activeRows.length} active current`}
          value={percent(currentActive, activeRows.length)}
        />
        <div className="grid gap-3">
          <Scorecard
            icon={<GitPullRequestArrow className="size-4" />}
            label="project states"
            sublabel={`active ${activeRows.length} retired ${rows.length - activeRows.length}`}
            value={String(rows.length)}
          />
          <Scorecard
            icon={<FileCheck2 className="size-4" />}
            label="missing manifests"
            sublabel="active projects without manifest"
            value={String(missingRows)}
          />
        </div>
      </div>

      <ScrollArea className="min-h-0">
        <div className="grid gap-3 pb-3">
          <div className="grid gap-3 xl:grid-cols-2">
            <ManifestVersions rows={rows} />
            <TemplatePins adoption={adoption} rows={rows} />
          </div>
          <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]">
            <ProjectsTable rows={filteredRows} selectedId={selectedRowId} onSelect={setSelectedId} />
            <ProjectInspector row={selectedRow} />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Layers3 className="size-4" />
            <span>Project rollout tracks active project manifest adoption. Template registry details live in Templates.</span>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
