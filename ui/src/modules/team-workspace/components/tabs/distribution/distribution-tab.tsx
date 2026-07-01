"use client";

/**
 * Team Workspace Distribution tab.
 * Inputs are the current social/content review fixture plus metrics snapshot
 * context. It stays read-only and does not schedule or fetch social providers.
 */

import { ExternalLink, Filter, Repeat2 } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MetricsUiSnapshot } from "../overview/goal-kpi-model";
import {
  retentionGapLabel,
  retentionLabel,
  reviewCue,
  type SocialContentInsight,
  type SocialContentInsightsModel,
} from "../overview/social-content-insights";

type DistributionFilter = "all" | "x" | "instagram" | "gaps";

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function DistributionTab({
  snapshot,
  socialContent,
}: {
  snapshot: MetricsUiSnapshot | null;
  socialContent: SocialContentInsightsModel;
}): ReactElement {
  const [filter, setFilter] = useState<DistributionFilter>("all");
  const items = socialContent.items;
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (filter === "all") return true;
        if (filter === "gaps") return item.gaps.length > 0 || Boolean(retentionGapLabel(item));
        return item.platform === filter;
      }),
    [filter, items],
  );
  const totals = buildDistributionTotals(items, snapshot);

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
              <span className="text-xs text-muted-foreground">
                {socialContent.sourceLabel}; aggregate KPI cockpit stays in Goals
              </span>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <SummaryTile label="Views" value={numberText(totals.views)} detail="selected content" />
            <SummaryTile
              label="Engagements"
              value={numberText(totals.engagements)}
              detail="likes, comments, shares, saves"
            />
            <SummaryTile label="Content" value={String(items.length)} detail="review items" />
            <SummaryTile label="Gaps" value={String(totals.gaps)} detail="retention/source gaps" />
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Filter className="h-4 w-4" />
                Filters
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                {socialContent.windows.map((window) => (
                  <Badge
                    key={window.id}
                    variant={window.state === "ready" ? "outline" : "secondary"}
                    className="max-w-full whitespace-normal rounded-md px-2 py-1 text-left [overflow-wrap:anywhere]"
                  >
                    {window.label}: {window.detail}
                  </Badge>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(["all", "x", "instagram", "gaps"] as const).map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={filter === value ? "default" : "outline"}
                  onClick={() => setFilter(value)}
                >
                  {filterLabel(value)}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-sm">Content Performance</CardTitle>
              <span className="text-xs text-muted-foreground">
                {filteredItems.length} shown of {items.length}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <DistributionContentRow key={item.content_id} item={item} />
              ))
            ) : (
              <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                No content items are available for this project/filter. Check the local social
                metrics files listed above.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

function DistributionContentRow({ item }: { item: SocialContentInsight }): ReactElement {
  const retentionGap = retentionGapLabel(item);
  const gaps = item.gaps.length > 0 ? item.gaps : retentionGap ? [retentionGap] : [];
  return (
    <div className="grid min-w-0 gap-3 rounded-md border bg-muted/20 p-3 xl:grid-cols-[minmax(11rem,0.7fr)_minmax(0,1.65fr)_minmax(9rem,0.55fr)]">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{item.platform === "x" ? "X" : "Instagram"}</Badge>
          <Badge variant="secondary" className="capitalize">
            {item.kind.replace(/_/g, " ")}
          </Badge>
        </div>
        <p className="break-all font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {item.content_id}
        </p>
        <p className="text-xs text-muted-foreground">{formatPublishedAt(item.published_at)}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        <MetricCell label="Views" value={item.content_metrics.views} />
        <MetricCell label="Likes" value={item.content_metrics.likes} />
        <MetricCell label="Eng." value={item.content_metrics.engagements} />
        <MetricCell label="Comments" value={item.content_metrics.comments} />
        <MetricCell label="Shares" value={item.content_metrics.shares} />
        <MetricCell label="Saves" value={item.content_metrics.saves} />
        <MetricCell label="Profile" value={item.content_metrics.profile_clicks} />
        <MetricCell label="URL" value={item.content_metrics.url_clicks} />
      </div>
      <div className="min-w-0 space-y-2">
        <Badge variant="outline" className="w-fit">
          {reviewCue(item)}
        </Badge>
        <Badge variant={retentionGap ? "secondary" : "outline"} className="w-fit">
          {retentionLabel(item)}
        </Badge>
        {gaps.map((gap) => (
          <p
            key={gap}
            className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]"
          >
            gap: {gap}
          </p>
        ))}
        {item.url ? (
          <Button asChild variant="outline" size="sm" className="w-fit">
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Open
            </a>
          </Button>
        ) : (
          <Badge variant="secondary">no url</Badge>
        )}
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}): ReactElement {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: number | null }): ReactElement {
  return (
    <div className="rounded-md border bg-background/50 p-2">
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium tabular-nums">{value === null ? "-" : numberText(value)}</p>
    </div>
  );
}

function buildDistributionTotals(
  items: SocialContentInsight[],
  snapshot: MetricsUiSnapshot | null,
): { views: number; engagements: number; gaps: number } {
  const itemViews = items.reduce((total, item) => total + (item.content_metrics.views ?? 0), 0);
  const snapshotViews =
    snapshot?.metrics
      .filter((metric) => /views|reach/i.test(metric.metricId))
      .reduce((total, metric) => total + (metric.current ?? 0), 0) ?? 0;
  const engagements = items.reduce(
    (total, item) =>
      total +
      (item.content_metrics.engagements ??
        (item.content_metrics.likes ?? 0) +
          (item.content_metrics.comments ?? 0) +
          (item.content_metrics.shares ?? 0) +
          (item.content_metrics.saves ?? 0)),
    0,
  );
  const gaps =
    items.reduce(
      (total, item) =>
        total +
        item.gaps.length +
        (item.content_metrics.retention_score === null && item.kind.toLowerCase() === "reels"
          ? 1
          : 0),
      0,
    ) +
    (snapshot?.sourceGaps.filter((gap) => /x_|instagram_|social/i.test(gap.metricId)).length ?? 0);
  return { views: itemViews || snapshotViews, engagements, gaps };
}

function filterLabel(value: DistributionFilter): string {
  if (value === "x") return "X";
  if (value === "instagram") return "Instagram";
  if (value === "gaps") return "Gaps only";
  return "All";
}

function formatPublishedAt(value: string | null): string {
  if (!value) return "time unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "time unknown" : dateFormatter.format(date);
}

function numberText(value: number): string {
  return numberFormatter.format(value);
}
