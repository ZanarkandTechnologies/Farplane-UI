"use client";

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  RefreshCw,
} from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UI_Z } from "@/lib/z-index";
import { useFinanceProjection } from "./hooks/use-finance-projection";
import type { FinancePeriodTotals } from "./lib/finance-types";

type FinancePanelProps = { open: boolean; onOpenChange: (open: boolean) => void };

function formatter(currency: string): Intl.NumberFormat {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function displayDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

function signedMoney(cents: number, currency: string): string {
  const value = formatter(currency).format(Math.abs(cents) / 100);
  return cents < 0 ? `-${value}` : cents > 0 ? `+${value}` : value;
}

function money(cents: number, currency: string): string {
  return formatter(currency).format(cents / 100);
}

function tone(cents: number): string {
  return cents < 0 ? "text-destructive" : cents > 0 ? "text-emerald-400" : "text-foreground";
}

function FlowBreakdown({ totals, currency }: { totals: FinancePeriodTotals; currency: string }) {
  const money = formatter(currency);
  return (
    <div className="grid grid-cols-2 gap-2 border-t border-border/70 pt-4 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <ArrowUpRight className="size-4 text-emerald-400" aria-hidden="true" />
        <span>Income</span>
        <span className="ml-auto font-mono tabular-nums text-foreground">
          {money.format(totals.incomeCents / 100)}
        </span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <ArrowDownRight className="size-4 text-destructive" aria-hidden="true" />
        <span>Expenses</span>
        <span className="ml-auto font-mono tabular-nums text-foreground">
          {money.format(totals.expenseCents / 100)}
        </span>
      </div>
    </div>
  );
}

export function FinancePanel({ open, onOpenChange }: FinancePanelProps): ReactElement {
  const { projection, isLoading, isRefreshing, error, refresh } = useFinanceProjection(open);
  const balanceHistory = projection?.balanceHistory ?? [];
  const syncLabel = projection?.lastSuccessfulSyncAt
    ? `Synced ${new Date(projection.lastSuccessfulSyncAt).toLocaleString()}`
    : "Slash not synced";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="finance-panel"
        className="flex h-[88vh] min-w-[min(92vw,1080px)] max-w-none flex-col overflow-hidden overscroll-contain border-border/80 bg-background/98 p-0"
        aria-busy={isRefreshing}
        style={{ zIndex: UI_Z.panelElevated }}
      >
        <DialogHeader className="flex-row items-center border-b border-border/80 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-9 place-items-center border border-border bg-card text-primary">
              <CircleDollarSign className="size-5" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle>Firm Finance</DialogTitle>
              <p aria-live="polite" className="mt-0.5 text-xs text-muted-foreground">
                {isRefreshing ? "Refreshing finance…" : syncLabel}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto mr-8 touch-manipulation"
            onClick={() => void refresh()}
            disabled={isRefreshing}
            aria-label="Refresh finance data"
          >
            <RefreshCw className={isRefreshing ? "animate-spin" : ""} aria-hidden="true" />
            Refresh
          </Button>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div
              role="status"
              className="grid h-full place-items-center text-sm text-muted-foreground"
            >
              Loading finance…
            </div>
          ) : null}
          {error ? (
            <div
              role="alert"
              className="flex items-center gap-3 border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
            >
              <AlertTriangle className="size-5" aria-hidden="true" />
              Finance data is unavailable. Refresh to try again.
            </div>
          ) : null}
          {projection ? (
            <div className="space-y-5">
              <Card className="rounded-none border-border/80 py-0">
                <CardHeader className="flex-row items-start px-5 pt-5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Company cash
                    </p>
                    <CardTitle
                      data-testid="finance-latest-balance"
                      className={`mt-2 font-mono text-4xl font-semibold tracking-tight tabular-nums ${tone(projection.latestBalance?.balanceCents ?? 0)}`}
                    >
                      {projection.latestBalance
                        ? money(projection.latestBalance.balanceCents, projection.latestBalance.currency)
                        : "—"}
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className="ml-auto font-mono uppercase">
                    {projection.latestBalance?.source ?? "not recorded"}
                  </Badge>
                </CardHeader>
                <CardContent className="px-5 pb-5 text-xs text-muted-foreground">
                  {projection.latestBalance
                    ? `Snapshot as of ${displayDate(projection.latestBalance.asOf)}`
                    : "Record a balance with farplane-ui finance snapshot record."}
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-[1.35fr_1fr]">
                <Card className="rounded-none border-border/80 py-0">
                  <CardHeader className="flex-row items-start px-5 pt-5">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        This week
                      </p>
                      <CardTitle
                        data-testid="finance-current-week-net"
                        className={`mt-2 font-mono text-4xl font-semibold tracking-tight tabular-nums ${tone(projection.currentWeek.netCashFlowCents)}`}
                      >
                        {signedMoney(projection.currentWeek.netCashFlowCents, projection.currency)}
                      </CardTitle>
                    </div>
                    <Badge variant="outline" className="ml-auto font-mono uppercase">
                      {projection.currentWeek.status}
                    </Badge>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <p className="mb-4 text-xs text-muted-foreground">
                      {displayDate(projection.currentWeek.startDate)} –{" "}
                      {displayDate(projection.currentWeek.endDate)}
                    </p>
                    <FlowBreakdown totals={projection.currentWeek} currency={projection.currency} />
                  </CardContent>
                </Card>

                <Card className="rounded-none border-border/80 py-0">
                  <CardHeader className="px-5 pt-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      This month
                    </p>
                    <CardTitle
                      className={`font-mono text-2xl tabular-nums ${tone(projection.currentMonth.netCashFlowCents)}`}
                    >
                      {signedMoney(projection.currentMonth.netCashFlowCents, projection.currency)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <p className="mb-4 text-xs text-muted-foreground">
                      {projection.observationCount} source observations
                    </p>
                    <FlowBreakdown
                      totals={projection.currentMonth}
                      currency={projection.currency}
                    />
                  </CardContent>
                </Card>
              </div>

              <section className="border border-border/80 bg-card">
                <div className="border-b border-border/80 px-4 py-3">
                  <h3 className="text-sm font-semibold">Cash Balance History</h3>
                </div>
                <div className="divide-y divide-border/70">
                  {balanceHistory.length ? (
                    balanceHistory.slice(0, 12).map((row) => (
                      <div key={`${row.asOf}:${row.observedAt}`} className="flex items-center gap-3 px-4 py-3 text-sm">
                        <div>
                          <p className="font-mono text-xs">{displayDate(row.asOf)}</p>
                          <p className="text-[11px] text-muted-foreground">{row.source}</p>
                        </div>
                        <span className={`ml-auto font-mono font-semibold tabular-nums ${tone(row.balanceCents)}`}>
                          {money(row.balanceCents, row.currency)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="grid h-24 place-items-center text-sm text-muted-foreground">
                      No company cash snapshots yet.
                    </div>
                  )}
                </div>
              </section>

              {projection.sourceGaps.length ? (
                <div
                  role="status"
                  data-testid="finance-source-gaps"
                  className="flex items-start gap-3 border border-amber-400/35 bg-amber-400/10 p-3 text-sm text-amber-100"
                >
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-amber-300"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-medium">
                      {projection.sourceGaps.length} source gap
                      {projection.sourceGaps.length === 1 ? "" : "s"}
                    </p>
                    <p className="mt-0.5 text-xs text-amber-100/70">
                      {projection.sourceGaps[0].source}: {projection.sourceGaps[0].code}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
                <section className="border border-border/80 bg-card">
                  <div className="border-b border-border/80 px-4 py-3">
                    <h3 className="text-sm font-semibold">Daily Flow</h3>
                  </div>
                  <div className="divide-y divide-border/70 sm:hidden">
                    {projection.daily.length ? (
                      projection.daily.slice(0, 14).map((row) => (
                        <div key={row.date} className="space-y-2 px-4 py-3 text-xs">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-mono text-muted-foreground">
                              {displayDate(row.date)}
                            </span>
                            <span
                              className={`font-mono text-sm font-semibold tabular-nums ${tone(row.netCashFlowCents)}`}
                            >
                              {signedMoney(row.netCashFlowCents, projection.currency)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4 text-muted-foreground">
                            <span>
                              Income {formatter(projection.currency).format(row.incomeCents / 100)}
                            </span>
                            <span>
                              Expenses{" "}
                              {formatter(projection.currency).format(row.expenseCents / 100)}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="grid h-24 place-items-center text-sm text-muted-foreground">
                        No finance observations yet.
                      </div>
                    )}
                  </div>
                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Income</TableHead>
                          <TableHead className="text-right">Expenses</TableHead>
                          <TableHead className="text-right">Net</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projection.daily.length ? (
                          projection.daily.slice(0, 14).map((row) => (
                            <TableRow key={row.date}>
                              <TableCell className="font-mono text-xs">
                                {displayDate(row.date)}
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums">
                                {formatter(projection.currency).format(row.incomeCents / 100)}
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums">
                                {formatter(projection.currency).format(row.expenseCents / 100)}
                              </TableCell>
                              <TableCell
                                className={`text-right font-mono font-semibold tabular-nums ${tone(row.netCashFlowCents)}`}
                              >
                                {signedMoney(row.netCashFlowCents, projection.currency)}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="h-24 text-center text-muted-foreground"
                            >
                              No finance observations yet.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </section>

                <section className="border border-border/80 bg-card">
                  <div className="border-b border-border/80 px-4 py-3">
                    <h3 className="text-sm font-semibold">Weekly Closes</h3>
                  </div>
                  <div className="divide-y divide-border/70">
                    {projection.weeklyHistory.length ? (
                      projection.weeklyHistory.slice(0, 8).map((row) => (
                        <div
                          key={row.weekKey}
                          className="flex items-center gap-3 px-4 py-3 text-sm"
                        >
                          <div>
                            <p className="font-mono text-xs">{row.weekKey}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {displayDate(row.startDate)} – {displayDate(row.endDate)}
                            </p>
                          </div>
                          <span
                            className={`ml-auto font-mono font-semibold tabular-nums ${tone(row.netCashFlowCents)}`}
                          >
                            {signedMoney(row.netCashFlowCents, row.currency)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="grid h-24 place-items-center text-sm text-muted-foreground">
                        No weeks closed yet.
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
