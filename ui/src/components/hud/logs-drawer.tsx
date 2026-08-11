import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Clock3,
  Database,
  GitCompareArrows,
  RefreshCw,
  Search,
  ShieldAlert,
  TerminalSquare,
} from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { UI_Z } from "@/lib/z-index";
import { hasGatewayToken, stateBase } from "@/modules/runtime";
import type {
  RuntimeAdapterKind,
  SessionRowModel,
  SessionTimelineModel,
  UnifiedOfficeModel,
} from "@/modules/runtime";
import { useOfficeRuntimeAdapter } from "@/modules/runtime";
import { isConvexEnabled } from "@/providers/convex-provider";
import { useAppStore } from "@/store";

import {
  connectionRecoveryCopy,
  filterRuntimeLines,
  runtimeEndpointLabel,
  runtimeEndpointUrl,
  sanitizeRuntimeText,
} from "./runtime-health-model";

type LogsDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gatewayBase: string;
};

type ConnectionStatus = "ok" | "unauthorized" | "unreachable" | "error";
type Severity = "ok" | "warn" | "error" | "muted";

type HookTelemetryEvent = {
  hookName: string;
  hookType: string;
  eventName?: string;
  projectId?: string;
  sessionId?: string;
  eventAt: number;
};

type HookTelemetryExplorer = {
  events: HookTelemetryEvent[];
  total: number;
};

type HealthCard = {
  label: string;
  value: string;
  detail: string;
  severity: Severity;
};

type Finding = {
  title: string;
  detail: string;
  severity: Severity;
};

const HOOK_STALE_MS = 10 * 60 * 1000;
const AGENT_EVENT_STALE_MS = 5 * 60 * 1000;

