/**
 * Unified Farplane project UI snapshot model.
 * Inputs are `.farplane/project/ui/latest.json`; outputs are render-safe slices
 * for Team Workspace tabs. The UI treats this snapshot as the read model and
 * does not parse project strategy files for dashboard data.
 */

import type { FarplaneProjectConfig } from "@/modules/team-workspace/lib/project-config";
import type {
  ProjectUiContentItem,
  ProjectUiContentMetricCard,
  ProjectUiCharter,
  ProjectUiMetricCard,
  ProjectUiMetricPoint,
  ProjectUiMetricSourceGap,
  ProjectUiMetricTarget,
  ProjectUiObjectives,
  ProjectUiSelectionMetric,
  ProjectUiSnapshot,
  ProjectUiSourceGap,
  ProjectUiSourceRef,
  ProjectUiAutomation,
} from "./project-ui-snapshot-types";

export type {
  ProjectUiContentItem,
  ProjectUiContentMetricCard,
  ProjectUiCharter,
  ProjectUiMetricCard,
  ProjectUiMetricPoint,
  ProjectUiMetricSourceGap,
  ProjectUiMetricTarget,
  ProjectUiObjectives,
  ProjectUiSelectionMetric,
  ProjectUiSnapshot,
  ProjectUiSourceGap,
  ProjectUiSourceRef,
  ProjectUiAutomation,
} from "./project-ui-snapshot-types";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalString(value: unknown): string | undefined {
  const text = stringValue(value).trim();
  return text ? text : undefined;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => stringValue(entry).trim()).filter(Boolean)
    : [];
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function sourceRef(value: unknown): ProjectUiSourceRef | undefined {
  if (typeof value === "string") {
    const path = value.trim();
    return path ? { path } : undefined;
  }
  const row = record(value);
  const path = stringValue(row.path).trim();
  if (!path) return undefined;
  return {
    hash: typeof row.hash === "string" || row.hash === null ? row.hash : undefined,
    id: optionalString(row.id),
    kind: optionalString(row.kind),
    path,
    pointer: optionalString(row.pointer),
    rowId: optionalString(row.row_id ?? row.rowId),
    status: optionalString(row.status),
    updatedAt:
      typeof row.updated_at === "string" || row.updated_at === null ? row.updated_at : undefined,
  };
}

function parseSourceGap(value: unknown): ProjectUiSourceGap | null {
  const row = record(value);
  const id = stringValue(row.id).trim();
  if (!id) return null;
  return {
    id,
    message: stringValue(row.message) || id,
    owner: stringValue(row.owner) || "unknown",
    severity: stringValue(row.severity) || "source_gap",
    sourceRef: sourceRef(row.source_ref ?? row.sourceRef),
  };
}

function parseTarget(value: unknown): ProjectUiMetricTarget | number | string | null {
  if (typeof value === "number" || typeof value === "string") return value;
  const row = record(value);
  if (Object.keys(row).length === 0) return null;
  return {
    direction: optionalString(row.direction),
    value:
      typeof row.value === "number" || typeof row.value === "string" || row.value === null
        ? row.value
        : undefined,
    unit: optionalString(row.unit),
    deadline: optionalString(row.deadline ?? row.by),
    label: optionalString(row.label),
  };
}

function parseMetricSourceGap(value: unknown): ProjectUiMetricSourceGap | null {
  const row = record(value);
  const reason = stringValue(row.reason).trim();
  const status = stringValue(row.status) || "source_gap";
  if (!reason && !status) return null;
  const payload = record(row.payload);
  return {
    date: optionalString(row.date),
    missingComponents: stringList(payload.missing_components ?? payload.missingComponents),
    payload,
    reason: reason || status,
    sourcePath: optionalString(payload.source_path ?? payload.sourcePath),
    status,
  };
}

function parseMetricPoint(value: unknown): ProjectUiMetricPoint | null {
  const row = record(value);
  const date = stringValue(row.date).trim();
  if (!date) return null;
  const items = Array.isArray(row.items) ? row.items : [];
  return {
    date,
    value: nullableNumber(row.value),
    current: nullableNumber(row.current ?? row.cumulative ?? row.value),
    dailyDiff: nullableNumber(row.daily_diff ?? row.dailyDiff),
    items: items
      .map((entry): ProjectUiMetricPoint["items"][number] | null => {
        const item = record(entry);
        const id = stringValue(item.id ?? item.content_id ?? item.ticket_id).trim();
        if (!id) return null;
        return {
          id,
          kind: optionalString(item.kind),
          url: optionalString(item.url ?? item.ticket),
          value: nullableNumber(item.value),
        };
      })
      .filter((entry): entry is ProjectUiMetricPoint["items"][number] => Boolean(entry)),
  };
}

