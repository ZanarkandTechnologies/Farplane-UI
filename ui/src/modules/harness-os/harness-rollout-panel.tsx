"use client";

/**
 * Ownership: Harness OS rollout scanner view.
 * Inputs: read-only adoption and skill rollout CLI payloads from the Vite bridge.
 * Outputs: project, feature, template, skill-template, and drift tables.
 * Side effects: none.
 */

import { AlertTriangle, Boxes, FileCode2, GitPullRequestArrow, Layers3, RadioTower } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { HarnessAdoptionPayload, HarnessSkillRolloutPayload } from "./harness-os-types";

type RolloutView = "projects" | "features" | "templates" | "skill-templates" | "drift";

const ROLLOUT_VIEWS: Array<{ id: RolloutView; label: string }> = [
  { id: "projects", label: "Projects" },
  { id: "features", label: "Features" },
  { id: "templates", label: "Templates" },
  { id: "skill-templates", label: "Skill Templates" },
  { id: "drift", label: "Drift" },
];

function statusBadge(status?: string): ReactElement {
  const normalized = status ?? "unknown";
  if (normalized === "current" || normalized === "implemented") {
    return <Badge variant="secondary">{normalized}</Badge>;
  }
  if (normalized === "stale" || normalized === "missing") {
    return <Badge variant="destructive">{normalized}</Badge>;
  }
  return <Badge variant="outline">{normalized}</Badge>;
}

