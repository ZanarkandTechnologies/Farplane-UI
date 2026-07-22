"use client";

/**
 * Codex thread intelligence inspector.
 *
 * Ownership: renders the selected task's hook-backed connected lineage network.
 * Inputs: one office employee plus the read-only Convex lineage projection.
 * Outputs: graph-first inspector with searchable nodes and replayable handoff links.
 * Side effects: requests a transient scene lineage replay; never mutates Codex runtime state.
 */

import { useQuery } from "convex/react";
import { Activity, Clock3, Gauge, Radio, Sparkles, Target } from "lucide-react";
import { type ReactElement, useMemo } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UI_Z } from "@/lib/z-index";
import {
  GraphWorkbench,
  type GraphWorkbenchEdge,
  type GraphWorkbenchNode,
} from "@/modules/graph-workbench";
import type { EmployeeData } from "@/modules/office/lib/types";
import { isConvexEnabled } from "@/providers/convex-provider";
import { useAppStore } from "@/store";
import { api } from "../../../../../../convex/_generated/api";
import {
  getThreadLineageNetwork,
  type LineageEdge,
  type LineageGraph,
  normalizeThreadId,
  resolveEmployeeThreadId,
} from "./codex-thread-inspector-logic";

type InspectorNodeKind = "current" | "root" | "task" | "ephemeral";

