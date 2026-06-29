"use client";

/**
 * EVENT PROGRAMS PANEL
 * ====================
 * Ownership: hook-telemetry UI module.
 * Inputs: recent hook telemetry events.
 * Outputs: non-executing previews of future event-to-mining-program routing.
 * Side effects: none.
 */

import { GitBranch, Play } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { HookTelemetryEvent } from "./raw-telemetry-panel";
import { EventPreviewRow, eventNameFor } from "./timeline-event-preview";

export const EVENT_PROGRAM_PREVIEWS = [
  {
    id: "ticket-completion-review",
    name: "Ticket Completion Review",
    eventName: "farplane.ticket.completed",
    mode: "dry_run",
    program: "ticket-completion-audit-v1",
    output: ".farplane/mine/runs/<run-id>/outputs/",
  },
  {
    id: "decision-miner",
    name: "Decision Miner",
    eventName: "farplane.ticket.progress.changed",
    mode: "planned",
    program: "decision-v1",
    output: ".farplane/mine/runs/<run-id>/outputs/",
  },
  {
    id: "goal-health-check",
    name: "Goal Health Check",
    eventName: "farplane.goals.changed",
    mode: "planned",
    program: "goal-health-v1",
    output: ".farplane/mine/runs/<run-id>/outputs/",
  },
] as const;

export function EventProgramsPanel({ events }: { events: HookTelemetryEvent[] }): ReactElement {
  const [selectedProgramId, setSelectedProgramId] = useState<string>(
    EVENT_PROGRAM_PREVIEWS[0]?.id ?? "",
  );
  const selected =
    EVENT_PROGRAM_PREVIEWS.find((program) => program.id === selectedProgramId) ??
    EVENT_PROGRAM_PREVIEWS[0];
  const matchedEvents = useMemo(
    () => events.filter((event) => eventNameFor(event) === selected.eventName).slice(0, 6),
    [events, selected.eventName],
  );

  return (
    <div className="grid h-full min-h-0 grid-cols-[300px_minmax(0,1fr)] overflow-hidden rounded-md border bg-background">
      <aside className="min-h-0 border-r">
        <div className="border-b px-4 py-3">
          <h2 className="font-medium text-sm">Event Programs</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Routing preview only; execution belongs to mining runs.
          </p>
        </div>
        <ScrollArea className="h-[calc(100%-65px)]">
          <div className="space-y-2 p-3">
            {EVENT_PROGRAM_PREVIEWS.map((program) => (
              <button
                key={program.id}
                type="button"
                className={`w-full rounded-md border px-3 py-3 text-left transition-colors ${
                  program.id === selected.id
                    ? "border-primary bg-primary/10"
                    : "bg-background hover:bg-muted/60"
                }`}
                onClick={() => setSelectedProgramId(program.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-medium text-sm">{program.name}</span>
                  <Badge variant="outline">{program.mode}</Badge>
                </div>
                <p className="mt-2 truncate font-mono text-xs text-muted-foreground">
                  {program.eventName}
                </p>
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <section className="min-h-0">
        <div className="flex h-full min-h-0 flex-col">
          <header className="border-b px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-sm">{selected.name}</h2>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{selected.eventName}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{selected.mode}</Badge>
                <Badge variant="secondary">not scheduled</Badge>
              </div>
            </div>
          </header>
          <ScrollArea className="min-h-0 flex-1">
            <div className="grid gap-5 p-5 xl:grid-cols-2">
              <section className="rounded-md border p-4">
                <div className="flex items-center gap-2">
                  <GitBranch className="size-4 text-muted-foreground" />
                  <h3 className="font-medium text-sm">Trigger</h3>
                </div>
                <div className="mt-4 grid gap-3">
                  <LabeledValue label="Event" value={selected.eventName} />
                  <LabeledValue label="Program" value={selected.program} />
                  <LabeledValue label="Output" value={selected.output} />
                  <LabeledValue label="Mode" value={selected.mode} />
                </div>
              </section>
              <section className="rounded-md border p-4">
                <div className="flex items-center gap-2">
                  <Play className="size-4 text-muted-foreground" />
                  <h3 className="font-medium text-sm">Sample Matches</h3>
                </div>
                <div className="mt-4 space-y-2">
                  {matchedEvents.length === 0 ? (
                    <p className="rounded-md border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
                      No matching events in this filtered window.
                    </p>
                  ) : (
                    matchedEvents.map((event) => (
                      <EventPreviewRow
                        key={event._id ?? event.eventKey ?? `${event.hookName}:${event.eventAt}`}
                        event={event}
                      />
                    ))
                  )}
                </div>
              </section>
            </div>
          </ScrollArea>
        </div>
      </section>
    </div>
  );
}

function LabeledValue({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <Input className="mt-1 font-mono text-xs" readOnly value={value} />
    </div>
  );
}