function SummaryMetric({
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

function EmptyState({ error, label }: { error: string | null; label: string }): ReactElement {
  return (
    <div className="grid h-full min-h-[20rem] place-items-center rounded-md border border-dashed bg-muted/10">
      <div className="max-w-md p-6 text-center">
        <AlertTriangle className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-3 font-semibold">{label}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {error ?? "The bridge has no payload for this rollout view yet."}
        </p>
      </div>
    </div>
  );
}

function ProjectsTable({ adoption }: { adoption: HarnessAdoptionPayload }): ReactElement {
  const projects = adoption.projects ?? [];
  if (!projects.length) return <EmptyState error={null} label="No projects scanned" />;
  return (
    <div className="min-h-0 rounded-md border bg-card">
      <div className="grid grid-cols-[minmax(10rem,0.8fr)_8rem_8rem_9rem_minmax(16rem,1.2fr)] gap-3 border-b px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
        <span>Project</span>
        <span>Spec</span>
        <span>Local</span>
        <span>Issues</span>
        <span>Templates</span>
      </div>
      <ScrollArea className="h-[58vh]">
        {projects.map((project) => (
          <div
            key={project.projectId ?? project.root}
            className="grid grid-cols-[minmax(10rem,0.8fr)_8rem_8rem_9rem_minmax(16rem,1.2fr)] gap-3 border-b px-4 py-2 text-sm last:border-b-0"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{project.projectId ?? "unknown project"}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{project.root}</p>
            </div>
            <Badge variant={project.specVersion === project.expectedSpecVersion ? "secondary" : "outline"}>
              {project.specVersion ?? "missing"}
            </Badge>
            <span className="text-muted-foreground">
              {project.usesLocalSkills ? `${project.localSkills?.length ?? 0} skills` : "shared"}
            </span>
            <Badge variant={(project.issues?.length ?? 0) ? "destructive" : "secondary"}>
              {project.issues?.length ?? 0} issues
            </Badge>
            <span className="truncate font-mono text-xs text-muted-foreground">
              {Object.entries(project.templateUses ?? {})
                .map(([key, value]) => `${key}@${value}`)
                .join(", ") || "--"}
            </span>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}

function FeaturesTable({ adoption }: { adoption: HarnessAdoptionPayload }): ReactElement {
  const features = Object.values(adoption.features ?? {});
  if (!features.length) return <EmptyState error={null} label="No feature rollout rows" />;
  return (
    <div className="min-h-0 rounded-md border bg-card">
      <div className="grid grid-cols-[8rem_minmax(12rem,1fr)_8rem_8rem_minmax(14rem,1fr)] gap-3 border-b px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
        <span>Feature</span>
        <span>Name</span>
        <span>Status</span>
        <span>Projects</span>
        <span>Sources</span>
      </div>
      <ScrollArea className="h-[58vh]">
        {features.map((feature) => (
          <div
            key={feature.id}
            className="grid grid-cols-[8rem_minmax(12rem,1fr)_8rem_8rem_minmax(14rem,1fr)] gap-3 border-b px-4 py-2 text-sm last:border-b-0"
          >
            <span className="font-mono text-xs text-muted-foreground">{feature.id}</span>
            <span className="truncate font-medium">{feature.name ?? feature.id}</span>
            {statusBadge(feature.status)}
            <span className="tabular-nums">{feature.projectCount ?? 0}</span>
            <span className="truncate text-xs text-muted-foreground">
              {[...(feature.explicitProjects ?? []), ...(feature.impliedProjects ?? [])].join(", ") || "--"}
            </span>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}

function TemplatesTable({
  adoption,
  skillRollout,
}: {
  adoption: HarnessAdoptionPayload | null;
  skillRollout: HarnessSkillRolloutPayload | null;
}): ReactElement {
  const rows = Object.entries(skillRollout?.templateRolloutSummary ?? {});
  if (!rows.length && !adoption) return <EmptyState error={null} label="No template rollout payload" />;
  return (
    <div className="min-h-0 rounded-md border bg-card">
      <div className="grid grid-cols-[minmax(12rem,1fr)_8rem_8rem_minmax(18rem,1.2fr)] gap-3 border-b px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
        <span>Template</span>
        <span>Version</span>
        <span>Consumers</span>
        <span>Target Basis</span>
      </div>
      <ScrollArea className="h-[58vh]">
        {Object.entries(adoption?.globalTemplateUses ?? {}).map(([templateId, version]) => (
          <div
            key={`project:${templateId}`}
            className="grid grid-cols-[minmax(12rem,1fr)_8rem_8rem_minmax(18rem,1.2fr)] gap-3 border-b px-4 py-2 text-sm"
          >
            <span className="font-medium">{templateId}</span>
            <Badge variant="secondary">{version}</Badge>
            <span className="tabular-nums">{adoption?.counts?.projects ?? 0}</span>
            <span className="truncate text-xs text-muted-foreground">project manifests</span>
          </div>
        ))}
        {rows.map(([templateId, summary]) => (
          <div
            key={templateId}
            className="grid grid-cols-[minmax(12rem,1fr)_8rem_8rem_minmax(18rem,1.2fr)] gap-3 border-b px-4 py-2 text-sm last:border-b-0"
          >
            <span className="font-medium">{templateId}</span>
            <Badge variant="outline">{summary.current_version ?? "unknown"}</Badge>
            <span className="tabular-nums">{summary.total_consumers ?? 0}</span>
            <span className="truncate text-xs text-muted-foreground">{summary.target_basis ?? "--"}</span>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}

function SkillTemplatesTable({ skillRollout }: { skillRollout: HarnessSkillRolloutPayload }): ReactElement {
  const skills = skillRollout.skills ?? [];
  if (!skills.length) return <EmptyState error={null} label="No skills in rollout scan" />;
  return (
    <div className="min-h-0 rounded-md border bg-card">
      <div className="grid grid-cols-[minmax(12rem,1fr)_7rem_8rem_8rem_7rem_7rem] gap-3 border-b px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
        <span>Skill</span>
        <span>Source</span>
        <span>Template</span>
        <span>Status</span>
        <span>Eval</span>
        <span>QA</span>
      </div>
      <ScrollArea className="h-[58vh]">
        {skills.map((skill) => (
          <div
            key={skill.skillId ?? skill.path}
            className="grid grid-cols-[minmax(12rem,1fr)_7rem_8rem_8rem_7rem_7rem] gap-3 border-b px-4 py-2 text-sm last:border-b-0"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{skill.skillId ?? "unknown"}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{skill.path}</p>
            </div>
            <span className="truncate text-muted-foreground">{skill.source ?? "local"}</span>
            <Badge variant={skill.templateVersion === "missing" ? "outline" : "secondary"}>
              {skill.templateVersion ?? "missing"}
            </Badge>
            {statusBadge(skill.status)}
            <span className="text-muted-foreground">{skill.eval ? "yes" : "no"}</span>
            <span className="text-muted-foreground">{skill.qaChecklist ? "yes" : "no"}</span>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}

function DriftTable({
  adoption,
  skillRollout,
}: {
  adoption: HarnessAdoptionPayload | null;
  skillRollout: HarnessSkillRolloutPayload | null;
}): ReactElement {
  const projectRows = (adoption?.projects ?? []).flatMap((project) =>
    (project.drift ?? []).map((drift, index) => ({
      id: `${project.projectId ?? project.root}:drift:${index}`,
      item: JSON.stringify(drift),
      scope: project.projectId ?? "project",
      source: "project adoption",
    })),
  );
  const skillRows = (skillRollout?.skills ?? [])
    .filter((skill) => skill.status === "missing" || skill.status === "stale")
    .map((skill) => ({
      id: `skill:${skill.skillId}`,
      item: `${skill.skillId ?? "unknown"} is ${skill.status ?? "unknown"} (${skill.templateVersion ?? "missing"})`,
      scope: "skill template",
      source: skill.path ?? "--",
    }));
  const rows = [...projectRows, ...skillRows].slice(0, 120);
  if (!rows.length) return <EmptyState error={null} label="No rollout drift detected" />;
  return (
    <div className="min-h-0 rounded-md border bg-card">
      <div className="grid grid-cols-[10rem_minmax(16rem,1fr)_minmax(14rem,0.8fr)] gap-3 border-b px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
        <span>Scope</span>
        <span>Item</span>
        <span>Source</span>
      </div>
      <ScrollArea className="h-[58vh]">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[10rem_minmax(16rem,1fr)_minmax(14rem,0.8fr)] gap-3 border-b px-4 py-2 text-sm last:border-b-0"
          >
            <Badge variant="outline">{row.scope}</Badge>
            <span className="truncate">{row.item}</span>
            <span className="truncate font-mono text-xs text-muted-foreground">{row.source}</span>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}

export function HarnessRolloutPanel({
  adoption,
  adoptionError,
  skillRollout,
  skillRolloutError,
}: {
  adoption: HarnessAdoptionPayload | null;
  adoptionError: string | null;
  skillRollout: HarnessSkillRolloutPayload | null;
  skillRolloutError: string | null;
}): ReactElement {
  const [activeView, setActiveView] = useState<RolloutView>("projects");
  const attention = useMemo(
    () =>
      (adoption?.counts?.driftItems ?? 0) +
      (skillRollout?.counts?.missing ?? 0) +
      (skillRollout?.counts?.stale ?? 0),
    [adoption?.counts?.driftItems, skillRollout?.counts?.missing, skillRollout?.counts?.stale],
  );

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-center text-sm">
          <SummaryMetric icon={<GitPullRequestArrow className="size-4" />} label="projects" value={String(adoption?.counts?.projects ?? 0)} />
          <SummaryMetric icon={<Layers3 className="size-4" />} label="features" value={String(Object.keys(adoption?.features ?? {}).length)} />
          <SummaryMetric icon={<FileCode2 className="size-4" />} label="skills" value={String(skillRollout?.counts?.skills ?? 0)} />
          <SummaryMetric icon={<RadioTower className="size-4" />} label="attention" value={String(attention)} />
          <SummaryMetric icon={<Boxes className="size-4" />} label="templates" value={String(Object.keys(skillRollout?.templateRolloutSummary ?? {}).length)} />
        </div>
        <Badge variant={adoption && skillRollout ? "secondary" : "outline"}>
          {adoption && skillRollout ? "CLI-backed" : "partial data"}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {ROLLOUT_VIEWS.map((view) => (
          <button
            key={view.id}
            type="button"
            onClick={() => setActiveView(view.id)}
            className={`rounded-md border px-3 py-1.5 text-sm transition ${
              activeView === view.id ? "border-primary bg-primary text-primary-foreground" : "bg-background"
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>

      <div className="min-h-0">
        {activeView === "projects" ? (
          adoption ? <ProjectsTable adoption={adoption} /> : <EmptyState error={adoptionError} label="Adoption scan unavailable" />
        ) : null}
        {activeView === "features" ? (
          adoption ? <FeaturesTable adoption={adoption} /> : <EmptyState error={adoptionError} label="Feature rollout unavailable" />
        ) : null}
        {activeView === "templates" ? (
          <TemplatesTable adoption={adoption} skillRollout={skillRollout} />
        ) : null}
        {activeView === "skill-templates" ? (
          skillRollout ? (
            <SkillTemplatesTable skillRollout={skillRollout} />
          ) : (
            <EmptyState error={skillRolloutError} label="Skill rollout scan unavailable" />
          )
        ) : null}
        {activeView === "drift" ? (
          <DriftTable adoption={adoption} skillRollout={skillRollout} />
        ) : null}
      </div>
    </div>
  );
}
