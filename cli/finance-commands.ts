/**
 * FINANCE COMMANDS
 * ================
 * Ownership: operator-only writes and reads for the global Farplane finance sidecar.
 * Inputs: manual observations, Slash credentials from config.toml, and close dates.
 * Outputs: JSON/text projections and immutable close snapshots.
 * Side effects: delegates all durable writes to finance-store; never prints provider secrets.
 */
import type { Command } from "commander";
import { formatOutput } from "./cli-utils.js";
import {
  createFinanceStore,
  type FinanceProjection,
  type SlashFinanceConfig,
} from "./finance-store.js";
import { readFarplaneConfigObject, resolveFarplaneHome } from "./runtime-config.js";

type SlashConfigRow = Record<string, unknown>;

function localDate(value = new Date()): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function addDays(dateValue: string, days: number): string {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

export function parseMoneyToCents(value: string): number {
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error("finance_amount_invalid");
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new Error("finance_amount_invalid");
  return cents;
}

export function parseSignedMoneyToCents(value: string): number {
  const match = value.trim().match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error("finance_amount_invalid");
  const cents = Number(match[2]) * 100 + Number((match[3] ?? "").padEnd(2, "0"));
  const signedCents = match[1] === "-" ? -cents : cents;
  if (!Number.isSafeInteger(signedCents)) throw new Error("finance_amount_invalid");
  return signedCents;
}

function stringAt(row: SlashConfigRow, ...names: string[]): string {
  for (const name of names) {
    const value = row[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function readSlashConfig(): SlashFinanceConfig {
  const value = readFarplaneConfigObject(["integrations", "slash"]);
  const row =
    value && typeof value === "object" && !Array.isArray(value) ? (value as SlashConfigRow) : {};
  return {
    apiKey: stringAt(row, "api_key", "apiKey"),
    legalEntityId: stringAt(row, "legal_entity_id", "legalEntityId") || undefined,
    baseUrl: stringAt(row, "base_url", "baseUrl") || undefined,
  };
}

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function signedMoney(cents: number, currency: string): string {
  const absolute = money(Math.abs(cents), currency);
  return cents < 0 ? `-${absolute}` : cents > 0 ? `+${absolute}` : absolute;
}

function projectionText(projection: FinanceProjection): string {
  return [
    projection.latestBalance
      ? `Company cash (${projection.latestBalance.asOf}): ${money(projection.latestBalance.balanceCents, projection.latestBalance.currency)}`
      : "Company cash: not recorded",
    `Week ${projection.currentWeek.key}: ${signedMoney(projection.currentWeek.netCashFlowCents, projection.currency)}`,
    `Month ${projection.currentMonth.key}: ${signedMoney(projection.currentMonth.netCashFlowCents, projection.currency)}`,
    `Observations: ${projection.observationCount}`,
    projection.lastSuccessfulSyncAt
      ? `Last Slash sync: ${projection.lastSuccessfulSyncAt}`
      : "Last Slash sync: never",
    projection.sourceGaps.length
      ? `Source gaps: ${projection.sourceGaps.length}`
      : "Source gaps: none",
  ].join("\n");
}

export function registerFinanceCommands(program: Command): void {
  const finance = program.command("finance").description("Manage global firm finance observations");

  finance
    .command("record")
    .requiredOption("--flow <income|expense>", "Flow direction")
    .requiredOption("--amount <amount>", "Positive amount in major currency units")
    .option("--date <YYYY-MM-DD>", "Observation date", localDate())
    .option("--source <source>", "Idempotency source key", "manual")
    .option("--currency <currency>", "ISO currency", "USD")
    .option("--json", "Emit JSON")
    .action(async (options: Record<string, string | boolean>) => {
      const flow = String(options.flow);
      if (flow !== "income" && flow !== "expense") throw new Error("finance_flow_invalid");
      const amountCents = parseMoneyToCents(String(options.amount));
      const store = createFinanceStore(resolveFarplaneHome());
      const projection = await store.recordDailyObservation({
        date: String(options.date),
        source: String(options.source),
        sourceKind: "manual",
        currency: String(options.currency),
        incomeCents: flow === "income" ? amountCents : 0,
        expenseCents: flow === "expense" ? amountCents : 0,
      });
      formatOutput(options.json ? "json" : "text", projection, projectionText(projection));
    });

  finance
    .command("status")
    .option("--currency <currency>", "ISO currency", "USD")
    .option("--json", "Emit JSON")
    .action(async (options: Record<string, string | boolean>) => {
      const projection = await createFinanceStore(resolveFarplaneHome()).readProjection(
        new Date(),
        String(options.currency),
      );
      formatOutput(options.json ? "json" : "text", projection, projectionText(projection));
    });

  const snapshot = finance.command("snapshot").description("Manage company cash snapshots");

  snapshot
    .command("record")
    .requiredOption("--balance <amount>", "Signed company cash balance in major currency units")
    .option("--as-of <YYYY-MM-DD>", "Statement or observation date", localDate())
    .option("--source <source>", "Observation source", "bank-statement")
    .option("--currency <currency>", "ISO currency", "USD")
    .option("--evidence <path>", "Optional local statement or evidence reference")
    .option("--replace", "Replace the snapshot for this date and write a replacement receipt")
    .option("--json", "Emit JSON")
    .action(async (options: Record<string, string | boolean | undefined>) => {
      const result = await createFinanceStore(resolveFarplaneHome()).recordBalanceSnapshot({
        asOf: String(options.asOf),
        balanceCents: parseSignedMoneyToCents(String(options.balance)),
        source: String(options.source),
        currency: String(options.currency),
        evidenceRef: options.evidence ? String(options.evidence) : undefined,
        replace: Boolean(options.replace),
      });
      const { projection, receipt } = result;
      const latest = projection.latestBalance;
      formatOutput(
        options.json ? "json" : "text",
        result,
        latest
          ? `Recorded company cash for ${latest.asOf}: ${money(latest.balanceCents, latest.currency)}\nReceipt: ${receipt.id}`
          : "Recorded company cash snapshot",
      );
    });

  finance
    .command("backfill")
    .argument("[provider]", "Provider name", "slash")
    .option("--start <YYYY-MM-DD>", "First observation date")
    .option("--end <YYYY-MM-DD>", "Last observation date")
    .option("--json", "Emit JSON")
    .action(async (provider: string, options: Record<string, string | boolean | undefined>) => {
      if (provider !== "slash") throw new Error("finance_provider_unsupported");
      const yesterday = addDays(localDate(), -1);
      const startDate = options.start ? String(options.start) : yesterday;
      const endDate = options.end ? String(options.end) : startDate;
      const store = createFinanceStore(resolveFarplaneHome());
      try {
        const projection = await store.backfillSlash({
          startDate,
          endDate,
          config: readSlashConfig(),
        });
        formatOutput(options.json ? "json" : "text", projection, projectionText(projection));
      } catch (error) {
        const message = error instanceof Error ? error.message : "slash_backfill_failed";
        const projection = await store.readProjection();
        formatOutput(
          options.json ? "json" : "text",
          { ok: false, error: message, projection },
          `Finance backfill failed: ${message}`,
        );
        process.exitCode = 1;
      }
    });

  finance
    .command("close-week")
    .option("--date <YYYY-MM-DD>", "Any date in the week; defaults to the prior completed week")
    .option("--currency <currency>", "ISO currency", "USD")
    .option("--replace", "Replace an existing close and write a replacement receipt")
    .option("--json", "Emit JSON")
    .action(async (options: Record<string, string | boolean | undefined>) => {
      const snapshot = await createFinanceStore(resolveFarplaneHome()).closeWeek({
        containingDate: options.date ? String(options.date) : undefined,
        currency: String(options.currency),
        replace: Boolean(options.replace),
      });
      formatOutput(
        options.json ? "json" : "text",
        snapshot,
        `Closed ${snapshot.weekKey}: ${signedMoney(snapshot.netCashFlowCents, snapshot.currency)}`,
      );
    });

  finance
    .command("close-month")
    .option("--date <YYYY-MM-DD>", "Any date in the month; defaults to the prior completed month")
    .option("--currency <currency>", "ISO currency", "USD")
    .option("--replace", "Replace an existing close and write a replacement receipt")
    .option("--json", "Emit JSON")
    .action(async (options: Record<string, string | boolean | undefined>) => {
      const snapshot = await createFinanceStore(resolveFarplaneHome()).closeMonth({
        containingDate: options.date ? String(options.date) : undefined,
        currency: String(options.currency),
        replace: Boolean(options.replace),
      });
      formatOutput(
        options.json ? "json" : "text",
        snapshot,
        `Closed ${snapshot.monthKey}: ${signedMoney(snapshot.netCashFlowCents, snapshot.currency)}`,
      );
    });
}
