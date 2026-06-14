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
  PositionedSkillNode,
  SkillGraphEdge,
  SkillGraphLayout,
  SkillGraphNode,
  SkillGraphPayload,
} from "./skill-os-types";

type ForceNode = SkillGraphNode &
  SimulationNodeDatum & {
    degree: number;
    radius: number;
  };

type ForceLink = SimulationLinkDatum<ForceNode> & {
  edge: SkillGraphEdge;
};

function nodeRadius(node: SkillGraphNode, degree: number): number {
  const tierBase = node.tier === 1 ? 25 : node.tier === 2 ? 20 : 16;
  const methodBonus = node.methods?.length ? 4 : 0;
  return tierBase + methodBonus + Math.min(10, degree * 0.75);
}

function tierTargetX(node: SkillGraphNode): number {
  if (node.tier === 1) return 560;
  if (node.tier === 2) return 430;
  return 760;
}

function linkDistance(edge: SkillGraphEdge): number {
  return edge.type === "common-chain" ? 150 : 210;
}

function linkId(value: string | number | ForceNode | undefined): string {
  if (typeof value === "object" && value && "id" in value) return String(value.id);
  return String(value ?? "");
}

export function buildForceGraphLayout(
  graph: SkillGraphPayload,
  visibleNodes: SkillGraphNode[],
): SkillGraphLayout {
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const degree = new Map<string, number>();
  for (const edge of graph.edges) {
    if (!visibleIds.has(edge.source) || !visibleIds.has(edge.target)) continue;
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }

  const nodes: ForceNode[] = visibleNodes.map((node, index) => {
    const angle = (index / Math.max(visibleNodes.length, 1)) * Math.PI * 2;
    const tier = node.tier ?? 3;
    const ring = tier === 1 ? 90 : tier === 2 ? 230 : 340;
    return {
      ...node,
      degree: degree.get(node.id) ?? 0,
      radius: nodeRadius(node, degree.get(node.id) ?? 0),
      x: tierTargetX(node) + Math.cos(angle) * ring,
      y: 410 + Math.sin(angle) * ring * 0.72,
    };
  });

  const edges = graph.edges
    .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
    .map((edge, index) => ({
      ...edge,
      renderKey: `${edge.source}-${edge.target}-${edge.type ?? "edge"}-${edge.label ?? "link"}-${index}`,
    }));

  const links: ForceLink[] = edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    edge,
  }));

  const simulation = forceSimulation<ForceNode>(nodes)
    .force(
      "link",
      forceLink<ForceNode, ForceLink>(links)
        .id((node) => node.id)
        .distance((link) => linkDistance(link.edge))
        .strength((link) => (link.edge.type === "common-chain" ? 0.42 : 0.18)),
    )
    .force(
      "charge",
      forceManyBody<ForceNode>().strength((node) => (node.tier === 1 ? -520 : -300)),
    )
    .force(
      "collision",
      forceCollide<ForceNode>()
        .radius((node) => node.radius + 18)
        .strength(0.9),
    )
    .force("x", forceX<ForceNode>((node) => tierTargetX(node)).strength(0.045))
    .force("y", forceY<ForceNode>(405).strength(0.035))
    .force("center", forceCenter(600, 405))
    .stop();

  for (let index = 0; index < 260; index += 1) simulation.tick();

  const points = new Map<string, { x: number; y: number }>();
  const positionedNodes: PositionedSkillNode[] = nodes.map((node) => {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    points.set(node.id, { x, y });
    return {
      ...node,
      x,
      y,
    };
  });

  return {
    edges: links.map((link) => ({
      ...link.edge,
      source: linkId(link.source),
      target: linkId(link.target),
    })),
    nodes: positionedNodes,
    points,
  };
}