export function LogsDrawer({
  open,
  onOpenChange,
  gatewayBase,
}: LogsDrawerProps): React.JSX.Element {
  const adapter = useOfficeRuntimeAdapter();
  const convexEnabled = isConvexEnabled();
  const setIsTelemetryPanelOpen = useAppStore((state) => state.setIsTelemetryPanelOpen);
  const setTelemetryPanelTab = useAppStore((state) => state.setTelemetryPanelTab);
  const [unified, setUnified] = useState<UnifiedOfficeModel | null>(null);
  const [sessions, setSessions] = useState<SessionRowModel[]>([]);
  const [timeline, setTimeline] = useState<SessionTimelineModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [diagStatus, setDiagStatus] = useState("");
  const [sessionStatus, setSessionStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("ok");

  const recentAgentEvents = convexEnabled
    ? useQuery(
        api.status.getRecentAgentEvents,
        open
          ? {
              limit: 120,
              windowMs: 120_000,
            }
          : "skip",
      )
    : undefined;

  const hookTelemetry = convexEnabled
    ? (useQuery(
        api.modules.hookTelemetry.queries.getHookTelemetryExplorer,
        open
          ? {
              rangeDays: 1,
              limit: 40,
            }
          : "skip",
      ) as HookTelemetryExplorer | undefined)
    : undefined;

  async function refresh(): Promise<void> {
    setLoading(true);
    setError("");
    setDiagStatus("");
    setSessionStatus("");
    try {
      const [configSnapshot, runtimeAgents] = await Promise.all([
        adapter.getConfigSnapshot(),
        adapter.listAgents(),
      ]);
      const configAgentsList = Array.isArray(
        (configSnapshot.config.agents as Record<string, unknown> | undefined)?.list,
      )
        ? (((configSnapshot.config.agents as Record<string, unknown>).list as unknown[]) ?? [])
        : [];
      const nextUnified = await adapter.getUnifiedOfficeModel();
      setConnectionStatus("ok");
      setUnified(nextUnified);
      if (configAgentsList.length === 0) {
        setDiagStatus("empty_config: agents.list is empty");
      } else if (runtimeAgents.length === 0) {
        setDiagStatus("empty_runtime: no running agents from /openclaw/agents");
      }
      const selectedAgent = runtimeAgents[0] ?? nextUnified.runtimeAgents[0];
      if (!selectedAgent) {
        setSessions([]);
        setTimeline(null);
        return;
      }
      let nextSessions: SessionRowModel[] = [];
      try {
        nextSessions = await adapter.listSessions(selectedAgent.agentId);
      } catch (cause) {
        const message =
          cause instanceof Error ? `session_list_failed:${cause.message}` : "session_list_failed";
        setSessionStatus(message);
        setSessions([]);
        setTimeline(null);
        return;
      }
      setSessions(nextSessions);
      const selectedSession = nextSessions[0];
      if (!selectedSession) {
        setTimeline(null);
        return;
      }
      try {
        const nextTimeline = await adapter.getSessionTimeline(
          selectedAgent.agentId,
          selectedSession.sessionKey,
          100,
        );
        setTimeline(nextTimeline);
      } catch (cause) {
        const message =
          cause instanceof Error
            ? `session_timeline_failed:${cause.message}`
            : "session_timeline_failed";
        setSessionStatus(message);
        setTimeline({
          agentId: selectedAgent.agentId,
          sessionKey: selectedSession.sessionKey,
          events: [],
        });
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "runtime_health_load_failed";
      setError(message);
      if (message.includes(":401") || message.includes(":403")) {
        setConnectionStatus("unauthorized");
      } else if (message.includes("request_unreachable")) {
        setConnectionStatus("unreachable");
      } else {
        setConnectionStatus("error");
      }
    } finally {
      setLoading(false);
    }
  }

  async function reloadConfig(): Promise<void> {
    try {
      const snapshot = await adapter.getConfigSnapshot();
      const list = (
        ((snapshot.config.agents as Record<string, unknown> | undefined)?.list as unknown[]) ?? []
      ).length;
      setDiagStatus(`config_loaded: agents.list=${list}`);
    } catch (cause) {
      setDiagStatus(
        cause instanceof Error ? `config_load_failed:${cause.message}` : "config_load_failed",
      );
    }
  }

  async function reloadSidecar(): Promise<void> {
    try {
      const company = await adapter.getCompanyModel();
      setDiagStatus(
        `sidecar_loaded: projects=${company.projects.length} agents=${company.agents.length}`,
      );
    } catch (cause) {
      setDiagStatus(
        cause instanceof Error ? `sidecar_load_failed:${cause.message}` : "sidecar_load_failed",
      );
    }
  }

  async function validateLayout(): Promise<void> {
    try {
      const nextUnified = await adapter.getUnifiedOfficeModel();
      const invalidCount = nextUnified.diagnostics.invalidOfficeObjects.length;
      setDiagStatus(`layout_validated: invalid_objects=${invalidCount}`);
      setUnified(nextUnified);
    } catch (cause) {
      setDiagStatus(
        cause instanceof Error
          ? `layout_validation_failed:${cause.message}`
          : "layout_validation_failed",
      );
    }
  }

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open]);

  const latestHookAt = hookTelemetry?.events[0]?.eventAt;
  const latestAgentEventAt = Array.isArray(recentAgentEvents)
    ? recentAgentEvents[0]?.occurredAt
    : undefined;
  const findings = useMemo(
    () =>
      buildFindings({
        adapterKind: adapter.runtimeKind,
        connectionStatus,
        convexEnabled,
        diagStatus,
        error,
        latestAgentEventAt,
        latestHookAt,
        sessionStatus,
        unified,
      }),
    [
      connectionStatus,
      convexEnabled,
      diagStatus,
      error,
      latestAgentEventAt,
      latestHookAt,
      sessionStatus,
      unified,
    ],
  );
  const healthCards = useMemo(
    () =>
      buildHealthCards({
        adapterLabel: adapter.runtimeLabel,
        adapterKind: adapter.runtimeKind,
        connectionStatus,
        convexEnabled,
        endpointUrl: runtimeEndpointUrl(adapter.runtimeKind, gatewayBase, stateBase),
        latestAgentEventAt,
        latestHookAt,
        unified,
      }),
    [
      adapter.runtimeLabel,
      adapter.runtimeKind,
      connectionStatus,
      convexEnabled,
      gatewayBase,
      latestAgentEventAt,
      latestHookAt,
      unified,
    ],
  );
  const breadcrumbLines = useMemo(
    () =>
      buildBreadcrumbLines({
        hookTelemetry,
        recentAgentEvents: Array.isArray(recentAgentEvents) ? recentAgentEvents : [],
        searchTerm,
        timeline,
      }),
    [hookTelemetry, recentAgentEvents, searchTerm, timeline],
  );
  const debugLines = useMemo(
    () =>
      buildDebugLines({
        connectionStatus,
        diagStatus,
        error,
        findings,
        sessionStatus,
        searchTerm,
        unified,
      }),
    [connectionStatus, diagStatus, error, findings, searchTerm, sessionStatus, unified],
  );

  const statusLabel = connectionStatus === "ok" ? "Live" : connectionStatus;
  const endpointLabel = runtimeEndpointLabel(adapter.runtimeKind);
  const endpointUrl = runtimeEndpointUrl(adapter.runtimeKind, gatewayBase, stateBase);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[88vh] min-w-[88vw] max-w-[1400px] flex-col overflow-hidden p-0"
        data-testid="runtime-health-panel"
        overlayStyle={{ zIndex: UI_Z.panelBase }}
        style={{ zIndex: UI_Z.panelElevated }}
      >
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Runtime Health
                <Badge variant={connectionStatus === "ok" ? "secondary" : "destructive"}>
                  <CircleDot className="h-3 w-3" />
                  {statusLabel}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                {endpointLabel}, Convex, hook ingest, runtime drift, sessions, and sanitized debug
                tail.
              </DialogDescription>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
              <StatusPill
                label={endpointLabel}
                severity={connectionStatusSeverity(connectionStatus)}
              />
              <StatusPill label="Convex" severity={convexEnabled ? "ok" : "warn"} />
              <StatusPill label="Hooks" severity={freshnessSeverity(latestHookAt, HOOK_STALE_MS)} />
              <StatusPill label={`Adapter ${adapter.runtimeLabel}`} severity="muted" />
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b py-3">
            <div className="grid min-w-[280px] gap-1 text-xs text-muted-foreground">
              <span>
                {endpointLabel}: {endpointUrl}
              </span>
              <span>
                Auth:{" "}
                <span
                  className={
                    adapter.runtimeKind === "codex" || hasGatewayToken()
                      ? "text-emerald-500"
                      : "text-amber-500"
                  }
                >
                  {adapter.runtimeKind === "codex"
                    ? "app-server bridge"
                    : hasGatewayToken()
                      ? "token present"
                      : "token missing"}
                </span>{" "}
                | Outbox: n/a | Last hook: {formatAgo(latestHookAt)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="-translate-y-1/2 absolute top-1/2 left-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  aria-label="Runtime Health search"
                  className="h-8 w-[190px] pl-7"
                  placeholder="filter tail"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}>
                <RefreshCw className={cn("h-3.5 w-3.5", loading ? "animate-spin" : "")} />
                Refresh
              </Button>
              <Button size="sm" variant="outline" onClick={() => void reloadConfig()}>
                Reload Config
              </Button>
              <Button size="sm" variant="outline" onClick={() => void reloadSidecar()}>
                Reload Sidecar
              </Button>
              <Button size="sm" variant="outline" onClick={() => void validateLayout()}>
                Validate Layout
              </Button>
            </div>
          </div>

          {error ? (
            <InlineAlert
              title="Runtime health load failed"
              detail={connectionRecoveryCopy(connectionStatus, error, adapter.runtimeKind)}
              severity="error"
            />
          ) : null}
          {diagStatus ? (
            <InlineAlert title="Latest diagnostic" detail={diagStatus} severity="warn" />
          ) : null}

          <Tabs defaultValue="health" className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
            <TabsList className="w-fit" data-testid="runtime-health-tabs">
              <TabsTrigger value="health" data-testid="runtime-health-tab-health">
                Health
              </TabsTrigger>
              <TabsTrigger value="drift" data-testid="runtime-health-tab-drift">
                Drift
              </TabsTrigger>
              <TabsTrigger value="sessions" data-testid="runtime-health-tab-sessions">
                Sessions
              </TabsTrigger>
              <TabsTrigger value="debug" data-testid="runtime-health-tab-debug">
                Debug Tail
              </TabsTrigger>
            </TabsList>

            <TabsContent value="health" className="mt-3 min-h-0 flex-1 overflow-auto">
              <HealthView
                cards={healthCards}
                findings={findings}
                breadcrumbLines={breadcrumbLines}
                onOpenRawTelemetry={() => {
                  setTelemetryPanelTab("events");
                  setIsTelemetryPanelOpen(true);
                }}
                onOpenHarnessUsage={() => {
                  setTelemetryPanelTab("usage");
                  setIsTelemetryPanelOpen(true);
                }}
              />
            </TabsContent>

            <TabsContent value="drift" className="mt-3 min-h-0 flex-1 overflow-hidden">
              <DriftView unified={unified} />
            </TabsContent>

            <TabsContent value="sessions" className="mt-3 min-h-0 flex-1 overflow-hidden">
              <SessionsView sessions={sessions} sessionStatus={sessionStatus} timeline={timeline} />
            </TabsContent>

            <TabsContent value="debug" className="mt-3 min-h-0 flex-1 overflow-hidden">
              <DebugTailView lines={debugLines} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HealthView({
  cards,
  findings,
  breadcrumbLines,
  onOpenHarnessUsage,
  onOpenRawTelemetry,
}: {
  cards: HealthCard[];
  findings: Finding[];
  breadcrumbLines: string[];
  onOpenHarnessUsage: () => void;
  onOpenRawTelemetry: () => void;
}): React.JSX.Element {
  return (
    <div className="grid min-h-full grid-rows-[auto,minmax(240px,1fr),180px] gap-3">
      <div className="grid gap-2 md:grid-cols-5">
        {cards.map((card) => (
          <HealthStatusCard key={card.label} card={card} />
        ))}
      </div>
      <div className="grid min-h-0 gap-3 lg:grid-cols-2">
        <section className="min-h-0 overflow-hidden rounded-md border bg-card p-3">
          <SectionTitle icon={<ShieldAlert className="h-4 w-4" />} title="Current Findings" />
          <ul className="mt-3 max-h-[calc(100%-34px)] space-y-2 overflow-auto pr-1">
            {findings.map((finding) => (
              <li
                key={`${finding.title}-${finding.detail}`}
                className="rounded-md border px-3 py-2"
              >
                <div className="flex items-start gap-2">
                  <SeverityIcon severity={finding.severity} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{finding.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{finding.detail}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="min-h-0 overflow-auto rounded-md border bg-card p-3">
          <SectionTitle icon={<Database className="h-4 w-4" />} title="Evidence And Actions" />
          <div className="mt-3 grid gap-2 text-xs">
            <EvidenceRow
              label="Last hook event"
              value={cards.find((card) => card.label === "Hooks")?.detail ?? "n/a"}
            />
            <EvidenceRow
              label="Last agent event"
              value={cards.find((card) => card.label === "Agent Events")?.detail ?? "n/a"}
            />
            <EvidenceRow label="Outbox" value="Not exposed to browser yet" />
            <EvidenceRow
              label="Runtime source"
              value={cards.find((card) => card.label === "Adapter")?.detail ?? "n/a"}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onOpenRawTelemetry}>
              Open Raw Telemetry
            </Button>
            <Button size="sm" variant="outline" onClick={onOpenHarnessUsage}>
              Open Harness Usage
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void navigator.clipboard?.writeText(buildDiagnosticBundle(cards, findings))
              }
            >
              Copy Diagnostics
            </Button>
          </div>
        </section>
      </div>
      <section className="min-h-0 rounded-md border bg-card p-3">
        <SectionTitle icon={<TerminalSquare className="h-4 w-4" />} title="Breadcrumb Tail" />
        <LogPre
          lines={breadcrumbLines}
          emptyLabel="No runtime breadcrumbs found for this window."
        />
      </section>
    </div>
  );
}

function DriftView({ unified }: { unified: UnifiedOfficeModel | null }): React.JSX.Element {
  const diagnostics = unified?.diagnostics;
  const runtimeRows: Array<[string, string | number]> = [
    ["Configured agents", diagnostics?.configAgentCount ?? 0],
    ["Running agents", diagnostics?.runtimeAgentCount ?? 0],
    ["Missing runtime", diagnostics?.missingRuntimeAgentIds.length ?? 0],
    ["Unmapped runtime", diagnostics?.unmappedRuntimeAgentIds.length ?? 0],
  ];
  const officeRows: Array<[string, string | number]> = [
    ["Office objects", diagnostics?.officeObjectCount ?? 0],
    ["Invalid objects", diagnostics?.invalidOfficeObjects.length ?? 0],
    ["Duplicate ids", diagnostics?.duplicateOfficeObjectIds.length ?? 0],
    ["Out-of-bounds clusters", diagnostics?.outOfBoundsClusterObjectIds.length ?? 0],
  ];
  return (
    <div className="grid h-full min-h-0 gap-3 lg:grid-cols-2">
      <DiagnosticPanel
        icon={<GitCompareArrows className="h-4 w-4" />}
        title="Runtime Reconciliation"
        rows={runtimeRows}
        items={[
          ...(diagnostics?.missingRuntimeAgentIds ?? []).map((id) => `missing runtime: ${id}`),
          ...(diagnostics?.unmappedRuntimeAgentIds ?? []).map((id) => `unmapped runtime: ${id}`),
        ]}
        emptyLabel="No runtime reconciliation drift."
      />
      <DiagnosticPanel
        icon={<Database className="h-4 w-4" />}
        title="Office Integrity"
        rows={officeRows}
        items={[
          ...(diagnostics?.invalidOfficeObjects ?? []).map((id) => `invalid office object: ${id}`),
          ...(diagnostics?.duplicateOfficeObjectIds ?? []).map(
            (id) => `duplicate object id: ${id}`,
          ),
          ...(diagnostics?.outOfBoundsClusterObjectIds ?? []).map(
            (id) => `out-of-bounds cluster object: ${id}`,
          ),
          `company source: ${diagnostics?.source ?? "n/a"}`,
          `CEO anchor mode: ${diagnostics?.ceoAnchorMode ?? "fallback"}`,
        ]}
        emptyLabel="No office integrity drift."
      />
    </div>
  );
}

function SessionsView({
  sessions,
  sessionStatus,
  timeline,
}: {
  sessions: SessionRowModel[];
  sessionStatus: string;
  timeline: SessionTimelineModel | null;
}): React.JSX.Element {
  const selectedSessionKey = timeline?.sessionKey ?? sessions[0]?.sessionKey ?? "n/a";
  const timelineLines = (timeline?.events ?? [])
    .slice(-100)
    .map(
      (event) =>
        `${formatClock(event.ts)} | ${event.type} | ${event.role} | ${sanitizeRuntimeText(event.text)}`,
    );
  return (
    <div className="grid h-full min-h-0 gap-3 md:grid-cols-[360px_minmax(0,1fr)]">
      <section className="min-h-0 rounded-md border bg-card p-3">
        <SectionTitle icon={<Clock3 className="h-4 w-4" />} title="Recent Sessions" />
        <ul className="mt-3 h-[calc(100%-34px)] space-y-1 overflow-auto text-xs">
          {sessions.map((session, index) => (
            <li
              key={session.sessionKey}
              className={cn(
                "rounded-md border px-2 py-2",
                index === 0 ? "border-primary/50 bg-primary/5" : "",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{session.sessionKey}</span>
                <Badge variant={index === 0 ? "secondary" : "outline"}>
                  {index === 0 ? "selected" : "idle"}
                </Badge>
              </div>
              <p className="mt-1 text-muted-foreground">
                {session.channel ? `${session.channel} | ` : ""}
                updated {formatAgo(session.updatedAt)}
              </p>
            </li>
          ))}
          {sessions.length === 0 ? <li className="opacity-70">No sessions loaded.</li> : null}
        </ul>
      </section>
      <section className="min-h-0 rounded-md border bg-card p-3">
        <SectionTitle icon={<TerminalSquare className="h-4 w-4" />} title="Selected Session Tail" />
        {sessionStatus ? (
          <div className="mt-2">
            <InlineAlert title="Session timeline degraded" detail={sessionStatus} severity="warn" />
          </div>
        ) : null}
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <EvidenceRow label="Session" value={selectedSessionKey} />
          <EvidenceRow label="Events" value={String(timeline?.events.length ?? 0)} />
        </div>
        <div className="mt-3 h-[calc(100%-86px)]">
          <LogPre lines={timelineLines} emptyLabel="No timeline events loaded." tone="green" />
        </div>
      </section>
    </div>
  );
}

function DebugTailView({ lines }: { lines: string[] }): React.JSX.Element {
  return (
    <section className="h-full min-h-0 rounded-md border bg-card p-3">
      <SectionTitle
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Warnings, Errors, And Breadcrumbs"
      />
      <p className="mt-1 text-xs text-muted-foreground">
        Sanitized operational tail only. Raw hook rows stay in Raw Telemetry; usage stays in Harness
        Usage.
      </p>
      <div className="mt-3 h-[calc(100%-54px)]">
        <LogPre
          lines={lines}
          emptyLabel="No warnings, errors, or filtered breadcrumbs found."
          tone="amber"
        />
      </div>
    </section>
  );
}

function HealthStatusCard({ card }: { card: HealthCard }): React.JSX.Element {
  return (
    <section className={cn("rounded-md border bg-card p-3", severityBorderClass(card.severity))}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase text-muted-foreground">{card.label}</p>
        <SeverityIcon severity={card.severity} />
      </div>
      <p className="mt-2 truncate text-lg font-semibold">{card.value}</p>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{card.detail}</p>
    </section>
  );
}

function DiagnosticPanel({
  emptyLabel,
  icon,
  items,
  rows,
  title,
}: {
  emptyLabel: string;
  icon: React.ReactNode;
  items: string[];
  rows: Array<[string, string | number]>;
  title: string;
}): React.JSX.Element {
  const visibleItems = items.filter((item) => item.trim().length > 0);
  return (
    <section className="min-h-0 rounded-md border bg-card p-3">
      <SectionTitle icon={icon} title={title} />
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <EvidenceRow key={label} label={label} value={String(value)} />
        ))}
      </div>
      <ul className="mt-4 h-[calc(100%-122px)] space-y-1 overflow-auto text-xs">
        {visibleItems.map((item) => (
          <li key={item} className="rounded-md border px-2 py-1.5">
            {item}
          </li>
        ))}
        {visibleItems.length === 0 ? <li className="text-muted-foreground">{emptyLabel}</li> : null}
      </ul>
    </section>
  );
}

function EvidenceRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-md border bg-muted/20 px-2 py-1.5">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-xs font-medium">{value}</p>
    </div>
  );
}

