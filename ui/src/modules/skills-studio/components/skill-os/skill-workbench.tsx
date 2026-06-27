"use client";

import { ArrowLeft, ExternalLink, FileCode2, GitBranch, ListChecks } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Response } from "@/components/ai-elements/response";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPercent, formatRunDate } from "@/modules/evals/lib/eval-artifacts";
import {
  buildSkillDetailScorecard,
  type SkillDetailScorecard,
  type SkillMaintenanceGap,
  type SkillScoreSignal,
} from "./skill-detail-scorecard-model";
import { TIER_LABELS, tierColor } from "./skill-os-constants";
import type {
  SkillDoc,
  SkillGraphEdge,
  SkillGraphNode,
  SkillTemplateIntelligencePayload,
} from "./skill-os-types";
import {
  buildSkillWorkbenchModel,
  type SkillArtifactKind,
  type SkillWorkbenchModel,
} from "./skill-workbench-model";
import { type SkillEvalHistoryRow, useSkillEvalHistory } from "./use-skill-eval-history";

function EmptyRenderer({ label }: { label: string }): ReactElement {
  return (
    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      No {label} found in the embedded skill document yet.
    </div>
  );
}

function MarkdownBlock({ children, label }: { children: string; label: string }): ReactElement {
  if (!children.trim()) return <EmptyRenderer label={label} />;
  return (
    <div className="overflow-hidden rounded-md border bg-muted/10 p-4">
      <Response className="prose prose-invert max-w-none text-sm">{children}</Response>
    </div>
  );
}

function scoreTone(score: number): string {
  if (score >= 85) return "text-emerald-500";
  if (score >= 70) return "text-sky-500";
  if (score >= 50) return "text-amber-500";
  return "text-destructive";
}

function gapVariant(status: SkillMaintenanceGap["status"]): "default" | "secondary" | "destructive" | "outline" {
  if (status === "good") return "secondary";
  if (status === "risk") return "default";
  if (status === "missing") return "destructive";
  return "outline";
}

function SignalRow({ signal }: { signal: SkillScoreSignal }): ReactElement {
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-[minmax(8rem,1fr)_3rem] items-center gap-3 text-sm">
        <div className="min-w-0">
          <p className="truncate font-medium">{signal.label}</p>
          <p className="truncate text-xs text-muted-foreground">{signal.detail}</p>
        </div>
        <span className="text-right font-mono text-sm tabular-nums">{signal.score}</span>
      </div>
      <Progress value={signal.score} className="h-1.5 bg-muted" />
    </div>
  );
}

function ScorecardPanel({ scorecard }: { scorecard: SkillDetailScorecard }): ReactElement {
  return (
    <div className="grid gap-3 xl:grid-cols-[17rem_minmax(0,1fr)]">
      <section className="rounded-md border bg-card p-4">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Skill Score</p>
        <div className="mt-4 flex items-end gap-2">
          <span className={`text-6xl font-semibold leading-none tabular-nums ${scoreTone(scorecard.score)}`}>
            {scorecard.score}
          </span>
          <span className="pb-1 text-sm text-muted-foreground">/100</span>
        </div>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{scorecard.action}</p>
      </section>

      <section className="rounded-md border bg-card p-4">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Signal Breakdown</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {scorecard.signals.map((signal) => (
            <SignalRow key={signal.id} signal={signal} />
          ))}
        </div>
      </section>
    </div>
  );
}

