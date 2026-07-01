/**
 * Team Workspace goal KPI model.
 * Inputs are farplane/goals.md plus the daily metrics UI snapshot; outputs are
 * render-ready goal axes. It is read-only and never invents source data.
 */

import { parseMarkdownTable } from "../project-config";
import type { FarplaneConfigFile, FarplaneProjectConfig } from "../project-config";

export type GoalSmartGoal = {
  id: string;
  target: string;
  kpis: string[];
  updateHint: string;
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
  current: number | null;
  dailyDiff: number | null;
  items: MetricBreakdownItem[];
};

export type KpiMetricRow = {
  metricId: string;
  label: string;
  axis: string;
  sourceId: string;
  status: string;
  current: number | null;
  target: number | string | null;
  targetHit: boolean | null;
  aggregation: string;
  cumulative: boolean;
  display: string;
  series: MetricSeriesPoint[];
};

export type MetricSourceGap = {
  metricId: string;
  sourceId: string;
  reason: string;
};

export type MetricsUiSnapshot = {
  snapshotDate: string;
  generatedAt: string;
  metrics: KpiMetricRow[];
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

function humanizeId(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function extractFencedBlock(markdown: string, language: string): string {
  const pattern = new RegExp("```" + language + "\\s*\\n([\\s\\S]*?)```", "i");
  return markdown.match(pattern)?.[1]?.trim() ?? "";
}

function normalizeScalar(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

export function parseGoalAxesFromGoalsMarkdown(markdown: string): GoalAxisContract[] {
  const yaml = extractFencedBlock(markdown, "yaml");
  if (yaml) {
    return parseGoalAxesYaml(yaml);
  }

  const kpiSection = markdown.match(/^## KPI Axes\s*([\s\S]*?)(?=^## |\s*$)/m)?.[1] ?? "";
  const rows = parseMarkdownTable(
    kpiSection,
  ).slice(1);
  return rows.map((row): GoalAxisContract => {
    const axis = row[0] ?? "KPI";
    const id = axis
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return {
      id,
      label: axis,
      question: row[2] || row[3] || "Goal question pending.",
      evidenceHints: [row[5] ?? "evidence missing"].filter(Boolean),
      smartGoals: [
        {
          id: `${id}_legacy`,
          target: row[3] || row[1] || "SMART target pending.",
          kpis: [],
          updateHint: row[8] ?? "Update hint pending.",
        },
      ],
    };
  });
}

function parseGoalAxesYaml(yaml: string): GoalAxisContract[] {
  const axes: GoalAxisContract[] = [];
  let currentAxis: GoalAxisContract | null = null;
  let currentGoal: GoalSmartGoal | null = null;
  let listMode: "evidence" | "kpis" | null = null;
  let collectingUpdateHint = false;
  const lines = yaml.split(/\r?\n/g);

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/g, "");
    if (!line.trim() || line.trim() === "goals:") continue;

    const axisMatch = line.match(/^  ([A-Za-z0-9_-]+):\s*$/);
    if (axisMatch) {
      currentAxis = {
        id: axisMatch[1],
        label: humanizeId(axisMatch[1]),
        question: "",
        evidenceHints: [],
        smartGoals: [],
      };
      axes.push(currentAxis);
      currentGoal = null;
      listMode = null;
      collectingUpdateHint = false;
      continue;
    }

    if (!currentAxis) continue;

    const questionMatch = line.match(/^    question:\s*(.+)$/);
    if (questionMatch) {
      currentAxis.question = normalizeScalar(questionMatch[1]);
      continue;
    }

    if (/^    evidence_hints:\s*$/.test(line)) {
      listMode = "evidence";
      collectingUpdateHint = false;
      continue;
    }

    if (/^    smart_goals:\s*$/.test(line)) {
      listMode = null;
      collectingUpdateHint = false;
      continue;
    }

    const evidenceMatch = line.match(/^      -\s+(.+)$/);
    if (listMode === "evidence" && evidenceMatch) {
      currentAxis.evidenceHints.push(normalizeScalar(evidenceMatch[1]));
      continue;
    }

    const goalMatch = line.match(/^      - id:\s*(.+)$/);
    if (goalMatch) {
      currentGoal = {
        id: normalizeScalar(goalMatch[1]),
        target: "",
        kpis: [],
        updateHint: "",
      };
      currentAxis.smartGoals.push(currentGoal);
      listMode = null;
      collectingUpdateHint = false;
      continue;
    }

    if (!currentGoal) continue;

    const targetMatch = line.match(/^        target:\s*(.+)$/);
    if (targetMatch) {
      currentGoal.target = normalizeScalar(targetMatch[1]);
      collectingUpdateHint = false;
      continue;
    }

    if (/^        kpis:\s*$/.test(line)) {
      listMode = "kpis";
      collectingUpdateHint = false;
      continue;
    }

    const kpiMatch = line.match(/^          -\s+(.+)$/);
    if (listMode === "kpis" && kpiMatch) {
      currentGoal.kpis.push(normalizeScalar(kpiMatch[1]));
      continue;
    }

    const updateHintMatch = line.match(/^        update_hint:\s*(.*)$/);
    if (updateHintMatch) {
      collectingUpdateHint = true;
      listMode = null;
      const inline = updateHintMatch[1].replace(/^>\s*/, "").trim();
      currentGoal.updateHint = inline ? normalizeScalar(inline) : "";
      continue;
    }

    if (collectingUpdateHint && line.startsWith("          ")) {
      currentGoal.updateHint = `${currentGoal.updateHint} ${line.trim()}`.trim();
    }
  }

  return axes;
}

function toNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseBreakdownItems(value: unknown): MetricBreakdownItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): MetricBreakdownItem | null => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      return {
        id: toStringValue(row.id),
        kind: toStringValue(row.kind) || undefined,
        url: toStringValue(row.url) || undefined,
        value: toNumberOrNull(row.value),
      };
    })
    .filter((item): item is MetricBreakdownItem => Boolean(item?.id));
}