function InlineAlert({
  detail,
  severity,
  title,
}: {
  detail: string;
  severity: Severity;
  title: string;
}): React.JSX.Element {
  return (
    <div className={cn("mt-2 rounded-md border p-2 text-xs", severityPanelClass(severity))}>
      <div className="flex items-center gap-2">
        <SeverityIcon severity={severity} />
        <span className="font-medium">{title}</span>
      </div>
      <p className="mt-1 line-clamp-2 break-all text-muted-foreground">
        {sanitizeRuntimeText(detail, 260)}
      </p>
    </div>
  );
}

function LogPre({
  emptyLabel,
  lines,
  tone = "cyan",
}: {
  emptyLabel: string;
  lines: string[];
  tone?: "amber" | "cyan" | "green";
}): React.JSX.Element {
  const toneClass =
    tone === "green" ? "text-emerald-300" : tone === "amber" ? "text-amber-300" : "text-cyan-300";
  return (
    <pre
      className={cn(
        "h-full overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/70 p-2 text-[11px]",
        toneClass,
      )}
    >
      {lines.join("\n") || emptyLabel}
    </pre>
  );
}

function SectionTitle({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}): React.JSX.Element {
  return (
    <h4 className="flex items-center gap-2 text-sm font-semibold">
      {icon}
      {title}
    </h4>
  );
}

