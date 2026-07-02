/**
 * Team Workspace goal KPI model.
 * Inputs are farplane/goals.md plus the daily metrics UI snapshot; outputs are
 * render-ready goal axes. It is read-only and never invents source data.
 */

import { parseMarkdownTable } from "@/modules/team-workspace/lib/project-config";
import type {
  FarplaneConfigFile,
  FarplaneProjectConfig,
} from "@/modules/team-workspace/lib/project-config";
import type {
  ContentMetricRow,
  ContentMetricSeriesPoint,
  GoalAxisContract,
  GoalAxisView,
  GoalSmartGoal,
  KpiMetricRow,
  MetricBreakdownItem,
  MetricSeriesPoint,
  MetricsContentRow,
  MetricSourceGap,
  MetricsUiSnapshot,
} from "./goal-kpi-types";

export type {
  ContentMetricRow,
  ContentMetricSeriesPoint,
  GoalAxisContract,
  GoalAxisView,
  GoalSmartGoal,
  KpiMetricRow,
  MetricBreakdownItem,
  MetricsContentRow,
  MetricSeriesPoint,
  MetricsUiSnapshot,
  MetricSourceGap,
  SmartGoalView,
} from "./goal-kpi-types";

function humanizeId(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function extractFencedBlock(markdown: string, language: string): string {
  const pattern = new RegExp(`\`\`\`${language}\\s*\\n([\\s\\S]*?)\`\`\``, "i");
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
  const rows = parseMarkdownTable(kpiSection).slice(1);
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
  let collectingBlock: "updateHint" | "interpretation" | "target" | null = null;
  const lines = yaml.split(/\r?\n/g);

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/g, "");
    if (!line.trim() || line.trim() === "goals:") continue;

    const axisMatch = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
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
      collectingBlock = null;
      continue;
    }

    if (!currentAxis) continue;

    const questionMatch = line.match(/^ {4}question:\s*(.+)$/);
    if (questionMatch) {
      currentAxis.question = normalizeScalar(questionMatch[1]);
      collectingBlock = null;
      continue;
    }

    if (/^ {4}evidence_hints:\s*$/.test(line)) {
      listMode = "evidence";
      collectingBlock = null;
      continue;
    }

    if (/^ {4}smart_goals:\s*$/.test(line)) {
      listMode = null;
      collectingBlock = null;
      continue;
    }

    const evidenceMatch = line.match(/^ {4,}-\s+(.+)$/);
    if (listMode === "evidence" && evidenceMatch) {
      currentAxis.evidenceHints.push(normalizeScalar(evidenceMatch[1]));
      continue;
    }

    const kpiObjectMatch = line.match(/^ {6,}- id:\s*(.+)$/);
    if (listMode === "kpis" && kpiObjectMatch && currentGoal) {
      currentGoal.kpis.push(normalizeScalar(kpiObjectMatch[1]));
      continue;
    }

    const kpiMatch = line.match(/^ {6,}-\s+(.+)$/);
    if (listMode === "kpis" && kpiMatch && currentGoal) {
      currentGoal.kpis.push(normalizeScalar(kpiMatch[1]));
      continue;
    }

    const goalMatch = line.match(/^ {4,}- id:\s*(.+)$/);
    if (goalMatch) {
      currentGoal = {
        id: normalizeScalar(goalMatch[1]),
        target: "",
        kpis: [],
        updateHint: "",
      };
      currentAxis.smartGoals.push(currentGoal);
      listMode = null;
      collectingBlock = null;
      continue;
    }

    if (!currentGoal) continue;

    const targetMatch = line.match(/^ {6,}target:\s*(.*)$/);
    if (targetMatch) {
      const inline = targetMatch[1].replace(/^[-|>]\s*/, "").trim();
      currentGoal.target = inline ? normalizeScalar(inline) : "";
      collectingBlock = inline ? null : "target";
      continue;
    }

    if (/^ {6,}kpis:\s*$/.test(line)) {
      listMode = "kpis";
      collectingBlock = null;
      continue;
    }

    const updateHintMatch = line.match(/^ {6,}update_hint:\s*(.*)$/);
    if (updateHintMatch) {
      listMode = null;
      const inline = updateHintMatch[1].replace(/^>\s*/, "").trim();
      currentGoal.updateHint = inline ? normalizeScalar(inline) : "";
      collectingBlock = inline ? null : "updateHint";
      continue;
    }

    const interpretationMatch = line.match(/^ {6,}interpretation:\s*(.*)$/);
    if (interpretationMatch) {
      listMode = null;
      const inline = interpretationMatch[1].replace(/^>\s*/, "").trim();
      currentGoal.interpretation = inline ? normalizeScalar(inline) : "";
      collectingBlock = inline ? null : "interpretation";
      continue;
    }

    if (collectingBlock && line.match(/^ {8,}\S/)) {
      const text = line.trim();
      if (collectingBlock === "target") {
        currentGoal.target = `${currentGoal.target} ${text}`.trim();
      } else if (collectingBlock === "interpretation") {
        currentGoal.interpretation = `${currentGoal.interpretation ?? ""} ${text}`.trim();
      } else {
        currentGoal.updateHint = `${currentGoal.updateHint} ${text}`.trim();
      }
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
      const id = toStringValue(row.id) || toStringValue(row.content_id) || toStringValue(row.ticket_id);
      return {
        id,
        kind: toStringValue(row.kind) || undefined,
        url: toStringValue(row.url) || toStringValue(row.ticket) || undefined,
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
        current: toNumberOrNull(row.current) ?? toNumberOrNull(row.cumulative) ?? toNumberOrNull(row.value),
        dailyDiff: toNumberOrNull(row.daily_diff),
        items: parseBreakdownItems(row.items ?? (recordPayload(row.payload).items ?? [])),
      };
    })
    .filter((point): point is MetricSeriesPoint => Boolean(point));
}

function recordPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseContentMetricSeries(value: unknown): ContentMetricSeriesPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((point): ContentMetricSeriesPoint | null => {
      if (!point || typeof point !== "object") return null;
      const row = point as Record<string, unknown>;
      const date = toStringValue(row.date);
      if (!date) return null;
      return {
        date,
        value: toNumberOrNull(row.value) ?? toNumberOrNull(row.current) ?? toNumberOrNull(row.cumulative),
      };
    })
    .filter((point): point is ContentMetricSeriesPoint => Boolean(point));
}

function parseContentMetrics(value: unknown): ContentMetricRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((metric): ContentMetricRow | null => {
      if (!metric || typeof metric !== "object") return null;
      const row = metric as Record<string, unknown>;
      const metricId = toStringValue(row.metric_id);
      if (!metricId) return null;
      return {
        metricId,
        label: toStringValue(row.label) || humanizeId(metricId),
        unit: toStringValue(row.unit),
        product: toStringValue(row.product),
        current: toNumberOrNull(row.current),
        series: parseContentMetricSeries(row.series),
      };
    })
    .filter((metric): metric is ContentMetricRow => Boolean(metric));
}

function parseContentRows(value: unknown): MetricsContentRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((content): MetricsContentRow | null => {
      if (!content || typeof content !== "object") return null;
      const row = content as Record<string, unknown>;
      const contentId = toStringValue(row.content_id) || toStringValue(row.id);
      if (!contentId) return null;
      const platform = toStringValue(row.platform) || contentId.split(":")[0] || "";
      return {
        contentId,
        id: toStringValue(row.id) || contentId,
        approval: toStringValue(row.approval) || undefined,
        approvalRef: toStringValue(row.approval_ref) || undefined,
        campaign: toStringValue(row.campaign) || undefined,
        externalId: toStringValue(row.external_id) || undefined,
        kind: toStringValue(row.kind) || undefined,
        kpis: Array.isArray(row.kpis)
          ? row.kpis.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
          : [],
        mediaProductType: toStringValue(row.media_product_type) || undefined,
        mediaType: toStringValue(row.media_type) || undefined,
        platform,
        publishedAt: toStringValue(row.published_at) || undefined,
        status: toStringValue(row.status) || undefined,
        title: toStringValue(row.title) || undefined,
        url: toStringValue(row.url) || null,
        metrics: parseContentMetrics(row.metrics),
      };
    })
    .filter((content): content is MetricsContentRow => Boolean(content));
}

function uniqueSourceGaps(gaps: MetricSourceGap[]): MetricSourceGap[] {
  const seen = new Set<string>();
  return gaps.filter((gap) => {
    const key = `${gap.metricId}\0${gap.sourceId}\0${gap.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseMetricsUiSnapshot(value: unknown): MetricsUiSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const rawMetrics = Array.isArray(source.metrics) ? source.metrics : [];
  const rawGaps = Array.isArray(source.source_gaps) ? source.source_gaps : [];
  const metricRows = rawMetrics
    .map((metric): KpiMetricRow | null => {
      if (!metric || typeof metric !== "object") return null;
      const row = metric as Record<string, unknown>;
      const metricId = toStringValue(row.metric_id);
      if (!metricId) return null;
      const metricGaps = Array.isArray(row.source_gaps) ? row.source_gaps : [];
      const hasGaps = metricGaps.length > 0;
      return {
        metricId,
        label: toStringValue(row.label) || humanizeId(metricId),
        axis: toStringValue(row.axis),
        product: toStringValue(row.product),
        sourceId: toStringValue(row.source_id) || toStringValue(row.product) || metricId,
        status: toStringValue(row.status) || (hasGaps ? "source_gap" : "available"),
        current: toNumberOrNull(row.current),
        unit: toStringValue(row.unit),
        target:
          typeof row.target === "number" || typeof row.target === "string" ? row.target : null,
        targetHit: typeof row.target_hit === "boolean" ? row.target_hit : null,
        aggregation: toStringValue(row.aggregation),
        cumulative: row.cumulative === true,
        display: toStringValue(row.display),
        series: parseSeries(row.series),
      };
    })
    .filter((metric): metric is KpiMetricRow => Boolean(metric));
  const nestedGaps = rawMetrics.flatMap((metric): MetricSourceGap[] => {
    if (!metric || typeof metric !== "object") return [];
    const row = metric as Record<string, unknown>;
    const metricId = toStringValue(row.metric_id);
    if (!metricId || !Array.isArray(row.source_gaps)) return [];
    return row.source_gaps
      .map((gap): MetricSourceGap | null => {
        if (typeof gap === "string") {
          return { metricId, sourceId: toStringValue(row.source_id), reason: gap };
        }
        if (!gap || typeof gap !== "object") return null;
        const gapRow = gap as Record<string, unknown>;
        return {
          metricId: toStringValue(gapRow.metric_id) || metricId,
          sourceId: toStringValue(gapRow.source_id) || toStringValue(row.source_id),
          reason: toStringValue(gapRow.reason) || "not connected yet",
        };
      })
      .filter((gap): gap is MetricSourceGap => Boolean(gap));
  });
  return {
    schemaVersion: toNumberOrNull(source.schema_version) ?? 1,
    snapshotDate: toStringValue(source.snapshot_date),
    generatedAt: toStringValue(source.generated_at),
    metrics: metricRows,
    contents: parseContentRows(source.contents),
    sourceGaps: uniqueSourceGaps([
      ...rawGaps
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
      ...nestedGaps,
    ]),
  };
}

export function findMetricsSnapshot(
  config: FarplaneProjectConfig | null,
): MetricsUiSnapshot | null {
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
