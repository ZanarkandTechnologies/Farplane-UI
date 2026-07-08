/**
 * Product tab KPI model helpers.
 * Maps compiled KPI rows back to product surfaces and formats numeric evidence.
 */

import type { KpiMetricRow } from "@/modules/team-workspace/lib/dashboard-projections/goal-kpi-model";
import type {
  ProjectUiProduct,
  ProjectUiProductArtifactWorkflow,
  ProjectUiProductGoal,
  ProjectUiProductKpis,
  ProjectUiWorkLane,
} from "@/modules/team-workspace/lib/dashboard-projections/project-ui-snapshot";

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export type ProductCardModel = {
  artifactWorkflows: ProjectUiProductArtifactWorkflow[];
  audience: string;
  goals: ProjectUiProductGoal[];
  kpis: ProjectUiProductKpis;
  kpiIds: string[];
  lane: string;
  lanePurpose: string;
  laneWeight: number | null;
  metricIds: string[];
  name: string;
  output: string;
  ownerSkill: string;
  productId: string;
  proofState: string;
  reward: string;
  sourceGapIds: string[];
  sourcePath: string;
  ticketCount: number | null;
};

export type ProductGoalMatrixRow = {
  axisId: string;
  goalId: string;
  interpretation: string;
  kpis: string[];
  productGoalIds: string[];
  productId: string;
  productLabel: string;
  productRefs: string[];
  question: string;
  scope: string;
  sharedKpis: string[];
  sharedProductGoalKpis: string[];
  status: string;
  target: string;
};

export type ProductRegistryModel = {
  goalProductMatrix: ProductGoalMatrixRow[];
  products: ProductCardModel[];
  sourcePath: string;
  workLanes: ProjectUiWorkLane[];
};

export function groupMetricsByProduct(
  metrics: KpiMetricRow[],
  products: ProductCardModel[] = [],
): Map<string, KpiMetricRow[]> {
  const grouped = new Map<string, KpiMetricRow[]>();
  const productByKpi = new Map<string, string[]>();
  for (const product of products) {
    for (const kpi of new Set([...product.kpis.all, ...product.kpiIds, ...product.metricIds])) {
      productByKpi.set(kpi, [...(productByKpi.get(kpi) ?? []), product.productId]);
    }
  }
  for (const metric of metrics) {
    const productIds = metric.product
      ? [metric.product]
      : (productByKpi.get(metric.metricId) ?? []);
    for (const productId of productIds) {
      grouped.set(productId, [...(grouped.get(productId) ?? []), metric]);
    }
  }
  return grouped;
}

export function formatMetricValue(value: number | null): string {
  return typeof value === "number" && Number.isFinite(value) ? numberFormatter.format(value) : "-";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => stringValue(entry).trim()).filter(Boolean)
    : [];
}

export function productCardFromSnapshot(
  product: ProjectUiProduct,
  lane: ProjectUiWorkLane | undefined,
): ProductCardModel {
  return {
    artifactWorkflows: product.artifactWorkflows,
    audience: product.audience,
    goals: product.goals,
    kpis: product.kpis,
    kpiIds: product.kpiIds,
    lane: product.lane,
    lanePurpose: lane?.purpose ?? "",
    laneWeight: product.laneWeight ?? lane?.defaultWeight ?? null,
    metricIds: product.metricIds,
    name: product.name,
    output: product.output,
    ownerSkill: product.ownerSkill,
    productId: product.productId,
    proofState: product.proofState,
    reward: product.reward,
    sourceGapIds: product.sourceGapIds,
    sourcePath: product.sourceRef?.path ?? "",
    ticketCount: product.ticketCount,
  };
}

export function productRegistryFromProductsJson(
  value: unknown,
  sourcePath = "farplane/products.json",
): ProductRegistryModel | null {
  const source = record(value);
  if (stringValue(source.kind) !== "project-products-index" && !Array.isArray(source.products)) {
    return null;
  }
  const workLanes = (Array.isArray(source.lanes) ? source.lanes : [])
    .map((entry): ProjectUiWorkLane | null => {
      const row = record(entry);
      const laneId = stringValue(row.id ?? row.lane_id ?? row.laneId).trim();
      if (!laneId) return null;
      return {
        defaultWeight: nullableNumber(row.default_weight ?? row.defaultWeight),
        laneId,
        purpose: stringValue(row.purpose),
      };
    })
    .filter((lane): lane is ProjectUiWorkLane => Boolean(lane));
  const laneById = new Map(workLanes.map((lane) => [lane.laneId, lane]));
  return {
    goalProductMatrix: (Array.isArray(source.goal_product_matrix) ? source.goal_product_matrix : [])
      .map(parseGoalProductMatrixRow)
      .filter((row): row is ProductGoalMatrixRow => Boolean(row)),
    products: (Array.isArray(source.products) ? source.products : [])
      .map((entry) => productCardFromRegistryProduct(entry, laneById, sourcePath))
      .filter((product): product is ProductCardModel => Boolean(product)),
    sourcePath,
    workLanes,
  };
}