function StatusPill({ label, severity }: { label: string; severity: Severity }): React.JSX.Element {
  return (
    <Badge
      variant={severity === "error" ? "destructive" : severity === "ok" ? "secondary" : "outline"}
    >
      <SeverityIcon severity={severity} />
      {label}
    </Badge>
  );
}

function SeverityIcon({ severity }: { severity: Severity }): React.JSX.Element {
  if (severity === "ok") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (severity === "error") return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
  if (severity === "warn") return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
  return <CircleDot className="h-3.5 w-3.5 text-muted-foreground" />;
}

function buildHealthCards(input: {
  adapterLabel: string;
  adapterKind: RuntimeAdapterKind;
  connectionStatus: ConnectionStatus;
  convexEnabled: boolean;
  endpointUrl: string;
  latestAgentEventAt?: number;
  latestHookAt?: number;
  unified: UnifiedOfficeModel | null;
}): HealthCard[] {
  return [
    {
      label: runtimeEndpointLabel(input.adapterKind),
      value: input.connectionStatus,
      detail: input.endpointUrl,
      severity: connectionStatusSeverity(input.connectionStatus),
    },
    {
      label: "Convex",
      value: input.convexEnabled ? "configured" : "missing",
      detail: input.convexEnabled ? "Realtime queries enabled" : "Convex provider disabled",
      severity: input.convexEnabled ? "ok" : "warn",
    },
    {
      label: "Hooks",
      value: freshnessLabel(input.latestHookAt, HOOK_STALE_MS),
      detail: formatAgo(input.latestHookAt),
      severity: freshnessSeverity(input.latestHookAt, HOOK_STALE_MS),
    },
    {
      label: "Agent Events",
      value: freshnessLabel(input.latestAgentEventAt, AGENT_EVENT_STALE_MS),
      detail: formatAgo(input.latestAgentEventAt),
      severity: freshnessSeverity(input.latestAgentEventAt, AGENT_EVENT_STALE_MS),
    },
    {
      label: "Adapter",
      value: input.adapterLabel,
      detail: `${input.unified?.runtimeAgents.length ?? 0} runtime agents`,
      severity: "muted",
    },
  ];
}

