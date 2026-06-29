import { Flag, Package, Trophy } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { findConfigFile, getConfigSection, parseMarkdownTable } from "./config-parsing";
import type { FarplaneProjectConfig } from "./config-types";
import { MetricTile, SparkBars, statusBadge } from "./shared";

export function ProjectProductsTab({
  config,
}: {
  config: FarplaneProjectConfig | null;
}): ReactElement {
  const products = findConfigFile(config, "products");
  const productRows = parseMarkdownTable(getConfigSection(products, "Products")).slice(1);
  const laneRows = parseMarkdownTable(getConfigSection(products, "Work Lanes")).slice(1);
  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Product Shop</h3>
            <p className="text-xs text-muted-foreground">
              Each shelf is a real Farplane product surface with its buyer and reward signal.
            </p>
          </div>
          {statusBadge(products)}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <MetricTile
            label="Shop Items"
            value={String(productRows.length)}
            detail="products.md product rows"
          />
          <MetricTile
            label="Departments"
            value={String(laneRows.length)}
            detail="work-lane routing weights"
          />
          <MetricTile
            label="Top Reward"
            value={productRows[0]?.[4]?.split(",")[0] ?? "reward missing"}
            detail={productRows[0]?.[0] ?? "first product row"}
          />
        </div>
        <div className="space-y-3">
          {productRows.map((row, index) => (
            <div
              key={row[0]}
              className="grid min-w-0 grid-cols-1 gap-3 rounded-md border bg-card p-4 lg:grid-cols-[10rem_minmax(0,1fr)_minmax(14rem,0.62fr)]"
            >
              <div className="flex items-start gap-3 rounded-md border bg-muted/20 p-3 lg:block">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-background lg:mb-3">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Shelf {String(index + 1).padStart(2, "0")}
                  </p>
                  <Badge
                    variant="secondary"
                    className="mt-2 max-w-full whitespace-normal break-words"
                  >
                    {row[0] ?? "product"}
                  </Badge>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Rank {index < 2 ? "S" : index < 5 ? "A" : "B"} item
                  </p>
                </div>
              </div>
              <div className="min-w-0 space-y-2">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Product Package
                  </p>
                  <h4 className="mt-1 break-words text-base font-semibold [overflow-wrap:anywhere]">
                    {row[1] ?? row[0] ?? "Untitled product"}
                  </h4>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="rounded-md border bg-muted/10 p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Buyer
                    </p>
                    <p className="mt-1 break-words text-sm [overflow-wrap:anywhere]">
                      {row[2] ?? "Audience pending"}
                    </p>
                  </div>
                  <div className="rounded-md border bg-muted/10 p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Output
                    </p>
                    <p className="mt-1 break-words text-sm [overflow-wrap:anywhere]">
                      {row[3] ?? "Output pending"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="min-w-0 rounded-md border bg-muted/20 p-3">
                <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  <Trophy className="h-3.5 w-3.5" />
                  Reward Signal
                </p>
                <p className="mt-2 break-words text-sm [overflow-wrap:anywhere]">
                  {row[4] ?? "reward missing"}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3 rounded-md border bg-background/50 px-3 py-2">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Demand
                  </span>
                  <SparkBars seed={`${row[0]}:${row[4]}`} active />
                </div>
              </div>
            </div>
          ))}
        </div>
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
      </div>
    </ScrollArea>
  );
}
