"use client";

import { History, ListFilter, Network, ShieldCheck, Target } from "lucide-react";
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
import { buildStandardsViewModel } from "./skill-os-standards-model";
import type {
  SkillDocsPayload,
  SkillFeatureSummary,
  SkillGraphNode,
  SkillTemplateIntelligencePayload,
  SkillTemplateRolloutRow,
} from "./skill-os-types";

type EnrichedRolloutRow = SkillTemplateRolloutRow & {
  featureRefs: string[];
  heatScore: number;
  invocationCount30d: number;
};
type HealthScore = {
  score: number;
  totalSkills: number;
  weightedSkills: number;
};
type VersionDistributionRow = {
  color: string;
  count: number;
  percent: number;
  status: "latest" | "missing" | "stale";
  version: string;
  versionLabel: string;
};
type FeatureCoverageRow = {
  feature: SkillFeatureSummary;
  hotMissingSkills: string[];
  implementedCount: number;
  latestCount: number;
  missingCount: number;
  staleCount: number;
};

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function enrichRolloutRows({
  docs,
  nodes,
  rows,
  templateFeatureRefsByVersion,
}: {
  docs: SkillDocsPayload | null;
  nodes: SkillGraphNode[];
  rows: SkillTemplateRolloutRow[];
  templateFeatureRefsByVersion: Map<string, string[]>;
}): EnrichedRolloutRow[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  return rows.map((row) => {
    const node = nodeById.get(row.skill_id);
    const heat = node?.heat;
    const frontmatter = docs?.skills[row.skill_id]?.frontmatter ?? {};
    const rowFeatureRefs = Array.isArray(row.feature_refs) ? row.feature_refs.map(String) : [];
    const frontmatterFeatureRefs = Array.isArray(frontmatter.feature_refs)
      ? frontmatter.feature_refs.map(String)
      : [];
    const templateFeatureRefs = templateFeatureRefsByVersion.get(row.template_version) ?? [];
    const featureRefs = [...new Set([...templateFeatureRefs, ...rowFeatureRefs, ...frontmatterFeatureRefs])];
    const heatScore = toNumber(heat?.heat_score);
    const invocationCount30d = toNumber(heat?.invocation_count_30d ?? heat?.invocation_count_window);

    return {
      ...row,
      featureRefs,
      heatScore,
      invocationCount30d,
      tier: row.tier ?? node?.tier ?? 3,
    };
  });
}

function isHotSkill(row: EnrichedRolloutRow): boolean {
  return row.heatScore > 0 || row.invocationCount30d > 0;
}

function isLocalSkill(row: EnrichedRolloutRow): boolean {
  return row.source !== "external";
}

function versionStatus(version: string, currentVersion: string): VersionDistributionRow["status"] {
  if (version === "missing") return "missing";
  if (version === currentVersion) return "latest";
  return "stale";
}

function versionColor(status: VersionDistributionRow["status"], index: number): string {
  if (status === "latest") return "var(--chart-1)";
  if (status === "missing") return "var(--chart-5)";
  const palette = ["var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--muted-foreground)"];
  return palette[index % palette.length] ?? "var(--muted-foreground)";
}

function buildVersionDistribution(
  rows: EnrichedRolloutRow[],
  currentVersion: string,
): VersionDistributionRow[] {
  const countByVersion = new Map<string, number>();
  for (const row of rows) {
    const version = row.template_version || "missing";
    countByVersion.set(version, (countByVersion.get(version) ?? 0) + 1);
  }
  const total = Math.max(1, rows.length);
  return [...countByVersion.entries()]
    .map(([version, count], index) => {
      const status = versionStatus(version, currentVersion);
      return {
        color: versionColor(status, index),
        count,
        percent: Math.round((count / total) * 100),
        status,
        version,
        versionLabel: version === currentVersion ? `${version} (latest)` : version,
      } satisfies VersionDistributionRow;
    })
    .sort((left, right) => {
      if (left.status === "latest") return -1;
      if (right.status === "latest") return 1;
      if (left.status === "missing") return 1;
      if (right.status === "missing") return -1;
      return right.count - left.count || left.version.localeCompare(right.version);
    });
}