export function CodexThreadInspector({
  employee,
  open,
  onOpenChange,
}: {
  employee: EmployeeData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): ReactElement {
  const setThreadLineageReveal = useAppStore((state) => state.setThreadLineageReveal);
  const convexEnabled = isConvexEnabled();
  const threadId = employee ? resolveEmployeeThreadId(employee) : "";
  const currentId = normalizeThreadId(threadId);
  const graph = useQuery(
    api.modules.hookTelemetry.queries.getThreadLineageGraph,
    convexEnabled && open && threadId ? { rangeDays: 90, limit: 1_000 } : "skip",
  ) as LineageGraph | undefined;
  const network = useMemo(
    () =>
      getThreadLineageNetwork({
        graph,
        threadId,
        observedParentThreadId: employee?.observedRuntime?.parentThreadId,
      }),
    [employee?.observedRuntime?.parentThreadId, graph, threadId],
  );
  const graphEdges = useMemo<GraphWorkbenchEdge[]>(
    () =>
      network.edges.map((edge) => ({
        source: normalizeThreadId(edge.source),
        target: normalizeThreadId(edge.target),
        type: edge.kind,
        label: edge.title ?? edge.kind,
        color: "#7dd3fc",
        directed: true,
      })),
    [network.edges],
  );
  const graphNodes = useMemo<GraphWorkbenchNode[]>(() => {
    const incoming = new Map<string, LineageEdge[]>();
    for (const edge of network.edges) {
      const target = normalizeThreadId(edge.target);
      incoming.set(target, [...(incoming.get(target) ?? []), edge]);
    }
    return network.nodes.map((node) => {
      const nodeId = normalizeThreadId(node.id);
      const incomingEdges = incoming.get(nodeId) ?? [];
      const kind: InspectorNodeKind =
        nodeId === currentId
          ? "current"
          : incomingEdges.some((edge) => edge.kind === "spawned")
            ? "ephemeral"
            : incomingEdges.length === 0
              ? "root"
              : "task";
      const label = nodeId === currentId ? (employee?.name ?? node.label) : node.label;
      const observed = node.lastSeenAt > 0 ? formatObservedTime(node.lastSeenAt) : "time unknown";
      return {
        id: nodeId,
        kind,
        label,
        path: nodeId,
        description:
          nodeId === currentId
            ? [employee?.activityLabel, employee?.activityDetail, `Observed ${observed}`]
                .filter(Boolean)
                .join(" · ") || `Current task · observed ${observed}`
            : `${kind === "ephemeral" ? "Ephemeral handoff" : "Task"} · observed ${observed}`,
        weight: nodeId === currentId ? 5 : kind === "root" ? 2 : 1,
      };
    });
  }, [currentId, employee?.activityDetail, employee?.activityLabel, employee?.name, network]);

  const replayLineage = (edge: LineageEdge) => {
    const requestedAt = Date.now();
    setThreadLineageReveal({
      id: `manual-lineage:${normalizeThreadId(edge.source)}:${normalizeThreadId(edge.target)}:${requestedAt}`,
      source: normalizeThreadId(edge.source),
      target: normalizeThreadId(edge.target),
      kind: edge.kind,
      requestedAt,
    });
    toast.success("Showing the handoff in the office.");
  };

  const edgeForNode = (nodeId: string): LineageEdge | undefined =>
    network.edges.find((edge) => normalizeThreadId(edge.target) === nodeId) ??
    network.edges.find((edge) => normalizeThreadId(edge.source) === nodeId);

  const machineLabel =
    employee?.observedRuntime?.machineName ??
    employee?.observedRuntime?.machineId ??
    "Local source";
  const hasParent = network.edges.some((edge) => normalizeThreadId(edge.target) === currentId);
  const goal = employee?.codexThreadGoal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="grid h-[88vh] max-h-[88vh] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden overscroll-contain border-border/80 bg-background/98 p-0 shadow-2xl sm:max-w-[min(96vw,1180px)]"
        style={{ zIndex: UI_Z.panelElevated }}
        overlayStyle={{ zIndex: UI_Z.panelElevated - 1 }}
      >
        <DialogHeader className="border-b bg-muted/20 px-5 py-4 pr-12">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="gap-1 border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300"
            >
              <Radio aria-hidden="true" className="size-3" /> Codex hook
            </Badge>
            <Badge variant={employee?.activityState === "running" ? "default" : "secondary"}>
              {employee?.activityState ?? employee?.heartbeatState ?? "idle"}
            </Badge>
            <Badge variant="secondary">{hasParent ? "delegated" : "root task"}</Badge>
            <span className="text-xs text-muted-foreground">
              {network.nodes.length} tasks · {network.edges.length} handoffs
            </span>
          </div>
          <DialogTitle className="mt-1 break-words text-xl leading-tight text-pretty">
            {employee?.name ?? "Codex task"}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{employee?.team || "Unassigned"}</span>
            <span aria-hidden="true">·</span>
            <span>{machineLabel}</span>
            {employee?.activityLabel ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <Activity aria-hidden="true" className="size-3" /> {employee.activityLabel}
                </span>
              </>
            ) : null}
          </DialogDescription>
          {goal ? <CodexThreadGoalCard goal={goal} /> : null}
        </DialogHeader>

        <div className="min-h-0 p-3 sm:p-4">
          {!convexEnabled ? (
            <InspectorState
              title="Lineage unavailable"
              detail="Connect Convex hook telemetry to inspect task handoffs."
            />
          ) : !graph ? (
            <InspectorState title="Loading lineage…" detail="Reading the connected task network." />
          ) : (
            <GraphWorkbench
              nodes={graphNodes}
              edges={graphEdges}
              kinds={[
                { id: "current", label: "Current", color: "#0284c7", foreground: "#020617" },
                { id: "root", label: "Root", color: "#64748b", foreground: "#f8fafc" },
                { id: "task", label: "Task", color: "#38bdf8", foreground: "#082f49" },
                { id: "ephemeral", label: "Ephemeral", color: "#7dd3fc", foreground: "#082f49" },
              ]}
              searchPlaceholder="Search this lineage…"
              telemetryLabel="Task handoff network"
              renderNodeActions={(node) => {
                const edge = edgeForNode(node.id);
                return edge ? (
                  <Button
                    className="w-full gap-2"
                    variant="outline"
                    onClick={() => replayLineage(edge)}
                  >
                    <Sparkles aria-hidden="true" className="size-4 text-sky-400" />
                    Show Handoff in Office
                  </Button>
                ) : null;
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CodexThreadGoalCard({
  goal,
}: {
  goal: NonNullable<EmployeeData["codexThreadGoal"]>;
}): ReactElement {
  return (
    <section
      aria-label="Thread goal"
      data-testid="codex-thread-goal-card"
      className="mt-3 rounded-lg border border-primary/20 bg-primary/[0.04] p-3 text-left"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
          <Target aria-hidden="true" className="size-3.5" /> Goal
        </span>
        <Badge variant={goalStatusBadgeVariant(goal.status)}>{formatGoalStatus(goal.status)}</Badge>
      </div>
      <p className="mt-2 text-sm font-medium leading-relaxed text-foreground">{goal.objective}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Gauge aria-hidden="true" className="size-3.5" />
          {formatGoalTokens(goal.tokensUsed, goal.tokenBudget)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock3 aria-hidden="true" className="size-3.5" />
          {formatGoalDuration(goal.timeUsedSeconds)}
        </span>
        <span>Updated {formatObservedTime(goal.updatedAt * 1_000)}</span>
      </div>
    </section>
  );
}

function formatGoalStatus(status: NonNullable<EmployeeData["codexThreadGoal"]>["status"]): string {
  const labels = {
    active: "Active",
    paused: "Paused",
    blocked: "Blocked",
    usageLimited: "Usage limited",
    budgetLimited: "Budget limited",
    complete: "Complete",
  } as const;
  return labels[status];
}

function goalStatusBadgeVariant(
  status: NonNullable<EmployeeData["codexThreadGoal"]>["status"],
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "blocked" || status === "usageLimited" || status === "budgetLimited") {
    return "destructive";
  }
  if (status === "complete") return "secondary";
  return "outline";
}

function formatGoalTokens(tokensUsed: number, tokenBudget: number | null): string {
  const formatter = new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const used = formatter.format(Math.max(0, tokensUsed));
  if (tokenBudget == null) return `${used} tokens used`;
  return `${used} / ${formatter.format(Math.max(0, tokenBudget))} tokens`;
}

function formatGoalDuration(seconds: number): string {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  if (totalMinutes < 60) return `${totalMinutes}m elapsed`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m elapsed` : `${hours}h elapsed`;
}

function InspectorState({ title, detail }: { title: string; detail: string }): ReactElement {
  return (
    <div className="grid h-full place-items-center rounded-lg border border-dashed bg-muted/15 p-8 text-center">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function formatObservedTime(value: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - value) / 1_000));
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (seconds < 60) return formatter.format(-seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return formatter.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return formatter.format(-hours, "hour");
  return formatter.format(-Math.round(hours / 24), "day");
}
