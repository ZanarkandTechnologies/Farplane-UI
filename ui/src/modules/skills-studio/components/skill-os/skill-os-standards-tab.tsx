"use client";

import { History, ListFilter, Network, ShieldCheck } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tierColor } from "./skill-os-constants";
import { buildStandardsViewModel } from "./skill-os-standards-model";
import type {
  SkillDocsPayload,
  SkillGraphNode,
  SkillTemplateIntelligencePayload,
  SkillTemplateRolloutRow,
} from "./skill-os-types";

type StandardsView = "rollout" | "registry" | "versions";

const STANDARDS_VIEW_LABELS: Record<StandardsView, string> = {
  registry: "Skill Registry",
  rollout: "Rollout Matrix",
  versions: "Template Versions",
};

function StatusBadge({ status }: { status?: string }): ReactElement {
  const normalized = status ?? "unknown";
  if (normalized === "current") return <Badge variant="secondary">current</Badge>;
  if (normalized === "stale") return <Badge variant="destructive">stale</Badge>;
  if (normalized === "external") return <Badge variant="outline">external</Badge>;
  return <Badge variant="outline">{normalized}</Badge>;
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
  activeView,
  generatedAt,
  hasGeneratedArtifact,
  onViewChange,
  summary,
  templateError,
}: {
  activeView: StandardsView;
  generatedAt: string;
  hasGeneratedArtifact: boolean;
  onViewChange: (view: StandardsView) => void;
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
        <Select value={activeView} onValueChange={(value) => onViewChange(value as StandardsView)}>
          <SelectTrigger size="sm" className="min-w-[11rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="rollout">Rollout Matrix</SelectItem>
            <SelectItem value="registry">Skill Registry</SelectItem>
            <SelectItem value="versions">Template Versions</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function RolloutMatrix({ rows }: { rows: SkillTemplateRolloutRow[] }): ReactElement {
  return (
    <div className="min-h-0 rounded-md border bg-card">
      <div className="grid grid-cols-[minmax(12rem,1fr)_7rem_8rem_8rem_6rem_minmax(10rem,0.8fr)] gap-3 border-b px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
        <span>Skill</span>
        <span>Source</span>
        <span>Template</span>
        <span>Status</span>
        <span>Tier</span>
        <span>Features</span>
      </div>
      <div>
        {rows.map((row) => (
          <div
            key={`${row.skill_id}:${row.template_version}`}
            className="grid grid-cols-[minmax(12rem,1fr)_7rem_8rem_8rem_6rem_minmax(10rem,0.8fr)] gap-3 border-b px-4 py-2 text-sm last:border-b-0"
          >
            <div className="min-w-0">
              <div className="truncate font-medium">{row.skill_id}</div>
              <div className="truncate font-mono text-xs text-muted-foreground">{row.path}</div>
            </div>
            <span className="truncate text-muted-foreground">{row.source ?? "local"}</span>
            <Badge variant={row.template_version === "missing" ? "outline" : "secondary"}>
              {row.template_version}
            </Badge>
            <StatusBadge status={row.status} />
            <span>
              <span
                className="mr-1 inline-block size-2 rounded-full"
                style={{ backgroundColor: tierColor(row.tier) }}
              />
              T{row.tier ?? 3}
            </span>
            <span className="truncate font-mono text-xs text-muted-foreground">
              {row.feature_refs?.join(", ") || "--"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkillRegistry({
  features,
}: {
  features: ReturnType<typeof buildStandardsViewModel>["features"];
}): ReactElement {
  if (features.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        No generated skill feature rows are available yet.
      </div>
    );
  }
  return (
    <div className="min-h-0 rounded-md border bg-card">
      <div className="grid grid-cols-[8rem_minmax(12rem,0.8fr)_8rem_minmax(16rem,1.2fr)_minmax(10rem,0.8fr)] gap-3 border-b px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
        <span>Feature</span>
        <span>Name</span>
        <span>Status</span>
        <span>What It Does</span>
        <span>Metrics</span>
      </div>
      <div>
        {features.map((feature) => (
          <div
            key={feature.id}
            className="grid grid-cols-[8rem_minmax(12rem,0.8fr)_8rem_minmax(16rem,1.2fr)_minmax(10rem,0.8fr)] gap-3 border-b px-4 py-2 text-sm last:border-b-0"
          >
            <span className="font-mono text-xs text-muted-foreground">{feature.id}</span>
            <span className="truncate font-medium">{feature.name}</span>
            <Badge variant="outline" className="w-fit">
              {feature.status ?? "unknown"}
            </Badge>
            <span className="line-clamp-2 text-muted-foreground">
              {feature.known_limits ?? "No description recorded."}
            </span>
            <span className="truncate font-mono text-xs text-muted-foreground">
              {(feature.metrics ?? []).join(", ") || "--"}
            </span>
          </div>
        ))}
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

export function SkillOsStandardsTab({
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
  const [activeView, setActiveView] = useState<StandardsView>("rollout");
  const model = useMemo(
    () => buildStandardsViewModel({ docs, nodes, templateIntelligence }),
    [docs, nodes, templateIntelligence],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <StandardsHeader
        activeView={activeView}
        generatedAt={model.generatedAt}
        hasGeneratedArtifact={model.hasGeneratedArtifact}
        onViewChange={setActiveView}
        summary={model.summary}
        templateError={templateError}
      />

      <ScrollArea className="min-h-0 flex-1">
        {activeView === "rollout" ? <RolloutMatrix rows={model.rolloutRows} /> : null}
        {activeView === "registry" ? <SkillRegistry features={model.features} /> : null}
        {activeView === "versions" ? (
          <TemplateVersions versions={model.templateVersions} />
        ) : null}
      </ScrollArea>

      <div className="sr-only" aria-live="polite">
        {STANDARDS_VIEW_LABELS[activeView]}
      </div>
    </div>
  );
}
