"use client";

import { AlertTriangle, CircleDollarSign, Gauge, RefreshCw, Sparkles } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLeverageProjection } from "./hooks/use-leverage-projection";
import type {
  LeverageDistribution,
  LeverageDistributionAccount,
  LeverageEdge,
  LeverageSourceGap,
} from "./lib/leverage-types";

type LeveragePanelProps = { open: boolean; onOpenChange: (open: boolean) => void };

function money(cents: number | null, currency: string | null): string {
  if (cents === null || !currency) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

function observedLabel(observedAt: string | null): string {
  return observedAt ? `Observed ${new Date(observedAt).toLocaleString()}` : "No dated observation";
}

function metricValue(metric: LeverageDistribution): string {
  if (metric.value === null) return "—";
  return `${new Intl.NumberFormat().format(metric.value)}${metric.unit ? ` ${metric.unit}` : ""}`;
}

function edgeEmptyState(edge: LeverageEdge): string {
  if (edge.status === "not_configured") return "No Edge metric is configured for this project.";
  if (edge.status === "unavailable") return "Project evidence is unavailable.";
  return "No current evidence-backed Edge paragraph.";
}

function DistributionAccount({ account }: { account: LeverageDistributionAccount }): ReactElement {
  return (
    <Card
      data-testid={`leverage-distribution-account-${account.id}`}
      className="rounded-none border-border/80 py-0"
    >
      <CardHeader className="flex-row items-center border-b border-border/70 px-4 py-3">
        <div>
          <CardTitle className="text-sm">{account.label}</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Used by: {account.projects.map((project) => project.name).join(" · ")}
          </p>
        </div>
        <Badge variant="outline" className="ml-auto font-mono uppercase">
          {account.metrics.length} signal{account.metrics.length === 1 ? "" : "s"}
        </Badge>
      </CardHeader>
      <CardContent className="divide-y divide-border/70 px-4 py-0">
        {account.metrics.map((metric) => (
          <div key={metric.metricId} className="flex items-start gap-3 py-3 text-sm">
            <div>
              <p className="font-medium">{metric.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {observedLabel(metric.observedAt)}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="font-mono font-semibold tabular-nums">{metricValue(metric)}</p>
              <Badge variant="outline" className="mt-1 text-[10px] uppercase">
                {statusLabel(metric.status)}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EdgeList({ edges }: { edges: LeverageEdge[] }): ReactElement {
  return (
    <Card data-testid="leverage-edge-list" className="rounded-none border-border/80 py-0">
      <CardContent className="divide-y divide-border/70 px-5 py-0">
        {edges.map((edge) => (
          <article key={edge.projectId} className="py-4">
            <div className="flex items-start gap-3">
              <div>
                <p className="font-medium">{edge.projectName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {edge.value ? observedLabel(edge.observedAt) : edgeEmptyState(edge)}
                </p>
              </div>
              <Badge variant="outline" className="ml-auto text-[10px] uppercase">
                {statusLabel(edge.status)}
              </Badge>
            </div>
            {edge.value ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{edge.value}</p>
            ) : null}
          </article>
        ))}
      </CardContent>
    </Card>
  );
}

function GapList({ gaps }: { gaps: LeverageSourceGap[] }): ReactElement | null {
  if (!gaps.length) return null;
  return (
    <section
      data-testid="leverage-source-gaps"
      className="border border-amber-400/35 bg-amber-400/10"
    >
      <div className="flex items-center gap-2 border-b border-amber-400/20 px-4 py-3">
        <AlertTriangle className="size-4 text-amber-300" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-amber-100">Evidence gaps</h3>
        <Badge variant="outline" className="ml-auto border-amber-300/35 text-amber-100">
          {gaps.length}
        </Badge>
      </div>
      <div className="divide-y divide-amber-400/15">
        {gaps.map((gap, index) => (
          <div
            key={`${gap.projectId ?? "capital"}:${gap.code}:${index}`}
            className="px-4 py-3 text-sm"
          >
            <p className="font-medium text-amber-50">
              {gap.projectName ?? "Capital"} · {statusLabel(gap.code)}
            </p>
            <p className="mt-0.5 text-xs text-amber-100/70">{gap.message}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LeveragePanel({ open, onOpenChange }: LeveragePanelProps): ReactElement {
  const { projection, isLoading, isRefreshing, error, refresh } = useLeverageProjection(open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="leverage-panel"
        aria-busy={isRefreshing}
        className="flex h-[92dvh] max-w-[88vw] flex-col gap-0 overflow-hidden rounded-md border-border/80 bg-background/98 p-0"
      >
      <DialogHeader className="flex-row items-center border-b border-border/80 px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 place-items-center border border-border bg-card text-primary">
            <Gauge className="size-5" aria-hidden="true" />
          </div>
          <div>
            <DialogTitle>Leverage</DialogTitle>
            <p aria-live="polite" className="mt-0.5 text-xs text-muted-foreground">
              Read-only evidence across capital, distribution, and Edge.
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
          aria-label="Refresh leverage evidence"
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
            Loading leverage evidence…
          </div>
        ) : null}
        {error ? (
          <div
            role="alert"
            className="flex items-center gap-3 border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
          >
            <AlertTriangle className="size-5" aria-hidden="true" />
            Leverage evidence is unavailable. Refresh to try again.
          </div>
        ) : null}
        {projection ? (
          <div className="space-y-6">
            <section aria-labelledby="leverage-capital-heading">
              <Card className="rounded-none border-border/80 py-0">
                <CardHeader className="flex-row items-start px-5 pt-5">
                  <div>
                    <p
                      id="leverage-capital-heading"
                      className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                    >
                      Capital
                    </p>
                    <CardTitle
                      data-testid="leverage-capital"
                      className="mt-2 font-mono text-3xl font-semibold tracking-tight tabular-nums"
                    >
                      {money(projection.capital.balanceCents, projection.capital.currency)}
                    </CardTitle>
                  </div>
                  <CircleDollarSign
                    className="ml-auto size-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                </CardHeader>
                <CardContent className="px-5 pb-5 text-xs text-muted-foreground">
                  {projection.capital.status === "available"
                    ? `${projection.capital.source ?? "Finance"} · ${observedLabel(projection.capital.observedAt)}`
                    : "Finance has no recorded cash snapshot yet."}
                </CardContent>
              </Card>
            </section>

            <section
              data-testid="leverage-distribution"
              aria-labelledby="leverage-distribution-heading"
            >
              <div className="mb-3 flex items-center gap-2">
                <h3
                  id="leverage-distribution-heading"
                  className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                >
                  Distribution
                </h3>
                <Badge variant="outline" className="font-mono uppercase">
                  {projection.distribution.length} account
                  {projection.distribution.length === 1 ? "" : "s"}
                </Badge>
              </div>
              {projection.distribution.length ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  {projection.distribution.map((account) => (
                    <DistributionAccount key={account.id} account={account} />
                  ))}
                </div>
              ) : (
                <div className="grid h-24 place-items-center border border-border/80 text-sm text-muted-foreground">
                  No configured social distribution evidence.
                </div>
              )}
            </section>

            <section aria-labelledby="leverage-edge-heading">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="size-4 text-primary" aria-hidden="true" />
                <h3
                  id="leverage-edge-heading"
                  className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                >
                  Edge
                </h3>
                <Badge variant="outline" className="font-mono uppercase">
                  {projection.edges.length} project{projection.edges.length === 1 ? "" : "s"}
                </Badge>
              </div>
              {projection.edges.length ? (
                <EdgeList edges={projection.edges} />
              ) : (
                <div className="grid h-24 place-items-center border border-border/80 text-sm text-muted-foreground">
                  No registered projects are available for Edge coverage.
                </div>
              )}
            </section>

            <GapList gaps={projection.sourceGaps} />
          </div>
        ) : null}
      </div>
      </DialogContent>
    </Dialog>
  );
}