function MaintenanceGapsPanel({ gaps }: { gaps: SkillMaintenanceGap[] }): ReactElement {
  return (
    <section className="rounded-md border bg-card p-4">
      <p className="text-xs font-semibold uppercase text-muted-foreground">Maintenance Gaps</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 2xl:grid-cols-5">
        {gaps.map((gap) => (
          <div key={gap.label} className="min-w-0 rounded-md border px-3 py-2">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{gap.label}</p>
              <Badge variant={gapVariant(gap.status)}>{gap.status}</Badge>
            </div>
            <p className="mt-2 truncate font-mono text-sm">{gap.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function openEvalOsForSkill(skillId: string, runId?: string): void {
  const params = new URLSearchParams({ skill: skillId });
  if (runId) params.set("run", runId);
  window.location.assign(`/evals?${params.toString()}`);
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
    <section className="rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Eval History</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {latest
              ? `${rows.length} matched run${rows.length === 1 ? "" : "s"} / latest ${formatRunDate(latest.runDate)} / ${formatPercent(latest.passRate ?? undefined)}`
              : status === "loading"
                ? "Loading eval runs..."
                : "No eval runs matched this skill yet."}
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => openEvalOsForSkill(skillId)}>
          <ExternalLink className="size-4" />
          View all
        </Button>
      </div>

      <div className="mt-3 max-h-[24rem] overflow-auto rounded-md border">
        <div className="grid grid-cols-[minmax(12rem,1fr)_8rem_6rem_6rem_minmax(8rem,0.7fr)] gap-3 border-b px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
          <span>Run</span>
          <span>Date</span>
          <span>Result</span>
          <span>Tasks</span>
          <span>Open</span>
        </div>
        {rows.map((row) => {
          const result = row.failedTasks > 0 ? "fail" : row.passedTasks > 0 ? "pass" : "unknown";
          return (
            <div
              key={row.jobId}
              className="grid grid-cols-[minmax(12rem,1fr)_8rem_6rem_6rem_minmax(8rem,0.7fr)] gap-3 border-b px-3 py-2 text-sm last:border-b-0"
            >
              <span className="min-w-0 truncate font-medium">{row.label}</span>
              <span className="truncate text-xs text-muted-foreground">{formatRunDate(row.runDate)}</span>
              <span>
                <Badge variant={result === "fail" ? "destructive" : result === "pass" ? "secondary" : "outline"}>
                  {result}
                </Badge>
              </span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {row.passedTasks}/{row.totalTasks}
              </span>
              <span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => openEvalOsForSkill(skillId, row.jobId)}
                >
                  Detail
                </Button>
              </span>
            </div>
          );
        })}
        {rows.length === 0 ? (
          <div className="px-3 py-6 text-sm text-muted-foreground">
            {status === "error"
              ? "Eval artifacts are unavailable."
              : "No past runs reference this skill by id, title, reason, or tags."}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function FrontmatterTable({ model }: { model: SkillWorkbenchModel }): ReactElement {
  if (model.frontmatterEntries.length === 0) return <EmptyRenderer label="frontmatter" />;
  return (
    <div className="overflow-hidden rounded-md border">
      {model.frontmatterEntries.map(([key, value]) => (
        <div
          key={key}
          className="grid min-w-0 grid-cols-[minmax(7rem,11rem)_minmax(0,1fr)] border-b px-3 py-2 text-sm last:border-b-0"
        >
          <span className="min-w-0 break-words text-muted-foreground">{key}</span>
          <span className="min-w-0 whitespace-pre-wrap break-all font-mono text-xs">
            {typeof value === "object" ? JSON.stringify(value) : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function FileGraph({
  activeArtifact,
  model,
  onSelectArtifact,
}: {
  activeArtifact: SkillArtifactKind;
  model: SkillWorkbenchModel;
  onSelectArtifact: (artifact: SkillArtifactKind) => void;
}): ReactElement {
  return (
    <div className="grid min-h-[360px] gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className="overflow-hidden rounded-md border bg-muted/10 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
          <GitBranch className="size-3.5" />
          Skill file graph
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <button
            type="button"
            className={`min-w-0 rounded-md border px-3 py-3 text-left text-foreground shadow-sm ${
              activeArtifact === "skill" ? "border-primary bg-primary/10" : "bg-background"
            }`}
            onClick={() => onSelectArtifact("skill")}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileCode2 className="size-4" />
              SKILL.md
            </div>
            <div className="mt-1 text-xs text-muted-foreground">source document</div>
          </button>
          {model.artifacts
            .filter((artifact) => artifact.id !== "skill")
            .map((artifact) => (
              <button
                key={artifact.id}
                type="button"
                className={`min-w-0 rounded-md border px-3 py-3 text-left text-xs text-foreground shadow-sm ${
                  activeArtifact === artifact.id
                    ? "border-primary bg-primary/10"
                    : "bg-background/95"
                } ${artifact.available ? "" : "opacity-45"}`}
                onClick={() => onSelectArtifact(artifact.id)}
              >
                <div className="truncate font-semibold">{artifact.label}</div>
                <div className="mt-1 truncate text-muted-foreground">{artifact.detail}</div>
              </button>
            ))}
        </div>
      </div>

      <ArtifactViewer activeArtifact={activeArtifact} model={model} />
    </div>
  );
}

function ArtifactViewer({
  activeArtifact,
  model,
}: {
  activeArtifact: SkillArtifactKind;
  model: SkillWorkbenchModel;
}): ReactElement {
  if (activeArtifact === "frontmatter") return <FrontmatterTable model={model} />;
  if (activeArtifact === "todo")
    return <MarkdownBlock label="todo section">{model.todo}</MarkdownBlock>;
  if (activeArtifact === "qa")
    return <MarkdownBlock label="QA tasks">{model.qaTasks}</MarkdownBlock>;
  if (activeArtifact === "checklist") {
    return <MarkdownBlock label="checklist">{model.checklist}</MarkdownBlock>;
  }
  if (activeArtifact === "references") {
    return <MarkdownBlock label="references">{model.references}</MarkdownBlock>;
  }
  if (activeArtifact === "evals")
    return <MarkdownBlock label="eval hints">{model.evals}</MarkdownBlock>;
  if (activeArtifact === "ui") return <MarkdownBlock label="UI hints">{model.ui}</MarkdownBlock>;
  return <MarkdownBlock label="skill document">{model.raw}</MarkdownBlock>;
}

export function SkillWorkbench({
  doc,
  edges,
  invocationCount,
  node,
  onBack,
  onSelectSkill,
  templateIntelligence,
}: {
  doc: SkillDoc | null;
  edges: SkillGraphEdge[];
  invocationCount: number;
  node: SkillGraphNode;
  onBack: () => void;
  onSelectSkill: (skillId: string) => void;
  templateIntelligence: SkillTemplateIntelligencePayload | null;
}): ReactElement {
  const model = useMemo(
    () => buildSkillWorkbenchModel({ doc, edges, invocationCount, node }),
    [doc, edges, invocationCount, node],
  );
  const evalHistory = useSkillEvalHistory(node.id);
  const evalTaskCount = useMemo(
    () => new Set(evalHistory.rows.flatMap((row) => row.tasks.map((task) => task.task_id))).size,
    [evalHistory.rows],
  );
  const scorecard = useMemo(
    () =>
      buildSkillDetailScorecard({
        doc,
        edges,
        evalTaskCount,
        invocationCount,
        model,
        node,
        templateIntelligence,
      }),
    [doc, edges, evalTaskCount, invocationCount, model, node, templateIntelligence],
  );
  const [activeArtifact, setActiveArtifact] = useState<SkillArtifactKind>("skill");

  return (
    <div className="absolute inset-4 z-40 grid overflow-hidden rounded-md border bg-background shadow-2xl">
      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
        <div className="flex min-w-0 items-start justify-between gap-4 border-b bg-muted/25 px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="min-w-0 break-words text-lg font-semibold">{node.id}</h3>
              <Badge style={{ backgroundColor: tierColor(node.tier), color: "white" }}>
                {TIER_LABELS[node.tier ?? 3] ?? "SKILL"}
              </Badge>
              <Badge variant="outline">{node.source ?? "local"}</Badge>
              <Badge variant="secondary">{model.invocationCount} invokes</Badge>
            </div>
            <p className="mt-1 break-all text-xs text-muted-foreground">{node.path}</p>
          </div>
          <Button size="sm" variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 size-4" />
            Back to graph
          </Button>
        </div>

        <Tabs defaultValue="overview" className="flex min-h-0 flex-col p-4">
          <TabsList className="w-fit max-w-full flex-wrap justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="todo">Todo</TabsTrigger>
            <TabsTrigger value="qa">QA Tasks</TabsTrigger>
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
            <TabsTrigger value="references">References</TabsTrigger>
            <TabsTrigger value="file-graph">File Graph</TabsTrigger>
            <TabsTrigger value="evals">Evals</TabsTrigger>
            <TabsTrigger value="ui">UI</TabsTrigger>
            <TabsTrigger value="raw">Raw Files</TabsTrigger>
          </TabsList>

          <ScrollArea className="mt-4 min-h-0 flex-1">
            <TabsContent value="overview" className="m-0 space-y-4">
              <ScorecardPanel scorecard={scorecard} />
              <MaintenanceGapsPanel gaps={scorecard.gaps} />
              <EvalHistoryPanel
                rows={evalHistory.rows}
                skillId={node.id}
                status={evalHistory.status}
              />
              <section className="rounded-md border bg-muted/10 p-4">
                <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Summary
                </h4>
                <p className="text-sm leading-6">{model.summary}</p>
              </section>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-md border p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <GitBranch className="size-4" />
                    Outgoing skill links
                  </div>
                  <div className="space-y-2">
                    {model.outgoing.slice(0, 12).map((edge) => (
                      <button
                        key={`${edge.source}-${edge.target}-${edge.type}-${edge.label}`}
                        type="button"
                        className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/30"
                        onClick={() => onSelectSkill(edge.target)}
                      >
                        <span className="truncate">{edge.target_ref ?? edge.target}</span>
                        <Badge variant={edge.type === "common-chain" ? "secondary" : "outline"}>
                          {edge.type === "common-chain" ? "chain" : "ref"}
                        </Badge>
                      </button>
                    ))}
                    {model.outgoing.length === 0 ? <EmptyRenderer label="outgoing links" /> : null}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <ListChecks className="size-4" />
                    Extracted task signals
                  </div>
                  <div className="grid gap-2 text-sm">
                    {model.artifacts.slice(2, 8).map((artifact) => (
                      <div
                        key={artifact.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] rounded-md border px-3 py-2"
                      >
                        <span className="truncate">{artifact.label}</span>
                        <Badge variant={artifact.available ? "secondary" : "outline"}>
                          {artifact.available ? "found" : "empty"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="todo" className="m-0">
              <MarkdownBlock label="todo section">{model.todo}</MarkdownBlock>
            </TabsContent>
            <TabsContent value="qa" className="m-0">
              <MarkdownBlock label="QA tasks">{model.qaTasks}</MarkdownBlock>
            </TabsContent>
            <TabsContent value="checklist" className="m-0">
              <MarkdownBlock label="checklist">{model.checklist}</MarkdownBlock>
            </TabsContent>
            <TabsContent value="references" className="m-0">
              <MarkdownBlock label="references">{model.references}</MarkdownBlock>
            </TabsContent>
            <TabsContent value="file-graph" className="m-0">
              <FileGraph
                activeArtifact={activeArtifact}
                model={model}
                onSelectArtifact={setActiveArtifact}
              />
            </TabsContent>
            <TabsContent value="evals" className="m-0">
              <MarkdownBlock label="eval hints">{model.evals}</MarkdownBlock>
            </TabsContent>
            <TabsContent value="ui" className="m-0">
              <MarkdownBlock label="UI hints">{model.ui}</MarkdownBlock>
            </TabsContent>
            <TabsContent value="raw" className="m-0">
              <ArtifactViewer activeArtifact="raw" model={model} />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  );
}
