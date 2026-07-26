export type FinancePeriodTotals = {
  incomeCents: number;
  expenseCents: number;
  netCashFlowCents: number;
};

export type FinanceProjectionPeriod = FinancePeriodTotals & {
  key: string;
  startDate: string;
  endDate: string;
  status: "open" | "closed";
};

export type FinanceProjectionDailyRow = FinancePeriodTotals & { date: string };

export type FinanceBalanceProjection = {
  asOf: string;
  balanceCents: number;
  currency: string;
  source: string;
  observedAt: string;
};

export type FinanceSnapshot = FinancePeriodTotals & {
  weekKey?: string;
  monthKey?: string;
  startDate: string;
  endDate: string;
  currency: string;
  closedAt: string;
  observationDates: string[];
};

export type FinanceSyncGap = {
  source: string;
  code: string;
  message: string;
  observedAt: string;
};

export type FinanceProjection = {
  schema: "farplane_finance_projection";
  generatedAt: string;
  currency: string;
  currentWeek: FinanceProjectionPeriod;
  currentMonth: FinanceProjectionPeriod;
  latestBalance: FinanceBalanceProjection | null;
  balanceHistory: FinanceBalanceProjection[];
  daily: FinanceProjectionDailyRow[];
  weeklyHistory: FinanceSnapshot[];
  monthlyHistory: FinanceSnapshot[];
  lastSuccessfulSyncAt: string | null;
  sourceGaps: FinanceSyncGap[];
  observationCount: number;
  balanceSnapshotCount: number;
};

export type FinanceProjectionResponse = {
  ok: boolean;
  projection?: FinanceProjection;
  error?: string;
};
