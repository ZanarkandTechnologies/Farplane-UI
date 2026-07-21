"use client";

/** Operations Dossier: maps one skill's graph, docs, evals, and improvement memory into a read-only, single-scroll workspace. */

import {
  Activity,
  ArrowLeft,
  BookOpenCheck,
  ExternalLink,
  FileCode2,
  FlaskConical,
  GitBranch,
  LayoutDashboard,
} from "lucide-react";
import { type ComponentType, type ReactElement, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPercent, formatRunDate } from "@/modules/evals/lib/eval-artifacts";
import type { SkillEvalSuite, SkillStudioFileEntry } from "@/modules/runtime";
import { SkillEvalSuiteView } from "../skill-eval-suite-view";
import {
  buildSkillDetailScorecard,
  type SkillMaintenanceGap,
} from "./skill-detail-scorecard-model";
import { SkillFilesPanel } from "./skill-files-panel";
import { TIER_LABELS, tierColor } from "./skill-os-constants";
import type {
  SkillDoc,
  SkillGraphEdge,
  SkillGraphNode,
  SkillTemplateIntelligencePayload,
} from "./skill-os-types";
import { SkillRunbookPanel } from "./skill-runbook-panel";
import { hasSelfImproveDirectory } from "./skill-self-improve-model";
import { SkillSelfImprovePanel } from "./skill-self-improve-panel";
import { buildSkillWorkbenchModel } from "./skill-workbench-model";
import { type SkillEvalHistoryRow, useSkillEvalHistory } from "./use-skill-eval-history";
import { useSkillSelfImprove } from "./use-skill-self-improve";

export type SkillWorkspaceView = "overview" | "runbook" | "experiments" | "files";

type WorkspaceNavItem = {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: SkillWorkspaceView;
};

const WORKSPACE_NAV: WorkspaceNavItem[] = [
  { icon: LayoutDashboard, label: "Overview", value: "overview" },
  { icon: BookOpenCheck, label: "Runbook", value: "runbook" },
  { icon: FlaskConical, label: "Experiments", value: "experiments" },
  { icon: FileCode2, label: "Files", value: "files" },
];

function gapVariant(
  status: SkillMaintenanceGap["status"],
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "good") return "secondary";
  if (status === "risk") return "default";
  if (status === "missing") return "destructive";
  return "outline";
}

