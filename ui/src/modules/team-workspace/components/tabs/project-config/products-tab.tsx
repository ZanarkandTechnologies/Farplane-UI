import type { ReactElement } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { findMetricsSnapshot } from "@/modules/team-workspace/lib/dashboard-projections/goal-kpi-model";
import { findProjectUiSnapshot } from "@/modules/team-workspace/lib/dashboard-projections/project-ui-snapshot";
import { findConfigFile } from "./config-parsing";
import type { FarplaneProjectConfig } from "./config-types";
import { ProductGoalMatrixCard, ProductSurfaceCard } from "./products-components";
import {
  groupMetricsByProduct,
  productCardFromSnapshot,
  productRegistryFromProductsJson,
} from "./products-model";
import { MetricTile, statusBadge } from "./shared";

export function ProjectProductsTab({
  config,
}: {
  config: FarplaneProjectConfig | null;
}): ReactElement {
  const productsIndex =
    findConfigFile(config, "products-index") ?? findConfigFile(config, "farplane/products.json");
  const productRegistry = productRegistryFromProductsJson(
    productsIndex?.parsedJson,
    productsIndex?.path ?? "farplane/products.json",
  );
  const projectUiSnapshot = findProjectUiSnapshot(config);
  const laneById = new Map(
    (projectUiSnapshot?.tabs.products.workLanes ?? []).map((lane) => [lane.laneId, lane]),
  );
  const productCards = productRegistry
    ? productRegistry.products
    : projectUiSnapshot
      ? projectUiSnapshot.tabs.products.products.map((product) =>
          productCardFromSnapshot(product, laneById.get(product.lane)),
        )
      : [];
  const snapshot = findMetricsSnapshot(config);
  const metricsByProduct = groupMetricsByProduct(snapshot?.metrics ?? [], productCards);
  const linkedKpiCount = productCards.reduce(
    (total, product) =>
      total +
      (product.kpis.all.length ||
        product.kpiIds.length ||
        metricsByProduct.get(product.productId)?.length ||
        0),
    0,
  );
  const workflowCount = productCards.reduce(
    (total, product) => total + product.artifactWorkflows.length,
    0,
  );
  const laneWeightTotal = productCards.reduce(
    (total, product) => total + (product.laneWeight ?? 0),
    0,
  );
  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Product Registry</h3>
            <p className="text-xs text-muted-foreground">
              Product-local strategy surfaces mapped to goals, workflows, and KPI evidence.
            </p>
          </div>
          {statusBadge(productsIndex)}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <MetricTile
            label="Shop Items"
            value={String(productCards.length)}
            detail="product surfaces"
          />
          <MetricTile
            label="Source Gaps"
            value={String(projectUiSnapshot?.tabs.products.sourceGapIds.length ?? 0)}
            detail="product evidence gaps"
          />
          <MetricTile
            label="Linked KPIs"
            value={snapshot ? String(linkedKpiCount) : "missing"}
            detail="product KPI memberships"
          />
          <MetricTile
            label="Workflows"
            value={String(workflowCount)}
            detail={
              laneWeightTotal > 0 ? `${laneWeightTotal}% lane weight tracked` : "artifact workflows"
            }
          />
        </div>
        {productRegistry?.goalProductMatrix.length ? (
          <ProductGoalMatrixCard rows={productRegistry.goalProductMatrix} />
        ) : null}
        <div className="space-y-3">
          {productCards.map((product, index) => (
            <ProductSurfaceCard
              key={product.productId || product.name}
              index={index}
              metrics={metricsByProduct.get(product.productId) ?? []}
              product={product}
            />
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}