function productCardFromRegistryProduct(
  value: unknown,
  laneById: Map<string, ProjectUiWorkLane>,
  sourcePath: string,
): ProductCardModel | null {
  const row = record(value);
  const productId = stringValue(row.id ?? row.product_id ?? row.productId).trim();
  if (!productId) return null;
  const lane = stringValue(row.lane);
  const laneInfo = laneById.get(lane);
  return {
    artifactWorkflows: (Array.isArray(row.artifact_workflows) ? row.artifact_workflows : [])
      .map(parseRegistryArtifactWorkflow)
      .filter((workflow): workflow is ProjectUiProductArtifactWorkflow => Boolean(workflow)),
    audience: stringValue(row.audience),
    goals: (Array.isArray(row.goals) ? row.goals : [])
      .map(parseRegistryGoal)
      .filter((goal): goal is ProjectUiProductGoal => Boolean(goal)),
    kpis: parseRegistryKpis(row.kpis),
    kpiIds: stringList(row.kpi_ids ?? row.kpiIds),
    lane,
    lanePurpose: stringValue(row.lane_purpose ?? row.lanePurpose) || laneInfo?.purpose || "",
    laneWeight:
      nullableNumber(row.default_weight ?? row.defaultWeight) ?? laneInfo?.defaultWeight ?? null,
    metricIds: stringList(row.metric_ids ?? row.metricIds),
    name: stringValue(row.label ?? row.name) || productId,
    output: stringValue(row.output),
    ownerSkill: stringValue(row.owner_skill ?? row.ownerSkill),
    productId,
    proofState: stringValue(row.status) || "unknown",
    reward: stringValue(row.reward),
    sourceGapIds: stringList(row.source_gap_ids ?? row.sourceGapIds),
    sourcePath:
      stringValue(record(row.refs).product) ||
      stringValue(row.product_ref ?? row.productRef) ||
      `${sourcePath}#${productId}`,
    ticketCount: nullableNumber(row.ticket_count ?? row.ticketCount),
  };
}

function parseRegistryKpis(value: unknown): ProjectUiProductKpis {
  const row = record(value);
  const primary = stringList(row.primary);
  const supporting = stringList(row.supporting);
  const guardrail = stringList(row.guardrail);
  return {
    all: stringList(row.all).length
      ? stringList(row.all)
      : [...primary, ...supporting, ...guardrail],
    guardrail,
    primary,
    supporting,
  };
}

function parseRegistryGoal(value: unknown): ProjectUiProductGoal | null {
  const row = record(value);
  const id = stringValue(row.id).trim();
  if (!id) return null;
  return {
    id,
    interpretation: stringValue(row.interpretation) || undefined,
    kpis: stringList(row.kpis),
    scope: stringValue(row.scope) || undefined,
    target: stringValue(row.target),
  };
}

function parseRegistryArtifactWorkflow(value: unknown): ProjectUiProductArtifactWorkflow | null {
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

function parseGoalProductMatrixRow(value: unknown): ProductGoalMatrixRow | null {
  const row = record(value);
  const goalId = stringValue(row.goal_id ?? row.goalId).trim();
  const productId = stringValue(row.product_id ?? row.productId).trim();
  if (!goalId || !productId) return null;
  return {
    axisId: stringValue(row.axis_id ?? row.axisId),
    goalId,
    interpretation: stringValue(row.interpretation),
    kpis: stringList(row.kpis),
    productGoalIds: stringList(row.product_goal_ids ?? row.productGoalIds),
    productId,
    productLabel: stringValue(row.product_label ?? row.productLabel) || productId,
    productRefs: stringList(row.product_refs ?? row.productRefs),
    question: stringValue(row.question),
    scope: stringValue(row.scope),
    sharedKpis: stringList(row.shared_kpis ?? row.sharedKpis),
    sharedProductGoalKpis: stringList(row.shared_product_goal_kpis ?? row.sharedProductGoalKpis),
    status: stringValue(row.status) || "unknown",
    target: stringValue(row.target),
  };
}
