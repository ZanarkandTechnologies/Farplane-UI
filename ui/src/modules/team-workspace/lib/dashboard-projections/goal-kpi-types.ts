/**
 * Shared Goal/KPI projection types.
 * Kept separate from parser logic so the runtime model stays below source-size guardrails.
 */

export type GoalSmartGoal = {
  id: string;
  target: string;
  kpis: string[];
  updateHint: string;
  interpretation?: string;
};

export type GoalAxisContract = {
  id: string;
  label: string;
  question: string;
  evidenceHints: string[];
  smartGoals: GoalSmartGoal[];
};

export type MetricBreakdownItem = {
  id: string;
  kind?: string;
  url?: string;
  value: number | null;
};

export type MetricSeriesPoint = {
  date: string;
  value: number | null;
  items: MetricBreakdownItem[];
};

export type KpiMetricRow = {
  metricId: string;
  label: string;
  description?: string;
  axis: string;
  product: string;
  sourceId: string;
  status: string;
  current: number | null;
  currentObservedAt?: string;
  currentStatus: string;
  type: "flow" | "stock";
  windowStart: string;
  windowEnd: string;
  windowTimezone: string;
  previousValue: number | null;
  absoluteDelta: number | null;
  percentDelta: number | null;
  progressDelta: number | null;
  momentum: string;
  comparisonReason?: string;
  cumulativeValue: number | null;
  cumulativeThrough?: string;
  cumulativeStatus?: string;
  unit?: string;
  target: number | string | null;
  targetDirection?: string;
  targetUnit?: string;
  targetDeadline?: string;
  targetHit: boolean | null;
  sourceGapIds?: string[];
  display: string;
  series: MetricSeriesPoint[];
};

export type MetricSourceGap = {
  metricId: string;
  sourceId: string;
  reason: string;
};

export type ContentMetricSeriesPoint = {
  date: string;
  value: number | null;
};

export type ContentMetricRow = {
  metricId: string;
  label: string;
  unit: string;
  product: string;
  current: number | null;
  series: ContentMetricSeriesPoint[];
};

export type MetricsContentRow = {
  contentId: string;
  id: string;
  approval?: string;
  approvalRef?: string;
  campaign?: string;
  externalId?: string;
  kind?: string;
  kpis: string[];
  mediaProductType?: string;
  mediaType?: string;
  platform: string;
  publishedAt?: string;
  status?: string;
  title?: string;
  url: string | null;
  metrics: ContentMetricRow[];
};

export type MetricsUiSnapshot = {
  schemaVersion: number;
  snapshotDate: string;
  generatedAt: string;
  metrics: KpiMetricRow[];
  contents: MetricsContentRow[];
  sourceGaps: MetricSourceGap[];
};

export type SmartGoalView = GoalSmartGoal & {
  metrics: Array<{
    metricId: string;
    metric: KpiMetricRow | null;
    gap: MetricSourceGap | null;
  }>;
};

export type GoalAxisView = Omit<GoalAxisContract, "smartGoals"> & {
  smartGoals: SmartGoalView[];
};
