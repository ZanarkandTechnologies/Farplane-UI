"use client";

import type {
  GraphWorkbenchEdge,
  GraphWorkbenchKind,
  GraphWorkbenchNode,
} from "@/modules/graph-workbench";
import type {
  HarnessFeatureSummary,
  HarnessAdoptionPayload,
  HarnessBridgePayload,
  HarnessFsaProjection,
  HarnessGraphEdge,
  HarnessGraphNode,
  HarnessGraphPayload,
  HarnessLifecycleEdge,
  HarnessLifecycleNode,
  HarnessLifecyclePayload,
  HarnessSkillRolloutPayload,
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

export const LIFECYCLE_GRAPH_KINDS: GraphWorkbenchKind[] = [
  { color: "#2563EB", id: "skill", label: "skills" },
  { color: "#0F766E", id: "file", label: "files" },
  { color: "#7C3AED", id: "doc", label: "docs" },
  { color: "#D97706", id: "ticket", label: "tickets" },
  { color: "#E11D48", id: "automation", label: "automations" },
  { color: "#BE185D", id: "hook", label: "hooks" },
  { color: "#16A34A", id: "report", label: "reports" },
  { color: "#0891B2", id: "runtime", label: "runtime" },
  { color: "#64748B", id: "route", label: "routes" },
  { color: "#94A3B8", id: "state", label: "states" },
  { color: "#F97316", id: "command", label: "commands" },
  { color: "#DB2777", id: "gate", label: "gates" },
  { color: "#475569", id: "fsa_state", label: "FSA states" },
];

const LIFECYCLE_KIND_IDS = new Set(LIFECYCLE_GRAPH_KINDS.map((kind) => kind.id));

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

export type HarnessLifecycleStage = {
  description: string;
  edgeTypes: Record<string, number>;
  evidenceRefs: string[];
  guardrailCount: number;
  id: string;
  nodeIds: string[];
  primaryKinds: string[];
  readiness: "ready" | "active" | "partial" | "missing";
  title: string;
};

export type HarnessLifecycleModel = {
  confidence: Record<string, number>;
  edges: GraphWorkbenchEdge[];
  generatedAt: string;
  graphAvailable: boolean;
  nodes: GraphWorkbenchNode[];
  projections: HarnessFsaProjection[];
  stages: HarnessLifecycleStage[];
  summary: {
    automations: number;
    edges: number;
    fsaProjections: number;
    guardrails: number;
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
    label: edge.label ?? edge.raw_ref,
    source: edge.source,
    target: edge.target,
    type: edge.type,
  };
}

function normalizeLifecycleNode(node: HarnessLifecycleNode): GraphWorkbenchNode {
  return {
    description:
      typeof node.metadata?.description === "string"
        ? node.metadata.description
        : `${node.kind} in the Farplane lifecycle projection.`,
    id: node.id,
    kind: LIFECYCLE_KIND_IDS.has(node.kind) ? node.kind : "state",
    label: node.label,
    path: node.path,
  };
}

function normalizeLifecycleEdge(edge: HarnessLifecycleEdge): GraphWorkbenchEdge {
  return {
    label: edge.label ?? edge.evidence_ref,
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

export function isHarnessLifecyclePayload(value: unknown): value is HarnessLifecyclePayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<HarnessLifecyclePayload>;
  return Array.isArray(candidate.nodes) && Array.isArray(candidate.edges);
}

export function isHarnessAdoptionPayload(value: unknown): value is HarnessAdoptionPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<HarnessAdoptionPayload>;
  return candidate.schema === "farplane_adoption_stats" || Array.isArray(candidate.projects);
}

export function isHarnessSkillRolloutPayload(value: unknown): value is HarnessSkillRolloutPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<HarnessSkillRolloutPayload>;
  return candidate.schema === "farplane_skill_rollout" || Array.isArray(candidate.skills);
}

export function isHarnessBridgePayload<T>(
  value: unknown,
  isPayload: (payload: unknown) => payload is T,
): value is HarnessBridgePayload<T> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<HarnessBridgePayload<T>>;
  return typeof candidate.ok === "boolean" && (!candidate.payload || isPayload(candidate.payload));
}