function parseMetricCard(value: unknown): ProjectUiMetricCard | null {
  const row = record(value);
  const metricId = stringValue(row.metric_id ?? row.metricId).trim();
  if (!metricId) return null;
  const series = Array.isArray(row.series) ? row.series : [];
  return {
    metricId,
    label: stringValue(row.label) || metricId,
    description: optionalString(
      row.description ?? row.tooltip ?? row.calculation_description ?? row.calculationDescription,
    ),
    productId: stringValue(row.product_id ?? row.productId ?? row.product),
    primitiveId: stringValue(row.primitive_id ?? row.primitiveId ?? row.source_id ?? row.sourceId),
    status: stringValue(row.status) || "missing",
    current: nullableNumber(row.current),
    series: series
      .map(parseMetricPoint)
      .filter((point): point is ProjectUiMetricPoint => Boolean(point)),
    target: parseTarget(row.target ?? row.target_spec ?? row.targetSpec),
    targetHit: typeof row.target_hit === "boolean" ? row.target_hit : null,
    sourceGapIds: stringList(row.source_gap_ids ?? row.sourceGapIds),
    sourceGaps: (Array.isArray(row.source_gaps) ? row.source_gaps : [])
      .map(parseMetricSourceGap)
      .filter((gap): gap is ProjectUiMetricSourceGap => Boolean(gap)),
    unit: stringValue(row.unit),
    display: stringValue(row.display),
    direction: stringValue(row.direction ?? row.target_direction ?? row.targetDirection),
    guard: parseMetricGuard(row.guard),
    maxAgeDays: nullableNumber(row.max_age_days ?? row.maxAgeDays),
    pinned: row.pinned === true,
    selectionRole: stringValue(row.selection_role ?? row.selectionRole),
  };
}

function parseMetricGuard(value: unknown): ProjectUiMetricCard["guard"] {
  const row = record(value);
  const operator = stringValue(row.operator).trim();
  if (!operator) return null;
  return { operator, threshold: nullableNumber(row.threshold) };
}

function parseContentMetricCard(value: unknown): ProjectUiContentMetricCard | null {
  const row = record(value);
  const metricId = stringValue(row.metric_id ?? row.metricId).trim();
  if (!metricId) return null;
  const series = Array.isArray(row.series) ? row.series : [];
  return {
    metricId,
    label: stringValue(row.label) || metricId,
    unit: stringValue(row.unit),
    productId: stringValue(row.product_id ?? row.productId ?? row.product),
    current: nullableNumber(row.current),
    series: series
      .map((point): ProjectUiContentMetricCard["series"][number] | null => {
        const pointRow = record(point);
        const date = stringValue(pointRow.date).trim();
        if (!date) return null;
        return { date, value: nullableNumber(pointRow.value ?? pointRow.current) };
      })
      .filter((point): point is ProjectUiContentMetricCard["series"][number] => Boolean(point)),
  };
}

function parseContentItem(value: unknown): ProjectUiContentItem | null {
  const row = record(value);
  const contentId = stringValue(row.content_id ?? row.contentId ?? row.id).trim();
  if (!contentId) return null;
  const metrics = Array.isArray(row.metrics) ? row.metrics : [];
  return {
    contentId,
    platform: stringValue(row.platform) || contentId.split(":")[0] || "unknown",
    url: stringValue(row.url) || null,
    title: optionalString(row.title),
    kind: optionalString(row.kind),
    status: optionalString(row.status),
    publishedAt: stringValue(row.published_at ?? row.publishedAt) || null,
    campaign: optionalString(row.campaign),
    approval: optionalString(row.approval),
    approvalRef: optionalString(row.approval_ref ?? row.approvalRef),
    externalId: optionalString(row.external_id ?? row.externalId),
    kpis: stringList(row.kpis),
    metrics: metrics
      .map(parseContentMetricCard)
      .filter((metric): metric is ProjectUiContentMetricCard => Boolean(metric)),
    sourceGapIds: stringList(row.source_gap_ids ?? row.sourceGapIds),
  };
}

function parseSelectionMetric(value: unknown): ProjectUiSelectionMetric | null {
  const row = record(value);
  const metricId = stringValue(row.metric_id ?? row.metricId ?? row.id).trim();
  if (!metricId) return null;
  return {
    metricId,
    priority: nullableNumber(row.priority),
    scope: stringValue(row.scope),
  };
}

function parseCharter(value: unknown): ProjectUiCharter {
  const row = record(value);
  return {
    mission: stringValue(row.mission),
    northStar: stringValue(row.north_star ?? row.northStar),
    humanThesis: stringValue(row.human_thesis ?? row.humanThesis),
    operatingPrinciples: stringList(row.operating_principles ?? row.operatingPrinciples),
    nonTradeoffs: stringList(row.non_tradeoffs ?? row.nonTradeoffs),
    stableCapabilities: stringList(row.stable_capabilities ?? row.stableCapabilities),
  };
}

function parseObjectives(value: unknown): ProjectUiObjectives {
  const row = record(value);
  const selection = record(row.selection);
  return {
    metricCards: arrayValue(row.metric_cards ?? row.metricCards)
      .map(parseMetricCard)
      .filter((metric): metric is ProjectUiMetricCard => Boolean(metric)),
    objectives: arrayValue(selection.objectives)
      .map(parseSelectionMetric)
      .filter((metric): metric is ProjectUiSelectionMetric => Boolean(metric)),
    guards: arrayValue(selection.guards)
      .map(parseSelectionMetric)
      .filter((metric): metric is ProjectUiSelectionMetric => Boolean(metric)),
    sourceGapIds: stringList(row.source_gap_ids ?? row.sourceGapIds),
  };
}

