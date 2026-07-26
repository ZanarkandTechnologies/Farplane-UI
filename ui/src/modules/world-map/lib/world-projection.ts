/**
 * World Map projection boundary.
 * Converts untrusted generated JSON into the module model and derives search/map views.
 * Parsing is tolerant across additive producer changes; invalid rows are omitted, never invented.
 */

import type {
  FeatureCollection,
  WorldEdge,
  WorldFilters,
  WorldIssue,
  WorldLineFeature,
  WorldNode,
  WorldPointFeature,
  WorldProjection,
  WorldTimelineEntry,
  WorldView,
} from "../types";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function text(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function numberValue(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is string => typeof entry === "string" && Boolean(entry.trim()),
  );
}

function tagMap(value: unknown): Record<string, string[]> {
  const row = record(value);
  return Object.fromEntries(
    Object.entries(row)
      .map(([key, entries]) => [key, stringArray(entries)] as const)
      .filter(([, entries]) => entries.length > 0),
  );
}

function parseNode(value: unknown, fallbackProjectId: string): WorldNode | null {
  const row = record(value);
  const metadata = record(row.frontmatter ?? row.metadata ?? row.fields);
  const entityId = text(row.entity_id, row.entityId, row.id);
  const projectId = text(row.project_id, row.projectId, fallbackProjectId) || "unknown-project";
  const key = text(row.key, row.node_key, row.qualified_id, `${projectId}:${entityId}`);
  const name = text(row.name, row.label, metadata.name, entityId);
  if (!entityId || !key || !name) return null;
  const latitude = numberValue(row.latitude, row.lat, metadata.latitude, metadata.lat);
  const longitude = numberValue(row.longitude, row.lng, row.lon, metadata.longitude, metadata.lng);
  return {
    key,
    entityId,
    projectId,
    name,
    kind: text(row.kind, row.entity_kind, metadata.kind, "entity"),
    location: text(row.location, metadata.location) || undefined,
    latitude,
    longitude,
    aliases: stringArray(row.aliases ?? metadata.aliases),
    sourcePath: text(row.source_path, row.sourcePath, row.path) || undefined,
    metadata,
  };
}

function parseEdge(value: unknown, fallbackProjectId: string): WorldEdge | null {
  const row = record(value);
  const projectId = text(row.project_id, row.projectId, fallbackProjectId) || "unknown-project";
  const sourceEntityId = text(row.source_entity_id, row.sourceEntityId, row.source_id);
  const targetEntityId = text(row.target_entity_id, row.targetEntityId, row.target_id);
  const sourceKey = text(
    row.source_key,
    row.sourceKey,
    row.source,
    `${projectId}:${sourceEntityId}`,
  );
  const targetKey = text(
    row.target_key,
    row.targetKey,
    row.target,
    `${projectId}:${targetEntityId}`,
  );
  const context = text(row.context, row.sentence, row.description);
  const displayContext =
    text(row.display_context, row.displayContext) ||
    context.replace(/\[([^\]]+)\]\(entity:[^)]+\)/g, "$1");
  const key = text(row.key, row.edge_key, row.qualified_id, `${sourceKey}->${targetKey}`);
  if (!key || !sourceKey || !targetKey || !context) return null;
  return {
    key,
    projectId,
    sourceKey,
    targetKey,
    sourceEntityId: sourceEntityId || sourceKey.split(":").at(-1) || sourceKey,
    targetEntityId: targetEntityId || targetKey.split(":").at(-1) || targetKey,
    context,
    displayContext,
    sourcePath: text(row.source_path, row.sourcePath, row.path) || undefined,
    section: text(row.section) || undefined,
  };
}

function parseIssue(value: unknown): WorldIssue | null {
  if (typeof value === "string" && value.trim())
    return { code: "projection_issue", message: value.trim() };
  const row = record(value);
  const message = text(row.message, row.reason, row.detail, row.error);
  if (!message) return null;
  return {
    code: text(row.code, row.kind, row.reason, "projection_issue"),
    message,
    path: text(row.path, row.source_path) || undefined,
  };
}

function parseView(value: unknown): WorldView | null {
  const row = record(value);
  const id = text(row.id, row.view_id, row.viewId);
  const name = text(row.name, row.label);
  const entityIds = stringArray(row.entity_ids ?? row.entityIds);
  if (!id || !name || !entityIds.length) return null;
  return { id, name, entityIds };
}

function parseTimelineEntry(value: unknown, fallbackProjectId: string): WorldTimelineEntry | null {
  const row = record(value);
  const projectId = text(row.project_id, row.projectId, fallbackProjectId) || "unknown-project";
  const key = text(row.key);
  const date = text(row.date);
  const sourceEntityId = text(row.source_entity_id, row.sourceEntityId);
  const context = text(row.context);
  const displayContext = text(row.display_context, row.displayContext, context);
  const entityIds = stringArray(row.entity_ids ?? row.entityIds);
  if (!key || !date || !sourceEntityId || !displayContext || !entityIds.length) return null;
  return {
    key,
    projectId,
    date,
    sourceEntityId,
    entityIds,
    entityKeys: stringArray(row.entity_keys ?? row.entityKeys),
    context,
    displayContext,
    tags: tagMap(row.tags),
    sourcePath: text(row.source_path, row.sourcePath, row.path) || undefined,
    section: text(row.section) || undefined,
  };
}

