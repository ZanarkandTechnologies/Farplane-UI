"use client";

import { Check, ChevronDown, CircleDashed, ExternalLink } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import type { SelfImproveProgressEntry } from "./skill-self-improve-model";
import type { SkillSelfImproveState } from "./use-skill-self-improve";

function decisionVariant(decision: string): "default" | "secondary" | "destructive" | "outline" {
  if (/promote|accept|current best/i.test(decision)) return "default";
  if (/reject|failed|regress/i.test(decision)) return "destructive";
  if (/pending|hold|local/i.test(decision)) return "secondary";
  return "outline";
}

function evalRunHref(skillId: string, runReference: string): string {
  const runId = runReference.split("/").filter(Boolean).at(-1);
  const params = new URLSearchParams({ skill: skillId });
  if (runId) params.set("run", runId);
  return `/evals?${params.toString()}`;
}

function formatEntryDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function SelfImprovePlanSummary({
  objective,
  primaryMetric,
  direction,
  stopRule,
}: {
  objective: string;
  primaryMetric: string;
  direction: string;
  stopRule: string;
}): ReactElement {
  return (
    <section className="grid gap-4 border-y py-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(12rem,0.7fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Objective
        </p>
        <p className="mt-1 [font-family:Inter,sans-serif] text-sm leading-6">
          {objective || "No objective recorded in program.md."}
        </p>
      </div>
      <div className="min-w-0 border-t pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Primary metric
        </p>
        <p className="mt-1 truncate font-mono text-sm" title={primaryMetric}>
          {primaryMetric || "Not recorded"}
        </p>
        {direction ? (
          <p className="mt-1 text-xs text-muted-foreground">Direction: {direction}</p>
        ) : null}
      </div>
      <div className="min-w-0 border-t pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Stop rule
        </p>
        <p className="mt-1 line-clamp-3 [font-family:Inter,sans-serif] text-sm leading-5 text-muted-foreground">
          {stopRule || "No stop rule recorded."}
        </p>
      </div>
    </section>
  );
}

