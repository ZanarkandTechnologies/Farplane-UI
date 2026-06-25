"use client";

/**
 * Ownership: Skill OS Signals view.
 * Inputs: skill graph heat, framework-core graph proximity, template rollout rows, optional Convex invocation telemetry.
 * Outputs: read-only ranking table for skill maintenance attention.
 * Side effects: none.
 */

import { Activity, GitBranch, ShieldAlert, ShieldCheck } from "lucide-react";
import { type ReactElement, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import type {
  SkillFrameworkCoreGraphPayload,
  SkillGraphNode,
  SkillTemplateIntelligencePayload,
  SkillTemplateRolloutRow,
} from "./skill-os-types";
import type { SkillInvocationCountState } from "./use-skill-invocation-counts";

type SignalRow = {
  action: string;
  coreDistance: number | null;
  heatScore: number;
  invocationCount: number;
  skillId: string;
  status: string;
  templateVersion: string;
  tier: number;
};

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function buildCoreDistanceMap(
  frameworkCoreGraph: SkillFrameworkCoreGraphPayload | null,
): Map<string, number> {
  if (!frameworkCoreGraph) return new Map();
  const nodeIds = new Set(frameworkCoreGraph.nodes.map((node) => node.id));
  const adjacency = new Map<string, Set<string>>();
  for (const edge of frameworkCoreGraph.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  const roots = ["workflow:lifecycle", "file:docs/farplane-framework/lifecycle.md"].filter((id) =>
    nodeIds.has(id),
  );
  const queue = roots.map((id) => ({ distance: 0, id }));
  const visited = new Map<string, number>();
  for (const root of roots) visited.set(root, 0);

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (!current) continue;
    for (const neighbor of adjacency.get(current.id) ?? []) {
      if (visited.has(neighbor)) continue;
      const distance = current.distance + 1;
      visited.set(neighbor, distance);
      queue.push({ distance, id: neighbor });
    }
  }

  const skillDistances = new Map<string, number>();
  for (const [nodeId, distance] of visited.entries()) {
    if (nodeId.startsWith("skill:")) skillDistances.set(nodeId.replace(/^skill:/, ""), distance);
  }
  return skillDistances;
}

function statusBadge(status: string): ReactElement {
  if (status === "current") return <Badge variant="secondary">current</Badge>;
  if (status === "stale") return <Badge variant="destructive">stale</Badge>;
  if (status === "missing") return <Badge variant="outline">missing</Badge>;
  if (status === "external") return <Badge variant="outline">external</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function maintenanceAction(row: Omit<SignalRow, "action">): string {
  if (row.status === "missing") return "add template metadata";
  if (row.status === "stale") return "bump template";
  if (row.coreDistance !== null && (row.heatScore > 0 || row.invocationCount > 0)) return "protect core";
  if (row.heatScore > 0 || row.invocationCount > 0) return "watch hot skill";
  return "monitor";
}

function MetricTile({
  icon,
  label,
  value,
}: {
  icon: ReactElement;
  label: string;
  value: string;
}): ReactElement {
  return (
    <div className="rounded-md border bg-card px-4 py-3">
      <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function SkillOsSignalsTab({
  frameworkCoreGraph,
  invocationState,
  nodes,
  templateIntelligence,
}: {
  frameworkCoreGraph: SkillFrameworkCoreGraphPayload | null;
  invocationState: SkillInvocationCountState;
  nodes: SkillGraphNode[];
  templateIntelligence: SkillTemplateIntelligencePayload | null;
}): ReactElement {
  const rows = useMemo(() => {
    const rolloutBySkill = new Map<string, SkillTemplateRolloutRow>();
    for (const row of templateIntelligence?.rollout ?? []) rolloutBySkill.set(row.skill_id, row);
    const coreDistances = buildCoreDistanceMap(frameworkCoreGraph);

    return nodes
      .filter((node) => node.source !== "external")
      .map((node) => {
        const rollout = rolloutBySkill.get(node.id);
        const heatScore = toNumber(node.heat?.heat_score);
        const invocationCount =
          invocationState.countBySkill.get(node.id) ??
          toNumber(node.heat?.invocation_count_30d ?? node.heat?.invocation_count_window);
        const rowBase = {
          coreDistance: coreDistances.get(node.id) ?? null,
          heatScore,
          invocationCount,
          skillId: node.id,
          status: rollout?.status ?? "unknown",
          templateVersion: rollout?.template_version ?? "missing",
          tier: rollout?.tier ?? node.tier ?? 3,
        };
        return {
          ...rowBase,
          action: maintenanceAction(rowBase),
        } satisfies SignalRow;
      })
      .sort((left, right) => {
        const leftDistance = left.coreDistance ?? 999;
        const rightDistance = right.coreDistance ?? 999;
        return (
          right.heatScore - left.heatScore ||
          right.invocationCount - left.invocationCount ||
          leftDistance - rightDistance ||
          left.skillId.localeCompare(right.skillId)
        );
      });
  }, [frameworkCoreGraph, invocationState.countBySkill, nodes, templateIntelligence]);

  const hotCount = rows.filter((row) => row.heatScore > 0 || row.invocationCount > 0).length;
  const coreCount = rows.filter((row) => row.coreDistance !== null).length;
  const debtCount = rows.filter((row) => row.status === "missing" || row.status === "stale").length;
  const currentCount = rows.filter((row) => row.status === "current").length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricTile icon={<Activity className="size-4" />} label="hot skills" value={String(hotCount)} />
        <MetricTile icon={<GitBranch className="size-4" />} label="core skills" value={String(coreCount)} />
        <MetricTile icon={<ShieldAlert className="size-4" />} label="debt" value={String(debtCount)} />
        <MetricTile
          icon={<ShieldCheck className="size-4" />}
          label="latest"
          value={`${Math.round((currentCount / Math.max(1, rows.length)) * 100)}%`}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-card">
        <div className="grid grid-cols-[minmax(12rem,1fr)_6rem_6rem_7rem_7rem_8rem_10rem] gap-3 border-b px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
          <span>Skill</span>
          <span>Heat</span>
          <span>Invoked</span>
          <span>Core</span>
          <span>Tier</span>
          <span>Template</span>
          <span>Action</span>
        </div>
        {rows.map((row) => (
          <div
            key={row.skillId}
            className="grid grid-cols-[minmax(12rem,1fr)_6rem_6rem_7rem_7rem_8rem_10rem] gap-3 border-b px-4 py-2 text-sm last:border-b-0"
          >
            <span className="truncate font-medium">{row.skillId}</span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{row.heatScore}</span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {row.invocationCount}
            </span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {row.coreDistance ?? "--"}
            </span>
            <span>T{row.tier}</span>
            <span className="flex min-w-0 items-center gap-2">
              {statusBadge(row.status)}
              <span className="truncate font-mono text-xs text-muted-foreground">
                {row.templateVersion}
              </span>
            </span>
            <span className="truncate text-muted-foreground">{row.action}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