function parseSeries(value: unknown): MetricSeriesPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((point): MetricSeriesPoint | null => {
      if (!point || typeof point !== "object") return null;
      const row = point as Record<string, unknown>;
      const date = toStringValue(row.date);
      if (!date) return null;
      return {
        date,
        value: toNumberOrNull(row.value),
        current: toNumberOrNull(row.current),
        dailyDiff: toNumberOrNull(row.daily_diff),
        items: parseBreakdownItems(row.items),
      };
    })
    .filter((point): point is MetricSeriesPoint => Boolean(point));
}

export function parseMetricsUiSnapshot(value: unknown): MetricsUiSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const rawMetrics = Array.isArray(source.metrics) ? source.metrics : [];
  const rawGaps = Array.isArray(source.source_gaps) ? source.source_gaps : [];
  return {
    snapshotDate: toStringValue(source.snapshot_date),
    generatedAt: toStringValue(source.generated_at),
    metrics: rawMetrics
      .map((metric): KpiMetricRow | null => {
        if (!metric || typeof metric !== "object") return null;
        const row = metric as Record<string, unknown>;
        const metricId = toStringValue(row.metric_id);
        if (!metricId) return null;
        return {
          metricId,
          label: toStringValue(row.label) || humanizeId(metricId),
          axis: toStringValue(row.axis),
          sourceId: toStringValue(row.source_id),
          status: toStringValue(row.status) || "unknown",
          current: toNumberOrNull(row.current),
          target:
            typeof row.target === "number" || typeof row.target === "string" ? row.target : null,
          targetHit: typeof row.target_hit === "boolean" ? row.target_hit : null,
          aggregation: toStringValue(row.aggregation),
          cumulative: row.cumulative === true,
          display: toStringValue(row.display),
          series: parseSeries(row.series),
        };
      })
      .filter((metric): metric is KpiMetricRow => Boolean(metric)),
    sourceGaps: rawGaps
      .map((gap): MetricSourceGap | null => {
        if (!gap || typeof gap !== "object") return null;
        const row = gap as Record<string, unknown>;
        const metricId = toStringValue(row.metric_id);
        if (!metricId) return null;
        return {
          metricId,
          sourceId: toStringValue(row.source_id),
          reason: toStringValue(row.reason) || "not connected yet",
        };
      })
      .filter((gap): gap is MetricSourceGap => Boolean(gap)),
  };
}

export function findMetricsSnapshot(config: FarplaneProjectConfig | null): MetricsUiSnapshot | null {
  const source = config?.runtimeSources.find((entry) => entry.id === "metrics-ui");
  return parseMetricsUiSnapshot(source?.parsedJson);
}

export function buildGoalAxisViews(
  axes: GoalAxisContract[],
  snapshot: MetricsUiSnapshot | null,
): GoalAxisView[] {
  const metricById = new Map((snapshot?.metrics ?? []).map((metric) => [metric.metricId, metric]));
  const gapById = new Map((snapshot?.sourceGaps ?? []).map((gap) => [gap.metricId, gap]));
  return axes.map((axis) => ({
    ...axis,
    smartGoals: axis.smartGoals.map((goal) => ({
      ...goal,
      metrics: goal.kpis.map((metricId) => ({
        metricId,
        metric: metricById.get(metricId) ?? null,
        gap: gapById.get(metricId) ?? null,
      })),
    })),
  }));
}

export function parseGoalAxesFromFile(file: FarplaneConfigFile | null): GoalAxisContract[] {
  return parseGoalAxesFromGoalsMarkdown(file?.content ?? "");
}
