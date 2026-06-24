"use client";

/**
 * Ownership: Harness OS template tracking surface.
 * Inputs: read-only template-tracking, adoption, graph, and skill rollout payloads.
 * Outputs: latest-adoption charts plus actionable template and skill worklists.
 * Side effects: none.
 */

import { AlertTriangle, Boxes, CheckCircle2, Flame, Gauge, Search } from "lucide-react";
import { type ReactElement, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  HarnessAdoptionPayload,
  HarnessGraphPayload,
  HarnessSkillRolloutPayload,
  HarnessSkillRolloutRow,
  HarnessTemplateTrackingFamily,
  HarnessTemplateTrackingPayload,
  HarnessTemplateTrackingStatus,
} from "./harness-os-types";

type TemplateTrackingRow = HarnessTemplateTrackingFamily & {
  currentConsumers: number;
  debt: number;
  distribution: Record<string, number>;
  latestPercent: number;
  missingConsumers: number;
  staleConsumers: number;
  totalConsumers: number;
};

type SkillPriorityRow = HarnessSkillRolloutRow & {
  currentness: number;
  debtScore: number;
  heatScore: number;
  label: string;
  priorityScore: number;
};

const distributionConfig = {
  currentConsumers: { color: "var(--chart-1)", label: "Latest" },
  staleConsumers: { color: "var(--chart-3)", label: "Stale" },
  missingConsumers: { color: "var(--chart-5)", label: "Missing" },
} satisfies ChartConfig;

const debtConfig = {
  debt: { color: "var(--chart-3)", label: "Debt" },
} satisfies ChartConfig;

const skillConfig = {
  priorityScore: { color: "var(--chart-2)", label: "Skill priority" },
} satisfies ChartConfig;

function statusBadge(status: HarnessTemplateTrackingStatus): ReactElement {
  if (status === "tracked") return <Badge variant="secondary">tracked</Badge>;
  if (status === "missing") return <Badge variant="destructive">missing</Badge>;
  if (status === "unversioned") return <Badge variant="outline">unversioned</Badge>;
  return <Badge variant="outline">scanner gap</Badge>;
}

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

function EmptyState({ error }: { error: string | null }): ReactElement {
  return (
    <div className="grid h-full min-h-[20rem] place-items-center rounded-md border border-dashed bg-muted/10">
      <div className="max-w-md p-6 text-center">
        <AlertTriangle className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-3 font-semibold">Template tracking scan unavailable</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {error ?? "No template-tracking payload has been loaded yet."}
        </p>
      </div>
    </div>
  );
}

