/**
 * Capability Map presentation helpers.
 *
 * The generated graph is canonical: departments come from Tier 3 `group` and
 * admitted packages are either artifact workstations or system facilities. It
 * deliberately carries no inferred task scheduling or runtime delivery state.
 */

import type {
  SkillCapabilityGraphPayload,
  SkillGraphEdge,
  SkillGraphNode,
  SkillGraphPayload,
} from "./skill-os-types";

export const CAPABILITY_GRAPH_SCHEMA_VERSION = "2.2.0";

const DEPARTMENT_COLORS: Record<string, string> = {
  "back-office": "#B6BE74",
  customer: "#73C8B1",
  deals: "#E8795A",
  intelligence: "#7AB6D9",
  marketing: "#E6C86A",
  operations: "#A78BFA",
  sales: "#D98EBC",
};

function isCapabilityGraphNode(value: unknown): value is SkillGraphNode {
  if (!value || typeof value !== "object") return false;
  const node = value as Partial<SkillGraphNode>;
  return (
    typeof node.id === "string" &&
    (node.kind === "department" || node.kind === "workstation" || node.kind === "facility")
  );
}

function isCapabilityGraphEdge(value: unknown): value is SkillGraphEdge {
  if (!value || typeof value !== "object") return false;
  const edge = value as Partial<SkillGraphEdge>;
  return (
    typeof edge.source === "string" &&
    typeof edge.target === "string" &&
    (edge.type === "member-of" || edge.type === "artifact-flow")
  );
}

export function isSkillCapabilityGraphPayload(
  value: unknown,
): value is SkillCapabilityGraphPayload {
  if (!value || typeof value !== "object") return false;
  const graph = value as Partial<SkillCapabilityGraphPayload>;
  return (
    graph.schema_version === CAPABILITY_GRAPH_SCHEMA_VERSION &&
    Array.isArray(graph.nodes) &&
    graph.nodes.every(isCapabilityGraphNode) &&
    Array.isArray(graph.edges) &&
    graph.edges.every(isCapabilityGraphEdge)
  );
}

function titleCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll(/[_-]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function departmentId(node: SkillGraphNode): string {
  return node.department_id ?? node.group ?? node.id.replace(/^department:/, "");
}

export function capabilityDepartmentColor(node: SkillGraphNode): string {
  return DEPARTMENT_COLORS[departmentId(node)] ?? "#E6C86A";
}

export function capabilityClusterColor(node: SkillGraphNode): string {
  return capabilityDepartmentColor(node);
}

export function capabilityNodeLabel(node: SkillGraphNode): string {
  if (node.kind === "department") return node.label ?? "Department";
  return titleCase(node.label ?? node.skill_id ?? node.id.replace(/^skill:/, ""));
}

export function capabilityNodeCaption(node: SkillGraphNode): string {
  if (node.kind === "department") return "DEPARTMENT";
  if (node.kind === "workstation") return "WORKSTATION";
  if (node.kind === "facility") return "SYSTEM FACILITY";
  return "CAPABILITY";
}

export function capabilityFocusContains(
  graph: SkillGraphPayload,
  focusId: string,
  nodeId: string,
): boolean {
  if (focusId === nodeId) return true;
  const childrenByParent = new Map<string, string[]>();
  for (const edge of graph.edges.filter(
    (edge) => edge.type === "member-of" || edge.type === "artifact-flow",
  )) {
    childrenByParent.set(edge.source, [...(childrenByParent.get(edge.source) ?? []), edge.target]);
  }
  const pending = [...(childrenByParent.get(focusId) ?? [])];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const current = pending.shift();
    if (!current || visited.has(current)) continue;
    if (current === nodeId) return true;
    visited.add(current);
    pending.push(...(childrenByParent.get(current) ?? []));
  }
  return false;
}

export function capabilityFocusId(graph: SkillGraphPayload, value: string | null): string | null {
  if (!value) return null;
  const direct = graph.nodes.find((node) => node.id === value);
  return direct?.kind === "department" ? direct.id : null;
}
