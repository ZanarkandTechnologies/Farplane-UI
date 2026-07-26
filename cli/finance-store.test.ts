import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createFinanceStore, normalizeSlashAggregation } from "./finance-store.js";

const roots: string[] = [];

async function testRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "farplane-finance-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("finance store", () => {
  it("records dated company cash snapshots without exposing evidence paths", async () => {
    const store = createFinanceStore(await testRoot());
    const now = new Date("2026-07-22T12:00:00+08:00");
    const { projection, receipt } = await store.recordBalanceSnapshot({
      asOf: "2026-07-21",
      balanceCents: -40_000,
      source: "bank-statement",
      evidenceRef: "/private/statements/july.pdf",
      observedAt: now.toISOString(),
    });

    expect(projection.latestBalance).toMatchObject({
      asOf: "2026-07-21",
      balanceCents: -40_000,
      currency: "USD",
      source: "bank-statement",
    });
    expect(projection.balanceSnapshotCount).toBe(1);
    expect(receipt.operation).toBe("record_balance");
    expect(JSON.stringify(projection)).not.toContain("/private/statements/july.pdf");
    const stored = await readFile(
      path.join(store.root, "snapshots", "balance", "2026-07-21.json"),
      "utf-8",
    );
    expect(stored).toContain("/private/statements/july.pdf");
  });

  it("requires explicit replacement for a same-day balance correction", async () => {
    const store = createFinanceStore(await testRoot());
    await store.recordBalanceSnapshot({ asOf: "2026-07-21", balanceCents: 12_500 });
    await expect(
      store.recordBalanceSnapshot({ asOf: "2026-07-21", balanceCents: 13_000 }),
    ).rejects.toThrow("finance_balance_already_recorded");

    const { projection } = await store.recordBalanceSnapshot({
      asOf: "2026-07-21",
      balanceCents: 13_000,
      replace: true,
    });
    expect(projection.latestBalance?.balanceCents).toBe(13_000);
    const receiptNames = await readdir(path.join(store.root, "sync", "receipts"));
    expect(receiptNames.some((name) => name.startsWith("replace_balance-"))).toBe(true);
  });

  it("orders balance history by statement date rather than ingestion order", async () => {
    const store = createFinanceStore(await testRoot());
    await store.recordBalanceSnapshot({ asOf: "2026-07-22", balanceCents: 22_000 });
    const { projection } = await store.recordBalanceSnapshot({
      asOf: "2026-07-20",
      balanceCents: 20_000,
    });
    expect(projection.latestBalance?.asOf).toBe("2026-07-22");
    expect(projection.balanceHistory.map((row) => row.asOf)).toEqual([
      "2026-07-22",
      "2026-07-20",
    ]);
  });

  it("replaces a source/date observation instead of double counting", async () => {
    const store = createFinanceStore(await testRoot());
    const now = new Date("2026-07-20T12:00:00+08:00");
    await store.recordDailyObservation({
      date: "2026-07-20",
      source: "manual",
      expenseCents: 40_000,
      observedAt: now.toISOString(),
    });
    await store.recordDailyObservation({
      date: "2026-07-20",
      source: "manual",
      expenseCents: 40_000,
      observedAt: now.toISOString(),
    });

    const projection = await store.readProjection(now);
    expect(projection.observationCount).toBe(1);
    expect(projection.currentWeek).toMatchObject({
      key: "2026-W30",
      incomeCents: 0,
      expenseCents: 40_000,
      netCashFlowCents: -40_000,
    });
    expect(projection.currentMonth.netCashFlowCents).toBe(-40_000);
  });

  it("accumulates independent source components", async () => {
    const store = createFinanceStore(await testRoot());
    const now = new Date("2026-07-20T12:00:00+08:00");
    await store.recordDailyObservation({
      date: "2026-07-20",
      source: "manual",
      expenseCents: 40_000,
    });
    await store.recordDailyObservation({
      date: "2026-07-20",
      source: "slash",
      sourceKind: "slash",
      incomeCents: 75_000,
      expenseCents: 5_000,
    });

    const projection = await store.readProjection(now);
    expect(projection.observationCount).toBe(2);
    expect(projection.currentWeek.netCashFlowCents).toBe(30_000);
  });

  it("keeps weekly closes immutable unless replacement is explicit", async () => {
    const store = createFinanceStore(await testRoot());
    const now = new Date("2026-07-20T12:00:00+08:00");
    for (let day = 13; day <= 19; day += 1) {
      await store.recordDailyObservation({
        date: `2026-07-${day}`,
        expenseCents: day === 13 ? 12_345 : 0,
      });
    }
    const first = await store.closeWeek({ containingDate: "2026-07-13", now });
    expect(first.netCashFlowCents).toBe(-12_345);
    await expect(store.closeWeek({ containingDate: "2026-07-13", now })).rejects.toThrow(
      "finance_week_already_closed",
    );
    const replacement = await store.closeWeek({ containingDate: "2026-07-13", now, replace: true });
    expect(replacement.weekKey).toBe(first.weekKey);
    const receiptNames = await readdir(path.join(store.root, "sync", "receipts"));
    expect(receiptNames.some((name) => name.startsWith("replace_week-"))).toBe(true);
  });

  it("refuses to freeze an incompletely observed week as zero", async () => {
    const store = createFinanceStore(await testRoot());
    await store.recordDailyObservation({ date: "2026-07-13", expenseCents: 0 });
    await expect(
      store.closeWeek({
        containingDate: "2026-07-13",
        now: new Date("2026-07-20T12:00:00+08:00"),
      }),
    ).rejects.toThrow("finance_week_coverage_incomplete:2026-07-14");
  });

  it("freezes a completely observed calendar month", async () => {
    const store = createFinanceStore(await testRoot());
    for (let day = 1; day <= 30; day += 1) {
      await store.recordDailyObservation({
        date: `2026-06-${String(day).padStart(2, "0")}`,
        incomeCents: day === 30 ? 50_000 : 0,
      });
    }
    const now = new Date("2026-07-20T12:00:00+08:00");
    const snapshot = await store.closeMonth({ containingDate: "2026-06-15", now });
    expect(snapshot).toMatchObject({
      monthKey: "2026-06",
      incomeCents: 50_000,
      expenseCents: 0,
      netCashFlowCents: 50_000,
    });
    expect(snapshot.observationDates).toHaveLength(30);
    await expect(store.closeMonth({ containingDate: "2026-06-15", now })).rejects.toThrow(
      "finance_month_already_closed",
    );
  }, 20_000);

  it("records provider gaps without persisting the API key", async () => {
    const store = createFinanceStore(await testRoot());
    const secret = "slash-secret-that-must-not-land-on-disk";
    await expect(
      store.backfillSlash({
        startDate: "2026-07-19",
        endDate: "2026-07-19",
        config: { apiKey: secret },
        fetcher: async () => new Response("unavailable", { status: 503 }),
      }),
    ).rejects.toThrow("slash_backfill_failed:503");

    const state = await readFile(path.join(store.root, "sync", "state.json"), "utf-8");
    expect(state).toContain("slash_backfill_failed");
    expect(state).not.toContain(secret);
  });
});

describe("Slash aggregation normalization", () => {
  it("accepts both documented signed-out and unsigned-out conventions", () => {
    expect(
      normalizeSlashAggregation({ totalIn: 10_000, totalOut: -4_000, netChange: 6_000 }),
    ).toEqual({
      incomeCents: 10_000,
      expenseCents: 4_000,
      netCashFlowCents: 6_000,
    });
    expect(
      normalizeSlashAggregation({ totalIn: 10_000, totalOut: 4_000, netChange: 6_000 }),
    ).toEqual({
      incomeCents: 10_000,
      expenseCents: 4_000,
      netCashFlowCents: 6_000,
    });
  });

  it("fails closed when provider signs do not reconcile", () => {
    expect(() =>
      normalizeSlashAggregation({ totalIn: 10_000, totalOut: 4_000, netChange: 5_000 }),
    ).toThrow("slash_total_out_sign_ambiguous");
  });
});