function parseAutomation(value: unknown): ProjectUiAutomation | null {
  const row = record(value);
  const id = stringValue(row.id).trim();
  if (!id) return null;
  return {
    id,
    kind: stringValue(row.kind) || "unknown",
    name: stringValue(row.name) || id,
    status: stringValue(row.status) || "unknown",
    sourceRef: sourceRef(row.source_ref ?? row.sourceRef),
  };
}

export function parseProjectUiSnapshot(value: unknown): ProjectUiSnapshot | null {
  const source = record(value);
  const tabs = record(source.tabs);
  const metrics = record(source.metrics);
  if (!source.generated_at && !source.generatedAt) return null;
  if (source.schema_version !== 2) return null;
  const overview = record(tabs.overview);
  if (!("charter" in overview) || !("objectives" in tabs)) return null;
  const objectives = record(tabs.objectives);
  const cadence = record(tabs.cadence);
  const distribution = record(tabs.distribution);
  const series = Array.isArray(metrics.series) ? metrics.series : [];
  const definitions = Object.values(record(metrics.definitions));
  const metricContents = Array.isArray(metrics.contents) ? metrics.contents : [];
  const distributionContent = Array.isArray(distribution.content_items)
    ? distribution.content_items
    : [];
  return {
    generatedAt: stringValue(source.generated_at ?? source.generatedAt),
    schemaVersion: typeof source.schema_version === "number" ? source.schema_version : 1,
    projectRoot: optionalString(source.project_root ?? source.projectRoot),
    project: record(source.project),
    sources: (Array.isArray(source.sources) ? source.sources : [])
      .map(sourceRef)
      .filter((entry): entry is ProjectUiSourceRef => Boolean(entry)),
    sourceGaps: (Array.isArray(source.source_gaps) ? source.source_gaps : [])
      .map(parseSourceGap)
      .filter((gap): gap is ProjectUiSourceGap => Boolean(gap)),
    metrics: {
      contents: metricContents
        .map(parseContentItem)
        .filter((item): item is ProjectUiContentItem => Boolean(item)),
      definitions: definitions
        .map(parseMetricCard)
        .filter((metric): metric is ProjectUiMetricCard => Boolean(metric)),
      primitives: record(metrics.primitives),
      readings: record(metrics.readings ?? metrics.latest),
      series: series
        .map(parseMetricCard)
        .filter((metric): metric is ProjectUiMetricCard => Boolean(metric)),
    },
    tabs: {
      overview: {
        charter: parseCharter(overview.charter),
        pinnedMetrics: stringList(overview.pinned_metrics ?? overview.pinnedMetrics),
        pinnedMetricCards: (Array.isArray(overview.pinned_metric_cards)
          ? overview.pinned_metric_cards
          : []
        )
          .map(parseMetricCard)
          .filter((metric): metric is ProjectUiMetricCard => Boolean(metric)),
        primitiveSummary: record(overview.primitive_summary ?? overview.primitiveSummary),
        sourceGapIds: stringList(overview.source_gap_ids ?? overview.sourceGapIds),
      },
      objectives: parseObjectives(objectives),
      cadence: {
        automations: arrayValue(cadence.automations)
          .map(parseAutomation)
          .filter((automation): automation is ProjectUiAutomation => Boolean(automation)),
        sourceGapIds: stringList(cadence.source_gap_ids ?? cadence.sourceGapIds),
      },
      distribution: {
        contentItems: distributionContent
          .map(parseContentItem)
          .filter((item): item is ProjectUiContentItem => Boolean(item)),
        contentMetricCards: (Array.isArray(distribution.content_metric_cards)
          ? distribution.content_metric_cards
          : []
        )
          .map(parseContentMetricCard)
          .filter((metric): metric is ProjectUiContentMetricCard => Boolean(metric)),
        contentMetricIds: stringList(
          distribution.content_metric_ids ?? distribution.contentMetricIds,
        ),
        sourceGapIds: stringList(distribution.source_gap_ids ?? distribution.sourceGapIds),
      },
    },
  };
}

export function findProjectUiSnapshot(
  config: FarplaneProjectConfig | null | undefined,
): ProjectUiSnapshot | null {
  const source = config?.runtimeSources.find((entry) => entry.id === "project-ui");
  return parseProjectUiSnapshot(source?.parsedJson);
}

export function sourceGapsById(
  snapshot: ProjectUiSnapshot | null,
): Map<string, ProjectUiSourceGap> {
  return new Map((snapshot?.sourceGaps ?? []).map((gap) => [gap.id, gap]));
}

export function sourceGapText(
  snapshot: ProjectUiSnapshot | null,
  ids: string[],
): Array<{ id: string; message: string; owner: string; path?: string }> {
  const gaps = sourceGapsById(snapshot);
  return ids.map((id) => {
    const gap = gaps.get(id);
    return {
      id,
      message: gap?.message || id,
      owner: gap?.owner || "source",
      path: gap?.sourceRef?.path,
    };
  });
}
