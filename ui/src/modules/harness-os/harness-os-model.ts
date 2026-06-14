"use client";

import type {
  GraphWorkbenchEdge,
  GraphWorkbenchKind,
  GraphWorkbenchNode,
} from "@/modules/graph-workbench";
import type {
  HarnessFeatureSummary,
  HarnessGraphEdge,
  HarnessGraphNode,
  HarnessGraphPayload,
  HarnessTemplateIntelligencePayload,
} from "./harness-os-types";

export const HARNESS_GRAPH_KINDS: GraphWorkbenchKind[] = [
  { color: "#2563EB", id: "skill", label: "skills" },
  { color: "#0F766E", id: "feature", label: "features" },
  { color: "#64748B", id: "doc", label: "docs" },
  { color: "#94A3B8", id: "root-doc", label: "root" },
  { color: "#06B6D4", id: "skill-doc", label: "skill docs" },
  { color: "#7C3AED", id: "spec", label: "specs" },
  { color: "#16A34A", id: "script", label: "scripts" },
  { color: "#E11D48", id: "agent", label: "agents" },
  { color: "#D97706", id: "template", label: "templates" },
  { color: "#BE185D", id: "review-rubric", label: "rubrics" },
  { color: "#0891B2", id: "research", label: "research" },
];

const INCLUDED_KINDS = new Set(HARNESS_GRAPH_KINDS.map((kind) => kind.id));

export type HarnessOsModel = {
  edges: GraphWorkbenchEdge[];
  features: HarnessFeatureSummary[];
  generatedAt: string;
  nodes: GraphWorkbenchNode[];
  summary: {
    docs: number;
    edges: number;
    features: number;
    nodes: number;
    skills: number;
  };
};

function nodeDescription(node: HarnessGraphNode): string {
  if (node.kind === "skill") return "Farplane skill package.";
  if (node.kind === "spec") return "Harness behavior specification.";
  if (node.kind === "skill-doc") return "Skill-system documentation and registry source.";
  if (node.kind === "root-doc") return "Root operating document.";
  if (node.kind === "script") return "Harness script, validator, or automation file.";
  if (node.kind === "agent") return "Agent profile or execution role.";
  if (node.kind === "review-rubric") return "Review rubric document.";
  if (node.kind === "template") return "Reusable harness template.";
  if (node.kind === "research") return "Research or prior analysis document.";
  return "Farplane repository document.";
}

function normalizeNode(node: HarnessGraphNode): GraphWorkbenchNode {
  return {
    description: nodeDescription(node),
    id: node.id,
    kind: node.kind,
    label: node.label ?? node.path ?? node.id,
    path: node.path,
  };
}

function normalizeEdge(edge: HarnessGraphEdge): GraphWorkbenchEdge {
  return {
    label: edge.raw_ref,
    source: edge.source,
    target: edge.target,
    type: edge.type,
  };
}

function surfaceToNodeId(surface: string, nodeIds: Set<string>): string | null {
  const normalized = surface.replace(/^\.?\//, "").replace(/\/$/, "");
  const skillMatch = normalized.match(/^skills\/([^/]+)(?:\/SKILL\.md)?$/);
  if (skillMatch) {
    const skillId = `skill:${skillMatch[1]}`;
    if (nodeIds.has(skillId)) return skillId;
  }
  const fileId = `file:${normalized}`;
  if (nodeIds.has(fileId)) return fileId;
  const dirId = `dir:${normalized}`;
  if (nodeIds.has(dirId)) return dirId;
  return null;
}

function featureNode(feature: HarnessFeatureSummary): GraphWorkbenchNode {
  return {
    description: feature.known_limits,
    id: `feature:${feature.id}`,
    kind: "feature",
    label: `${feature.id} ${feature.name}`,
    path: feature.surfaces?.[0],
    weight: Math.min(8, feature.surfaces?.length ?? 0),
  };
}

export function buildHarnessOsModel({
  graph,
  templateIntelligence,
}: {
  graph: HarnessGraphPayload;
  templateIntelligence: HarnessTemplateIntelligencePayload | null;
}): HarnessOsModel {
  const baseNodes = graph.nodes.filter((node) => INCLUDED_KINDS.has(node.kind)).map(normalizeNode);
  const nodeIds = new Set(baseNodes.map((node) => node.id));
  const features = templateIntelligence?.features ?? [];
  const featureNodes = features.map(featureNode);
  const allNodes = [...baseNodes, ...featureNodes];
  const allNodeIds = new Set(allNodes.map((node) => node.id));

  const graphEdges = graph.edges
    .map(normalizeEdge)
    .filter((edge) => allNodeIds.has(edge.source) && allNodeIds.has(edge.target));
  const featureEdges = features.flatMap((feature) =>
    (feature.surfaces ?? [])
      .map((surface) => surfaceToNodeId(surface, nodeIds))
      .filter((nodeId): nodeId is string => Boolean(nodeId))
      .map((nodeId) => ({
        label: feature.id,
        source: `feature:${feature.id}`,
        target: nodeId,
        type: "feature-surface",
      })),
  );
  const edges = [...graphEdges, ...featureEdges];

  return {
    edges,
    features,
    generatedAt: templateIntelligence?.generated_at ?? graph.generated_at ?? "unknown",
    nodes: allNodes,
    summary: {
      docs: allNodes.filter((node) =>
        ["doc", "root-doc", "skill-doc", "spec", "review-rubric", "research"].includes(node.kind),
      ).length,
      edges: edges.length,
      features: features.length,
      nodes: allNodes.length,
      skills: allNodes.filter((node) => node.kind === "skill").length,
    },
  };
}

export function isHarnessGraphPayload(value: unknown): value is HarnessGraphPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<HarnessGraphPayload>;
  return Array.isArray(candidate.nodes) && Array.isArray(candidate.edges);
}

export function isHarnessTemplateIntelligencePayload(
  value: unknown,
): value is HarnessTemplateIntelligencePayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<HarnessTemplateIntelligencePayload>;
  return candidate.features === undefined || Array.isArray(candidate.features);
}
