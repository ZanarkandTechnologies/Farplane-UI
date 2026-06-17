"use client";

/**
 * RAW HOOK TELEMETRY PANEL
 * ========================
 * Ownership: hook-telemetry UI module.
 * Inputs: Convex hookTelemetry explorer query plus local hook setup defaults.
 * Outputs: compact event log, distribution summary, and hook installation guidance.
 * Side effects: optional clipboard copy only.
 */

import { Copy, Search } from "lucide-react";
import { useMemo, useState, type ReactElement } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { UI_Z } from "@/lib/z-index";
import { isConvexEnabled } from "@/providers/convex-provider";
import { useOfficeAccessMode } from "@/providers/office-access-mode-provider";

type RawTelemetryPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type HookTelemetryEvent = {
  _id?: string;
  hookName: string;
  hookType: string;
  eventName?: string;
  projectId?: string;
  sessionId?: string;
  payload?: unknown;
  eventAt: number;
  eventKey?: string;
};

type DistributionRow = {
  key: string;
  count: number;
};

type HookTelemetryExplorer = {
  events: HookTelemetryEvent[];
  total: number;
  distributions: {
    hookNames: DistributionRow[];
    hookTypes: DistributionRow[];
    eventNames: DistributionRow[];
    sessions: DistributionRow[];
  };
};

const RANGE_OPTIONS = [
  { label: "1 day", value: 1 },
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
] as const;

const EVENT_FILTERS = ["all", "skill.invoked", "file.changed", "thread.started", "thread.stopped"] as const;
const HOOK_INSTALL_COMMAND = "npm run hooks:install";
const DEFAULT_FILE_PATTERNS = [
  "progress.md",
  "goals.md",
  "tickets/*/ticket.md",
  "tickets/*/progress.md",
  "tickets/*/program.md",
  "docs/*.md",
  "docs/**/*.md",
  "evals/**",
  "skills/*/memory.md",
].join("\n");

export function RawTelemetryPanel({ open, onOpenChange }: RawTelemetryPanelProps): ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[88vh] min-w-[86vw] max-w-none flex-col overflow-hidden p-0"
        style={{ zIndex: UI_Z.panelElevated }}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Raw Telemetry</DialogTitle>
        </DialogHeader>
        <RawTelemetryContent />
      </DialogContent>
    </Dialog>
  );
}

function RawTelemetryContent(): ReactElement {
  const { isReadOnly } = useOfficeAccessMode();
  const convexEnabled = isConvexEnabled();
  const [rangeDays, setRangeDays] = useState(7);
  const [hookName, setHookName] = useState("");
  const [hookType, setHookType] = useState("");
  const [eventName, setEventName] = useState<(typeof EVENT_FILTERS)[number]>("all");
  const queryArgs = useMemo(
    () => ({
      rangeDays,
      limit: 500,
      hookName: hookName.trim() || undefined,
      hookType: hookType.trim() || undefined,
      eventName: eventName === "all" ? undefined : eventName,
    }),
    [eventName, hookName, hookType, rangeDays],
  );
  const data = useQuery(
    api.modules.hookTelemetry.queries.getHookTelemetryExplorer,
    convexEnabled && !isReadOnly ? queryArgs : "skip",
  ) as HookTelemetryExplorer | undefined;

  if (isReadOnly) {
    return (
      <div className="px-6 py-6">
        <StateCard title="Raw telemetry locked" detail="Raw hook events are only available in operator mode." />
      </div>
    );
  }

  if (!convexEnabled) {
    return (
      <div className="px-6 py-6">
        <StateCard title="Raw telemetry unavailable" detail="Convex is not configured for this UI session." />
      </div>
    );
  }

  return (
    <Tabs defaultValue="events" className="flex min-h-0 flex-1 flex-col px-6 pb-6 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="hooks">Hooks</TabsTrigger>
        </TabsList>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(rangeDays)} onValueChange={(value) => setRangeDays(Number(value))}>
            <SelectTrigger aria-label="Raw telemetry range" size="sm" className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={eventName} onValueChange={(value) => setEventName(value as typeof eventName)}>
            <SelectTrigger aria-label="Event name filter" size="sm" className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_FILTERS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === "all" ? "All events" : option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="-translate-y-1/2 absolute top-1/2 left-2 size-3.5 text-muted-foreground" />
            <Input
              aria-label="Hook name filter"
              className="h-8 w-[170px] pl-7"
              placeholder="hook name"
              value={hookName}
              onChange={(event) => setHookName(event.target.value)}
            />
          </div>
          <Input
            aria-label="Hook type filter"
            className="h-8 w-[140px]"
            placeholder="hook type"
            value={hookType}
            onChange={(event) => setHookType(event.target.value)}
          />
        </div>
      </div>

      <TabsContent value="events" className="mt-3 min-h-0 flex-1">
        {data ? <EventTable rows={data.events} total={data.total} /> : <StateCard title="Loading events" detail="Reading hook telemetry rows..." />}
      </TabsContent>
      <TabsContent value="distribution" className="mt-3 min-h-0 flex-1">
        {data ? <DistributionGrid data={data.distributions} total={data.total} /> : <StateCard title="Loading distribution" detail="Aggregating hook telemetry rows..." />}
      </TabsContent>
      <TabsContent value="hooks" className="mt-3 min-h-0 flex-1">
        <HooksSetup />
      </TabsContent>
    </Tabs>
  );
}