function buildFindings(input: {
  adapterKind: RuntimeAdapterKind;
  connectionStatus: ConnectionStatus;
  convexEnabled: boolean;
  diagStatus: string;
  error: string;
  latestAgentEventAt?: number;
  latestHookAt?: number;
  sessionStatus: string;
  unified: UnifiedOfficeModel | null;
}): Finding[] {
  const findings: Finding[] = [];
  if (input.error) {
    findings.push({ title: "Runtime request failed", detail: input.error, severity: "error" });
  }
  if (input.connectionStatus !== "ok") {
    findings.push({
      title: `${runtimeEndpointLabel(input.adapterKind)} connection is not healthy`,
      detail: connectionRecoveryCopy(
        input.connectionStatus,
        "check runtime settings",
        input.adapterKind,
      ),
      severity: input.connectionStatus === "unauthorized" ? "error" : "warn",
    });
  }
  if (input.sessionStatus) {
    findings.push({
      title: "Session timeline degraded",
      detail: input.sessionStatus,
      severity: "warn",
    });
  }
  if (!input.convexEnabled) {
    findings.push({
      title: "Convex is unavailable",
      detail: "Realtime activity, hook telemetry, and usage diagnostics cannot update.",
      severity: "warn",
    });
  }
  if (freshnessSeverity(input.latestHookAt, HOOK_STALE_MS) !== "ok") {
    findings.push({
      title: "Hook ingest freshness needs attention",
      detail: `Last hook event: ${formatAgo(input.latestHookAt)}`,
      severity: freshnessSeverity(input.latestHookAt, HOOK_STALE_MS),
    });
  }
  if (freshnessSeverity(input.latestAgentEventAt, AGENT_EVENT_STALE_MS) !== "ok") {
    findings.push({
      title: "Agent activity feed is quiet",
      detail: `Last agent event: ${formatAgo(input.latestAgentEventAt)}`,
      severity: "warn",
    });
  }
  const diagnostics = input.unified?.diagnostics;
  if ((diagnostics?.missingRuntimeAgentIds.length ?? 0) > 0) {
    findings.push({
      title: `${diagnostics?.missingRuntimeAgentIds.length ?? 0} configured agents missing`,
      detail: (diagnostics?.missingRuntimeAgentIds ?? []).slice(0, 4).join(", "),
      severity: "warn",
    });
  }
  if ((diagnostics?.invalidOfficeObjects.length ?? 0) > 0) {
    findings.push({
      title: `${diagnostics?.invalidOfficeObjects.length ?? 0} invalid office objects`,
      detail: (diagnostics?.invalidOfficeObjects ?? []).slice(0, 4).join(", "),
      severity: "warn",
    });
  }
  if (input.diagStatus) {
    findings.push({
      title: "Latest manual diagnostic",
      detail: input.diagStatus,
      severity: "muted",
    });
  }
  if (findings.length === 0) {
    findings.push({
      title: "No current findings",
      detail: "Connection, ingest, runtime reconciliation, and layout checks look quiet.",
      severity: "ok",
    });
  }
  return findings;
}

