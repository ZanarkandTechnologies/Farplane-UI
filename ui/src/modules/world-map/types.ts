export type WorldProject = {
  id: string;
  name: string;
  path?: string;
};

export type WorldNode = {
  key: string;
  entityId: string;
  projectId: string;
  name: string;
  kind: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  aliases: string[];
  sourcePath?: string;
  metadata: Record<string, unknown>;
};

export type WorldEdge = {
  key: string;
  projectId: string;
  sourceKey: string;
  targetKey: string;
  sourceEntityId: string;
  targetEntityId: string;
  context: string;
  displayContext: string;
  sourcePath?: string;
  section?: string;
};

export type WorldIssue = {
  code: string;
  message: string;
  path?: string;
};

export type WorldProjection = {
  schemaVersion: string;
  generatedAt?: string;
  project: WorldProject;
  nodes: WorldNode[];
  edges: WorldEdge[];
  issues: WorldIssue[];
  stale: boolean;
};

export type WorldBridgePayload = {
  ok: boolean;
  state: "ready" | "missing";
  projectPath: string;
  projection: unknown | null;
  stale?: boolean;
  issues?: unknown[];
  modifiedAt?: string;
  error?: string;
};

export type WorldFilters = {
  query: string;
  kind: string;
  location: string;
};

export type WorldSelection = { type: "node"; key: string } | { type: "edge"; key: string } | null;

export type WorldPointFeature = {
  type: "Feature";
  id: string;
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: { key: string; name: string; kind: string };
};

export type WorldLineFeature = {
  type: "Feature";
  id: string;
  geometry: { type: "LineString"; coordinates: [[number, number], [number, number]] };
  properties: { key: string; context: string; sourceName: string; targetName: string };
};

export type FeatureCollection<T> = {
  type: "FeatureCollection";
  features: T[];
};
