"use client";

import { CheckCircle2 } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import type { HookTelemetryEvent } from "./raw-telemetry-panel";

export function EventPreviewRow({ event }: { event: HookTelemetryEvent }): ReactElement {
  return (
    <div className="rounded-md border bg-background/50 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 truncate font-mono text-xs">{eventNameFor(event)}</div>
        <Badge variant="outline">{formatTime(event.eventAt)}</Badge>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="size-3.5" />
        <span className="min-w-0 truncate">{payloadSummary(event.payload)}</span>
      </div>
    </div>
  );
}

export function eventNameFor(event: HookTelemetryEvent): string {
  if (event.eventName) return event.eventName;
  if (event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)) {
    const candidate = (event.payload as Record<string, unknown>).eventName;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return "unknown";
}

function payloadSummary(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return "No payload preview";
  const record = payload as Record<string, unknown>;
  const entityId = stringValue(record.entityId) ?? stringValue(record.ticketId);
  const path = stringValue(record.path) ?? pathsValue(record.paths);
  const changedFields = Array.isArray(record.changedFields)
    ? `${record.changedFields.length} changed fields`
    : undefined;
  const message = stringValue(record.message);
  return [entityId, path, changedFields, message].filter(Boolean).join(" · ") || "Redacted payload";
}

function pathsValue(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  const paths = value.filter((entry): entry is string => typeof entry === "string").slice(0, 2);
  return paths.length > 0 ? paths.join(", ") : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 140) : undefined;
}

function formatTime(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
