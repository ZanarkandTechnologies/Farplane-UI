/**
 * FINANCE METRIC ROLL-UP
 * ======================
 * Ownership: telemetry module portfolio projections.
 * Inputs: tracked `farplane/metrics.yaml` definitions plus compiled project metric series.
 * Outputs: one current-calendar-month finance summary for global HUD consumers.
 * Side effects: none.
 * Invariants: metric IDs are never finance semantics; actual and estimated values stay separate.
 */

export type FinanceFlow = "expense" | "income";
export type FinanceBasis = "actual" | "estimated";

export type FinanceProjectConfig = {
  projectId: string;
  projectName: string;
  config: unknown;
  isGlobal?: boolean;
};

export type GlobalFinanceRollup = {
  currency: string;
  monthKey: string;
  expenseLimit: number | null;
  actualExpense: number;
  actualIncome: number;
  actualNetCashFlow: number;
  estimatedExpense: number;
  estimatedIncome: number;
  remainingExpenseBudget: number | null;
  configuredMetricCount: number;
  observedMetricCount: number;
  observedActualMetricCount: number;
  observedActualExpenseMetricCount: number;
  configuredProjectCount: number;
  reportingProjectCount: number;
  unavailableProjectCount: number;
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function rows(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metricsDocument(config: unknown): JsonRecord {
  const file = rows(record(config).files)
    .map(record)
    .find((candidate) => stringValue(candidate.path ?? candidate.id) === "farplane/metrics.yaml");
  return record(file?.parsedJson);
}

function projectUiSnapshot(config: unknown): JsonRecord {
  const source = rows(record(config).runtimeSources)
    .map(record)
    .find((candidate) => stringValue(candidate.id) === "project-ui");
  return record(source?.parsedJson);
}

function financeMetricDefinitions(document: JsonRecord): Array<{
  metricId: string;
  flow: FinanceFlow;
  basis: FinanceBasis;
  currency: string;
}> {
  return Object.entries(record(document.metrics)).flatMap(([metricId, value]) => {
    const definition = record(value);
    const finance = record(definition.finance);
    const flow = stringValue(finance.flow);
    const basis = stringValue(finance.basis);
    if (flow !== "expense" && flow !== "income") return [];
    if (basis !== "actual" && basis !== "estimated") return [];
    const currency = stringValue(definition.unit).toUpperCase();
    if (!currency) return [];
    return [{ metricId, flow, basis, currency }];
  });
}

function metricSeriesById(snapshot: JsonRecord): Map<string, JsonRecord> {
  const metrics = record(snapshot.metrics);
  return new Map(
    rows(metrics.series)
      .map(record)
      .map((metric) => [stringValue(metric.metric_id ?? metric.metricId), metric] as const)
      .filter(([metricId]) => Boolean(metricId)),
  );
}

function currentMonthMetricAmount(metric: JsonRecord | undefined, monthKey: string): number | null {
  if (!metric) return null;
  const valuesByDate = new Map<string, number>();
  for (const rawPoint of rows(metric.series)) {
    const point = record(rawPoint);
    const date = stringValue(point.date);
    if (!date.startsWith(monthKey)) continue;
    const value = finiteNumber(point.value);
    if (value === null) continue;
    valuesByDate.set(date, Math.max(0, value));
  }
  if (valuesByDate.size === 0) return null;
  return [...valuesByDate.values()].reduce((sum, value) => sum + value, 0);
}

function globalFinanceSettings(configs: FinanceProjectConfig[]): {
  currency: string;
  expenseLimit: number | null;
} {
  const globalDocument = metricsDocument(configs.find((entry) => entry.isGlobal)?.config);
  const finance = record(globalDocument.finance);
  const expenseLimit = record(finance.expense_limit ?? finance.expenseLimit);
  const amount = finiteNumber(expenseLimit.amount);
  const window = stringValue(expenseLimit.window);
  return {
    currency: stringValue(finance.currency).toUpperCase() || "USD",
    expenseLimit: window === "calendar_month" && amount !== null ? Math.max(0, amount) : null,
  };
}

export function buildGlobalFinanceRollup(
  configs: FinanceProjectConfig[],
  now: Date = new Date(),
): GlobalFinanceRollup {
  const { currency, expenseLimit } = globalFinanceSettings(configs);
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const configuredProjects = new Set<string>();
  const reportingProjects = new Set<string>();
  let actualExpense = 0;
  let actualIncome = 0;
  let estimatedExpense = 0;
  let estimatedIncome = 0;
  let configuredMetricCount = 0;
  let observedMetricCount = 0;
  let observedActualMetricCount = 0;
  let observedActualExpenseMetricCount = 0;

  for (const project of configs) {
    const definitions = financeMetricDefinitions(metricsDocument(project.config)).filter(
      (definition) => definition.currency === currency,
    );
    if (definitions.length === 0) continue;
    configuredProjects.add(project.projectId);
    configuredMetricCount += definitions.length;
    const metricSeries = metricSeriesById(projectUiSnapshot(project.config));

    for (const definition of definitions) {
      const amount = currentMonthMetricAmount(metricSeries.get(definition.metricId), monthKey);
      if (amount === null) continue;
      observedMetricCount += 1;
      reportingProjects.add(project.projectId);
      if (definition.basis === "actual") observedActualMetricCount += 1;
      if (definition.basis === "actual" && definition.flow === "expense") {
        actualExpense += amount;
        observedActualExpenseMetricCount += 1;
      }
      if (definition.basis === "actual" && definition.flow === "income") actualIncome += amount;
      if (definition.basis === "estimated" && definition.flow === "expense") {
        estimatedExpense += amount;
      }
      if (definition.basis === "estimated" && definition.flow === "income") {
        estimatedIncome += amount;
      }
    }
  }

  return {
    currency,
    monthKey,
    expenseLimit,
    actualExpense,
    actualIncome,
    actualNetCashFlow: actualIncome - actualExpense,
    estimatedExpense,
    estimatedIncome,
    remainingExpenseBudget:
      expenseLimit === null ? null : Math.max(0, expenseLimit - actualExpense),
    configuredMetricCount,
    observedMetricCount,
    observedActualMetricCount,
    observedActualExpenseMetricCount,
    configuredProjectCount: configuredProjects.size,
    reportingProjectCount: reportingProjects.size,
    unavailableProjectCount: 0,
  };
}