function humanizeLifecycleState(stateId: string): string {
  const tail = stateId.split(":").pop() ?? stateId;
  return tail
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function projectionDescription(projection: HarnessFsaProjection): string {
  if (projection.id === "project_initialization") {
    return "Turns operator intent into a visible Farplane project substrate and a first Goal Advisor handoff.";
  }
  if (projection.id === "automation_activation") {
    return "Moves reviewed automation prompts into Pulse, Interval, scheduler state, and PM grouping.";
  }
  if (projection.id === "ticket_goal_execution") {
    return "Compiles one selected ticket into a native Codex Goal, proof bundle, review, and closeout.";
  }
  if (projection.id === "memory_drain_upkeep") {
    return "Compresses reports, lessons, troubles, and outcomes back into durable memory and skills.";
  }
  return "Lifecycle projection generated from the Farplane graph contract.";
}

function stageStatus(index: number, total: number): HarnessLifecycleStage["readiness"] {
  if (total <= 0) return "missing";
  if (index < Math.max(1, total - 2)) return "ready";
  if (index === total - 2) return "active";
  return "partial";
}

function buildStagesFromProjections(
  projections: HarnessFsaProjection[],
  lifecycleEdges: HarnessLifecycleEdge[],
): HarnessLifecycleStage[] {
  return projections.map((projection, index) => {
    const edgeTypes = projection.transitions.reduce<Record<string, number>>((types, edge) => {
      const type = edge.type ?? "transition";
      types[type] = (types[type] ?? 0) + 1;
      return types;
    }, {});
    const evidenceRefs = Array.from(
      new Set(projection.transitions.map((edge) => edge.evidence_ref).filter(Boolean)),
    );
    const transitionTargets = new Set([
      ...projection.transitions.map((edge) => edge.source),
      ...projection.transitions.map((edge) => edge.target),
    ]);
    const relatedEdges = lifecycleEdges.filter(
      (edge) => transitionTargets.has(edge.source) || transitionTargets.has(edge.target),
    );
    const guardrailCount = relatedEdges.filter((edge) =>
      ["guards", "triggers", "contains"].includes(edge.type ?? ""),
    ).length;

    return {
      description: projectionDescription(projection),
      edgeTypes,
      evidenceRefs,
      guardrailCount,
      id: projection.id,
      nodeIds: projection.states,
      primaryKinds: ["fsa", "skill", "file"],
      readiness: stageStatus(index, projections.length),
      title: projection.label,
    };
  });
}

function fallbackStages(): HarnessLifecycleStage[] {
  return [
    {
      description: "Capture project intent and write the initial Farplane project substrate.",
      edgeTypes: {},
      evidenceRefs: [],
      guardrailCount: 0,
      id: "pilot",
      nodeIds: [],
      primaryKinds: ["doc", "file"],
      readiness: "partial",
      title: "Pilot intake",
    },
    {
      description: "Shape goals, frontier, tickets, and Goal Packets before execution.",
      edgeTypes: {},
      evidenceRefs: [],
      guardrailCount: 0,
      id: "goal-packet",
      nodeIds: [],
      primaryKinds: ["ticket", "skill"],
      readiness: "partial",
      title: "Goal packet",
    },
    {
      description: "Run native Codex Goals with implementation, QA, demo, and review proof.",
      edgeTypes: {},
      evidenceRefs: [],
      guardrailCount: 0,
      id: "execution",
      nodeIds: [],
      primaryKinds: ["runtime", "report"],
      readiness: "missing",
      title: "Execution proof",
    },
    {
      description: "Activate Pulse, Interval, hooks, and memory drains after proof surfaces exist.",
      edgeTypes: {},
      evidenceRefs: [],
      guardrailCount: 0,
      id: "production-loop",
      nodeIds: [],
      primaryKinds: ["automation", "hook"],
      readiness: "missing",
      title: "Production loop",
    },
  ];
}

export function buildHarnessLifecycleModel(
  lifecycle: HarnessLifecyclePayload | null,
): HarnessLifecycleModel {
  if (!lifecycle) {
    return {
      confidence: {},
      edges: [],
      generatedAt: "not generated",
      graphAvailable: false,
      nodes: [],
      projections: [],
      stages: fallbackStages(),
      summary: {
        automations: 0,
        edges: 0,
        fsaProjections: 0,
        guardrails: 0,
        nodes: 0,
        skills: 0,
      },
    };
  }

  const nodes = lifecycle.nodes.map(normalizeLifecycleNode);
  const edges = lifecycle.edges.map(normalizeLifecycleEdge);
  const projections = lifecycle.fsa_projections ?? [];
  const guardrails = lifecycle.edges.filter((edge) =>
    ["guards", "triggers", "contains"].includes(edge.type ?? ""),
  ).length;

  return {
    confidence: lifecycle.counts?.edge_confidence ?? {},
    edges,
    generatedAt: lifecycle.generated_at ?? "unknown",
    graphAvailable: true,
    nodes,
    projections,
    stages: projections.length > 0 ? buildStagesFromProjections(projections, lifecycle.edges) : fallbackStages(),
    summary: {
      automations: lifecycle.counts?.node_kinds?.automation ?? 0,
      edges: lifecycle.counts?.edges ?? lifecycle.edges.length,
      fsaProjections: lifecycle.counts?.fsa_projections ?? projections.length,
      guardrails,
      nodes: lifecycle.counts?.nodes ?? lifecycle.nodes.length,
      skills: lifecycle.counts?.node_kinds?.skill ?? 0,
    },
  };
}

export { humanizeLifecycleState };
