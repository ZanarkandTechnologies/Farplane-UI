/**
 * Product tab presentational pieces.
 * Renders product surface cards, KPI evidence, and work-lane department cards.
 */

import { Flag, Gauge, Package } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { KpiMetricRow } from "@/modules/team-workspace/lib/dashboard-projections/goal-kpi-model";
import { formatMetricValue } from "./products-model";

export function ProductSurfaceCard({
  index,
  metrics,
  row,
}: {
  index: number;
  metrics: KpiMetricRow[];
  row: string[];
}): ReactElement {
  const productId = row[0] ?? "";
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 rounded-md border bg-card p-4 lg:grid-cols-[10rem_minmax(0,1fr)_minmax(16rem,0.72fr)]">
      <div className="flex items-start gap-3 rounded-md border bg-muted/20 p-3 lg:block">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-background lg:mb-3">
          <Package className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Product {String(index + 1).padStart(2, "0")}
          </p>
          <Badge variant="secondary" className="mt-2 max-w-full whitespace-normal break-words">
            {productId || "product"}
          </Badge>
        </div>
      </div>
      <div className="min-w-0 space-y-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Surface</p>
          <h4 className="mt-1 break-words text-base font-semibold [overflow-wrap:anywhere]">
            {row[1] ?? productId ?? "Untitled product"}
          </h4>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <ProductField label="Audience" value={row[2] ?? "Audience pending"} />
          <ProductField label="Output" value={row[3] ?? "Output pending"} />
        </div>
      </div>
      <ProductKpiPanel fallback={row[4] ?? ""} metrics={metrics} productId={productId} />
    </div>
  );
}

export function ShopDepartmentsCard({ laneRows }: { laneRows: string[][] }): ReactElement {
  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Flag className="h-4 w-4" />
          Shop Departments
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {laneRows.map((row) => (
          <div key={row[0]} className="rounded-md border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{row[0]}</p>
              <Badge variant="secondary">{row[1]}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{row[2]}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ProductField({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="rounded-md border bg-muted/10 p-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm [overflow-wrap:anywhere]">{value}</p>
    </div>
  );
}

function ProductKpiPanel({
  fallback,
  metrics,
  productId,
}: {
  fallback: string;
  metrics: KpiMetricRow[];
  productId: string;
}): ReactElement {
  return (
    <div className="min-w-0 rounded-md border bg-muted/20 p-3">
      <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        <Gauge className="h-3.5 w-3.5" />
        KPI Evidence
      </p>
      {metrics.length > 0 ? (
        <div className="mt-2 space-y-2">
          {metrics.slice(0, 5).map((metric) => (
            <div
              key={metric.metricId}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-md border bg-background/50 p-2"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{metric.label}</p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {metric.metricId}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">
                  {formatMetricValue(metric.current)}
                </p>
                <Badge variant={metric.status === "available" ? "outline" : "secondary"}>
                  {metric.unit || metric.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 rounded-md border bg-background/50 p-3">
          <Badge variant="secondary">no KPI linked</Badge>
          <p className="mt-2 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {fallback || `No metric currently declares product=${productId || "this product"}.`}
          </p>
        </div>
      )}
    </div>
  );
}