function percent(numerator: number, denominator: number): string {
  if (!denominator) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function compactLabel(label: string): string {
  return label.length > 16 ? `${label.slice(0, 13)}...` : label;
}

function buildRows({
  adoption,
  skillRollout,
  templateTracking,
}: {
  adoption: HarnessAdoptionPayload | null;
  skillRollout: HarnessSkillRolloutPayload | null;
  templateTracking: HarnessTemplateTrackingPayload;
}): TemplateTrackingRow[] {
  return templateTracking.families.map((family) => {
    const summary = skillRollout?.templateRolloutSummary?.[family.familyId];
    const currentConsumers = summary?.by_status?.current ?? 0;
    const staleConsumers = summary?.by_status?.stale ?? 0;
    const missingConsumers = summary?.by_status?.missing ?? 0;
    const totalConsumers =
      summary?.total_consumers ??
      family.consumerCount ??
      currentConsumers + staleConsumers + missingConsumers;
    const distribution = summary?.by_status ?? {};
    const currentVersion =
      summary?.current_version ??
      family.currentVersion ??
      adoption?.globalTemplateUses?.[family.familyId];

    return {
      ...family,
      consumerCount: totalConsumers,
      currentConsumers,
      currentVersion,
      debt: staleConsumers + missingConsumers,
      distribution,
      latestPercent: totalConsumers ? Math.round((currentConsumers / totalConsumers) * 100) : 0,
      missingConsumers,
      source: summary ? "derived" : family.source,
      staleConsumers,
      status: summary ? "tracked" : family.status,
      totalConsumers,
    };
  });
}

function currentness(status?: string): number {
  if (status === "current" || status === "external") return 100;
  if (status === "stale") return 45;
  if (status === "missing") return 15;
  return 0;
}

function buildSkillRows({
  graph,
  skillRollout,
}: {
  graph: HarnessGraphPayload | null;
  skillRollout: HarnessSkillRolloutPayload | null;
}): SkillPriorityRow[] {
  const heatBySkill = new Map(
    (graph?.nodes ?? [])
      .filter((node) => node.kind === "skill")
      .map((node) => [node.id.replace(/^skill:/, ""), node.heat?.heat_score ?? 0]),
  );

  return (skillRollout?.skills ?? [])
    .map((skill) => {
      const heatScore = heatBySkill.get(skill.skillId ?? "") ?? 0;
      const debtScore =
        (skill.status === "current" || skill.status === "external" ? 0 : 40) +
        (skill.eval ? 0 : 20) +
        (skill.hasChecklist || skill.qaChecklist ? 0 : 10) +
        (skill.skillUi ? 0 : 10);
      const tierPriority = Math.max(0, 4 - (skill.tier ?? 3)) * 8;
      return {
        ...skill,
        currentness: currentness(skill.status),
        debtScore,
        heatScore,
        label: skill.skillId ?? skill.path ?? "unknown skill",
        priorityScore: heatScore + debtScore + tierPriority,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

function DistributionChart({ rows }: { rows: TemplateTrackingRow[] }): ReactElement {
  const data = rows
    .filter((row) => row.totalConsumers > 0)
    .map((row) => ({
      currentConsumers: row.currentConsumers,
      label: compactLabel(row.familyId),
      missingConsumers: row.missingConsumers,
      staleConsumers: row.staleConsumers,
    }))
    .slice(0, 10);

  if (!data.length) {
    return <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">No distribution data yet.</div>;
  }

  return (
    <div className="rounded-md border bg-card p-3">
      <div className="mb-2">
        <p className="text-sm font-semibold">Version Distribution by Family</p>
        <p className="text-xs text-muted-foreground">Latest, stale, and missing consumers per template family.</p>
      </div>
      <ChartContainer className="aspect-auto h-[240px] w-full" config={distributionConfig}>
        <BarChart data={data} layout="vertical" margin={{ bottom: 8, left: 8, right: 16, top: 8 }}>
          <CartesianGrid horizontal={false} strokeDasharray="4 6" />
          <XAxis allowDecimals={false} hide type="number" />
          <YAxis axisLine={false} dataKey="label" tickLine={false} tickMargin={8} type="category" width={160} />
          <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey="currentConsumers" fill="var(--color-currentConsumers)" isAnimationActive={false} radius={2} stackId="a" />
          <Bar dataKey="staleConsumers" fill="var(--color-staleConsumers)" isAnimationActive={false} radius={2} stackId="a" />
          <Bar dataKey="missingConsumers" fill="var(--color-missingConsumers)" isAnimationActive={false} radius={2} stackId="a" />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

function DebtChart({ rows }: { rows: TemplateTrackingRow[] }): ReactElement {
  const data = [...rows]
    .filter((row) => row.debt > 0)
    .sort((a, b) => b.debt - a.debt)
    .slice(0, 8)
    .map((row) => ({ debt: row.debt, label: compactLabel(row.familyId) }));

  if (!data.length) {
    return (
      <div className="rounded-md border bg-card p-4">
        <p className="text-sm font-semibold">Rollout Debt</p>
        <p className="mt-2 text-sm text-muted-foreground">No stale or missing template consumers found.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card p-3">
      <div className="mb-2">
        <p className="text-sm font-semibold">Rollout Debt Leaderboard</p>
        <p className="text-xs text-muted-foreground">Template families with the most stale or missing consumers.</p>
      </div>
      <ChartContainer className="aspect-auto h-[240px] w-full" config={debtConfig}>
        <BarChart data={data} layout="vertical" margin={{ bottom: 8, left: 8, right: 16, top: 8 }}>
          <CartesianGrid horizontal={false} strokeDasharray="4 6" />
          <XAxis allowDecimals={false} hide type="number" />
          <YAxis axisLine={false} dataKey="label" tickLine={false} tickMargin={8} type="category" width={160} />
          <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey="debt" fill="var(--color-debt)" isAnimationActive={false} radius={2} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

function SkillPriorityChart({ rows }: { rows: SkillPriorityRow[] }): ReactElement {
  const data = rows.slice(0, 40);
  if (!data.length) {
    return <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">No skill rollout data yet.</div>;
  }

  return (
    <div className="rounded-md border bg-card p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Skill Heat x Maintenance Priority</p>
          <p className="text-xs text-muted-foreground">Hot/stale/core skills rise first; currentness moves right.</p>
        </div>
        <Badge variant="outline">top {data.length}</Badge>
      </div>
      <ChartContainer className="aspect-auto h-[260px] w-full" config={skillConfig}>
        <ScatterChart margin={{ bottom: 16, left: 8, right: 16, top: 12 }}>
          <CartesianGrid strokeDasharray="4 6" />
          <XAxis
            dataKey="currentness"
            domain={[0, 100]}
            name="currentness"
            tickFormatter={(value) => `${value}%`}
            type="number"
          />
          <YAxis dataKey="priorityScore" name="priority" type="number" />
          <ZAxis dataKey="debtScore" range={[48, 180]} />
          <ChartTooltip content={<ChartTooltipContent nameKey="label" />} cursor={{ strokeDasharray: "4 4" }} />
          <Scatter data={data} dataKey="priorityScore" isAnimationActive={false} name="priority">
            {data.map((skill) => (
              <Cell
                fill={
                  skill.status === "current"
                    ? "var(--chart-1)"
                    : skill.status === "stale"
                      ? "var(--chart-3)"
                      : "var(--chart-5)"
                }
                key={skill.label}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ChartContainer>
    </div>
  );
}

function TemplateRows({ rows }: { rows: TemplateTrackingRow[] }): ReactElement {
  return (
    <div className="min-h-0 rounded-md border bg-card">
      <div className="grid grid-cols-[minmax(12rem,0.8fr)_7rem_8rem_8rem_8rem_minmax(14rem,1fr)] gap-3 border-b px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
        <span>Family</span>
        <span>Latest</span>
        <span>Adopted</span>
        <span>Debt</span>
        <span>Status</span>
        <span>Evidence</span>
      </div>
      <ScrollArea className="h-[32vh]">
        {rows.map((row) => (
          <div
            key={row.familyId}
            className="grid grid-cols-[minmax(12rem,0.8fr)_7rem_8rem_8rem_8rem_minmax(14rem,1fr)] gap-3 border-b px-4 py-2 text-sm last:border-b-0"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{row.label}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{row.familyId}</p>
            </div>
            <Badge variant={row.currentVersion ? "secondary" : "outline"} className="w-fit">
              {row.currentVersion ?? "--"}
            </Badge>
            <span className="text-muted-foreground">
              {row.currentConsumers}/{row.totalConsumers || 0} latest
            </span>
            <Badge variant={row.debt ? "destructive" : "secondary"}>
              {row.debt ? `${row.debt} item${row.debt === 1 ? "" : "s"}` : "clear"}
            </Badge>
            {statusBadge(row.status)}
            <div className="min-w-0">
              <p className="truncate font-mono text-xs text-muted-foreground">
                {(row.paths ?? []).slice(0, 2).join(", ") || row.source}
              </p>
              {row.notes ? <p className="truncate text-xs text-muted-foreground">{row.notes}</p> : null}
            </div>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}

function SkillWorklist({ rows }: { rows: SkillPriorityRow[] }): ReactElement {
  return (
    <div className="min-h-0 rounded-md border bg-card">
      <div className="grid grid-cols-[minmax(12rem,1fr)_7rem_7rem_7rem_7rem_8rem] gap-3 border-b px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
        <span>Skill</span>
        <span>Status</span>
        <span>Heat</span>
        <span>Eval</span>
        <span>UI</span>
        <span>Priority</span>
      </div>
      <ScrollArea className="h-[32vh]">
        {rows.slice(0, 24).map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[minmax(12rem,1fr)_7rem_7rem_7rem_7rem_8rem] gap-3 border-b px-4 py-2 text-sm last:border-b-0"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{row.label}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{row.path}</p>
            </div>
            <Badge variant={row.status === "current" ? "secondary" : "outline"}>{row.status ?? "unknown"}</Badge>
            <span className="tabular-nums text-muted-foreground">{row.heatScore}</span>
            <span className="text-muted-foreground">{row.eval ? "yes" : "missing"}</span>
            <span className="text-muted-foreground">{row.skillUi ? "yes" : "missing"}</span>
            <Badge variant={row.priorityScore > 60 ? "destructive" : "outline"}>{Math.round(row.priorityScore)}</Badge>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}

export function TemplateTrackingPanel({
  adoption,
  error,
  graph,
  skillRollout,
  templateTracking,
}: {
  adoption: HarnessAdoptionPayload | null;
  error: string | null;
  graph: HarnessGraphPayload | null;
  skillRollout: HarnessSkillRolloutPayload | null;
  templateTracking: HarnessTemplateTrackingPayload | null;
}): ReactElement {
  const rows = useMemo(() => {
    if (!templateTracking) return [];
    return buildRows({ adoption, skillRollout, templateTracking }).sort((a, b) => b.debt - a.debt);
  }, [adoption, skillRollout, templateTracking]);
  const skillRows = useMemo(() => buildSkillRows({ graph, skillRollout }), [graph, skillRollout]);

  if (!templateTracking) return <EmptyState error={error} />;

  const currentConsumers = rows.reduce((total, row) => total + row.currentConsumers, 0);
  const totalConsumers = rows.reduce((total, row) => total + row.totalConsumers, 0);
  const debt = rows.reduce((total, row) => total + row.debt, 0);
  const hotSkillDebt = skillRows.filter((row) => row.priorityScore > 60).length;

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="grid gap-3 md:grid-cols-4">
        <Scorecard
          icon={<CheckCircle2 className="size-4" />}
          label="latest adoption"
          sublabel={`${currentConsumers}/${totalConsumers} consumers latest`}
          value={percent(currentConsumers, totalConsumers)}
        />
        <Scorecard icon={<Boxes className="size-4" />} label="families" sublabel="tracked template families" value={String(rows.length)} />
        <Scorecard icon={<Search className="size-4" />} label="rollout debt" sublabel="stale or missing consumers" value={String(debt)} />
        <Scorecard icon={<Flame className="size-4" />} label="skill priority" sublabel="hot/stale/core skill candidates" value={String(hotSkillDebt)} />
      </div>

      <ScrollArea className="min-h-0">
        <div className="grid gap-3 pb-3 xl:grid-cols-2">
          <DistributionChart rows={rows} />
          <DebtChart rows={rows} />
          <SkillPriorityChart rows={skillRows} />
          <div className="rounded-md border bg-card p-3">
            <div className="mb-3 flex items-center gap-2">
              <Gauge className="size-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold">Policy Note</p>
                <p className="text-xs text-muted-foreground">
                  Ticket templates should be judged on new and active tickets; archived tickets are historical reference, not rollout debt.
                </p>
              </div>
            </div>
            <div className="grid gap-2 text-sm text-muted-foreground">
              <p>Use Template Tracking to push template families to latest.</p>
              <p>Use the Skill priority view to decide which stale or unrendered skills deserve maintenance first.</p>
              <p>Trend lines should wait until scans persist snapshots.</p>
            </div>
          </div>
          <TemplateRows rows={rows} />
          <SkillWorklist rows={skillRows} />
        </div>
      </ScrollArea>
    </div>
  );
}
