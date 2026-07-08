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
  ProjectUiGoalAxis,
  ProjectUiMetricCard,
  ProjectUiMetricPoint,
  ProjectUiMetricSourceGap,
  ProjectUiMetricTarget,
  ProjectUiProduct,
  ProjectUiProductArtifactWorkflow,
  ProjectUiProductGoal,
  ProjectUiProductKpis,
  ProjectUiSmartGoal,
  ProjectUiSmartGoalKpi,
  ProjectUiSnapshot,
  ProjectUiSourceGap,
  ProjectUiSourceRef,
  ProjectUiTeamFocus,
  ProjectUiWorkLane,
} from "./project-ui-snapshot-types";

export type {
  ProjectUiContentItem,
  ProjectUiContentMetricCard,
  ProjectUiGoalAxis,
  ProjectUiMetricCard,
  ProjectUiMetricPoint,
  ProjectUiMetricSourceGap,
  ProjectUiMetricTarget,
  ProjectUiProduct,
  ProjectUiProductArtifactWorkflow,
  ProjectUiProductGoal,
  ProjectUiProductKpis,
  ProjectUiSmartGoal,
  ProjectUiSmartGoalKpi,
  ProjectUiSnapshot,
  ProjectUiSourceGap,
  ProjectUiSourceRef,
  ProjectUiTeamFocus,
  ProjectUiWorkLane,
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
    pinned: row.pinned === true,
  };
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

function parseSmartGoalKpi(value: unknown): ProjectUiSmartGoalKpi | null {
  const row = record(value);
  const metricId = stringValue(row.metric_id ?? row.metricId).trim();
  if (!metricId) return null;
  return {
    metricId,
    label: stringValue(row.label) || metricId,
    description: optionalString(
      row.description ?? row.tooltip ?? row.calculation_description ?? row.calculationDescription,
    ),
    current: nullableNumber(row.current),
    display: stringValue(row.display),
    status: stringValue(row.status) || "missing",
    primitiveId: stringValue(row.primitive_id ?? row.primitiveId),
    sourceGapIds: stringList(row.source_gap_ids ?? row.sourceGapIds),
    target: parseTarget(row.target ?? row.target_spec ?? row.targetSpec),
    targetHit: typeof row.target_hit === "boolean" ? row.target_hit : null,
    unit: stringValue(row.unit),
  };
}

function parseGoalAxis(value: unknown): ProjectUiGoalAxis | null {
  const row = record(value);
  const id = stringValue(row.id).trim();
  if (!id) return null;
  const rawSmartGoals = row.smart_goals ?? row.smartGoals;
  const smartGoals: unknown[] = Array.isArray(rawSmartGoals) ? rawSmartGoals : [];
  return {
    id,
    label: stringValue(row.label) || id,
    question: stringValue(row.question),
    evidenceHints: stringList(row.evidence_hints ?? row.evidenceHints),
    smartGoals: smartGoals
      .map((entry): ProjectUiSmartGoal | null => {
        const goal = record(entry);
        const goalId = stringValue(goal.id).trim();
        if (!goalId) return null;
        const kpis: unknown[] = Array.isArray(goal.kpis) ? goal.kpis : [];
        return {
          id: goalId,
          target: stringValue(goal.target),
          kpis: kpis
            .map(parseSmartGoalKpi)
            .filter((kpi): kpi is ProjectUiSmartGoalKpi => Boolean(kpi)),
          updateHint: optionalString(goal.update_hint ?? goal.updateHint),
          interpretation: optionalString(goal.interpretation),
        };
      })
      .filter((goal): goal is ProjectUiSmartGoal => Boolean(goal)),
  };
}

function parseProduct(value: unknown): ProjectUiProduct | null {
  const row = record(value);
  const productId = stringValue(row.product_id ?? row.productId ?? row.id).trim();
  if (!productId) return null;
  const artifactWorkflows = arrayValue(row.artifact_workflows ?? row.artifactWorkflows);
  return {
    artifactWorkflows: artifactWorkflows
      .map(parseProductArtifactWorkflow)
      .filter((workflow): workflow is ProjectUiProductArtifactWorkflow => Boolean(workflow)),
    audience: stringValue(row.audience),
    goals: (Array.isArray(row.goals) ? row.goals : [])
      .map(parseProductGoal)
      .filter((goal): goal is ProjectUiProductGoal => Boolean(goal)),
    kpis: parseProductKpis(row.kpis),
    kpiIds: stringList(row.kpi_ids ?? row.kpiIds),
    lane: stringValue(row.lane),
    laneWeight: nullableNumber(
      row.default_weight ?? row.defaultWeight ?? row.lane_weight ?? row.laneWeight,
    ),
    metricIds: stringList(row.metric_ids ?? row.metricIds),
    name: stringValue(row.name ?? row.label) || productId,
    output: stringValue(row.output),
    ownerSkill: stringValue(row.owner_skill ?? row.ownerSkill),
    productId,
    proofState: stringValue(row.proof_state ?? row.proofState) || "unknown",
    reward: stringValue(row.reward),
    sourceGapIds: stringList(row.source_gap_ids ?? row.sourceGapIds),
    sourceRef: sourceRef(row.source_ref ?? row.sourceRef ?? record(row.refs).product),
    ticketCount: nullableNumber(row.ticket_count ?? row.ticketCount),
  };
}

