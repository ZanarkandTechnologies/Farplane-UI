"use client";

/**
 * Team Workspace Distribution tab.
 * Coordinates compiled content metrics, filters, and read-only distribution sections.
 */

import { Repeat2 } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MetricsUiSnapshot } from "@/modules/team-workspace/lib/dashboard-projections/goal-kpi-model";
import type { SocialContentInsightsModel } from "@/modules/team-workspace/lib/dashboard-projections/social-content-insights";
import {
  DistributionContentRow,
  DistributionControls,
  numberText,
  SummaryTile,
} from "./distribution-components";
import {
  buildDistributionTotals,
  buildTimeframeWindow,
  distributionSourceGaps,
  type DistributionFilter,
  isInTimeframe,
  metricCurrent,
  sortContentItems,
  type TimeframeFilter,
} from "./distribution-model";

export function DistributionTab({
  snapshot,
  socialContent,
}: {
  snapshot: MetricsUiSnapshot | null;
  socialContent: SocialContentInsightsModel;
}): ReactElement {
  const [filter, setFilter] = useState<DistributionFilter>("all");
  const [timeframe, setTimeframe] = useState<TimeframeFilter>("month");
  const items = socialContent.items;
  const timeframeWindow = useMemo(() => buildTimeframeWindow(snapshot?.snapshotDate), [snapshot]);
  const filteredItems = useMemo(
    () =>
      sortContentItems(
        items.filter((item) => {
          if (!isInTimeframe(item, timeframe, timeframeWindow)) return false;
          if (filter === "all") return true;
          if (filter === "gaps") return item.gaps.length > 0;
          return item.platform === filter;
        }),
      ),
    [filter, items, timeframe, timeframeWindow],
  );
  const totals = buildDistributionTotals(filteredItems, snapshot);
  const postsPublished = metricCurrent(snapshot, "posts_published");
  const sourceGaps = useMemo(() => distributionSourceGaps(snapshot), [snapshot]);

  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Repeat2 className="h-4 w-4" />
                Distribution
              </CardTitle>
              <DistributionControls
                filter={filter}
                setFilter={setFilter}
                setTimeframe={setTimeframe}
                timeframe={timeframe}
              />
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <SummaryTile label="Views" value={numberText(totals.views)} detail="selected content" />
            <SummaryTile
              label="Engagements"
              value={numberText(totals.engagements)}
              detail="likes, comments, shares, saves"
            />
            <SummaryTile label="Content" value={String(filteredItems.length)} detail="shown items" />
            <SummaryTile
              label="Published"
              value={numberText(postsPublished)}
              detail="approved posts"
            />
          </CardContent>
          {sourceGaps.length > 0 ? (
            <CardContent className="border-t pt-3">
              <div className="flex flex-wrap gap-2">
                {sourceGaps.map((gap) => (
                  <Badge
                    key={`${gap.metricId}:${gap.reason}`}
                    variant="secondary"
                    className="max-w-full whitespace-normal rounded-md px-2 py-1 text-left [overflow-wrap:anywhere]"
                  >
                    {gap.label}: {gap.detail}
                  </Badge>
                ))}
              </div>
            </CardContent>
          ) : null}
        </Card>

        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-sm">Content Performance</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                {socialContent.windows.map((window) => (
                  <Badge
                    key={window.id}
                    variant={window.state === "ready" ? "outline" : "secondary"}
                    className="max-w-full whitespace-normal rounded-md px-2 py-1 text-left [overflow-wrap:anywhere]"
                  >
                    {window.detail}
                  </Badge>
                ))}
                <span className="text-xs text-muted-foreground">
                  {filteredItems.length} shown of {items.length}
                </span>
                <span className="text-xs text-muted-foreground">{socialContent.sourceLabel}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <DistributionContentRow key={item.content_id} item={item} />
              ))
            ) : (
              <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                No content items are available from {socialContent.sourceLabel}.{" "}
                {snapshot
                  ? `Loaded ${snapshot.snapshotDate || "unknown-date"} metrics with ${snapshot.contents.length} compiled content row${snapshot.contents.length === 1 ? "" : "s"}.`
                  : "No metrics snapshot is loaded for this project."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
