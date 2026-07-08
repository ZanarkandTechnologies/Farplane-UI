/**
 * Product tab presentational pieces.
 * Renders product surface cards, KPI evidence, and work-lane department cards.
 */

import { Flag, Gauge, GitBranch, Package, Route, Target, Workflow } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { KpiMetricRow } from "@/modules/team-workspace/lib/dashboard-projections/goal-kpi-model";
import {
  formatMetricValue,
  type ProductCardModel,
  type ProductGoalMatrixRow,
} from "./products-model";

export function ProductSurfaceCard({
  index,
  metrics,
  product,
}: {
  index: number;
  metrics: KpiMetricRow[];
  product: ProductCardModel;
}): ReactElement {
  const sourceGaps = product.sourceGapIds.join(", ");
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 rounded-md border bg-card p-4 lg:grid-cols-[10rem_minmax(0,1fr)_minmax(18rem,0.78fr)]">
      <div className="flex items-start gap-3 rounded-md border bg-muted/20 p-3 lg:block">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-background lg:mb-3">
          <Package className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Product {String(index + 1).padStart(2, "0")}
          </p>
          <Badge variant="secondary" className="mt-2 max-w-full whitespace-normal break-words">
            {product.productId || "product"}
          </Badge>
          {product.proofState ? (
            <Badge
              variant={product.proofState === "ready" ? "outline" : "secondary"}
              className="mt-2 max-w-full whitespace-normal break-words"
            >
              {product.proofState.replace(/[_-]+/g, " ")}
            </Badge>
          ) : null}
          {product.laneWeight !== null ? (
            <Badge variant="outline" className="mt-2">
              {product.laneWeight}% lane
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="min-w-0 space-y-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Surface</p>
          <h4 className="mt-1 break-words text-base font-semibold [overflow-wrap:anywhere]">
            {product.name || product.productId || "Untitled product"}
          </h4>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <ProductField label="Lane" value={product.lane || "lane pending"} />
          <ProductField label="Owner Skill" value={product.ownerSkill || "owner pending"} />
          <ProductField label="Audience" value={product.audience || "Audience pending"} />
          <ProductField label="Output" value={product.output || "Output pending"} />
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <ProductField
            label="Ticket Count"
            value={
              typeof product.ticketCount === "number"
                ? String(product.ticketCount)
                : "not attributed"
            }
          />
          <ProductField label="Source Gaps" value={sourceGaps || "none"} />
          <ProductField label="Source" value={product.sourcePath || "product.md pending"} />
          <ProductField
            label="Lane Purpose"
            value={product.lanePurpose || product.reward || "pending"}
          />
        </div>
        <ProductGoalList goals={product.goals} />
        <ProductWorkflowList workflows={product.artifactWorkflows} />
      </div>
      <ProductKpiPanel metrics={metrics} product={product} />
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

export function ProductGoalMatrixCard({ rows }: { rows: ProductGoalMatrixRow[] }): ReactElement {
  const alignedCount = rows.filter((row) => row.status === "aligned").length;
  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Target className="h-4 w-4" />
          Goal Alignment
          <Badge variant="secondary" className="ml-auto">
            {alignedCount}/{rows.length} aligned
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.slice(0, 8).map((row) => (
          <div
            key={`${row.goalId}:${row.productId}`}
            className="grid min-w-0 grid-cols-1 gap-2 rounded-md border bg-muted/20 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(10rem,0.35fr)]"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{row.goalId}</Badge>
                <Badge variant="secondary">{row.productLabel}</Badge>
                <Badge variant={row.status === "aligned" ? "outline" : "secondary"}>
                  {row.status.replace(/[_-]+/g, " ")}
                </Badge>
              </div>
              <p className="mt-2 break-words text-xs [overflow-wrap:anywhere]">{row.target}</p>
              {row.productGoalIds.length > 0 ? (
                <p className="mt-1 break-words font-mono text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
                  {row.productGoalIds.join(", ")}
                </p>
              ) : null}
            </div>
            <div className="min-w-0 rounded-md border bg-background/50 p-2">
              <p className="text-[10px] uppercase tracking-normal text-muted-foreground">
                Shared KPIs
              </p>
              <p className="mt-1 break-words font-mono text-[11px] [overflow-wrap:anywhere]">
                {row.sharedKpis.length > 0 ? row.sharedKpis.slice(0, 4).join(", ") : "none"}
              </p>
            </div>
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
  metrics,
  product,
}: {
  metrics: KpiMetricRow[];
  product: ProductCardModel;
}): ReactElement {
  const membershipCount = product.kpis.all.length || product.kpiIds.length;
  return (
    <div className="min-w-0 rounded-md border bg-muted/20 p-3">
      <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        <Gauge className="h-3.5 w-3.5" />
        KPI Membership
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <KpiGroup label="Primary" values={product.kpis.primary} />
        <KpiGroup label="Guardrail" values={product.kpis.guardrail} />
        <KpiGroup label="Supporting" values={product.kpis.supporting} />
        <KpiGroup
          label="All"
          values={product.kpis.all.length ? product.kpis.all : product.kpiIds}
        />
      </div>
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
          <Badge variant="secondary">
            {membershipCount > 0 ? `${membershipCount} KPI ref(s)` : "no KPI linked"}
          </Badge>
          <p className="mt-2 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {product.reward ||
              `No metric currently declares product=${product.productId || "this product"}.`}
          </p>
        </div>
      )}
    </div>
  );
}

function KpiGroup({ label, values }: { label: string; values: string[] }): ReactElement {
  return (
    <div className="min-w-0 rounded-md border bg-background/50 p-2">
      <p className="text-[10px] uppercase tracking-normal text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-mono text-[11px] [overflow-wrap:anywhere]">
        {values.length > 0 ? values.slice(0, 3).join(", ") : "none"}
      </p>
      {values.length > 3 ? (
        <Badge variant="secondary" className="mt-1">
          +{values.length - 3}
        </Badge>
      ) : null}
    </div>
  );
}

function ProductGoalList({ goals }: { goals: ProductCardModel["goals"] }): ReactElement | null {
  if (goals.length === 0) return null;
  return (
    <div className="rounded-md border bg-muted/10 p-3">
      <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        <Target className="h-3.5 w-3.5" />
        Product Goals
      </p>
      <div className="mt-2 space-y-2">
        {goals.slice(0, 2).map((goal) => (
          <div key={goal.id} className="rounded-md border bg-background/50 p-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{goal.id}</Badge>
              {goal.scope ? <Badge variant="secondary">{goal.scope}</Badge> : null}
            </div>
            <p className="mt-1 break-words text-xs [overflow-wrap:anywhere]">{goal.target}</p>
            {goal.kpis.length > 0 ? (
              <p className="mt-1 break-words font-mono text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
                {goal.kpis.join(", ")}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductWorkflowList({
  workflows,
}: {
  workflows: ProductCardModel["artifactWorkflows"];
}): ReactElement | null {
  if (workflows.length === 0) return null;
  return (
    <div className="rounded-md border bg-muted/10 p-3">
      <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        <Workflow className="h-3.5 w-3.5" />
        Artifact Workflows
      </p>
      <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-2">
        {workflows.slice(0, 4).map((workflow) => (
          <div key={workflow.id} className="rounded-md border bg-background/50 p-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{workflow.id}</Badge>
              <Badge variant="secondary" className="max-w-full whitespace-normal break-words">
                {workflow.owner || workflow.lane || "owner pending"}
              </Badge>
            </div>
            <p className="mt-1 flex min-w-0 items-center gap-1 break-words text-xs [overflow-wrap:anywhere]">
              <GitBranch className="h-3 w-3 shrink-0" />
              {workflow.planningArtifact || "planning artifact pending"}
            </p>
            <p className="mt-1 flex min-w-0 items-center gap-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
              <Route className="h-3 w-3 shrink-0" />
              {workflow.executionArtifact || "execution artifact pending"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
