"use client";

/** Department → real workflow → artifact specialist layout for the capability constellation. */

import type {
  PositionedSkillNode,
  SkillGraphEdge,
  SkillGraphLayout,
  SkillGraphNode,
  SkillGraphPayload,
} from "./skill-os-types";

const CENTER_X = 600;
const CENTER_Y = 405;
const OVERVIEW_DEPARTMENT_RING = 220;
const DEPARTMENT_ORDER = [
  "back-office",
  "sales",
  "deals",
  "marketing",
  "operations",
  "intelligence",
  "customer",
];

type LayoutMode = "focus" | "overview";

function departmentSortKey(node: SkillGraphNode): number {
  const departmentId = node.department_id ?? node.id.replace(/^department:/, "");
  const index = DEPARTMENT_ORDER.indexOf(departmentId);
  return index === -1 ? DEPARTMENT_ORDER.length : index;
}

function nodeRadius(node: SkillGraphNode, childCount: number, mode: LayoutMode): number {
  if (node.kind === "department") return mode === "overview" ? 14 : 20;
  if (node.kind === "workflow") return mode === "overview" ? 5.5 : 10 + Math.min(2, childCount);
  return mode === "overview" ? 3.75 : 6;
}

function nodesOfKind(graph: SkillGraphPayload, kind: string): SkillGraphNode[] {
  return graph.nodes
    .filter((node) => node.kind === kind)
    .slice()
    .sort((left, right) => {
      if (kind === "department") return departmentSortKey(left) - departmentSortKey(right);
      return left.id.localeCompare(right.id);
    });
}

function childNodes(
  graph: SkillGraphPayload,
  root: SkillGraphNode,
  edgeType: "contains" | "member-of",
): SkillGraphNode[] {
  const childIds = new Set(
    graph.edges
      .filter((edge) => edge.type === edgeType && edge.source === root.id)
      .map((edge) => edge.target),
  );
  return graph.nodes
    .filter((node) => childIds.has(node.id))
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id));
}

function positionNode(
  node: SkillGraphNode,
  childCount: number,
  mode: LayoutMode,
  x: number,
  y: number,
): PositionedSkillNode {
  return { ...node, degree: childCount, radius: nodeRadius(node, childCount, mode), x, y };
}

function visibleEdges(graph: SkillGraphPayload, visibleIds: Set<string>): SkillGraphEdge[] {
  return graph.edges
    .filter(
      (edge) =>
        (edge.type === "member-of" || edge.type === "contains") &&
        visibleIds.has(edge.source) &&
        visibleIds.has(edge.target),
    )
    .map((edge, index) => ({
      ...edge,
      renderKey: `${edge.source}-${edge.target}-${edge.type ?? "edge"}-${index}`,
    }));
}

function branchPosition(
  originX: number,
  originY: number,
  branchAngle: number,
  index: number,
  count: number,
  mode: LayoutMode,
): { angle: number; x: number; y: number } {
  const laneSize = mode === "overview" ? 7 : 8;
  const lane = Math.floor(index / laneSize);
  const laneIndex = index % laneSize;
  const currentLaneSize = Math.min(laneSize, count - lane * laneSize);
  const span = Math.min(mode === "overview" ? 1.45 : 1.78, 0.56 + count * 0.037);
  const offset = currentLaneSize <= 1 ? 0 : -span / 2 + (laneIndex / (currentLaneSize - 1)) * span;
  const radius = (mode === "overview" ? 48 : 170) + lane * (mode === "overview" ? 27 : 48);
  const angle = branchAngle + offset;
  // Preserve the same real endpoint pairs while preventing a perfectly even
  // fan. The small tangent offset gives branches a more organic constellation
  // silhouette; it is never emitted as an intermediate graph node.
  const rhythm = ((index * 5) % 7) - 3;
  const tangentOffset = rhythm * (mode === "overview" ? 2.6 : 8.5);
  const tangentialAngle = angle + Math.PI / 2;
  return {
    angle,
    x: originX + Math.cos(angle) * radius + Math.cos(tangentialAngle) * tangentOffset,
    y: originY + Math.sin(angle) * radius + Math.sin(tangentialAngle) * tangentOffset,
  };
}

