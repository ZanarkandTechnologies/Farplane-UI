/**
 * GLOBAL FINANCE STORE
 * ====================
 * Ownership: firm-level Farplane finance observations under ~/.farplane/finance.
 * Inputs: normalized manual/provider daily flow aggregates and company cash snapshots in integer cents.
 * Outputs: daily observations, dated balance snapshots, immutable close snapshots, receipts, and UI projection.
 * Side effects: atomic local JSON writes guarded by a cross-process lock file.
 * Invariants: flows are non-negative; signed net is derived; browser projections contain no secrets.
 */
import { randomUUID } from "node:crypto";
import { mkdir, open, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export type FinanceFlow = "income" | "expense";
export type FinanceSourceKind = "manual" | "slash";

export type FinanceSourceObservation = {
  source: string;
  sourceKind: FinanceSourceKind;
  currency: string;
  incomeCents: number;
  expenseCents: number;
  observedAt: string;
  coverage: "complete" | "partial";
};

export type FinanceDailyObservation = {
  schema: "farplane_finance_daily_observation";
  date: string;
  updatedAt: string;
  observations: FinanceSourceObservation[];
};

export type FinancePeriodTotals = {
  incomeCents: number;
  expenseCents: number;
  netCashFlowCents: number;
};

export type FinanceWeeklySnapshot = FinancePeriodTotals & {
  schema: "farplane_finance_weekly_snapshot";
  weekKey: string;
  startDate: string;
  endDate: string;
  currency: string;
  closedAt: string;
  observationDates: string[];
};

export type FinanceMonthlySnapshot = FinancePeriodTotals & {
  schema: "farplane_finance_monthly_snapshot";
  monthKey: string;
  startDate: string;
  endDate: string;
  currency: string;
  closedAt: string;
  observationDates: string[];
};

export type FinanceBalanceSnapshot = {
  schema: "farplane_finance_balance_snapshot";
  asOf: string;
  balanceCents: number;
  currency: string;
  source: string;
  observedAt: string;
  evidenceRef?: string;
};

export type FinanceBalanceProjection = Omit<FinanceBalanceSnapshot, "schema" | "evidenceRef">;

export type FinanceSyncGap = {
  source: string;
  code: string;
  message: string;
  observedAt: string;
};

export type FinanceSyncState = {
  schema: "farplane_finance_sync_state";
  updatedAt: string;
  lastSuccessfulSyncAt?: string;
  lastBackfillStart?: string;
  lastBackfillEnd?: string;
  sourceGaps: FinanceSyncGap[];
};

export type FinanceSyncReceipt = {
  schema: "farplane_finance_receipt";
  id: string;
  operation:
    | "record"
    | "record_balance"
    | "replace_balance"
    | "backfill"
    | "close_week"
    | "replace_week"
    | "close_month"
    | "replace_month";
  source: string;
  startedAt: string;
  completedAt: string;
  dates: string[];
  files: string[];
};

export type FinanceProjectionPeriod = FinancePeriodTotals & {
  key: string;
  startDate: string;
  endDate: string;
  status: "open" | "closed";
};

export type FinanceProjectionDailyRow = FinancePeriodTotals & {
  date: string;
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
  weeklyHistory: FinanceWeeklySnapshot[];
  monthlyHistory: FinanceMonthlySnapshot[];
  lastSuccessfulSyncAt: string | null;
  sourceGaps: FinanceSyncGap[];
  observationCount: number;
  balanceSnapshotCount: number;
};

export type FinanceStore = {
  root: string;
  recordDailyObservation: (input: RecordDailyObservationInput) => Promise<FinanceProjection>;
  recordBalanceSnapshot: (input: RecordBalanceSnapshotInput) => Promise<RecordBalanceSnapshotResult>;
  readProjection: (now?: Date, currency?: string) => Promise<FinanceProjection>;
  closeWeek: (input?: ClosePeriodInput) => Promise<FinanceWeeklySnapshot>;
  closeMonth: (input?: ClosePeriodInput) => Promise<FinanceMonthlySnapshot>;
  backfillSlash: (input: SlashBackfillInput) => Promise<FinanceProjection>;
  recordSyncGap: (
    gap: Omit<FinanceSyncGap, "observedAt"> & { observedAt?: string },
  ) => Promise<void>;
};

export type RecordBalanceSnapshotResult = {
  projection: FinanceProjection;
  receipt: FinanceSyncReceipt;
};

export type RecordBalanceSnapshotInput = {
  asOf: string;
  balanceCents: number;
  currency?: string;
  source?: string;
  observedAt?: string;
  evidenceRef?: string;
  replace?: boolean;
};

export type RecordDailyObservationInput = {
  date: string;
  currency?: string;
  source?: string;
  sourceKind?: FinanceSourceKind;
  incomeCents?: number;
  expenseCents?: number;
  observedAt?: string;
  coverage?: "complete" | "partial";
};

export type ClosePeriodInput = {
  containingDate?: string;
  currency?: string;
  replace?: boolean;
  now?: Date;
};

export type SlashFinanceConfig = {
  apiKey: string;
  legalEntityId?: string;
  baseUrl?: string;
};

export type SlashBackfillInput = {
  startDate: string;
  endDate: string;
  config: SlashFinanceConfig;
  fetcher?: typeof fetch;
  now?: Date;
};

type DateParts = { year: number; month: number; day: number };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
function normalizeCurrency(value: string | undefined): string {
  const currency = (value ?? "USD").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("finance_currency_invalid");
  return currency;
}

function normalizeCents(value: number | undefined, field: string): number {
  const cents = value ?? 0;
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error(`${field}_invalid`);
  return cents;
}

function normalizeSignedCents(value: number, field: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(`${field}_invalid`);
  return value;
}

function parseDate(value: string): DateParts {
  if (!DATE_PATTERN.test(value)) throw new Error("finance_date_invalid");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error("finance_date_invalid");
  }
  return { year, month, day };
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localDate(value: string): Date {
  const { year, month, day } = parseDate(value);
  return new Date(year, month - 1, day, 12);
}

function addDays(value: string, days: number): string {
  const date = localDate(value);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

function compareDates(left: string, right: string): number {
  return left.localeCompare(right);
}

function datesInclusive(startDate: string, endDate: string): string[] {
  parseDate(startDate);
  parseDate(endDate);
  if (compareDates(startDate, endDate) > 0) throw new Error("finance_date_range_invalid");
  const dates: string[] = [];
  for (let cursor = startDate; compareDates(cursor, endDate) <= 0; cursor = addDays(cursor, 1)) {
    dates.push(cursor);
    if (dates.length > 370) throw new Error("finance_date_range_too_large");
  }
  return dates;
}

export function weekWindow(containingDate: string): {
  weekKey: string;
  startDate: string;
  endDate: string;
} {
  const date = localDate(containingDate);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  const startDate = formatLocalDate(date);
  const thursday = new Date(date);
  thursday.setDate(thursday.getDate() + 3);
  const weekYear = thursday.getFullYear();
  const firstThursday = new Date(weekYear, 0, 4, 12);
  const firstDay = firstThursday.getDay();
  firstThursday.setDate(firstThursday.getDate() + (firstDay === 0 ? -3 : 4 - firstDay));
  const weekNumber = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / 604_800_000);
  return {
    weekKey: `${weekYear}-W${String(weekNumber).padStart(2, "0")}`,
    startDate,
    endDate: addDays(startDate, 6),
  };
}

export function monthWindow(containingDate: string): {
  monthKey: string;
  startDate: string;
  endDate: string;
} {
  const { year, month } = parseDate(containingDate);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = new Date(year, month, 0, 12);
  return { monthKey: startDate.slice(0, 7), startDate, endDate: formatLocalDate(end) };
}

function totals(incomeCents: number, expenseCents: number): FinancePeriodTotals {
  return { incomeCents, expenseCents, netCashFlowCents: incomeCents - expenseCents };
}

function relative(root: string, filePath: string): string {
  return path.relative(root, filePath).split(path.sep).join("/");
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf-8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeJsonAtomic(filePath: string, payload: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  await rename(tempPath, filePath);
}

async function withFinanceLock<T>(financeRoot: string, operation: () => Promise<T>): Promise<T> {
  await mkdir(financeRoot, { recursive: true });
  const lockPath = path.join(financeRoot, ".write.lock");
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      handle = await open(lockPath, "wx");
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  if (!handle) throw new Error("finance_store_locked");
  try {
    return await operation();
  } finally {
    await handle.close();
    await unlink(lockPath).catch(() => undefined);
  }
}

async function listJsonFiles(directory: string): Promise<string[]> {
  try {
    return (await readdir(directory))
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) => path.join(directory, name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function normalizeDaily(
  value: FinanceDailyObservation | null,
  date: string,
): FinanceDailyObservation {
  const observations = Array.isArray(value?.observations)
    ? value.observations.filter(
        (row) =>
          row &&
          typeof row.source === "string" &&
          (row.sourceKind === "manual" || row.sourceKind === "slash") &&
          Number.isSafeInteger(row.incomeCents) &&
          row.incomeCents >= 0 &&
          Number.isSafeInteger(row.expenseCents) &&
          row.expenseCents >= 0,
      )
    : [];
  return {
    schema: "farplane_finance_daily_observation",
    date,
    updatedAt: value?.updatedAt ?? new Date(0).toISOString(),
    observations,
  };
}

async function readDailyObservations(dailyDir: string): Promise<FinanceDailyObservation[]> {
  const rows: FinanceDailyObservation[] = [];
  for (const filePath of await listJsonFiles(dailyDir)) {
    const date = path.basename(filePath, ".json");
    if (!DATE_PATTERN.test(date)) continue;
    rows.push(normalizeDaily(await readJson<FinanceDailyObservation>(filePath), date));
  }
  return rows.sort((left, right) => left.date.localeCompare(right.date));
}

function dailyTotals(row: FinanceDailyObservation, currency: string): FinanceProjectionDailyRow {
  const matching = row.observations.filter(
    (entry) => normalizeCurrency(entry.currency) === currency,
  );
  const incomeCents = matching.reduce((sum, entry) => sum + entry.incomeCents, 0);
  const expenseCents = matching.reduce((sum, entry) => sum + entry.expenseCents, 0);
  return { date: row.date, ...totals(incomeCents, expenseCents) };
}

function aggregateDaily(
  rows: FinanceDailyObservation[],
  startDate: string,
  endDate: string,
  currency: string,
): FinancePeriodTotals & { observationDates: string[] } {
  const matching = rows.filter(
    (row) => compareDates(row.date, startDate) >= 0 && compareDates(row.date, endDate) <= 0,
  );
  const aggregates = matching.map((row) => dailyTotals(row, currency));
  return {
    ...totals(
      aggregates.reduce((sum, row) => sum + row.incomeCents, 0),
      aggregates.reduce((sum, row) => sum + row.expenseCents, 0),
    ),
    observationDates: matching.flatMap((row) =>
      row.observations.some((entry) => normalizeCurrency(entry.currency) === currency)
        ? [row.date]
        : [],
    ),
  };
}

function assertCompleteCoverage(
  rows: FinanceDailyObservation[],
  startDate: string,
  endDate: string,
  currency: string,
  errorCode: string,
): void {
  const covered = new Set(
    rows
      .filter(
        (row) => compareDates(row.date, startDate) >= 0 && compareDates(row.date, endDate) <= 0,
      )
      .filter((row) =>
        row.observations.some(
          (entry) =>
            normalizeCurrency(entry.currency) === currency && entry.coverage === "complete",
        ),
      )
      .map((row) => row.date),
  );
  const missingDates = datesInclusive(startDate, endDate).filter((date) => !covered.has(date));
  if (missingDates.length) throw new Error(`${errorCode}:${missingDates.join(",")}`);
}

async function readHistory<T>(directory: string): Promise<T[]> {
  const rows: T[] = [];
  for (const filePath of await listJsonFiles(directory)) {
    const row = await readJson<T>(filePath);
    if (row) rows.push(row);
  }
  return rows;
}

async function compileProjection(
  financeRoot: string,
  now: Date,
  currencyInput: string,
): Promise<FinanceProjection> {
  const currency = normalizeCurrency(currencyInput);
  const dailyRows = await readDailyObservations(path.join(financeRoot, "observations", "daily"));
  const today = formatLocalDate(now);
  const currentWeekWindow = weekWindow(today);
  const currentMonthWindow = monthWindow(today);
  const weeklyHistory = (
    await readHistory<FinanceWeeklySnapshot>(path.join(financeRoot, "snapshots", "weekly"))
  )
    .filter((row) => row.currency === currency)
    .sort((left, right) => right.startDate.localeCompare(left.startDate));
  const monthlyHistory = (
    await readHistory<FinanceMonthlySnapshot>(path.join(financeRoot, "snapshots", "monthly"))
  )
    .filter((row) => row.currency === currency)
    .sort((left, right) => right.startDate.localeCompare(left.startDate));
  const balanceHistory = (
    await readHistory<FinanceBalanceSnapshot>(path.join(financeRoot, "snapshots", "balance"))
  )
    .filter((row) => row.schema === "farplane_finance_balance_snapshot" && row.currency === currency)
    .sort((left, right) =>
      right.asOf.localeCompare(left.asOf) || right.observedAt.localeCompare(left.observedAt),
    )
    .map(({ asOf, balanceCents, currency: rowCurrency, source, observedAt }) => ({
      asOf,
      balanceCents,
      currency: rowCurrency,
      source,
      observedAt,
    }));
  const syncState = (await readJson<FinanceSyncState>(
    path.join(financeRoot, "sync", "state.json"),
  )) ?? {
    schema: "farplane_finance_sync_state",
    updatedAt: new Date(0).toISOString(),
    sourceGaps: [],
  };
  const currentWeekTotals = aggregateDaily(
    dailyRows,
    currentWeekWindow.startDate,
    currentWeekWindow.endDate,
    currency,
  );
  const currentMonthTotals = aggregateDaily(
    dailyRows,
    currentMonthWindow.startDate,
    currentMonthWindow.endDate,
    currency,
  );
  return {
    schema: "farplane_finance_projection",
    generatedAt: now.toISOString(),
    currency,
    currentWeek: {
      key: currentWeekWindow.weekKey,
      startDate: currentWeekWindow.startDate,
      endDate: currentWeekWindow.endDate,
      status: weeklyHistory.some((row) => row.weekKey === currentWeekWindow.weekKey)
        ? "closed"
        : "open",
      ...totals(currentWeekTotals.incomeCents, currentWeekTotals.expenseCents),
    },
    currentMonth: {
      key: currentMonthWindow.monthKey,
      startDate: currentMonthWindow.startDate,
      endDate: currentMonthWindow.endDate,
      status: monthlyHistory.some((row) => row.monthKey === currentMonthWindow.monthKey)
        ? "closed"
        : "open",
      ...totals(currentMonthTotals.incomeCents, currentMonthTotals.expenseCents),
    },
    latestBalance: balanceHistory[0] ?? null,
    balanceHistory: balanceHistory.slice(0, 24),
    daily: dailyRows
      .slice(-35)
      .map((row) => dailyTotals(row, currency))
      .reverse(),
    weeklyHistory: weeklyHistory.slice(0, 16),
    monthlyHistory: monthlyHistory.slice(0, 12),
    lastSuccessfulSyncAt: syncState.lastSuccessfulSyncAt ?? null,
    sourceGaps: Array.isArray(syncState.sourceGaps) ? syncState.sourceGaps : [],
    observationCount: dailyRows.reduce(
      (sum, row) =>
        sum +
        row.observations.filter((entry) => normalizeCurrency(entry.currency) === currency).length,
      0,
    ),
    balanceSnapshotCount: balanceHistory.length,
  };
}

async function writeReceipt(
  financeRoot: string,
  input: Omit<FinanceSyncReceipt, "schema" | "id">,
): Promise<FinanceSyncReceipt> {
  const receipt: FinanceSyncReceipt = {
    schema: "farplane_finance_receipt",
    id: `${input.operation}-${input.completedAt.replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`,
    ...input,
  };
  await writeJsonAtomic(path.join(financeRoot, "sync", "receipts", `${receipt.id}.json`), receipt);
  return receipt;
}

async function persistProjection(
  financeRoot: string,
  now: Date,
  currency: string,
): Promise<FinanceProjection> {
  const projection = await compileProjection(financeRoot, now, currency);
  await writeJsonAtomic(path.join(financeRoot, "ui", "latest.json"), projection);
  return projection;
}

function priorCompletedWeek(now: Date): string {
  const today = formatLocalDate(now);
  return addDays(weekWindow(today).startDate, -1);
}

function priorCompletedMonth(now: Date): string {
  const today = formatLocalDate(now);
  return addDays(monthWindow(today).startDate, -1);
}

function localDayBounds(dateValue: string): { fromMs: number; toMs: number } {
  const { year, month, day } = parseDate(dateValue);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  return { fromMs: start.getTime(), toMs: end.getTime() - 1 };
}

export function normalizeSlashAggregation(payload: unknown): FinancePeriodTotals {
  const row = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const totalIn = row.totalIn;
  const totalOut = row.totalOut;
  const netChange = row.netChange;
  if (
    !Number.isSafeInteger(totalIn) ||
    !Number.isSafeInteger(totalOut) ||
    !Number.isSafeInteger(netChange)
  ) {
    throw new Error("slash_aggregation_invalid");
  }
  const incomeCents = Math.max(0, totalIn as number);
  const rawOut = totalOut as number;
  const rawNet = netChange as number;
  let expenseCents: number;
  if (rawOut <= 0 && rawNet === incomeCents + rawOut) expenseCents = Math.abs(rawOut);
  else if (rawOut >= 0 && rawNet === incomeCents - rawOut) expenseCents = rawOut;
  else throw new Error("slash_total_out_sign_ambiguous");
  return totals(incomeCents, expenseCents);
}

export function createFinanceStore(root: string): FinanceStore {
  const financeRoot = path.join(path.resolve(root), "finance");

  const recordSyncGap: FinanceStore["recordSyncGap"] = async (gap) =>
    withFinanceLock(financeRoot, async () => {
      const observedAt = new Date(gap.observedAt ?? new Date().toISOString());
      if (Number.isNaN(observedAt.getTime())) throw new Error("finance_observed_at_invalid");
      const statePath = path.join(financeRoot, "sync", "state.json");
      const existing = await readJson<FinanceSyncState>(statePath);
      const sourceGaps = (existing?.sourceGaps ?? [])
        .filter((row) => !(row.source === gap.source && row.code === gap.code))
        .concat({ ...gap, observedAt: observedAt.toISOString() })
        .slice(-20);
      await writeJsonAtomic(statePath, {
        schema: "farplane_finance_sync_state",
        updatedAt: observedAt.toISOString(),
        lastSuccessfulSyncAt: existing?.lastSuccessfulSyncAt,
        lastBackfillStart: existing?.lastBackfillStart,
        lastBackfillEnd: existing?.lastBackfillEnd,
        sourceGaps,
      } satisfies FinanceSyncState);
      await persistProjection(financeRoot, observedAt, "USD");
    });

  const recordDailyObservation = async (
    input: RecordDailyObservationInput,
  ): Promise<FinanceProjection> =>
    withFinanceLock(financeRoot, async () => {
      parseDate(input.date);
      const currency = normalizeCurrency(input.currency);
      const source = (input.source ?? "manual").trim();
      if (!source || !/^[a-z0-9][a-z0-9._-]*$/i.test(source))
        throw new Error("finance_source_invalid");
      const now = new Date(input.observedAt ?? new Date().toISOString());
      if (Number.isNaN(now.getTime())) throw new Error("finance_observed_at_invalid");
      const dailyPath = path.join(financeRoot, "observations", "daily", `${input.date}.json`);
      const existing = normalizeDaily(
        await readJson<FinanceDailyObservation>(dailyPath),
        input.date,
      );
      const observation: FinanceSourceObservation = {
        source,
        sourceKind: input.sourceKind ?? "manual",
        currency,
        incomeCents: normalizeCents(input.incomeCents, "finance_income_cents"),
        expenseCents: normalizeCents(input.expenseCents, "finance_expense_cents"),
        observedAt: now.toISOString(),
        coverage: input.coverage ?? "complete",
      };
      const observations = existing.observations
        .filter((row) => !(row.source === source && normalizeCurrency(row.currency) === currency))
        .concat(observation)
        .sort((left, right) =>
          `${left.currency}:${left.source}`.localeCompare(`${right.currency}:${right.source}`),
        );
      const daily: FinanceDailyObservation = {
        schema: "farplane_finance_daily_observation",
        date: input.date,
        updatedAt: now.toISOString(),
        observations,
      };
      await writeJsonAtomic(dailyPath, daily);
      const projection = await persistProjection(financeRoot, now, currency);
      await writeReceipt(financeRoot, {
        operation: "record",
        source,
        startedAt: now.toISOString(),
        completedAt: now.toISOString(),
        dates: [input.date],
        files: [relative(financeRoot, dailyPath), "ui/latest.json"],
      });
      return projection;
    });

  const recordBalanceSnapshot = async (
    input: RecordBalanceSnapshotInput,
  ): Promise<RecordBalanceSnapshotResult> =>
    withFinanceLock(financeRoot, async () => {
      parseDate(input.asOf);
      const currency = normalizeCurrency(input.currency);
      const source = (input.source ?? "bank-statement").trim();
      if (!source || !/^[a-z0-9][a-z0-9._-]*$/i.test(source)) {
        throw new Error("finance_source_invalid");
      }
      const now = new Date(input.observedAt ?? new Date().toISOString());
      if (Number.isNaN(now.getTime())) throw new Error("finance_observed_at_invalid");
      const snapshotPath = path.join(financeRoot, "snapshots", "balance", `${input.asOf}.json`);
      const existing = await readJson<FinanceBalanceSnapshot>(snapshotPath);
      if (existing && !input.replace) throw new Error("finance_balance_already_recorded");
      const evidenceRef = input.evidenceRef?.trim();
      const snapshot: FinanceBalanceSnapshot = {
        schema: "farplane_finance_balance_snapshot",
        asOf: input.asOf,
        balanceCents: normalizeSignedCents(input.balanceCents, "finance_balance_cents"),
        currency,
        source,
        observedAt: now.toISOString(),
        ...(evidenceRef ? { evidenceRef } : {}),
      };
      await writeJsonAtomic(snapshotPath, snapshot);
      const projection = await persistProjection(financeRoot, now, currency);
      const receipt = await writeReceipt(financeRoot, {
        operation: existing ? "replace_balance" : "record_balance",
        source,
        startedAt: now.toISOString(),
        completedAt: now.toISOString(),
        dates: [input.asOf],
        files: [relative(financeRoot, snapshotPath), "ui/latest.json"],
      });
      return { projection, receipt };
    });

  const closeWeek = async (input: ClosePeriodInput = {}): Promise<FinanceWeeklySnapshot> =>
    withFinanceLock(financeRoot, async () => {
      const now = input.now ?? new Date();
      const currency = normalizeCurrency(input.currency);
      const window = weekWindow(input.containingDate ?? priorCompletedWeek(now));
      if (compareDates(window.endDate, formatLocalDate(now)) >= 0)
        throw new Error("finance_week_still_open");
      const snapshotPath = path.join(financeRoot, "snapshots", "weekly", `${window.weekKey}.json`);
      const existing = await readJson<FinanceWeeklySnapshot>(snapshotPath);
      if (existing && !input.replace) throw new Error("finance_week_already_closed");
      const dailyRows = await readDailyObservations(
        path.join(financeRoot, "observations", "daily"),
      );
      assertCompleteCoverage(
        dailyRows,
        window.startDate,
        window.endDate,
        currency,
        "finance_week_coverage_incomplete",
      );
      const aggregate = aggregateDaily(dailyRows, window.startDate, window.endDate, currency);
      const snapshot: FinanceWeeklySnapshot = {
        schema: "farplane_finance_weekly_snapshot",
        ...window,
        currency,
        closedAt: now.toISOString(),
        ...aggregate,
      };
      await writeJsonAtomic(snapshotPath, snapshot);
      await persistProjection(financeRoot, now, currency);
      await writeReceipt(financeRoot, {
        operation: existing ? "replace_week" : "close_week",
        source: "farplane",
        startedAt: now.toISOString(),
        completedAt: now.toISOString(),
        dates: datesInclusive(window.startDate, window.endDate),
        files: [relative(financeRoot, snapshotPath), "ui/latest.json"],
      });
      return snapshot;
    });

  const closeMonth = async (input: ClosePeriodInput = {}): Promise<FinanceMonthlySnapshot> =>
    withFinanceLock(financeRoot, async () => {
      const now = input.now ?? new Date();
      const currency = normalizeCurrency(input.currency);
      const window = monthWindow(input.containingDate ?? priorCompletedMonth(now));
      if (compareDates(window.endDate, formatLocalDate(now)) >= 0)
        throw new Error("finance_month_still_open");
      const snapshotPath = path.join(
        financeRoot,
        "snapshots",
        "monthly",
        `${window.monthKey}.json`,
      );
      const existing = await readJson<FinanceMonthlySnapshot>(snapshotPath);
      if (existing && !input.replace) throw new Error("finance_month_already_closed");
      const dailyRows = await readDailyObservations(
        path.join(financeRoot, "observations", "daily"),
      );
      assertCompleteCoverage(
        dailyRows,
        window.startDate,
        window.endDate,
        currency,
        "finance_month_coverage_incomplete",
      );
      const aggregate = aggregateDaily(dailyRows, window.startDate, window.endDate, currency);
      const snapshot: FinanceMonthlySnapshot = {
        schema: "farplane_finance_monthly_snapshot",
        ...window,
        currency,
        closedAt: now.toISOString(),
        ...aggregate,
      };
      await writeJsonAtomic(snapshotPath, snapshot);
      await persistProjection(financeRoot, now, currency);
      await writeReceipt(financeRoot, {
        operation: existing ? "replace_month" : "close_month",
        source: "farplane",
        startedAt: now.toISOString(),
        completedAt: now.toISOString(),
        dates: datesInclusive(window.startDate, window.endDate),
        files: [relative(financeRoot, snapshotPath), "ui/latest.json"],
      });
      return snapshot;
    });

  const backfillSlash = async (input: SlashBackfillInput): Promise<FinanceProjection> => {
    const startedAt = input.now ?? new Date();
    const dates = datesInclusive(input.startDate, input.endDate);
    const rows: Array<{ date: string; aggregate: FinancePeriodTotals }> = [];
    try {
      if (!input.config.apiKey.trim()) throw new Error("slash_api_key_missing");
      const fetcher = input.fetcher ?? fetch;
      for (const date of dates) {
        const bounds = localDayBounds(date);
        const url = new URL(
          "/transaction/aggregation",
          input.config.baseUrl ?? "https://api.slash.com",
        );
        url.searchParams.set("filter:from_date", String(bounds.fromMs));
        url.searchParams.set("filter:to_date", String(bounds.toMs));
        url.searchParams.set("filter:status", "posted");
        if (input.config.legalEntityId) {
          url.searchParams.set("filter:legalEntityId", input.config.legalEntityId);
        }
        const response = await fetcher(url, {
          headers: {
            "X-API-Key": input.config.apiKey,
            ...(input.config.legalEntityId ? { "X-Legal-Entity": input.config.legalEntityId } : {}),
          },
        });
        if (!response.ok) throw new Error(`slash_backfill_failed:${response.status}`);
        rows.push({ date, aggregate: normalizeSlashAggregation(await response.json()) });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "slash_backfill_failed";
      await recordSyncGap({ source: "slash", code: message.split(":")[0], message });
      throw error;
    }
    for (const row of rows) {
      await recordDailyObservation({
        date: row.date,
        source: "slash",
        sourceKind: "slash",
        currency: "USD",
        incomeCents: row.aggregate.incomeCents,
        expenseCents: row.aggregate.expenseCents,
        observedAt: startedAt.toISOString(),
      });
    }
    return withFinanceLock(financeRoot, async () => {
      const completedAt = new Date();
      const statePath = path.join(financeRoot, "sync", "state.json");
      const state: FinanceSyncState = {
        schema: "farplane_finance_sync_state",
        updatedAt: completedAt.toISOString(),
        lastSuccessfulSyncAt: completedAt.toISOString(),
        lastBackfillStart: input.startDate,
        lastBackfillEnd: input.endDate,
        sourceGaps: [],
      };
      await writeJsonAtomic(statePath, state);
      const projection = await persistProjection(financeRoot, completedAt, "USD");
      await writeReceipt(financeRoot, {
        operation: "backfill",
        source: "slash",
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        dates,
        files: dates
          .map((date) => `observations/daily/${date}.json`)
          .concat("sync/state.json", "ui/latest.json"),
      });
      return projection;
    });
  };

  return {
    root: financeRoot,
    recordDailyObservation,
    recordBalanceSnapshot,
    readProjection: (now = new Date(), currency = "USD") =>
      compileProjection(financeRoot, now, currency),
    closeWeek,
    closeMonth,
    backfillSlash,
    recordSyncGap,
  };
}
