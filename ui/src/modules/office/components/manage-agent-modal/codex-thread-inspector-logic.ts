/**
 * Pure Codex inspector lineage shaping.
 *
 * Ownership: resolves office employee thread identity and direct graph neighbors.
 * Inputs/outputs: EmployeeData or hook graph rows -> stable thread id and parent/child edges.
 * Side effects: none.
 */

import type { EmployeeData } from "@/modules/office/lib/types";

export type LineageEdge = {
  id: string;
  source: string;
  target: string;
  kind: "created" | "forked" | "spawned";
  eventAt: number;
  title?: string;
};

export type LineageNode = {
  id: string;
  label: string;
  kind: "thread" | "pending" | "unknown-parent";
  lastSeenAt: number;
};

export type LineageGraph = { nodes: LineageNode[]; edges: LineageEdge[] };

export function resolveEmployeeThreadId(employee: EmployeeData): string {
  return (
    employee.observedRuntime?.threadId ??
    employee.observedRuntime?.sessionKey ??
    String(employee._id).replace(/^employee-(?:codex-thread:)?/, "")
  );
}

export function normalizeThreadId(value: string): string {
  return value.replace(/^codex-thread:/, "");
}

export function getDirectThreadLineage(input: {
  graph?: LineageGraph;
  threadId: string;
  observedParentThreadId?: string;
}): { parents: LineageEdge[]; children: LineageEdge[] } {
  const current = normalizeThreadId(input.threadId);
  const edges = input.graph?.edges ?? [];
  const parents = edges.filter((edge) => normalizeThreadId(edge.target) === current);
  if (parents.length === 0 && input.observedParentThreadId) {
    parents.push({
      id: `observed-parent:${input.observedParentThreadId}:${current}`,
      source: input.observedParentThreadId,
      target: input.threadId,
      kind: "spawned",
      eventAt: 0,
    });
  }
  return {
    parents,
    children: edges.filter((edge) => normalizeThreadId(edge.source) === current),
  };
}

export function getThreadLineageNetwork(input: {
  graph?: LineageGraph;
  threadId: string;
  observedParentThreadId?: string;
  maxNodes?: number;
}): LineageGraph {
  const current = normalizeThreadId(input.threadId);
  const graphNodes = input.graph?.nodes ?? [];
  const graphEdges = [...(input.graph?.edges ?? [])];
  const observedParent = normalizeThreadId(input.observedParentThreadId ?? "");
  if (
    observedParent &&
    !graphEdges.some(
      (edge) =>
        normalizeThreadId(edge.source) === observedParent &&
        normalizeThreadId(edge.target) === current,
    )
  ) {
    graphEdges.push({
      id: `observed-parent:${observedParent}:${current}`,
      source: observedParent,
      target: current,
      kind: "spawned",
      eventAt: 0,
    });
  }

  const adjacency = new Map<string, Set<string>>();
  for (const edge of graphEdges) {
    const source = normalizeThreadId(edge.source);
    const target = normalizeThreadId(edge.target);
    const sourceNeighbors = adjacency.get(source) ?? new Set<string>();
    sourceNeighbors.add(target);
    adjacency.set(source, sourceNeighbors);
    const targetNeighbors = adjacency.get(target) ?? new Set<string>();
    targetNeighbors.add(source);
    adjacency.set(target, targetNeighbors);
  }

  const visited = new Set<string>();
  const queue = [current];
  const maxNodes = input.maxNodes ?? 200;
  while (queue.length > 0 && visited.size < maxNodes) {
    const nodeId = queue.shift();
    if (!nodeId || visited.has(nodeId)) continue;
    visited.add(nodeId);
    for (const neighbor of adjacency.get(nodeId) ?? []) {
      if (!visited.has(neighbor)) queue.push(neighbor);
    }
  }

  const byNormalizedId = new Map(
    graphNodes.map((node) => [normalizeThreadId(node.id), node] as const),
  );
  return {
    nodes: [...visited].map((nodeId) => {
      const existing = byNormalizedId.get(nodeId);
      return (
        existing ?? {
          id: nodeId,
          label: nodeId === current ? "Current task" : shortThreadId(nodeId),
          kind: "thread" as const,
          lastSeenAt: 0,
        }
      );
    }),
    edges: graphEdges.filter(
      (edge) =>
        visited.has(normalizeThreadId(edge.source)) && visited.has(normalizeThreadId(edge.target)),
    ),
  };
}

function shortThreadId(value: string): string {
  if (value.length <= 20) return value;
  return `${value.slice(0, 8)}…${value.slice(-8)}`;
}