function EmptyState({ children }: { children: string }): ReactElement {
  return (
    <div className="border border-dashed px-4 py-5 text-sm text-muted-foreground">{children}</div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}): ReactElement {
  return (
    <header className="mb-5">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
        {eyebrow}
      </p>
      <h3 className="mt-1 [font-family:Inter,sans-serif] text-xl font-semibold tracking-tight">
        {title}
      </h3>
      {description ? (
        <p className="mt-1 max-w-3xl [font-family:Inter,sans-serif] text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </header>
  );
}

function MaintenanceStatus({ gaps }: { gaps: SkillMaintenanceGap[] }): ReactElement {
  return (
    <section className="border-t pt-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h4 className="[font-family:Inter,sans-serif] text-sm font-semibold">Readiness</h4>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          source checks
        </span>
      </div>
      <div className="divide-y border-y">
        {gaps.map((gap) => (
          <div
            key={gap.label}
            className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-1 py-2.5"
          >
            <p className="min-w-0 truncate [font-family:Inter,sans-serif] text-sm">{gap.label}</p>
            <p className="max-w-48 truncate font-mono text-[11px] text-muted-foreground">
              {gap.value}
            </p>
            <Badge className="min-w-16 justify-center" variant={gapVariant(gap.status)}>
              {gap.status}
            </Badge>
          </div>
        ))}
      </div>
    </section>
  );
}

function RelationshipList({
  edges,
  empty,
  onSelectSkill,
  title,
  target,
}: {
  edges: SkillGraphEdge[];
  empty: string;
  onSelectSkill: (skillId: string) => void;
  title: string;
  target: "source" | "target";
}): ReactElement {
  return (
    <section className="min-w-0 border-t pt-6">
      <div className="mb-3 flex items-center gap-2 [font-family:Inter,sans-serif] text-sm font-semibold">
        <GitBranch className="size-4 text-muted-foreground" aria-hidden="true" />
        {title}
      </div>
      <div className="divide-y border-y">
        {edges.slice(0, 12).map((edge) => {
          const skillId = edge[target];
          return (
            <button
              key={`${edge.source}-${edge.target}-${edge.type}-${edge.label}`}
              type="button"
              className="grid min-h-11 w-full touch-manipulation grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-1 py-2.5 text-left hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              onClick={() => onSelectSkill(skillId)}
            >
              <span className="truncate [font-family:Inter,sans-serif] text-sm">
                {target === "target" ? (edge.target_ref ?? skillId) : skillId}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {edge.type === "common-chain" ? "chain" : "ref"}
              </span>
            </button>
          );
        })}
        {edges.length === 0 ? (
          <p className="px-1 py-3 [font-family:Inter,sans-serif] text-sm text-muted-foreground">
            {empty}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function evalOsHref(skillId: string, runId?: string): string {
  const params = new URLSearchParams({ skill: skillId });
  if (runId) params.set("run", runId);
  return `/evals?${params.toString()}`;
}

function EvalHistoryPanel({
  rows,
  skillId,
  status,
}: {
  rows: SkillEvalHistoryRow[];
  skillId: string;
  status: "idle" | "loading" | "ready" | "error";
}): ReactElement {
  const latest = rows[0] ?? null;
  return (
    <section className="border-t pt-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="[font-family:Inter,sans-serif] text-sm font-semibold">Eval history</h4>
          <p className="mt-1 [font-family:Inter,sans-serif] text-xs text-muted-foreground">
            {latest
              ? `${rows.length} run${rows.length === 1 ? "" : "s"} · latest ${formatRunDate(latest.runDate)} · ${formatPercent(latest.passRate ?? undefined)}`
              : status === "loading"
                ? "Loading eval runs…"
                : "No eval runs matched this skill yet."}
          </p>
        </div>
        <Button asChild size="sm" variant="ghost">
          <a href={evalOsHref(skillId)}>
            View all
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        </Button>
      </div>
      <div className="mt-3 divide-y border-y">
        {rows.map((row) => (
          <a
            key={row.jobId}
            className="grid w-full grid-cols-[minmax(0,1fr)_7rem_5rem] items-center gap-3 px-1 py-2.5 text-left hover:bg-muted/20"
            href={evalOsHref(skillId, row.jobId)}
          >
            <span className="min-w-0 truncate [font-family:Inter,sans-serif] text-sm font-medium">
              {row.label}
            </span>
            <span className="text-xs text-muted-foreground">{formatRunDate(row.runDate)}</span>
            <span className="text-right font-mono text-xs tabular-nums text-muted-foreground">
              {row.passedTasks}/{row.totalTasks}
            </span>
          </a>
        ))}
        {rows.length === 0 ? (
          <div className="px-1 py-4 [font-family:Inter,sans-serif] text-sm text-muted-foreground">
            {status === "error" ? "Eval artifacts are unavailable." : "No recorded history yet."}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function SkillWorkbench({
  activeView,
  doc,
  edges,
  invocationCount,
  node,
  onBack,
  onSelectSkill,
  onViewChange,
  templateIntelligence,
  evalPath,
  evalSuite,
  fileEntries = [],
}: {
  activeView: SkillWorkspaceView;
  doc: SkillDoc | null;
  edges: SkillGraphEdge[];
  invocationCount: number;
  node: SkillGraphNode;
  onBack: () => void;
  onSelectSkill: (skillId: string) => void;
  onViewChange: (view: SkillWorkspaceView) => void;
  templateIntelligence: SkillTemplateIntelligencePayload | null;
  evalPath?: string;
  evalSuite?: SkillEvalSuite;
  fileEntries?: SkillStudioFileEntry[];
}): ReactElement {
  const model = useMemo(
    () =>
      buildSkillWorkbenchModel({
        doc,
        edges,
        invocationCount,
        node,
        evalCount: evalSuite?.evals.length ?? 0,
        evalPath,
      }),
    [doc, edges, invocationCount, node, evalPath, evalSuite],
  );
  const evalHistory = useSkillEvalHistory(node.id);
  const scorecard = useMemo(
    () =>
      buildSkillDetailScorecard({
        doc,
        edges,
        evalTaskCount: evalSuite?.evals.length ?? 0,
        invocationCount,
        model,
        node,
        templateIntelligence,
      }),
    [doc, edges, evalSuite, invocationCount, model, node, templateIntelligence],
  );
  const hasSelfImprove = hasSelfImproveDirectory(fileEntries);
  const programPath = fileEntries.find((entry) => entry.path === "self-improve/program.md")?.path;
  const progressPath = fileEntries.find((entry) => entry.path === "self-improve/progress.md")?.path;
  const selfImprove = useSkillSelfImprove(node.id, programPath, progressPath);
  const hasExperiments = hasSelfImprove || Boolean(evalPath || evalSuite);
  const visibleView = activeView === "experiments" && !hasExperiments ? "overview" : activeView;
  const latestEntry = selfImprove.projection?.entries.at(-1) ?? null;
  const latestScoredEntry =
    selfImprove.projection?.entries
      .slice()
      .reverse()
      .find((entry) => entry.score) ?? null;

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-background">
      <header className="flex min-w-0 items-center gap-3 border-b px-4 py-2.5 md:px-5">
        <Button
          size="icon-sm"
          variant="ghost"
          className="size-11 touch-manipulation md:size-8"
          aria-label="Back to skill graph"
          onClick={onBack}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="min-w-0 truncate [font-family:Inter,sans-serif] text-base font-semibold tracking-tight">
              {node.id}
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {node.source ?? "local"}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {TIER_LABELS[node.tier ?? 3] ?? "SKILL"}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {model.invocationCount} invokes
            </span>
          </div>
          <p
            className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground"
            title={node.path}
          >
            {node.path}
          </p>
        </div>
        <span
          className="hidden size-2.5 shrink-0 md:block"
          style={{ backgroundColor: tierColor(node.tier) }}
          aria-hidden="true"
        />
      </header>

      <Tabs
        value={visibleView}
        onValueChange={(value) => onViewChange(value as SkillWorkspaceView)}
        orientation="vertical"
        className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-0 md:grid-cols-[13.5rem_minmax(0,1fr)] md:grid-rows-1"
      >
        <aside className="min-w-0 border-b bg-muted/[0.08] md:border-b-0 md:border-r">
          <TabsList
            className={
              hasExperiments
                ? "grid h-auto w-full grid-cols-4 rounded-none bg-transparent p-0 md:grid-cols-1 md:px-3 md:py-4"
                : "grid h-auto w-full grid-cols-3 rounded-none bg-transparent p-0 md:grid-cols-1 md:px-3 md:py-4"
            }
          >
            {WORKSPACE_NAV.filter((item) => item.value !== "experiments" || hasExperiments).map(
              (item) => {
                const Icon = item.icon;
                return (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    className="h-11 min-w-0 flex-1 touch-manipulation justify-center gap-1 rounded-none border-b-2 border-l-0 border-b-transparent px-1 [font-family:Inter,sans-serif] text-[11px] text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-primary/[0.06] data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-[state=active]:bg-primary/[0.08] md:h-10 md:w-full md:justify-start md:border-b-0 md:border-l-2 md:px-3 md:text-xs"
                  >
                    <Icon className="hidden size-3.5 md:block" aria-hidden={true} />
                    {item.label}
                  </TabsTrigger>
                );
              },
            )}
          </TabsList>

          <div className="hidden px-4 pb-5 md:block">
            <div className="border-t pt-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                    Health
                  </p>
                  <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                    {scorecard.score}
                  </p>
                </div>
                <Activity className="mb-1 size-4 text-primary" aria-hidden="true" />
              </div>
              <p className="mt-2 [font-family:Inter,sans-serif] text-xs leading-5 text-muted-foreground">
                {scorecard.action}
              </p>
            </div>

            {hasSelfImprove ? (
              <div className="mt-5 border-t pt-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                    Latest learning
                  </p>
                  {latestScoredEntry?.score ? (
                    <span className="font-mono text-xs font-semibold tabular-nums text-primary">
                      {latestScoredEntry.score.display}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 line-clamp-4 [font-family:Inter,sans-serif] text-xs leading-5 text-foreground/80">
                  {selfImprove.status === "loading"
                    ? "Loading experiment history…"
                    : latestEntry?.insight || "No experiment insight recorded yet."}
                </p>
              </div>
            ) : null}
          </div>
        </aside>

        <main
          data-skill-workspace-scroll
          className="min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain bg-background"
        >
          <TabsContent value="overview" className="m-0 px-5 py-6 md:px-8 md:py-7">
            <SectionHeading eyebrow="Skill dossier" title="Overview" description={model.summary} />
            <MaintenanceStatus gaps={scorecard.gaps} />
            <div className="mt-7 grid gap-7 lg:grid-cols-2">
              <RelationshipList
                title="Used by"
                edges={model.incoming}
                target="source"
                empty="No incoming skill links."
                onSelectSkill={onSelectSkill}
              />
              <RelationshipList
                title="Uses"
                edges={model.outgoing}
                target="target"
                empty="No outgoing skill links."
                onSelectSkill={onSelectSkill}
              />
            </div>
          </TabsContent>
          <TabsContent value="runbook" className="m-0 px-5 py-6 md:px-8 md:py-7">
            <SectionHeading
              eyebrow="Operating procedure"
              title="Runbook"
              description="Execute the skill in order, then apply its declared quality gates before claiming completion."
            />
            <SkillRunbookPanel
              doc={doc}
              fileEntries={fileEntries}
              model={model}
              skillId={node.id}
            />
          </TabsContent>
          {hasExperiments ? (
            <TabsContent value="experiments" className="m-0 px-5 py-6 md:px-8 md:py-7">
              <SectionHeading
                eyebrow="Learning loop"
                title="Experiments"
                description="Follow the score trajectory, inspect each decision, and open the evidence behind meaningful changes."
              />
              <div className="grid gap-7">
                {hasSelfImprove ? (
                  <SkillSelfImprovePanel
                    key={node.id}
                    programPath={programPath}
                    progressPath={progressPath}
                    skillId={node.id}
                    state={selfImprove}
                  />
                ) : null}
                {evalSuite && evalPath ? (
                  <SkillEvalSuiteView suite={evalSuite} path={evalPath} />
                ) : (
                  <EmptyState>No canonical eval suite is available.</EmptyState>
                )}
                <EvalHistoryPanel
                  rows={evalHistory.rows}
                  skillId={node.id}
                  status={evalHistory.status}
                />
              </div>
            </TabsContent>
          ) : null}
          <TabsContent value="files" className="m-0 px-5 py-6 md:px-8 md:py-7">
            <SectionHeading
              eyebrow="Source inventory"
              title="Files"
              description="Inspect the declared skill package without leaving the dossier."
            />
            <SkillFilesPanel
              fallbackSkillMarkdown={model.raw}
              fileEntries={fileEntries}
              skillId={node.id}
            />
          </TabsContent>
        </main>
      </Tabs>
    </div>
  );
}