function buildTemplateFeatureRefsByVersion(
  templateIntelligence: SkillTemplateIntelligencePayload | null,
): Map<string, string[]> {
  const byVersion = new Map<string, string[]>();
  for (const version of templateIntelligence?.template_versions ?? []) {
    const featureRefs = version.template_metadata?.feature_refs;
    if (!Array.isArray(featureRefs)) continue;
    byVersion.set(version.version, featureRefs.map(String));
  }
  return byVersion;
}

function buildFeatureRows({
  features,
  localRows,
}: {
  features: SkillFeatureSummary[];
  localRows: EnrichedRolloutRow[];
}): FeatureCoverageRow[] {
  return features
    .map((feature) => {
      const implementedRows = localRows.filter((row) => row.featureRefs.includes(feature.id));
      const latestCount = implementedRows.filter((row) => row.status === "current").length;
      const staleCount = implementedRows.length - latestCount;
      const missingRows = localRows.filter((row) => !row.featureRefs.includes(feature.id));
      const hotMissingSkills = missingRows
        .filter(isHotSkill)
        .sort((left, right) => right.heatScore - left.heatScore || left.skill_id.localeCompare(right.skill_id))
        .map((row) => row.skill_id);
      return {
        feature,
        hotMissingSkills,
        implementedCount: implementedRows.length,
        latestCount,
        missingCount: missingRows.length,
        staleCount,
      } satisfies FeatureCoverageRow;
    })
    .sort(
      (left, right) =>
        right.hotMissingSkills.length - left.hotMissingSkills.length ||
        right.missingCount - left.missingCount ||
        left.feature.id.localeCompare(right.feature.id),
    );
}

function skillHealthScore({
  features,
  rows,
}: {
  features: SkillFeatureSummary[];
  rows: EnrichedRolloutRow[];
}): HealthScore {
  const eligibleFeatureIds = new Set(features.map((feature) => feature.id));
  if (eligibleFeatureIds.size === 0 || rows.length === 0) {
    return { score: 0, totalSkills: rows.length, weightedSkills: 0 };
  }
  const weightedSkills = rows.filter(isHotSkill).length;
  const totalWeight = rows.reduce(
    (sum, row) => sum + Math.max(1, row.invocationCount30d || 0, row.heatScore || 0),
    0,
  );
  if (totalWeight === 0) return { score: 0, totalSkills: rows.length, weightedSkills };
  const weightedCoverage = rows.reduce((sum, row) => {
    const implementedCount = row.featureRefs.filter((featureId) =>
      eligibleFeatureIds.has(featureId),
    ).length;
    const featureRatio = implementedCount / eligibleFeatureIds.size;
    return sum + Math.max(1, row.invocationCount30d || 0, row.heatScore || 0) * featureRatio;
  }, 0);
  return {
    score: Math.round((weightedCoverage / totalWeight) * 100),
    totalSkills: rows.length,
    weightedSkills,
  };
}

