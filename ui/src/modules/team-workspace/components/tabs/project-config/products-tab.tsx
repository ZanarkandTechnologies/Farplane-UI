import type { ReactElement } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { findMetricsSnapshot } from "@/modules/team-workspace/lib/dashboard-projections/goal-kpi-model";
import { findConfigFile, getConfigSection, parseMarkdownTable } from "./config-parsing";
import type { FarplaneProjectConfig } from "./config-types";
import { ProductSurfaceCard, ShopDepartmentsCard } from "./products-components";
import { groupMetricsByProduct } from "./products-model";
import { MetricTile, statusBadge } from "./shared";

export function ProjectProductsTab({
  config,
}: {
  config: FarplaneProjectConfig | null;
}): ReactElement {
  const products = findConfigFile(config, "products");
  const productRows = parseMarkdownTable(getConfigSection(products, "Products")).slice(1);
  const laneRows = parseMarkdownTable(getConfigSection(products, "Work Lanes")).slice(1);
  const snapshot = findMetricsSnapshot(config);
  const metricsByProduct = groupMetricsByProduct(snapshot?.metrics ?? []);
  const linkedKpiCount = productRows.reduce(
    (total, row) => total + (metricsByProduct.get(row[0] ?? "")?.length ?? 0),
    0,
  );
  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Product Shop</h3>
            <p className="text-xs text-muted-foreground">
              Product surfaces mapped to their current KPI evidence.
            </p>
          </div>
          {statusBadge(products)}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <MetricTile
            label="Shop Items"
            value={String(productRows.length)}
            detail="product surfaces"
          />
          <MetricTile
            label="Departments"
            value={String(laneRows.length)}
            detail="work-lane weights"
          />
          <MetricTile
            label="Linked KPIs"
            value={snapshot ? String(linkedKpiCount) : "missing"}
            detail="metrics bound by product"
          />
        </div>
        <div className="space-y-3">
          {productRows.map((row, index) => (
            <ProductSurfaceCard
              key={row[0] || row[1]}
              index={index}
              metrics={metricsByProduct.get(row[0] ?? "") ?? []}
              row={row}
            />
          ))}
        </div>
        <ShopDepartmentsCard laneRows={laneRows} />
      </div>
    </ScrollArea>
  );
}
