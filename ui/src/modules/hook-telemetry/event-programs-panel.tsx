"use client";

/** Read-only projection of Core-owned mining routes and immutable programs. */
import { GitBranch, Play } from "lucide-react";
import { type ReactElement, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { HookTelemetryEvent } from "./raw-telemetry-panel";
import { EventPreviewRow, eventNameFor } from "./timeline-event-preview";

type CoreProgram = {
  id: string;
  name: string;
  version?: string;
  objective?: string;
  programRef?: string;
  programDigest?: string;
};

type CoreRoute = {
  id: string;
  eventName: string;
  programRef: string;
  enabled: boolean;
};

function records(value: unknown, key: string): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  if (Array.isArray(value[key])) return value[key].filter(isRecord);
  return isRecord(value.data) ? records(value.data, key) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeProgram(row: Record<string, unknown>): CoreProgram | null {
  const id = String(row.id ?? "").trim();
  const name = String(row.name ?? id).trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    version: String(row.version ?? "").trim() || undefined,
    objective: String(row.objective ?? "").trim() || undefined,
    programRef: String(row.programRef ?? row.program_ref ?? row.ref ?? "").trim() || undefined,
    programDigest:
      String(row.programDigest ?? row.program_digest ?? row.digest ?? "").trim() || undefined,
  };
}

function normalizeRoute(row: Record<string, unknown>): CoreRoute | null {
  const id = String(row.id ?? row.route_id ?? "").trim();
  const eventName = String(row.eventName ?? row.event_name ?? row.event ?? "").trim();
  const programRef = String(row.programRef ?? row.program_ref ?? row.program ?? "").trim();
  if (!id || !eventName || !programRef) return null;
  return { id, eventName, programRef, enabled: row.enabled !== false };
}