function CompactMetric({
  icon,
  label,
  value,
}: {
  icon: ReactElement;
  label: string;
  value: string;
}): ReactElement {
  return (
    <div className="flex items-center gap-2 border-r px-3 py-2 last:border-r-0">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-xs uppercase text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function StandardsHeader({
  generatedAt,
  hasGeneratedArtifact,
  summary,
  templateError,
}: {
  generatedAt: string;
  hasGeneratedArtifact: boolean;
  summary: ReturnType<typeof buildStandardsViewModel>["summary"];
  templateError: string | null;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center text-sm">
        <CompactMetric
          icon={<ShieldCheck className="size-4" />}
          label="current"
          value={String(summary.current)}
        />
        <CompactMetric
          icon={<ListFilter className="size-4" />}
          label="drift"
          value={String(summary.missing + summary.stale)}
        />
        <CompactMetric
          icon={<History className="size-4" />}
          label="versions"
          value={String(summary.templates)}
        />
        <CompactMetric
          icon={<Network className="size-4" />}
          label="features"
          value={String(summary.features)}
        />
        <span className="px-3 text-xs text-muted-foreground">
          {hasGeneratedArtifact
            ? `generated ${generatedAt}`
            : `artifact unavailable: ${templateError ?? "not loaded"}`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={hasGeneratedArtifact ? "secondary" : "outline"}>
          {hasGeneratedArtifact ? "Farplane artifact" : "frontmatter fallback"}
        </Badge>
      </div>
    </div>
  );
}

function WeightedHealthCard({ health }: { health: HealthScore }): ReactElement {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
        <Target className="size-4" />
        <span>Weighted Skill Health</span>
      </div>
      <p className="mt-5 text-5xl font-semibold tabular-nums">{health.score}%</p>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        All local skills count; invocation and heat signals increase weight when present.
        <span className="ml-1 font-mono">
          {health.weightedSkills} weighted / {health.totalSkills} total skills
        </span>
      </p>
    </div>
  );
}

const templateVersionChartConfig = {
  count: { color: "var(--chart-1)", label: "Skills" },
} satisfies ChartConfig;

function TemplateVersionPie({
  distribution,
}: {
  distribution: VersionDistributionRow[];
}): ReactElement {
  const total = distribution.reduce((sum, row) => sum + row.count, 0);
  return (
    <div className="rounded-md border bg-card p-4">
      <div>
        <p className="text-sm font-semibold">Skill Template Versions</p>
        <p className="text-xs text-muted-foreground">All local skills grouped by adopted skill-template version.</p>
      </div>
      <ChartContainer
        className="mx-auto aspect-auto h-[240px] w-full max-w-[360px]"
        config={templateVersionChartConfig}
        initialDimension={{ height: 240, width: 320 }}
      >
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey="versionLabel" />} />
          <Pie
            cx="50%"
            cy="50%"
            data={distribution}
            dataKey="count"
            innerRadius={54}
            isAnimationActive={false}
            nameKey="versionLabel"
            outerRadius={88}
            paddingAngle={2}
          >
            {distribution.map((row) => (
              <Cell fill={row.color} key={row.version} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="mt-2 grid gap-2">
        {distribution.map((row) => (
          <div key={row.version} className="flex items-center justify-between rounded-md border px-2 py-1 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2 rounded-full" style={{ backgroundColor: row.color }} />
              <span className="truncate font-mono">{row.versionLabel}</span>
              <Badge variant={row.status === "latest" ? "secondary" : "outline"} className="h-5 px-1.5 text-[10px]">
                {row.status}
              </Badge>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {row.count} skills · {row.percent}%
            </span>
          </div>
        ))}
        {distribution.length === 0 ? (
          <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            No local skill template versions found.
          </div>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{total} local skills counted.</p>
    </div>
  );
}

function CoverageBar({ row }: { row: FeatureCoverageRow }): ReactElement {
  const total = Math.max(1, row.latestCount + row.staleCount + row.missingCount);
  const latestPct = (row.latestCount / total) * 100;
  const stalePct = (row.staleCount / total) * 100;
  const missingPct = (row.missingCount / total) * 100;
  return (
    <div className="min-w-0">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="bg-[var(--chart-1)]" style={{ width: `${latestPct}%` }} />
        <div className="bg-[var(--chart-3)]" style={{ width: `${stalePct}%` }} />
        <div className="bg-[var(--chart-5)]" style={{ width: `${missingPct}%` }} />
      </div>
      <div className="mt-1 flex gap-3 text-[11px] text-muted-foreground">
        <span>latest {row.latestCount}</span>
        {row.staleCount ? <span>stale {row.staleCount}</span> : null}
        <span>missing {row.missingCount}</span>
      </div>
    </div>
  );
}

function FeatureDetail({ row }: { row: FeatureCoverageRow | null }): ReactElement {
  if (!row) {
    return (
      <div className="h-full rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        Select a feature row.
      </div>
    );
  }
  return (
    <aside className="h-full rounded-md border bg-card p-4">
      <p className="font-mono text-sm text-muted-foreground">{row.feature.id}</p>
      <h3 className="mt-2 text-lg font-semibold">{row.feature.name}</h3>
      <p className="mt-3 line-clamp-5 text-sm text-muted-foreground">
        {row.feature.known_limits ?? "No feature detail recorded."}
      </p>
      <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-md border p-2">
          <p className="text-xs uppercase text-muted-foreground">latest</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{row.latestCount}</p>
        </div>
        <div className="rounded-md border p-2">
          <p className="text-xs uppercase text-muted-foreground">missing</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{row.missingCount}</p>
        </div>
        <div className="rounded-md border p-2">
          <p className="text-xs uppercase text-muted-foreground">hot</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{row.hotMissingSkills.length}</p>
        </div>
      </div>
      <div className="mt-5">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Hot Missing Skills</p>
        <div className="mt-2 space-y-1">
          {row.hotMissingSkills.slice(0, 12).map((skillId) => (
            <div key={skillId} className="rounded-md border px-2 py-1 font-mono text-xs">
              {skillId}
            </div>
          ))}
          {row.hotMissingSkills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hot skills are missing this feature.</p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function RolloutMatrix({
  currentTemplateVersion,
  docs,
  features,
  nodes,
  rows,
  templateIntelligence,
}: {
  currentTemplateVersion: string;
  docs: SkillDocsPayload | null;
  features: SkillFeatureSummary[];
  nodes: SkillGraphNode[];
  rows: SkillTemplateRolloutRow[];
  templateIntelligence: SkillTemplateIntelligencePayload | null;
}): ReactElement {
  const templateFeatureRefsByVersion = useMemo(
    () => buildTemplateFeatureRefsByVersion(templateIntelligence),
    [templateIntelligence],
  );
  const eligibleFeatureIds = useMemo(
    () => new Set(templateFeatureRefsByVersion.get(currentTemplateVersion) ?? []),
    [currentTemplateVersion, templateFeatureRefsByVersion],
  );
  const eligibleFeatures = useMemo(() => {
    if (eligibleFeatureIds.size === 0) return features;
    const featureById = new Map(features.map((feature) => [feature.id, feature]));
    return [...eligibleFeatureIds].map(
      (featureId) =>
        featureById.get(featureId) ?? {
          id: featureId,
          known_limits:
            "This feature is declared by the skill template metadata but is not exported as a skill-category feature summary.",
          name: "Feature metadata unavailable",
          status: "template-declared",
        },
    );
  }, [eligibleFeatureIds, features]);
  const enrichedRows = useMemo(
    () => enrichRolloutRows({ docs, nodes, rows, templateFeatureRefsByVersion }),
    [docs, nodes, rows, templateFeatureRefsByVersion],
  );
  const localRows = useMemo(() => enrichedRows.filter(isLocalSkill), [enrichedRows]);
  const featureRows = useMemo(
    () => buildFeatureRows({ features: eligibleFeatures, localRows }),
    [eligibleFeatures, localRows],
  );
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>("");
  const selectedRow =
    featureRows.find((row) => row.feature.id === selectedFeatureId) ?? featureRows[0] ?? null;
  const health = useMemo(
    () => skillHealthScore({ features: eligibleFeatures, rows: localRows }),
    [eligibleFeatures, localRows],
  );
  const versionDistribution = useMemo(
    () => buildVersionDistribution(localRows, currentTemplateVersion),
    [currentTemplateVersion, localRows],
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(18rem,0.9fr)_minmax(20rem,1.1fr)]">
        <TemplateVersionPie distribution={versionDistribution} />
        <WeightedHealthCard health={health} />
      </div>

      <div className="grid min-h-[30rem] gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-h-0 rounded-md border bg-card">
          <div className="grid grid-cols-[minmax(14rem,0.8fr)_minmax(14rem,1fr)_7rem] gap-3 border-b px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
            <span>Feature</span>
            <span>Coverage</span>
            <span>Hot Missing</span>
          </div>
          <div>
            {featureRows.map((row) => (
              <button
                key={row.feature.id}
                type="button"
                onClick={() => setSelectedFeatureId(row.feature.id)}
                className={`grid w-full grid-cols-[minmax(14rem,0.8fr)_minmax(14rem,1fr)_7rem] gap-3 border-b px-4 py-3 text-left text-sm last:border-b-0 ${
                  selectedRow?.feature.id === row.feature.id ? "bg-muted/50" : "hover:bg-muted/30"
                }`}
              >
                <span className="min-w-0">
                  <span className="block font-mono text-xs text-muted-foreground">
                    {row.feature.id}
                  </span>
                  <span className="block truncate font-medium">{row.feature.name}</span>
                </span>
                <CoverageBar row={row} />
                <span className="font-mono text-sm tabular-nums">{row.hotMissingSkills.length}</span>
              </button>
            ))}
            {featureRows.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No skill feature coverage rows are available yet.
              </div>
            ) : null}
          </div>
        </div>
        <FeatureDetail row={selectedRow} />
      </div>
    </div>
  );
}

function TemplateVersions({
  versions,
}: {
  versions: ReturnType<typeof buildStandardsViewModel>["templateVersions"];
}): ReactElement {
  if (versions.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        No template version releases are available yet.
      </div>
    );
  }
  return (
    <div className="min-h-0 rounded-md border bg-card">
      <div className="grid grid-cols-[7rem_8rem_8rem_minmax(16rem,1fr)_minmax(16rem,1fr)] gap-3 border-b px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
        <span>Version</span>
        <span>First</span>
        <span>Latest</span>
        <span>Release Summary</span>
        <span>Archive</span>
      </div>
      <div>
        {versions
          .slice()
          .reverse()
          .map((version) => (
            <div
              key={version.version}
              className="grid grid-cols-[7rem_8rem_8rem_minmax(16rem,1fr)_minmax(16rem,1fr)] gap-3 border-b px-4 py-2 text-sm last:border-b-0"
            >
              <Badge variant="secondary" className="w-fit">
                {version.version}
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">
                {version.source_commit ?? "--"}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {version.latest_commit ?? "--"}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {version.latest_summary ?? version.summary ?? "Template release"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {version.release_count ?? 0} archived snapshots · {version.introduced_at ?? "--"} to{" "}
                  {version.latest_at ?? "--"}
                </span>
              </span>
              <span className="truncate font-mono text-xs text-muted-foreground">
                {version.snapshot_path ?? "--"}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

export function SkillOsRolloutTab({
  docs,
  nodes,
  templateError,
  templateIntelligence,
}: {
  docs: SkillDocsPayload | null;
  nodes: SkillGraphNode[];
  templateError: string | null;
  templateIntelligence: SkillTemplateIntelligencePayload | null;
}): ReactElement {
  const model = useMemo(
    () => buildStandardsViewModel({ docs, nodes, templateIntelligence }),
    [docs, nodes, templateIntelligence],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <StandardsHeader
        generatedAt={model.generatedAt}
        hasGeneratedArtifact={model.hasGeneratedArtifact}
        summary={model.summary}
        templateError={templateError}
      />

      <ScrollArea className="min-h-0 flex-1">
        <RolloutMatrix
          currentTemplateVersion={model.currentTemplateVersion}
          docs={docs}
          features={model.features}
          nodes={nodes}
          rows={model.rolloutRows}
          templateIntelligence={templateIntelligence}
        />
      </ScrollArea>
    </div>
  );
}

export function SkillOsTemplatesTab({
  docs,
  nodes,
  templateError,
  templateIntelligence,
}: {
  docs: SkillDocsPayload | null;
  nodes: SkillGraphNode[];
  templateError: string | null;
  templateIntelligence: SkillTemplateIntelligencePayload | null;
}): ReactElement {
  const model = useMemo(
    () => buildStandardsViewModel({ docs, nodes, templateIntelligence }),
    [docs, nodes, templateIntelligence],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <StandardsHeader
        generatedAt={model.generatedAt}
        hasGeneratedArtifact={model.hasGeneratedArtifact}
        summary={model.summary}
        templateError={templateError}
      />
      <ScrollArea className="min-h-0 flex-1">
        <TemplateVersions versions={model.templateVersions} />
      </ScrollArea>
    </div>
  );
}
