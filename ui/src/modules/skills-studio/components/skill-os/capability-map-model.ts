/**
 * Capability Map presentation helpers.
 *
 * The generated graph is canonical: departments come from Tier 3 `group`,
 * map roots are selected real workflow skills, and outputs are artifact-only
 * `contains` leaves. It deliberately carries no inferred task scheduling.
 */

import type { SkillGraphNode, SkillGraphPayload } from "./skill-os-types";

const DEPARTMENT_COLORS: Record<string, string> = {
  "back-office": "#B6BE74",
  customer: "#73C8B1",
  deals: "#E8795A",
  intelligence: "#7AB6D9",
  marketing: "#E6C86A",
  operations: "#A78BFA",
  sales: "#D98EBC",
};

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

const ARTIFACT_METHOD_LABELS: Record<string, string> = {
  "cross-platform": "Cross-Platform",
  "twitter-thread": "X Thread",
};

export function capabilityDepartmentColor(node: SkillGraphNode): string {
  return DEPARTMENT_COLORS[departmentId(node)] ?? "#E6C86A";
}

export function capabilityClusterColor(node: SkillGraphNode): string {
  return capabilityDepartmentColor(node);
}

export function capabilityNodeLabel(node: SkillGraphNode): string {
  if (node.kind === "department") return node.label ?? "Department";
  if (node.kind === "workflow") return titleCase(node.label ?? node.skill_id ?? node.id);
  const action = node.method_id?.split(":").at(-1);
  if (action && ARTIFACT_METHOD_LABELS[action]) return ARTIFACT_METHOD_LABELS[action];
  return titleCase(action ?? node.label ?? node.output ?? node.id);
}

export function capabilityNodeCaption(node: SkillGraphNode): string {
  if (node.kind === "department") return "DEPARTMENT";
  if (node.kind === "workflow") return "WORKFLOW";
  if (node.kind === "artifact") return "ARTIFACT";
  return "ACTION";
}

export function capabilityFocusContains(
  graph: SkillGraphPayload,
  focusId: string,
  nodeId: string,
): boolean {
  if (focusId === nodeId) return true;
  const childrenByParent = new Map<string, string[]>();
  for (const edge of graph.edges.filter(
    (edge) => edge.type === "member-of" || edge.type === "contains",
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
  if (direct?.kind === "department" || direct?.kind === "workflow") return direct.id;
  return (
    graph.nodes.find((node) => node.kind === "workflow" && node.skill_id === value)?.id ?? null
  );
}