function buildBreadcrumbLines(input: {
  hookTelemetry?: HookTelemetryExplorer;
  recentAgentEvents: Array<{
    occurredAt: number;
    agentId?: string;
    eventType?: string;
    label?: string;
    detail?: string;
  }>;
  searchTerm: string;
  timeline: SessionTimelineModel | null;
}): string[] {
  const lines = [
    ...input.recentAgentEvents.slice(0, 40).map((row) => {
      const detail = row.detail ? ` | ${sanitizeRuntimeText(row.detail)}` : "";
      return `${formatClock(row.occurredAt)} | agent | ${row.agentId ?? "unknown"} | ${row.eventType ?? "event"} | ${sanitizeRuntimeText(row.label ?? "")}${detail}`;
    }),
    ...(input.hookTelemetry?.events ?? []).slice(0, 20).map((row) => {
      const eventName = row.eventName ? ` | ${row.eventName}` : "";
      return `${formatClock(row.eventAt)} | hook | ${row.hookName} | ${row.hookType}${eventName}`;
    }),
    ...(input.timeline?.events ?? []).slice(-20).map((event) => {
      return `${formatClock(event.ts)} | session | ${event.type} | ${event.role} | ${sanitizeRuntimeText(event.text)}`;
    }),
  ]
    .sort()
    .reverse();
  return filterRuntimeLines(lines, input.searchTerm).slice(0, 100);
}

