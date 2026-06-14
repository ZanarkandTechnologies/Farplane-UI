"use client";

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3";
import type {
  GraphWorkbenchEdge,
  GraphWorkbenchLayout,
  GraphWorkbenchNode,
  PositionedGraphWorkbenchNode,
} from "./types";

type ForceNode = GraphWorkbenchNode &
  SimulationNodeDatum & {
    degree: number;
    radius: number;
  };

type ForceLink = SimulationLinkDatum<ForceNode> & {
  edge: GraphWorkbenchEdge;
};

const KIND_TARGETS: Record<string, { x: number; y: number }> = {
  agent: { x: 260, y: 280 },
  doc: { x: 620, y: 230 },
  feature: { x: 560, y: 520 },
  "review-rubric": { x: 780, y: 550 },
  "root-doc": { x: 420, y: 170 },
  script: { x: 930, y: 360 },
  skill: { x: 360, y: 430 },
  "skill-doc": { x: 530, y: 330 },
  spec: { x: 740, y: 330 },
  template: { x: 930, y: 210 },
};

function nodeRadius(node: GraphWorkbenchNode, degree: number): number {
  const base = node.kind === "feature" ? 24 : node.kind === "skill" ? 20 : 16;
  return base + Math.min(11, degree * 0.55) + Math.min(8, node.weight ?? 0);
}

function targetFor(node: GraphWorkbenchNode): { x: number; y: number } {
  return KIND_TARGETS[node.kind] ?? { x: 620, y: 390 };
}

function linkId(value: string | number | ForceNode | undefined): string {
  if (typeof value === "object" && value && "id" in value) return String(value.id);
  return String(value ?? "");
}

function linkDistance(edge: GraphWorkbenchEdge): number {
  if (edge.type === "feature-surface") return 130;
  if (edge.type === "markdown-link") return 190;
  if (edge.type === "literal-path") return 150;
  return 170;
}

export function buildGraphWorkbenchLayout(
  nodes: GraphWorkbenchNode[],
  edges: GraphWorkbenchEdge[],
): GraphWorkbenchLayout {
  const visibleIds = new Set(nodes.map((node) => node.id));
  const degree = new Map<string, number>();
  for (const edge of edges) {
    if (!visibleIds.has(edge.source) || !visibleIds.has(edge.target)) continue;
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }

  const forceNodes: ForceNode[] = nodes.map((node, index) => {
    const target = targetFor(node);
    const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2;
    const ring = node.kind === "feature" ? 120 : node.kind === "skill" ? 260 : 360;
    return {
      ...node,
      degree: degree.get(node.id) ?? 0,
      radius: nodeRadius(node, degree.get(node.id) ?? 0),
      x: target.x + Math.cos(angle) * ring,
      y: target.y + Math.sin(angle) * ring * 0.72,
    };
  });

  const layoutEdges = edges
    .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
    .map((edge, index) => ({
      ...edge,
      renderKey: `${edge.source}-${edge.target}-${edge.type ?? "edge"}-${index}`,
    }));

  const links: ForceLink[] = layoutEdges.map((edge) => ({
    edge,
    source: edge.source,
    target: edge.target,
  }));

  const simulation = forceSimulation<ForceNode>(forceNodes)
    .force(
      "link",
      forceLink<ForceNode, ForceLink>(links)
        .id((node) => node.id)
        .distance((link) => linkDistance(link.edge))
        .strength((link) => (link.edge.type === "feature-surface" ? 0.35 : 0.16)),
    )
    .force(
      "charge",
      forceManyBody<ForceNode>().strength((node) => (node.kind === "feature" ? -560 : -280)),
    )
    .force(
      "collision",
      forceCollide<ForceNode>()
        .radius((node) => node.radius + 16)
        .strength(0.9),
    )
    .force("x", forceX<ForceNode>((node) => targetFor(node).x).strength(0.048))
    .force("y", forceY<ForceNode>((node) => targetFor(node).y).strength(0.042))
    .force("center", forceCenter(620, 390))
    .stop();

  for (let index = 0; index < 260; index += 1) simulation.tick();

  const points = new Map<string, { x: number; y: number }>();
  const positionedNodes: PositionedGraphWorkbenchNode[] = forceNodes.map((node) => {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    points.set(node.id, { x, y });
    return { ...node, x, y };
  });

  return {
    edges: links.map((link) => ({
      ...link.edge,
      renderKey: link.edge.renderKey,
      source: linkId(link.source),
      target: linkId(link.target),
    })),
    nodes: positionedNodes,
    points,
  };
}
