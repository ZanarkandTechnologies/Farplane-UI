"use client";

/** Department → workstation | facility constellation layout. */

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
  if (node.kind === "department") return mode === "overview" ? 15 : 23;
  if (node.kind === "workstation") return mode === "overview" ? 7.4 : 16 + Math.min(2, childCount);
  if (node.kind === "facility") return mode === "overview" ? 7.8 : 17;
  return mode === "overview" ? 4 : 8;
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

function departmentCapabilities(
  graph: SkillGraphPayload,
  department: SkillGraphNode,
): SkillGraphNode[] {
  const ids = new Set(
    graph.edges
      .filter((edge) => edge.type === "member-of" && edge.source === department.id)
      .map((edge) => edge.target),
  );
  return graph.nodes
    .filter((node) => ids.has(node.id))
    .slice()
    .sort((left, right) => {
      const role = (node: SkillGraphNode): number => (node.kind === "workstation" ? 0 : 1);
      return role(left) - role(right) || left.id.localeCompare(right.id);
    });
}

function facilityLeaves(graph: SkillGraphPayload, workstation: SkillGraphNode): SkillGraphNode[] {
  const ids = new Set(
    graph.edges
      .filter((edge) => edge.type === "artifact-flow" && edge.source === workstation.id)
      .map((edge) => edge.target),
  );
  return graph.nodes
    .filter((node) => node.kind === "facility" && ids.has(node.id))
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
        (edge.type === "member-of" || edge.type === "artifact-flow") &&
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
  const span = count <= 1 ? 0 : Math.min(mode === "overview" ? 0.68 : 1.12, 0.42 + count * 0.16);
  const offset = count <= 1 ? 0 : -span / 2 + (index / (count - 1)) * span;
  const angle = branchAngle + offset;
  // A deterministic tangent offset makes the real direct connections feel
  // like a small constellation without inventing visual process nodes.
  const rhythm = ((index * 7 + count * 3) % 5) - 2;
  const tangent = angle + Math.PI / 2;
  const radius = mode === "overview" ? 48 + index * 4 : 190 + index * 26;
  const drift = rhythm * (mode === "overview" ? 4.5 : 13);
  return {
    angle,
    x: originX + Math.cos(angle) * radius + Math.cos(tangent) * drift,
    y: originY + Math.sin(angle) * radius + Math.sin(tangent) * drift,
  };
}

function facilityPosition(
  workstation: PositionedSkillNode,
  outwardAngle: number,
  index: number,
  count: number,
  mode: LayoutMode,
): { x: number; y: number } {
  const span = count <= 1 ? 0 : Math.min(mode === "overview" ? 0.5 : 0.84, 0.3 + count * 0.12);
  const offset = count <= 1 ? 0 : -span / 2 + (index / (count - 1)) * span;
  const angle = outwardAngle + offset;
  const radius = mode === "overview" ? 25 + index * 3 : 132 + index * 22;
  const drift = (((index * 5 + count) % 3) - 1) * (mode === "overview" ? 3 : 9);
  const tangent = angle + Math.PI / 2;
  return {
    x: workstation.x + Math.cos(angle) * radius + Math.cos(tangent) * drift,
    y: workstation.y + Math.sin(angle) * radius + Math.sin(tangent) * drift,
  };
}

function appendFacilityLeaves({
  claimedFacilityIds,
  graph,
  mode,
  outwardAngle,
  positionedNodes,
  workstation,
}: {
  claimedFacilityIds: Set<string>;
  graph: SkillGraphPayload;
  mode: LayoutMode;
  outwardAngle: number;
  positionedNodes: PositionedSkillNode[];
  workstation: PositionedSkillNode;
}): void {
  const facilities = facilityLeaves(graph, workstation).filter(
    (facility) => !claimedFacilityIds.has(facility.id),
  );
  facilities.forEach((facility, index) => {
    claimedFacilityIds.add(facility.id);
    const position = facilityPosition(workstation, outwardAngle, index, facilities.length, mode);
    positionedNodes.push(positionNode(facility, 0, mode, position.x, position.y));
  });
}

function buildOverviewLayout(graph: SkillGraphPayload): SkillGraphLayout {
  const departments = nodesOfKind(graph, "department");
  const positionedNodes: PositionedSkillNode[] = [];
  const claimedFacilityIds = new Set<string>();

  departments.forEach((department, index) => {
    const angle = -Math.PI * 0.75 + (index / Math.max(departments.length, 1)) * Math.PI * 2;
    const x = CENTER_X + Math.cos(angle) * OVERVIEW_DEPARTMENT_RING;
    const y = CENTER_Y + Math.sin(angle) * OVERVIEW_DEPARTMENT_RING;
    const capabilities = departmentCapabilities(graph, department);
    positionedNodes.push(positionNode(department, capabilities.length, "overview", x, y));

    capabilities.forEach((capability, capabilityIndex) => {
      const branch = branchPosition(x, y, angle, capabilityIndex, capabilities.length, "overview");
      const facilities = capability.kind === "workstation" ? facilityLeaves(graph, capability) : [];
      const positionedCapability = positionNode(
        capability,
        facilities.length,
        "overview",
        branch.x,
        branch.y,
      );
      positionedNodes.push(positionedCapability);
      if (capability.kind === "workstation") {
        appendFacilityLeaves({
          claimedFacilityIds,
          graph,
          mode: "overview",
          outwardAngle: branch.angle,
          positionedNodes,
          workstation: positionedCapability,
        });
      }
    });
  });

  const visibleIds = new Set(positionedNodes.map((node) => node.id));
  return {
    edges: visibleEdges(graph, visibleIds),
    nodes: positionedNodes,
    points: new Map(positionedNodes.map((node) => [node.id, node])),
  };
}

function buildDepartmentFocusLayout(
  graph: SkillGraphPayload,
  departmentId: string,
): SkillGraphLayout {
  const department = graph.nodes.find((node) => node.id === departmentId);
  if (!department || department.kind !== "department") return buildOverviewLayout(graph);

  const capabilities = departmentCapabilities(graph, department);
  const rootY = 650;
  const positionedNodes = [positionNode(department, capabilities.length, "focus", CENTER_X, rootY)];
  const claimedFacilityIds = new Set<string>();
  capabilities.forEach((capability, index) => {
    const branch = branchPosition(
      CENTER_X,
      rootY,
      -Math.PI / 2,
      index,
      capabilities.length,
      "focus",
    );
    const facilities = capability.kind === "workstation" ? facilityLeaves(graph, capability) : [];
    const positionedCapability = positionNode(
      capability,
      facilities.length,
      "focus",
      branch.x,
      branch.y,
    );
    positionedNodes.push(positionedCapability);
    if (capability.kind === "workstation") {
      appendFacilityLeaves({
        claimedFacilityIds,
        graph,
        mode: "focus",
        outwardAngle: branch.angle,
        positionedNodes,
        workstation: positionedCapability,
      });
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
    ? buildDepartmentFocusLayout(graph, focusedCapabilityId)
    : buildOverviewLayout(graph);
}