function buildDebugLines(input: {
  connectionStatus: ConnectionStatus;
  diagStatus: string;
  error: string;
  findings: Finding[];
  sessionStatus: string;
  searchTerm: string;
  unified: UnifiedOfficeModel | null;
}): string[] {
  const warnings = [
    input.error ? `${formatClock(Date.now())} | error | ${sanitizeRuntimeText(input.error)}` : "",
    input.diagStatus
      ? `${formatClock(Date.now())} | diagnostic | ${sanitizeRuntimeText(input.diagStatus)}`
      : "",
    input.sessionStatus
      ? `${formatClock(Date.now())} | session | ${sanitizeRuntimeText(input.sessionStatus)}`
      : "",
    input.connectionStatus !== "ok"
      ? `${formatClock(Date.now())} | connection | ${input.connectionStatus}`
      : "",
    ...input.findings
      .filter((finding) => finding.severity !== "ok")
      .map(
        (finding) =>
          `${formatClock(Date.now())} | ${finding.severity} | ${finding.title} | ${sanitizeRuntimeText(finding.detail)}`,
      ),
    ...(input.unified?.warnings ?? []).map(
      (warning) =>
        `${formatClock(Date.now())} | reconciliation | ${warning.code} | ${sanitizeRuntimeText(warning.message)}`,
    ),
  ].filter(Boolean);
  return filterRuntimeLines(warnings, input.searchTerm).slice(0, 120);
}

