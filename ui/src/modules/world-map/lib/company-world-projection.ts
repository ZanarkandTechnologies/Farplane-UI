/**
 * Company World aggregation boundary.
 * Inputs are isolated per-project read results; output is a deterministic, project-qualified,
 * read-only projection. No entity identity is inferred across configured projects.
 */

import type {
  CompanyWorldProject,
  CompanyWorldProjection,
  CompanyWorldProjectRef,
  CompanyWorldWarning,
  WorldProjection,
} from "../types";

export const COMPANY_WORLD_PROJECT_CAP = 24;
export const COMPANY_WORLD_PANEL_CAPS = { nodes: 400, edges: 800 } as const;
export const COMPANY_WORLD_PREVIEW_CAPS = { nodes: 80, edges: 120 } as const;

export type CompanyWorldProjectResult = {
  ref: CompanyWorldProjectRef;
  projection?: WorldProjection | null;
  error?: string;
};

export function normalizeCompanyWorldProjectRefs(
  refs: CompanyWorldProjectRef[],
  cap = COMPANY_WORLD_PROJECT_CAP,
): { refs: CompanyWorldProjectRef[]; warnings: CompanyWorldWarning[] } {
  const sorted = [...refs]
    .filter((ref) => Boolean(ref.id.trim()) && Boolean(ref.path.trim()))
    .sort((left, right) => left.id.localeCompare(right.id) || left.path.localeCompare(right.path));
  const unique: CompanyWorldProjectRef[] = [];
  const warnings: CompanyWorldWarning[] = [];
  const ids = new Set<string>();
  for (const ref of sorted) {
    if (ids.has(ref.id)) {
      warnings.push({
        code: "duplicate_project",
        projectId: ref.id,
        message: `Ignored duplicate configured project ${ref.name}.`,
      });
      continue;
    }
    ids.add(ref.id);
    unique.push(ref);
  }
  if (unique.length > cap) {
    warnings.push({
      code: "project_cap",
      message: `Showing the first ${cap} of ${unique.length} configured projects.`,
    });
  }
  return { refs: unique.slice(0, cap), warnings };
}

function qualifiedKey(projectId: string, key: string): string {
  return `${projectId}::${key}`;
}

export function mergeCompanyWorld(
  projectResults: CompanyWorldProjectResult[],
  caps: { nodes: number; edges: number } = COMPANY_WORLD_PANEL_CAPS,
  initialWarnings: CompanyWorldWarning[] = [],
): CompanyWorldProjection {
  const warnings = [...initialWarnings];
  const projects: CompanyWorldProject[] = [];
  const nodes: CompanyWorldProjection["nodes"] = [];
  const candidateEdges: CompanyWorldProjection["edges"] = [];
  const timeline: CompanyWorldProjection["timeline"] = [];
  let stale = false;
  const issues: CompanyWorldProjection["issues"] = [];

  for (const result of [...projectResults].sort((left, right) =>
    left.ref.id.localeCompare(right.ref.id),
  )) {
    const { ref, projection } = result;
    if (result.error) {
      projects.push({ ...ref, state: "error", nodeCount: 0, edgeCount: 0 });
      warnings.push({
        code: "project_error",
        projectId: ref.id,
        message: `${ref.name} could not be loaded: ${result.error}`,
      });
      continue;
    }
    if (!projection) {
      projects.push({ ...ref, state: "missing", nodeCount: 0, edgeCount: 0 });
      warnings.push({
        code: "project_missing",
        projectId: ref.id,
        message: `${ref.name} has no World projection yet.`,
      });
      continue;
    }

    projects.push({
      ...ref,
      state: "ready",
      nodeCount: projection.nodes.length,
      edgeCount: projection.edges.length,
    });
    stale ||= projection.stale;
    issues.push(
      ...projection.issues.map((issue) => ({
        ...issue,
        path: issue.path ? `${ref.name}: ${issue.path}` : ref.name,
      })),
    );

    const nodeKeyMap = new Map<string, string>();
    const entityKeyMap = new Map<string, string>();
    for (const node of [...projection.nodes].sort((left, right) =>
      left.key.localeCompare(right.key),
    )) {
      const key = qualifiedKey(ref.id, node.key);
      if (nodeKeyMap.has(node.key)) {
        warnings.push({
          code: "duplicate_node_key",
          projectId: ref.id,
          message: `${ref.name} contains duplicate entity key ${node.key}.`,
        });
        continue;
      }
      nodeKeyMap.set(node.key, key);
      entityKeyMap.set(node.entityId, key);
      nodes.push({ ...node, key, projectId: ref.id });
    }

    for (const edge of [...projection.edges].sort((left, right) =>
      left.key.localeCompare(right.key),
    )) {
      const sourceKey = nodeKeyMap.get(edge.sourceKey);
      const targetKey = nodeKeyMap.get(edge.targetKey);
      if (!sourceKey || !targetKey) {
        warnings.push({
          code: "invalid_edge_endpoint",
          projectId: ref.id,
          message: `${ref.name} association ${edge.key} references a missing endpoint.`,
        });
        continue;
      }
      candidateEdges.push({
        ...edge,
        key: qualifiedKey(ref.id, edge.key),
        projectId: ref.id,
        sourceKey,
        targetKey,
      });
    }

    timeline.push(
      ...projection.timeline.map((entry) => ({
        ...entry,
        key: qualifiedKey(ref.id, entry.key),
        projectId: ref.id,
        entityKeys: entry.entityKeys.length
          ? entry.entityKeys.flatMap((key) => {
              const qualified = nodeKeyMap.get(key);
              return qualified ? [qualified] : [];
            })
          : entry.entityIds.flatMap((entityId) => {
              const qualified = entityKeyMap.get(entityId);
              return qualified ? [qualified] : [];
            }),
      })),
    );
  }

  const cappedNodes = nodes.slice(0, caps.nodes);
  if (nodes.length > cappedNodes.length) {
    warnings.push({
      code: "node_cap",
      message: `Showing ${cappedNodes.length} of ${nodes.length} company entities.`,
    });
  }
  const retainedNodeKeys = new Set(cappedNodes.map((node) => node.key));
  const validEdges = candidateEdges.filter(
    (edge) => retainedNodeKeys.has(edge.sourceKey) && retainedNodeKeys.has(edge.targetKey),
  );
  const edges = validEdges.slice(0, caps.edges);
  if (validEdges.length > edges.length) {
    warnings.push({
      code: "edge_cap",
      message: `Showing ${edges.length} of ${validEdges.length} company associations.`,
    });
  }

  return {
    schemaVersion: "company-1",
    project: { id: "all-projects", name: "All projects" },
    projects,
    nodes: cappedNodes,
    edges,
    views: [],
    timeline: timeline
      .filter((entry) => entry.entityKeys.some((key) => retainedNodeKeys.has(key)))
      .sort(
        (left, right) => right.date.localeCompare(left.date) || left.key.localeCompare(right.key),
      ),
    issues,
    warnings,
    stale,
    loadedAt: Date.now(),
  };
}
