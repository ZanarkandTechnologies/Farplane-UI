/**
 * Shared types for the Farplane project UI snapshot.
 * Kept separate from parser logic so the snapshot parser stays below the
 * source-size guardrail while preserving a single typed read model.
 */

export type ProjectUiSourceRef = {
  hash?: string | null;
  id?: string;
  kind?: string;
  path: string;
  pointer?: string;
  rowId?: string;
  status?: string;
  updatedAt?: string | null;
};

export type ProjectUiSourceGap = {
  id: string;
  message: string;
  owner: string;
  severity: string;
  sourceRef?: ProjectUiSourceRef;
};

export type ProjectUiMetricTarget = {
  direction?: string;
  value?: number | string | null;
  unit?: string;
  deadline?: string;
  label?: string;
};

export type ProjectUiMetricPoint = {
  date: string;
  value: number | null;
  current: number | null;
  dailyDiff: number | null;
  payload: Record<string, unknown>;
  items: Array<{ id: string; kind?: string; url?: string; value: number | null }>;
};

export type ProjectUiMetricSourceGap = {
  date?: string;
  missingComponents: string[];
  payload: Record<string, unknown>;
  reason: string;
  sourcePath?: string;
  status: string;
};

export type ProjectUiMetricCard = {
  metricId: string;
  label: string;
  description?: string;
  productId: string;
  primitiveId: string;
  status: string;
  current: number | null;
  series: ProjectUiMetricPoint[];
  target: ProjectUiMetricTarget | number | string | null;
  targetHit: boolean | null;
  sourceGapIds: string[];
  sourceGaps: ProjectUiMetricSourceGap[];
  unit: string;
  display: string;
  direction: string;
  guard: { operator: string; threshold: number | null } | null;
  maxAgeDays: number | null;
  pinned: boolean;
  selectionRole: string;
};

export type ProjectUiContentMetricCard = {
  metricId: string;
  label: string;
  unit: string;
  productId: string;
  current: number | null;
  series: Array<{ date: string; value: number | null }>;
};

export type ProjectUiContentItem = {
  contentId: string;
  platform: string;
  url: string | null;
  title?: string;
  kind?: string;
  status?: string;
  publishedAt?: string | null;
  campaign?: string;
  approval?: string;
  approvalRef?: string;
  externalId?: string;
  kpis: string[];
  metrics: ProjectUiContentMetricCard[];
  sourceGapIds: string[];
};

export type ProjectUiCharter = {
  mission: string;
  northStar: string;
  humanThesis: string;
  operatingPrinciples: string[];
  nonTradeoffs: string[];
  stableCapabilities: string[];
};

export type ProjectUiSelectionMetric = {
  metricId: string;
  priority: number | null;
  scope: string;
};

export type ProjectUiObjectives = {
  metricCards: ProjectUiMetricCard[];
  objectives: ProjectUiSelectionMetric[];
  guards: ProjectUiSelectionMetric[];
  sourceGapIds: string[];
};

export type ProjectUiAutomation = {
  id: string;
  kind: string;
  name: string;
  status: string;
  sourceRef?: ProjectUiSourceRef;
};

export type ProjectUiSnapshot = {
  generatedAt: string;
  schemaVersion: number;
  projectRoot?: string;
  project: Record<string, unknown>;
  sources: ProjectUiSourceRef[];
  sourceGaps: ProjectUiSourceGap[];
  metrics: {
    contents: ProjectUiContentItem[];
    definitions: ProjectUiMetricCard[];
    primitives: Record<string, unknown>;
    readings: Record<string, unknown>;
    series: ProjectUiMetricCard[];
  };
  tabs: {
    overview: {
      charter: ProjectUiCharter;
      pinnedMetrics: string[];
      pinnedMetricCards: ProjectUiMetricCard[];
      primitiveSummary: Record<string, unknown>;
      sourceGapIds: string[];
    };
    objectives: ProjectUiObjectives;
    cadence: {
      automations: ProjectUiAutomation[];
      sourceGapIds: string[];
    };
    distribution: {
      contentItems: ProjectUiContentItem[];
      contentMetricCards: ProjectUiContentMetricCard[];
      contentMetricIds: string[];
      sourceGapIds: string[];
    };
  };
};
