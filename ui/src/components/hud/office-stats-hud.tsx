"use client";

import { CircleDollarSign, Footprints } from "lucide-react";
import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFinanceProjection } from "@/modules/finance";
import type { OfficeLayoutModel } from "@/modules/office/lib/office-layout";
import { deriveOfficeSpaceStats } from "@/modules/office/lib/office-space-stats";
import type { EmployeeData, OfficeObject } from "@/modules/office/lib/types";
import { SoundtrackHudControl } from "@/modules/soundtrack";

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function currencyFormatter(currency: string): Intl.NumberFormat {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
}

export function OfficeStatsHud(props: {
  employees: EmployeeData[];
  officeObjects: OfficeObject[];
  officeLayout: OfficeLayoutModel;
  onOpenFinance: () => void;
}) {
  const stats = useMemo(
    () =>
      deriveOfficeSpaceStats({
        employees: props.employees,
        officeObjects: props.officeObjects,
        officeLayout: props.officeLayout,
      }),
    [props.employees, props.officeObjects, props.officeLayout],
  );
  const { projection, isLoading, error } = useFinanceProjection();
  const formatter = useMemo(
    () => currencyFormatter(projection?.currency ?? "USD"),
    [projection?.currency],
  );
  const latestBalance = projection?.latestBalance ?? null;
  const hasCashSnapshot = latestBalance !== null;
  const cashBalance = (latestBalance?.balanceCents ?? 0) / 100;
  const financeTone =
    cashBalance < 0 ? "text-destructive" : cashBalance > 0 ? "text-emerald-400" : "text-foreground";
  const triggerValue = isLoading
    ? "…"
    : error
      ? "—"
      : hasCashSnapshot
        ? formatter.format(cashBalance)
        : "—";
  const financeState = isLoading
    ? "loading"
    : error
      ? "error"
      : hasCashSnapshot
        ? "ready"
        : "missing";
  const accessibleLabel = isLoading
    ? "Finance metrics loading"
    : error
      ? "Finance metrics unavailable"
      : hasCashSnapshot
        ? `Company cash: ${formatter.format(cashBalance)} as of ${latestBalance.asOf}`
        : "Finance: no company cash snapshot";
  const walkabilityTone =
    stats.walkablePercent < 0.85
      ? "text-destructive"
      : stats.walkablePercent < 0.95
        ? "text-amber-300"
        : "text-primary";

  return (
    <div
      data-testid="office-hud-rail"
      className="pointer-events-auto flex h-11 items-stretch border border-border/80 bg-card/95 text-card-foreground shadow-lg backdrop-blur-md"
    >
      <Tooltip delayDuration={120}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={props.onOpenFinance}
            aria-label={accessibleLabel}
            data-testid="office-finance-hud-trigger"
            data-finance-state={financeState}
            className={`flex min-w-11 touch-manipulation items-center justify-center gap-2 px-3 transition-[background-color,color] hover:bg-accent focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${financeTone}`}
          >
            <CircleDollarSign aria-hidden="true" className="size-4 shrink-0" />
            <span className="font-mono text-sm font-semibold tabular-nums">{triggerValue}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="end"
          sideOffset={8}
          data-testid="office-finance-hud-tooltip"
          className="rounded-none border-border/80 bg-card/95 px-3 py-2 text-card-foreground shadow-lg backdrop-blur-md"
          arrowClassName="bg-card fill-card"
        >
          <div className="flex items-baseline justify-between gap-5 whitespace-nowrap">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {hasCashSnapshot ? "Company cash" : "Finance"}
            </span>
            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
              <span className={financeTone}>{triggerValue}</span>
            </span>
          </div>
          <div className="mt-1 whitespace-nowrap text-[10px] text-muted-foreground">
            {error
              ? "Spend readings unavailable"
              : hasCashSnapshot
                ? `As of ${latestBalance.asOf} · ${latestBalance.source}`
                : "No company cash snapshot"}
            {!error && projection && projection.sourceGaps.length > 0
              ? ` · ${projection.sourceGaps.length} source gap${projection.sourceGaps.length === 1 ? "" : "s"}`
              : ""}
          </div>
        </TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={120}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Office space: ${formatPercent(stats.walkablePercent)} walkable, ${formatPercent(stats.emptyPercent)} empty, ${stats.totalEmployees} agents`}
            data-testid="office-walkability-hud-trigger"
            className={`flex size-11 touch-manipulation items-center justify-center border-l border-border/70 text-muted-foreground transition-[background-color,color] hover:bg-accent hover:text-foreground focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${walkabilityTone}`}
          >
            <Footprints aria-hidden="true" className="size-[18px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="end"
          sideOffset={8}
          data-testid="office-walkability-hud-tooltip"
          className="rounded-none border-border/80 bg-card/95 px-3 py-2 text-card-foreground shadow-lg backdrop-blur-md"
          arrowClassName="bg-card fill-card"
        >
          <div className="flex items-center gap-2 whitespace-nowrap font-mono text-[11px] tabular-nums">
            <span className={walkabilityTone}>Walk {formatPercent(stats.walkablePercent)}</span>
            <span className="text-border">·</span>
            <span>Empty {formatPercent(stats.emptyPercent)}</span>
            <span className="text-border">·</span>
            <span>{stats.totalEmployees} agents</span>
          </div>
        </TooltipContent>
      </Tooltip>
      <SoundtrackHudControl />
    </div>
  );
}
