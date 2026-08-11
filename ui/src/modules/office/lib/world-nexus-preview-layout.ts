/**
 * WORLD NEXUS PREVIEW LAYOUT
 * ==========================
 * Builds the bounded, deterministic 3D projection used by Command Commons.
 * It only reshapes the already-read Company World snapshot; it never fetches,
 * infers cross-project identities, or changes canonical World data.
 */

import type { CompanyWorldProjection } from "@/modules/world-map/types";

export const WORLD_NEXUS_PREVIEW_CAPS = { nodes: 42, edges: 80 } as const;

const PROJECT_COLORS = ["#75aead", "#95a77a", "#d3a66a", "#9b9fc6", "#bd907e"] as const;

export type WorldNexusPreviewNode = {
  key: string;
  color: string;
  position: [number, number, number];
};

export type WorldNexusPreviewEdge = {
  key: string;
  sourceKey: string;
  targetKey: string;
  color: string;
};

export type WorldNexusPreviewGraph = {
  nodes: WorldNexusPreviewNode[];
  edges: WorldNexusPreviewEdge[];
};

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function unit(value: string, salt: string): number {
  return stableHash(`${value}:${salt}`) / 0xffffffff;
}

function projectColor(projectId: string): string {
  return PROJECT_COLORS[stableHash(projectId) % PROJECT_COLORS.length] ?? PROJECT_COLORS[0];
}

export function buildWorldNexusPreviewGraph(
  projection: CompanyWorldProjection | undefined,
): WorldNexusPreviewGraph {
  const entityNodes = projection?.nodes.slice(0, WORLD_NEXUS_PREVIEW_CAPS.nodes) ?? [];
  const sourceNodes = entityNodes.length
    ? entityNodes
    : (projection?.projects ?? [])
        .filter((project) => project.state !== "error")
        .slice(0, WORLD_NEXUS_PREVIEW_CAPS.nodes)
        .map((project) => ({ key: `project:${project.id}`, projectId: project.id }));
  const nodeKeys = new Set(sourceNodes.map((node) => node.key));
  const nodes = sourceNodes.map((node, index) => {
    const angle =
      (index / Math.max(sourceNodes.length, 1)) * Math.PI * 2 + unit(node.key, "angle") * 0.52;
    const radius = 0.42 + unit(node.key, "radius") * 0.72;
    return {
      key: node.key,
      color: projectColor(node.projectId),
      position: [
        Math.cos(angle) * radius,
        0.2 + unit(node.key, "height") * 0.96,
        Math.sin(angle) * radius * 0.78,
      ] as [number, number, number],
    };
  });
  const colorByKey = new Map(nodes.map((node) => [node.key, node.color]));
  const edges = (entityNodes.length ? (projection?.edges ?? []) : [])
    .filter((edge) => nodeKeys.has(edge.sourceKey) && nodeKeys.has(edge.targetKey))
    .slice(0, WORLD_NEXUS_PREVIEW_CAPS.edges)
    .map((edge) => ({
      key: edge.key,
      sourceKey: edge.sourceKey,
      targetKey: edge.targetKey,
      color: colorByKey.get(edge.sourceKey) ?? "#8ca9a4",
    }));

  return { nodes, edges };
}