function addMethodLeaves(
  graph: SkillGraphPayload,
  positionedNodes: PositionedSkillNode[],
  workflow: PositionedSkillNode,
  outwardAngle: number,
  mode: LayoutMode,
): void {
  const methods = childNodes(graph, workflow, "contains");
  methods.forEach((method, index) => {
    const offset = methods.length <= 1 ? 0 : -0.34 + (index / (methods.length - 1)) * 0.68;
    const radius = mode === "overview" ? 19 + index * 3 : 36 + index * 8;
    const angle = outwardAngle + offset;
    const rhythm = (index % 2 === 0 ? -1 : 1) * (mode === "overview" ? 2 : 6);
    const tangentialAngle = angle + Math.PI / 2;
    positionedNodes.push(
      positionNode(
        method,
        0,
        mode,
        workflow.x + Math.cos(angle) * radius + Math.cos(tangentialAngle) * rhythm,
        workflow.y + Math.sin(angle) * radius + Math.sin(tangentialAngle) * rhythm,
      ),
    );
  });
}

function focusedChildPosition(
  originX: number,
  originY: number,
  index: number,
  count: number,
): { angle: number; x: number; y: number } {
  const horizontalSpacing = Math.min(154, 660 / Math.max(count - 1, 1));
  const x = originX + (index - (count - 1) / 2) * horizontalSpacing;
  // The alternating elevation makes a focused constellation feel like a path
  // system rather than a flat fan, without manufacturing stages. The generous
  // lateral spacing keeps real workflow labels legible before their format
  // specialists are expanded.
  const y = originY - 200 - ((index * 2) % 3) * 58;
  return {
    angle: Math.atan2(y - originY, x - originX),
    x,
    y,
  };
}

function buildOverviewLayout(graph: SkillGraphPayload): SkillGraphLayout {
  const departments = nodesOfKind(graph, "department");
  const positionedNodes: PositionedSkillNode[] = [];

  departments.forEach((department, index) => {
    const angle = -Math.PI * 0.75 + (index / Math.max(departments.length, 1)) * Math.PI * 2;
    const x = CENTER_X + Math.cos(angle) * OVERVIEW_DEPARTMENT_RING;
    const y = CENTER_Y + Math.sin(angle) * OVERVIEW_DEPARTMENT_RING;
    const workflows = childNodes(graph, department, "member-of");
    positionedNodes.push(positionNode(department, workflows.length, "overview", x, y));

    workflows.forEach((workflow, workflowIndex) => {
      const branch = branchPosition(x, y, angle, workflowIndex, workflows.length, "overview");
      const positionedWorkflow = positionNode(
        workflow,
        childNodes(graph, workflow, "contains").length,
        "overview",
        branch.x,
        branch.y,
      );
      positionedNodes.push(positionedWorkflow);
      addMethodLeaves(graph, positionedNodes, positionedWorkflow, branch.angle, "overview");
    });
  });

  const visibleIds = new Set(positionedNodes.map((node) => node.id));
  return {
    edges: visibleEdges(graph, visibleIds),
    nodes: positionedNodes,
    points: new Map(positionedNodes.map((node) => [node.id, node])),
  };
}

function buildFocusedLayout(graph: SkillGraphPayload, focusId: string): SkillGraphLayout {
  const root = graph.nodes.find((node) => node.id === focusId);
  if (!root || (root.kind !== "department" && root.kind !== "workflow")) {
    return buildOverviewLayout(graph);
  }

  const edgeType = root.kind === "department" ? "member-of" : "contains";
  const children = childNodes(graph, root, edgeType);
  const rootY = root.kind === "department" ? 650 : 620;
  const positionedNodes = [positionNode(root, children.length, "focus", CENTER_X, rootY)];

  children.forEach((child, index) => {
    const branch = focusedChildPosition(CENTER_X, rootY, index, children.length);
    const positionedChild = positionNode(
      child,
      child.kind === "workflow" ? childNodes(graph, child, "contains").length : 0,
      "focus",
      branch.x,
      branch.y,
    );
    positionedNodes.push(positionedChild);
    if (root.kind === "department" && child.kind === "workflow") {
      addMethodLeaves(graph, positionedNodes, positionedChild, branch.angle, "focus");
    }
  });

  const visibleIds = new Set(positionedNodes.map((node) => node.id));
  return {
    edges: visibleEdges(graph, visibleIds),
    nodes: positionedNodes,
    points: new Map(positionedNodes.map((node) => [node.id, node])),
  };
}

export function buildCapabilityGraphLayout(
  graph: SkillGraphPayload,
  focusedCapabilityId: string | null,
): SkillGraphLayout {
  return focusedCapabilityId
    ? buildFocusedLayout(graph, focusedCapabilityId)
    : buildOverviewLayout(graph);
}
