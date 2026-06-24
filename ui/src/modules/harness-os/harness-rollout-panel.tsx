"use client";

/**
 * Ownership: Harness OS rollout scanner view.
 * Inputs: read-only project adoption payload from the Vite bridge.
 * Outputs: project-level latest-adoption dashboard and remediation rows.
 * Side effects: none.
 */

import { AlertTriangle, CheckCircle2, FileCheck2, GitPullRequestArrow, Layers3 } from "lucide-react";
import { type ReactElement, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { HarnessAdoptionPayload, HarnessAdoptionProject } from "./harness-os-types";

type ProjectRolloutRow = {
  issueCount: number;
  latestTemplatePairs: number;
  project: HarnessAdoptionProject;
  staleTemplatePairs: number;
  templatePairs: number;
};

const projectConfig = {
  latest: { color: "var(--chart-1)", label: "Latest" },
  stale: { color: "var(--chart-3)", label: "Stale or missing" },
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

function buildRows(adoption: HarnessAdoptionPayload): ProjectRolloutRow[] {
  const expectedTemplates = adoption.globalTemplateUses ?? {};
  const templateKeys = Object.keys(expectedTemplates);
  return (adoption.projects ?? []).map((project) => {
    const uses = project.templateUses ?? {};
    const latestTemplatePairs = templateKeys.filter((key) => uses[key] === expectedTemplates[key]).length;
    const templatePairs = templateKeys.length;
    const staleTemplatePairs = Math.max(0, templatePairs - latestTemplatePairs);
    return {
      issueCount: (project.issues?.length ?? 0) + staleTemplatePairs,
      latestTemplatePairs,
      project,
      staleTemplatePairs,
      templatePairs,
    };
  });
}

function percent(numerator: number, denominator: number): string {
  if (!denominator) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function RolloutChart({ rows }: { rows: ProjectRolloutRow[] }): ReactElement {
  const chartData = rows
    .map((row) => ({
      latest: row.latestTemplatePairs,
      name: projectId(row.project),
      stale: row.staleTemplatePairs,
    }))
    .slice(0, 12);

  if (!chartData.length) {
    return <EmptyState error={null} label="No rollout chart data" />;
  }

  return (
    <div className="rounded-md border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Project Template Adoption</p>
          <p className="text-xs text-muted-foreground">Latest versus stale/missing template pins by project.</p>
        </div>
        <Badge variant="outline">{chartData.length} shown</Badge>
      </div>
      <ChartContainer className="aspect-auto h-[220px] w-full" config={projectConfig}>
        <BarChart data={chartData} layout="vertical" margin={{ bottom: 8, left: 8, right: 16, top: 8 }}>
          <CartesianGrid horizontal={false} strokeDasharray="4 6" />
          <XAxis allowDecimals={false} hide type="number" />
          <YAxis
            axisLine={false}
            dataKey="name"
            tickLine={false}
            tickMargin={8}
            type="category"
            width={112}
          />
          <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey="latest" fill="var(--color-latest)" isAnimationActive={false} radius={2} stackId="a" />
          <Bar dataKey="stale" fill="var(--color-stale)" isAnimationActive={false} radius={2} stackId="a" />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

function ProjectsTable({ rows }: { rows: ProjectRolloutRow[] }): ReactElement {
  if (!rows.length) return <EmptyState error={null} label="No projects scanned" />;
  return (
    <div className="min-h-0 rounded-md border bg-card">
      <div className="grid grid-cols-[minmax(10rem,0.9fr)_8rem_9rem_9rem_minmax(16rem,1.2fr)] gap-3 border-b px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
        <span>Project</span>
        <span>Spec</span>
        <span>Templates</span>
        <span>Debt</span>
        <span>Template Pins</span>
      </div>
      <ScrollArea className="h-[42vh]">
        {rows.map((row) => (
          <div
            key={projectId(row.project)}
            className="grid grid-cols-[minmax(10rem,0.9fr)_8rem_9rem_9rem_minmax(16rem,1.2fr)] gap-3 border-b px-4 py-2 text-sm last:border-b-0"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{row.project.projectId ?? "unknown project"}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{row.project.root}</p>
            </div>
            <Badge variant={row.project.specVersion === row.project.expectedSpecVersion ? "secondary" : "outline"}>
              {row.project.specVersion ?? "missing"}
            </Badge>
            <span className="text-muted-foreground">
              {row.latestTemplatePairs}/{row.templatePairs || 0} latest
            </span>
            <Badge variant={row.issueCount ? "destructive" : "secondary"}>
              {row.issueCount ? `${row.issueCount} item${row.issueCount === 1 ? "" : "s"}` : "clear"}
            </Badge>
            <span className="truncate font-mono text-xs text-muted-foreground">
              {Object.entries(row.project.templateUses ?? {})
                .map(([key, value]) => `${key}@${value}`)
                .join(", ") || "--"}
            </span>
          </div>
        ))}
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
  const rows = useMemo(() => (adoption ? buildRows(adoption) : []), [adoption]);
  const projects = rows.length;
  const manifests = adoption?.counts?.manifests ?? rows.filter((row) => row.project.manifestExists).length;
  const latestSpec = rows.filter(
    (row) => row.project.specVersion && row.project.specVersion === row.project.expectedSpecVersion,
  ).length;
  const latestTemplatePairs = rows.reduce((total, row) => total + row.latestTemplatePairs, 0);
  const templatePairs = rows.reduce((total, row) => total + row.templatePairs, 0);
  const cleanProjects = rows.filter((row) => row.issueCount === 0).length;

  if (!adoption) {
    return <EmptyState error={adoptionError} label="Adoption scan unavailable" />;
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
      <div className="grid gap-3 md:grid-cols-4">
        <Scorecard
          icon={<GitPullRequestArrow className="size-4" />}
          label="projects latest"
          sublabel={`${latestSpec}/${projects} on expected spec`}
          value={percent(latestSpec, projects)}
        />
        <Scorecard
          icon={<Layers3 className="size-4" />}
          label="template pins"
          sublabel={`${latestTemplatePairs}/${templatePairs} latest`}
          value={percent(latestTemplatePairs, templatePairs)}
        />
        <Scorecard
          icon={<CheckCircle2 className="size-4" />}
          label="clean projects"
          sublabel={`${cleanProjects}/${projects} with no rollout debt`}
          value={percent(cleanProjects, projects)}
        />
        <Scorecard
          icon={<FileCheck2 className="size-4" />}
          label="manifests"
          sublabel={`${manifests}/${projects} project manifests`}
          value={String(manifests)}
        />
      </div>

      <RolloutChart rows={rows} />
      <ProjectsTable rows={[...rows].sort((a, b) => b.issueCount - a.issueCount)} />
    </div>
  );
}