function ScoreTimeline({
  entries,
  selectedEntryId,
  onSelect,
}: {
  entries: SelfImproveProgressEntry[];
  selectedEntryId: string;
  onSelect: (entryId: string) => void;
}): ReactElement | null {
  const scoredEntries = entries.filter((entry) => entry.score);
  const points = entries.map((entry, index) => ({
    entry,
    x: entries.length === 1 ? 50 : 8 + (index / Math.max(entries.length - 1, 1)) * 84,
    y: entry.score ? 78 - entry.score.normalized * 0.62 : 88,
  }));
  const polyline = points
    .filter((point) => point.entry.score)
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  const selected = entries.find((entry) => entry.id === selectedEntryId) ?? entries.at(-1);

  return (
    <section className="pt-1" aria-labelledby="self-improve-score-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4
            id="self-improve-score-title"
            className="[font-family:Inter,sans-serif] text-sm font-semibold"
          >
            Score progression
          </h4>
          <p className="text-xs text-muted-foreground">
            {scoredEntries.length} measured · {entries.length} total
          </p>
        </div>
        {selected ? (
          <Badge variant={selected.score ? "secondary" : "outline"}>
            {selected.score?.display ?? "Unmeasured"}
          </Badge>
        ) : null}
      </div>

      <div className="relative mt-4 h-56 overflow-hidden border-y bg-muted/[0.06] px-3 py-2">
        <div className="text-[9px] text-muted-foreground" aria-hidden="true">
          <span className="absolute left-2 top-4">100</span>
          <span className="absolute left-2 top-[76%]">0</span>
          <span className="absolute bottom-1 left-2">Unmeasured</span>
        </div>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-3 h-[calc(100%_-_1.5rem)] w-[calc(100%_-_1.5rem)]"
          aria-hidden="true"
        >
          <line x1="6" y1="16" x2="94" y2="16" className="stroke-border" strokeDasharray="2 2" />
          <line x1="6" y1="47" x2="94" y2="47" className="stroke-border" strokeDasharray="2 2" />
          <line x1="6" y1="78" x2="94" y2="78" className="stroke-border" />
          <line
            x1="6"
            y1="88"
            x2="94"
            y2="88"
            className="stroke-muted-foreground/40"
            strokeDasharray="1 2"
          />
          {scoredEntries.length > 1 ? (
            <polyline
              points={polyline}
              fill="none"
              className="stroke-primary"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>

        {entries.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            No iterations recorded yet.
          </div>
        ) : null}

        {points.map(({ entry, x, y }, index) => (
          <button
            key={entry.id}
            type="button"
            className="group absolute flex size-11 touch-manipulation -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none ring-offset-background transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring"
            style={{ left: `${x}%`, top: `${y}%` }}
            aria-label={`${entry.title}: ${entry.score?.display ?? "unmeasured"}. ${entry.insight}`}
            aria-pressed={entry.id === selectedEntryId}
            onClick={() => onSelect(entry.id)}
          >
            <span
              className={`size-3 rounded-full border-2 shadow-sm ${
                entry.score
                  ? "border-background bg-primary"
                  : "border-muted-foreground bg-background"
              }`}
              aria-hidden="true"
            />
            <span
              className={`pointer-events-none absolute left-1/2 z-10 hidden w-40 -translate-x-1/2 rounded border bg-popover px-2 py-1.5 text-left text-[10px] leading-4 text-popover-foreground shadow-lg group-hover:block group-focus-visible:block ${
                entry.score ? "top-9" : "bottom-9"
              }`}
            >
              <span className="block font-semibold">
                {index + 1}. {entry.score?.display ?? "Unmeasured"}
              </span>
              <span className="line-clamp-3">{entry.insight}</span>
            </span>
          </button>
        ))}
      </div>

      {selected ? (
        <button
          type="button"
          className="mt-3 grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-3 border-l-2 border-primary bg-primary/[0.04] px-3 py-2.5 text-left hover:bg-primary/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onSelect(selected.id)}
        >
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {selected.score?.display ?? "—"}
          </span>
          <span className="[font-family:Inter,sans-serif] text-sm leading-5">
            {selected.insight}
          </span>
        </button>
      ) : null}
    </section>
  );
}

function ProgressEntry({
  entry,
  open,
  onOpenChange,
  skillId,
}: {
  entry: SelfImproveProgressEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillId: string;
}): ReactElement {
  const evalRun = entry.fields.find((field) => /^eval run$/i.test(field.label));
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="relative pl-7">
      <span className="absolute left-[7px] top-0 h-full w-px bg-border" aria-hidden="true" />
      <span
        className="absolute left-0 top-3 flex size-4 items-center justify-center rounded-full border bg-background"
        aria-hidden="true"
      >
        {/promote|accept|current best/i.test(entry.decision) ? (
          <Check className="size-2.5 text-emerald-500" aria-hidden="true" />
        ) : (
          <CircleDashed className="size-2.5 text-muted-foreground" aria-hidden="true" />
        )}
      </span>
      <div className="border-y bg-card/30">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-3 py-2.5 text-left outline-none hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="[font-family:Inter,sans-serif] text-sm font-semibold">
                  {entry.title}
                </span>
                {entry.score ? <Badge variant="outline">{entry.score.display}</Badge> : null}
                {entry.decision ? (
                  <Badge variant={decisionVariant(entry.decision)}>{entry.decision}</Badge>
                ) : null}
              </span>
              <span className="mt-1 line-clamp-2 block [font-family:Inter,sans-serif] text-xs leading-5 text-muted-foreground">
                {entry.insight}
              </span>
            </span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {entry.date ? (
                <time dateTime={entry.date} className="hidden sm:inline">
                  {formatEntryDate(entry.date)}
                </time>
              ) : null}
              <ChevronDown
                className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t px-3 py-3">
          <dl className="grid gap-3 md:grid-cols-2">
            {entry.fields.map((field) => (
              <div key={`${entry.id}-${field.label}`} className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {field.label}
                </dt>
                <dd className="mt-1 break-words text-sm leading-5">{field.value || "—"}</dd>
              </div>
            ))}
          </dl>
          {evalRun?.value && !/^(?:pending|none)$/i.test(evalRun.value) ? (
            <Button asChild size="sm" variant="outline" className="mt-4">
              <a href={evalRunHref(skillId, evalRun.value)}>
                <ExternalLink className="size-4" aria-hidden="true" />
                Open eval evidence
              </a>
            </Button>
          ) : null}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function SkillSelfImprovePanel({
  programPath,
  progressPath,
  skillId,
  state,
}: {
  programPath?: string;
  progressPath?: string;
  skillId: string;
  state: SkillSelfImproveState;
}): ReactElement {
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const entries = state.projection?.entries ?? [];

  const selectedId =
    selectedEntryId ||
    entries.filter((entry) => entry.score).at(-1)?.id ||
    entries.at(-1)?.id ||
    "";
  const openEntries = useMemo(
    () => new Set(selectedEntryId ? [selectedEntryId] : []),
    [selectedEntryId],
  );

  if (state.status === "loading" || state.status === "idle") {
    return (
      <output className="grid gap-3" aria-label="Loading self-improvement history">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-20 w-full" />
      </output>
    );
  }

  if (state.status === "error" || !state.projection) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
        {state.error || "Self-improvement history unavailable."}
      </div>
    );
  }

  return (
    <div className="grid gap-7 pb-2">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <p className="[font-family:Inter,sans-serif] text-xs text-muted-foreground">
          {entries.length} recorded {entries.length === 1 ? "iteration" : "iterations"}
        </p>
        <div className="flex gap-2">
          {programPath ? (
            <span className="font-mono text-[10px] text-muted-foreground">program.md</span>
          ) : null}
          {progressPath ? (
            <span className="font-mono text-[10px] text-muted-foreground">progress.md</span>
          ) : null}
        </div>
      </div>

      <ScoreTimeline entries={entries} selectedEntryId={selectedId} onSelect={setSelectedEntryId} />
      <SelfImprovePlanSummary {...state.projection.plan} />

      <section aria-labelledby="self-improve-history-title">
        <div className="mb-3 flex items-center justify-between gap-3 border-t pt-6">
          <h4
            id="self-improve-history-title"
            className="[font-family:Inter,sans-serif] text-sm font-semibold"
          >
            Timeline
          </h4>
          <span className="text-xs text-muted-foreground">Newest last</span>
        </div>
        {entries.length > 0 ? (
          <div className="grid gap-2">
            {entries.map((entry) => (
              <ProgressEntry
                key={entry.id}
                entry={entry}
                open={openEntries.has(entry.id)}
                onOpenChange={(open) => setSelectedEntryId(open ? entry.id : "")}
                skillId={skillId}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No progress entries recorded yet.
          </div>
        )}
      </section>
    </div>
  );
}
