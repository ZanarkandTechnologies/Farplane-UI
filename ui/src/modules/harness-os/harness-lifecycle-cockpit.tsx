"use client";

/**
 * Harness OS lifecycle cockpit.
 *
 * Ownership: Harness OS read-only mini app.
 * Inputs: generated lifecycle projection model from /codex/skill-maintenance-graph.
 * Outputs: operator-facing lifecycle, guardrail, confidence, and FSA projection views.
 * Side effects: local selection state only; no writes.
 * Invariants: graph data is generated upstream and treated as read-only UI evidence.
 */

import { AlertTriangle, CheckCircle2, CircleDashed, GitBranch, ShieldCheck } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  humanizeLifecycleState,
  type HarnessLifecycleModel,
  type HarnessLifecycleStage,
} from "./harness-os-model";

const STATUS_STYLES: Record<HarnessLifecycleStage["readiness"], string> = {
  active: "border-sky-500 bg-sky-500/10 text-sky-900 dark:text-sky-100",
  missing: "border-border bg-muted/30 text-muted-foreground",
  partial: "border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-100",
  ready: "border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
};

const STATUS_ICON = {
  active: CircleDashed,
  missing: AlertTriangle,
  partial: CircleDashed,
  ready: CheckCircle2,
};

function formatGeneratedAt(value: string): string {
  if (value === "not generated" || value === "unknown") return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

function confidenceTotal(confidence: Record<string, number>): number {
  return Object.values(confidence).reduce((total, value) => total + value, 0);
}

function StageButton({
  index,
  isSelected,
  onSelect,
  stage,
}: {
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  stage: HarnessLifecycleStage;
}): ReactElement {
  const Icon = STATUS_ICON[stage.readiness];
  return (
    <button
      type="button"
      className={cn(
        "group relative flex min-h-[10.5rem] min-w-0 flex-col justify-between rounded-md border p-4 text-left transition hover:border-primary/60 hover:bg-muted/30",
        STATUS_STYLES[stage.readiness],
        isSelected ? "ring-2 ring-primary/50" : "",
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">
            Stage {index + 1}
          </p>
          <h3 className="text-base font-semibold leading-5">{stage.title}</h3>
        </div>
        <Icon className="h-4 w-4 shrink-0" />
      </div>
      <p className="line-clamp-3 text-sm leading-5 text-muted-foreground">{stage.description}</p>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline">{stage.nodeIds.length || "n/a"} states</Badge>
        <Badge variant="outline">{stage.guardrailCount} guards</Badge>
      </div>
    </button>
  );
}

function ConfidenceBars({ confidence }: { confidence: Record<string, number> }): ReactElement {
  const total = confidenceTotal(confidence);
  const rows = ["explicit", "curated", "parsed"].map((key) => ({
    key,
    value: confidence[key] ?? 0,
  }));

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const width = total > 0 ? `${Math.max(8, (row.value / total) * 100)}%` : "8%";
        return (
          <div key={row.key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium capitalize">{row.key}</span>
              <span className="tabular-nums text-muted-foreground">{row.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary/75" style={{ width }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProjectionTrack({
  activeProjectionId,
  model,
}: {
  activeProjectionId: string;
  model: HarnessLifecycleModel;
}): ReactElement {
  const projection = model.projections.find((item) => item.id === activeProjectionId);
  if (!projection) {
    return (
      <div className="flex min-h-[16rem] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Lifecycle FSA projections will appear when the generated graph is installed.
      </div>
    );
  }

  return (
    <ScrollArea className="min-h-0 w-full max-w-full overflow-hidden rounded-md border bg-background">
      <div className="flex min-w-max items-center gap-3 p-4">
        {projection.states.map((stateId, index) => {
          const isStart = stateId === projection.start;
          const isTerminal = projection.terminal.includes(stateId);
          return (
            <div key={stateId} className="flex items-center gap-3">
              <div
                className={cn(
                  "grid h-24 w-44 content-between rounded-md border bg-muted/20 p-3",
                  isStart ? "border-sky-500 bg-sky-500/10" : "",
                  isTerminal ? "border-emerald-500 bg-emerald-500/10" : "",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                    {isStart ? "Start" : isTerminal ? "Terminal" : `Step ${index + 1}`}
                  </span>
                  <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium leading-5">{humanizeLifecycleState(stateId)}</p>
              </div>
              {index < projection.states.length - 1 ? (
                <div className="h-px w-8 bg-border" aria-hidden="true" />
              ) : null}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

function StageInspector({ stage }: { stage: HarnessLifecycleStage }): ReactElement {
  const edgeRows = Object.entries(stage.edgeTypes);
  return (
    <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-md border bg-background">
      <div className="border-b p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Selected stage</p>
            <h3 className="mt-1 text-lg font-semibold">{stage.title}</h3>
          </div>
          <Badge variant="outline" className="capitalize">
            {stage.readiness}
          </Badge>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{stage.description}</p>
      </div>
      <ScrollArea className="min-h-0">
        <div className="space-y-5 p-4">
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Transition Mix</h4>
            <div className="grid grid-cols-2 gap-2">
              {edgeRows.length > 0 ? (
                edgeRows.map(([type, count]) => (
                  <div key={type} className="rounded-md border p-3">
                    <p className="truncate text-xs text-muted-foreground">{type}</p>
                    <p className="text-xl font-semibold tabular-nums">{count}</p>
                  </div>
                ))
              ) : (
                <div className="col-span-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  No transition details in the current graph projection.
                </div>
              )}
            </div>
          </section>
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Evidence</h4>
            <div className="space-y-2">
              {stage.evidenceRefs.length > 0 ? (
                stage.evidenceRefs.slice(0, 6).map((ref) => (
                  <div key={ref} className="rounded-md border px-3 py-2 font-mono text-xs">
                    {ref}
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Evidence refs need the lifecycle graph artifact.
                </div>
              )}
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

export function HarnessLifecycleCockpit({
  model,
}: {
  model: HarnessLifecycleModel;
}): ReactElement {
  const [selectedStageId, setSelectedStageId] = useState(model.stages[0]?.id ?? "");
  const [activeProjectionId, setActiveProjectionId] = useState(model.projections[0]?.id ?? "");
  const selectedStage =
    model.stages.find((stage) => stage.id === selectedStageId) ?? model.stages[0] ?? null;
  const readiness = useMemo(
    () => model.stages.reduce<Record<string, number>>((state, stage) => {
      state[stage.readiness] = (state[stage.readiness] ?? 0) + 1;
      return state;
    }, {}),
    [model.stages],
  );

  return (
    <div className="grid min-h-full gap-4 overflow-auto xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <main className="grid min-w-0 gap-4 xl:min-h-0 xl:grid-rows-[auto_auto_minmax(0,1fr)]">
        <section className="w-full max-w-full overflow-hidden rounded-md border bg-background p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Harness lifecycle cockpit
              </div>
              <h2 className="mt-2 break-words text-2xl font-semibold tracking-normal">
                Pilot to production-ready automation
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                A generated map of the core loops, guardrails, proof surfaces, and upkeep paths
                that make the Harness usable as an operating system.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              {[
                ["nodes", model.summary.nodes],
                ["edges", model.summary.edges],
                ["FSA", model.summary.fsaProjections],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border px-3 py-2 text-right">
                  <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
                  <p className="text-lg font-semibold tabular-nums">{value}</p>
                </div>
              ))}
            </div>
          </div>
          {!model.graphAvailable ? (
            <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
              Lifecycle graph artifact not found yet. Showing the intended cockpit structure with
              fallback stages.
            </div>
          ) : null}
        </section>

        <section className="grid w-full min-w-0 max-w-full gap-3 overflow-hidden md:grid-cols-2 2xl:grid-cols-4">
          {model.stages.map((stage, index) => (
            <StageButton
              index={index}
              isSelected={selectedStage?.id === stage.id}
              key={stage.id}
              onSelect={() => setSelectedStageId(stage.id)}
              stage={stage}
            />
          ))}
        </section>

        <section className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {model.projections.map((projection) => (
                <Button
                  key={projection.id}
                  size="sm"
                  type="button"
                  variant={projection.id === activeProjectionId ? "default" : "outline"}
                  onClick={() => setActiveProjectionId(projection.id)}
                >
                  {projection.label}
                </Button>
              ))}
              {model.projections.length === 0 ? (
                <Badge variant="outline">FSA projections pending</Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Generated {formatGeneratedAt(model.generatedAt)}
            </p>
          </div>
          <ProjectionTrack activeProjectionId={activeProjectionId} model={model} />
        </section>
      </main>

      <aside className="grid min-w-0 gap-4 xl:min-h-0 xl:grid-rows-[auto_auto_minmax(0,1fr)]">
        <section className="rounded-md border bg-background p-4">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">Readiness</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["ready", "active", "partial", "missing"] as const).map((state) => (
              <div key={state} className={cn("rounded-md border px-3 py-2", STATUS_STYLES[state])}>
                <p className="text-[10px] uppercase text-muted-foreground">{state}</p>
                <p className="text-xl font-semibold tabular-nums">{readiness[state] ?? 0}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border bg-background p-4">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">Confidence</h3>
          <div className="mt-3">
            <ConfidenceBars confidence={model.confidence} />
          </div>
        </section>

        {selectedStage ? <StageInspector stage={selectedStage} /> : null}
      </aside>
    </div>
  );
}