function buildDiagnosticBundle(cards: HealthCard[], findings: Finding[]): string {
  return [
    "Runtime Health",
    "",
    "Status:",
    ...cards.map((card) => `- ${card.label}: ${card.value} (${sanitizeRuntimeText(card.detail)})`),
    "",
    "Findings:",
    ...findings.map(
      (finding) =>
        `- ${finding.severity}: ${finding.title} - ${sanitizeRuntimeText(finding.detail)}`,
    ),
  ].join("\n");
}

function connectionStatusSeverity(status: ConnectionStatus): Severity {
  if (status === "ok") return "ok";
  if (status === "unauthorized" || status === "error") return "error";
  return "warn";
}

function freshnessSeverity(timestamp: number | undefined, staleMs: number): Severity {
  if (!timestamp) return "muted";
  const age = Date.now() - timestamp;
  if (age > staleMs * 6) return "error";
  if (age > staleMs) return "warn";
  return "ok";
}

function freshnessLabel(timestamp: number | undefined, staleMs: number): string {
  const severity = freshnessSeverity(timestamp, staleMs);
  if (severity === "ok") return "fresh";
  if (severity === "warn") return "stale";
  if (severity === "error") return "old";
  return "none";
}

function formatAgo(timestamp: number | undefined): string {
  if (!timestamp) return "no rows";
  const ageMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatClock(timestamp: number | undefined): string {
  if (!timestamp) return "--:--:--";
  return new Date(timestamp).toLocaleTimeString();
}

function severityBorderClass(severity: Severity): string {
  if (severity === "ok") return "border-emerald-500/30";
  if (severity === "warn") return "border-amber-500/40";
  if (severity === "error") return "border-red-500/40";
  return "border-border";
}

function severityPanelClass(severity: Severity): string {
  if (severity === "error") return "border-red-500/40 bg-red-500/10";
  if (severity === "warn") return "border-amber-500/40 bg-amber-500/10";
  if (severity === "ok") return "border-emerald-500/40 bg-emerald-500/10";
  return "bg-muted/20";
}