export function parseWorldProjection(input: unknown): WorldProjection {
  const root = record(input);
  const projectRow = record(root.project);
  const projectId = text(
    projectRow.project_id,
    projectRow.id,
    root.project_id,
    root.projectId,
    "unknown-project",
  );
  const nodes = (Array.isArray(root.nodes) ? root.nodes : [])
    .map((row) => parseNode(row, projectId))
    .filter((row): row is WorldNode => row !== null);
  const edges = (
    Array.isArray(root.edges)
      ? root.edges
      : Array.isArray(root.associations)
        ? root.associations
        : []
  )
    .map((row) => parseEdge(row, projectId))
    .filter((row): row is WorldEdge => row !== null);
  const issues = (Array.isArray(root.issues) ? root.issues : [])
    .map(parseIssue)
    .filter((row): row is WorldIssue => row !== null);
  const views = (Array.isArray(root.views) ? root.views : [])
    .map(parseView)
    .filter((row): row is WorldView => row !== null);
  const timeline = (Array.isArray(root.timeline) ? root.timeline : [])
    .map((row) => parseTimelineEntry(row, projectId))
    .filter((row): row is WorldTimelineEntry => row !== null)
    .sort(
      (left, right) => right.date.localeCompare(left.date) || left.key.localeCompare(right.key),
    );
  return {
    schemaVersion: text(root.schema_version, root.schemaVersion, root.version, "1"),
    generatedAt: text(root.generated_at, root.generatedAt) || undefined,
    project: {
      id: projectId,
      name: text(projectRow.name, root.project_name, projectId),
      path: text(projectRow.path, root.project_path) || undefined,
    },
    nodes,
    edges,
    views,
    timeline,
    issues,
    stale: root.stale === true,
  };
}

export function hasCoordinates(
  node: WorldNode,
): node is WorldNode & { latitude: number; longitude: number } {
  return (
    typeof node.latitude === "number" &&
    node.latitude >= -90 &&
    node.latitude <= 90 &&
    typeof node.longitude === "number" &&
    node.longitude >= -180 &&
    node.longitude <= 180
  );
}

export function filterWorldNodes(
  nodes: WorldNode[],
  filters: WorldFilters,
  views: WorldView[] = [],
): WorldNode[] {
  const query = filters.query.trim().toLocaleLowerCase();
  const location = filters.location.trim().toLocaleLowerCase();
  const selectedView =
    filters.viewId && filters.viewId !== "all"
      ? views.find((view) => view.id === filters.viewId)
      : undefined;
  const viewEntityIds = selectedView ? new Set(selectedView.entityIds) : null;
  return nodes.filter((node) => {
    if (viewEntityIds && !viewEntityIds.has(node.entityId)) return false;
    if (filters.kind && filters.kind !== "all" && node.kind !== filters.kind) return false;
    if (location && !(node.location ?? "").toLocaleLowerCase().includes(location)) return false;
    if (!query) return true;
    return [node.name, node.entityId, node.kind, node.location ?? "", ...node.aliases]
      .join(" ")
      .toLocaleLowerCase()
      .includes(query);
  });
}

export function filterWorldEdges(edges: WorldEdge[], nodes: WorldNode[]): WorldEdge[] {
  const visibleKeys = new Set(nodes.map((node) => node.key));
  return edges.filter((edge) => visibleKeys.has(edge.sourceKey) && visibleKeys.has(edge.targetKey));
}

export function worldGeoJson(
  nodes: WorldNode[],
  edges: WorldEdge[],
): { points: FeatureCollection<WorldPointFeature>; lines: FeatureCollection<WorldLineFeature> } {
  const locatedByKey = new Map(nodes.filter(hasCoordinates).map((node) => [node.key, node]));
  const visibleKeys = new Set(nodes.map((node) => node.key));
  return {
    points: {
      type: "FeatureCollection",
      features: [...locatedByKey.values()].map((node) => ({
        type: "Feature",
        id: node.key,
        geometry: { type: "Point", coordinates: [node.longitude, node.latitude] },
        properties: { key: node.key, name: node.name, kind: node.kind },
      })),
    },
    lines: {
      type: "FeatureCollection",
      features: edges.flatMap((edge) => {
        if (!visibleKeys.has(edge.sourceKey) || !visibleKeys.has(edge.targetKey)) return [];
        const source = locatedByKey.get(edge.sourceKey);
        const target = locatedByKey.get(edge.targetKey);
        if (!source || !target) return [];
        return [
          {
            type: "Feature" as const,
            id: edge.key,
            geometry: {
              type: "LineString" as const,
              coordinates: [
                [source.longitude, source.latitude],
                [target.longitude, target.latitude],
              ],
            },
            properties: {
              key: edge.key,
              context: edge.displayContext,
              sourceName: source.name,
              targetName: target.name,
            },
          },
        ];
      }),
    },
  };
}