export function EventProgramsPanel({ events }: { events: HookTelemetryEvent[] }): ReactElement {
  const [programs, setPrograms] = useState<CoreProgram[]>([]);
  const [routes, setRoutes] = useState<CoreRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [eventDraft, setEventDraft] = useState("");
  const [programDraft, setProgramDraft] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetch("/farplane/mine/programs").then((response) => {
        if (!response.ok) throw new Error("programs_unavailable");
        return response.json();
      }),
      fetch("/farplane/mine/routes").then((response) => {
        if (!response.ok) throw new Error("routes_unavailable");
        return response.json();
      }),
    ])
      .then(([programPayload, routePayload]) => {
        if (!active) return;
        const nextPrograms = records(programPayload, "programs")
          .map(normalizeProgram)
          .filter((row): row is CoreProgram => Boolean(row));
        const nextRoutes = records(routePayload, "routes")
          .map(normalizeRoute)
          .filter((row): row is CoreRoute => Boolean(row));
        setPrograms(nextPrograms);
        setRoutes(nextRoutes);
        setSelectedRouteId((current) => current || nextRoutes[0]?.id || "");
        setState("ready");
      })
      .catch(() => {
        if (active) setState("unavailable");
      });
    return () => {
      active = false;
    };
  }, []);

  const selected = routes.find((route) => route.id === selectedRouteId) ?? routes[0];
  const program = programs.find(
    (candidate) =>
      candidate.programRef === selected?.programRef || candidate.id === selected?.programRef,
  );
  const matchedEvents = useMemo(
    () => events.filter((event) => eventNameFor(event) === selected?.eventName).slice(0, 6),
    [events, selected?.eventName],
  );

  useEffect(() => {
    setEventDraft(selected?.eventName ?? "");
    setProgramDraft(selected?.programRef ?? "");
  }, [selected?.eventName, selected?.programRef]);

  const saveRoute = async (): Promise<void> => {
    if (!selected || !eventDraft.trim() || !programDraft.trim()) return;
    setMessage("Saving through Core…");
    try {
      const response = await fetch("/farplane/mine/routes", {
        method: "POST",
        headers: { "content-type": "application/json", "x-farplane-actor-role": "operator" },
        body: JSON.stringify({ id: selected.id, eventName: eventDraft, programRef: programDraft }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(String(payload.error ?? "route_save_failed"));
      setRoutes(
        records(payload, "routes")
          .map(normalizeRoute)
          .filter((row): row is CoreRoute => Boolean(row)),
      );
      setMessage("Core route saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "route_save_failed");
    }
  };

  const removeRoute = async (): Promise<void> => {
    if (!selected) return;
    setMessage("Removing through Core…");
    try {
      const response = await fetch(`/farplane/mine/routes/${encodeURIComponent(selected.id)}`, {
        method: "DELETE",
        headers: { "x-farplane-actor-role": "operator" },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(String(payload.error ?? "route_remove_failed"));
      const nextRoutes = records(payload, "routes")
        .map(normalizeRoute)
        .filter((row): row is CoreRoute => Boolean(row));
      setRoutes(nextRoutes);
      setSelectedRouteId(nextRoutes[0]?.id ?? "");
      setMessage("Core route removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "route_remove_failed");
    }
  };

  if (state !== "ready" || !selected) {
    return (
      <div className="rounded-md border bg-muted/20 p-6 text-sm text-muted-foreground">
        {state === "loading"
          ? "Loading Core mining registry…"
          : "Core mining routes are unavailable. No UI-owned fallback routes are applied."}
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[300px_minmax(0,1fr)] overflow-hidden rounded-md border bg-background">
      <aside className="min-h-0 border-r">
        <div className="border-b px-4 py-3">
          <h2 className="font-medium text-sm">Core Routes</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Programs are immutable; routing is owned by Core.
          </p>
        </div>
        <ScrollArea className="h-[calc(100%-65px)]">
          <div className="space-y-2 p-3">
            {routes.map((route) => (
              <button
                key={route.id}
                type="button"
                className={`w-full rounded-md border px-3 py-3 text-left transition-colors ${
                  route.id === selected.id ? "border-primary bg-primary/10" : "hover:bg-muted/60"
                }`}
                onClick={() => setSelectedRouteId(route.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-sm">{route.id}</span>
                  <Badge variant="outline">{route.enabled ? "enabled" : "disabled"}</Badge>
                </div>
                <p className="mt-2 truncate font-mono text-xs text-muted-foreground">
                  {route.eventName}
                </p>
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>
      <section className="min-h-0">
        <header className="border-b px-5 py-3">
          <h2 className="font-semibold text-sm">{program?.name ?? selected.programRef}</h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{selected.eventName}</p>
        </header>
        <ScrollArea className="h-[calc(100%-65px)]">
          <div className="grid gap-5 p-5 xl:grid-cols-2">
            <section className="rounded-md border p-4">
              <div className="flex items-center gap-2">
                <GitBranch className="size-4" />
                <h3 className="font-medium text-sm">Core binding</h3>
              </div>
              <div className="mt-4 grid gap-3">
                <EditableValue label="Event" value={eventDraft} onChange={setEventDraft} />
                <EditableValue
                  label="Program ref"
                  value={programDraft}
                  onChange={setProgramDraft}
                />
                <LabeledValue
                  label="Digest"
                  value={program?.programDigest ?? "reported by Core at run time"}
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => void saveRoute()}>
                    Save route
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void removeRoute()}>
                    Remove
                  </Button>
                </div>
                {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
              </div>
            </section>
            <section className="rounded-md border p-4">
              <div className="flex items-center gap-2">
                <Play className="size-4" />
                <h3 className="font-medium text-sm">Mirror matches</h3>
              </div>
              <div className="mt-4 space-y-2">
                {matchedEvents.length ? (
                  matchedEvents.map((event) => (
                    <EventPreviewRow
                      key={event._id ?? event.eventKey ?? `${event.hookName}:${event.eventAt}`}
                      event={event}
                    />
                  ))
                ) : (
                  <p className="rounded-md border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
                    No mirrored events in this window.
                  </p>
                )}
              </div>
            </section>
          </div>
        </ScrollArea>
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

function EditableValue({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <Input
        className="mt-1 font-mono text-xs"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