function EventTable({ rows, total }: { rows: HookTelemetryEvent[]; total: number }): ReactElement {
  if (rows.length === 0) {
    return <StateCard title="No hook events" detail="Install hooks or widen the filters to see raw event rows." />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="text-xs text-muted-foreground">{total} event{total === 1 ? "" : "s"} in the current window</div>
      <ScrollArea className="min-h-0 flex-1 pr-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Hook</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Session</TableHead>
              <TableHead>Payload</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row._id ?? row.eventKey ?? `${row.hookName}:${row.eventAt}`}>
                <TableCell className="whitespace-nowrap text-xs">{formatDate(row.eventAt)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{row.eventName ?? "unknown"}</Badge>
                </TableCell>
                <TableCell className="max-w-[180px] truncate font-mono text-xs">{row.hookName}</TableCell>
                <TableCell className="max-w-[140px] truncate">{row.hookType}</TableCell>
                <TableCell className="max-w-[180px] truncate font-mono text-xs">{row.sessionId ?? "none"}</TableCell>
                <TableCell className="max-w-[360px] truncate font-mono text-xs text-muted-foreground">
                  {payloadPreview(row.payload)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

function DistributionGrid({
  data,
  total,
}: {
  data: HookTelemetryExplorer["distributions"];
  total: number;
}): ReactElement {
  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-2">
      <DistributionCard title="Event Names" rows={data.eventNames} total={total} />
      <DistributionCard title="Hook Names" rows={data.hookNames} total={total} />
      <DistributionCard title="Hook Types" rows={data.hookTypes} total={total} />
      <DistributionCard title="Sessions" rows={data.sessions} total={total} />
    </div>
  );
}

function DistributionCard({ rows, title, total }: { rows: DistributionRow[]; title: string; total: number }): ReactElement {
  return (
    <Card className="min-h-0 rounded-md">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No rows.</p> : null}
        {rows.map((row) => (
          <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_56px] items-center gap-3 text-sm">
            <div className="min-w-0">
              <div className="truncate font-medium">{row.key}</div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${Math.max(4, (row.count / Math.max(1, total)) * 100)}%` }} />
              </div>
            </div>
            <div className="text-right font-mono text-xs text-muted-foreground">{row.count}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function HooksSetup(): ReactElement {
  const [copied, setCopied] = useState(false);

  async function copyCommand(): Promise<void> {
    if (!navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(HOOK_INSTALL_COMMAND);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_200);
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Card className="rounded-md">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Install Hooks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded border bg-muted px-2 py-1.5 text-xs">
              {HOOK_INSTALL_COMMAND}
            </code>
            <Button size="icon" variant="outline" aria-label="Copy hook install command" onClick={() => void copyCommand()}>
              <Copy className="size-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{copied ? "Copied" : "CLI install"}</Badge>
            <Badge variant="outline">Open /hooks to trust</Badge>
            <Badge variant="outline">Posts to /telemetry/hooks</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="min-h-0 rounded-md">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">File Change Matcher</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="file-change-patterns">Watched patterns</Label>
          <p className="text-xs text-muted-foreground">
            Default preview. Runtime overrides come from <code>FARPLANE_FILE_CHANGE_PATTERNS</code>.
          </p>
          <Textarea
            id="file-change-patterns"
            className="h-[260px] resize-none font-mono text-xs"
            readOnly
            value={DEFAULT_FILE_PATTERNS}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function StateCard({ detail, title }: { detail: string; title: string }): ReactElement {
  return (
    <Card className="rounded-md">
      <CardContent className="py-8">
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function formatDate(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function payloadPreview(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const record = payload as Record<string, unknown>;
  const safePayload = {
    eventName: stringValue(record.eventName),
    message: stringValue(record.message),
    skillId: stringValue(record.skillId),
    threadId: stringValue(record.threadId),
    paths: Array.isArray(record.paths)
      ? record.paths.filter((entry): entry is string => typeof entry === "string").slice(0, 5)
      : undefined,
  };
  const entries = Object.entries(safePayload).filter(([, value]) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value),
  );
  if (entries.length === 0) return "redacted";
  try {
    return JSON.stringify(Object.fromEntries(entries)).slice(0, 220);
  } catch {
    return "[unserializable]";
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 140) : undefined;
}