function parseProductKpis(value: unknown): ProjectUiProductKpis {
  const row = record(value);
  return {
    all: stringList(row.all),
    guardrail: stringList(row.guardrail),
    primary: stringList(row.primary),
    supporting: stringList(row.supporting),
  };
}

function parseProductGoal(value: unknown): ProjectUiProductGoal | null {
  const row = record(value);
  const id = stringValue(row.id).trim();
  if (!id) return null;
  return {
    id,
    interpretation: optionalString(row.interpretation),
    kpis: stringList(row.kpis),
    scope: optionalString(row.scope),
    target: stringValue(row.target),
  };
}

function parseProductArtifactWorkflow(value: unknown): ProjectUiProductArtifactWorkflow | null {
  const row = record(value);
  const id = stringValue(row.id).trim();
  if (!id) return null;
  return {
    executionArtifact: stringValue(row.execution_artifact ?? row.executionArtifact),
    feedbackQuestion: stringValue(row.feedback_question ?? row.feedbackQuestion),
    id,
    lane: stringValue(row.lane),
    owner: stringValue(row.owner),
    planningArtifact: stringValue(row.planning_artifact ?? row.planningArtifact),
  };
}

function parseWorkLane(value: unknown): ProjectUiWorkLane | null {
  const row = record(value);
  const laneId = stringValue(row.lane_id ?? row.laneId ?? row.id).trim();
  if (!laneId) return null;
  return {
    defaultWeight: nullableNumber(row.default_weight ?? row.defaultWeight),
    laneId,
    purpose: stringValue(row.purpose),
  };
}

function parseTeamFocus(value: unknown): ProjectUiTeamFocus {
  const row = record(value);
  return {
    activeMilestone: stringValue(row.active_milestone ?? row.activeMilestone) || null,
    activeProductIds: stringList(row.active_product_ids ?? row.activeProductIds),
    blockers: stringList(row.blockers),
    currentBet: stringValue(row.current_bet ?? row.currentBet) || null,
    currentFocus: stringValue(row.current_focus ?? row.currentFocus) || null,
    topGoalId: stringValue(row.top_goal_id ?? row.topGoalId) || null,
  };
}

export function parseProjectUiSnapshot(value: unknown): ProjectUiSnapshot | null {
  const source = record(value);
  const tabs = record(source.tabs);
  const metrics = record(source.metrics);
  if (!source.generated_at && !source.generatedAt) return null;
  const overview = record(tabs.overview);
  const goals = record(tabs.goals);
  const products = record(tabs.products);
  const distribution = record(tabs.distribution);
  const series = Array.isArray(metrics.series) ? metrics.series : [];
  const metricContents = Array.isArray(metrics.contents) ? metrics.contents : [];
  const distributionContent = Array.isArray(distribution.content_items)
    ? distribution.content_items
    : [];
  const workLanes = arrayValue(products.work_lanes ?? products.workLanes);
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
      primitives: record(metrics.primitives),
      readings: record(metrics.readings ?? metrics.latest),
      series: series
        .map(parseMetricCard)
        .filter((metric): metric is ProjectUiMetricCard => Boolean(metric)),
    },
    tabs: {
      overview: {
        pinnedMetrics: stringList(overview.pinned_metrics ?? overview.pinnedMetrics),
        pinnedMetricCards: (Array.isArray(overview.pinned_metric_cards)
          ? overview.pinned_metric_cards
          : []
        )
          .map(parseMetricCard)
          .filter((metric): metric is ProjectUiMetricCard => Boolean(metric)),
        primitiveSummary: record(overview.primitive_summary ?? overview.primitiveSummary),
        sourceGapIds: stringList(overview.source_gap_ids ?? overview.sourceGapIds),
        teamFocus: parseTeamFocus(overview.team_focus ?? overview.teamFocus),
      },
      goals: {
        axes: (Array.isArray(goals.axes) ? goals.axes : [])
          .map(parseGoalAxis)
          .filter((axis): axis is ProjectUiGoalAxis => Boolean(axis)),
        sourceGapIds: stringList(goals.source_gap_ids ?? goals.sourceGapIds),
      },
      products: {
        products: (Array.isArray(products.products) ? products.products : [])
          .map(parseProduct)
          .filter((product): product is ProjectUiProduct => Boolean(product)),
        sourceGapIds: stringList(products.source_gap_ids ?? products.sourceGapIds),
        workLanes: workLanes
          .map(parseWorkLane)
          .filter((lane): lane is ProjectUiWorkLane => Boolean(lane)),
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
