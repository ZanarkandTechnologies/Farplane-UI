"use client";

/**
 * Distribution tab presentational components.
 * Renders controls, summary tiles, content rows, embeds, metric chips, and audit details.
 */

import { ExternalLink, Filter } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  retentionLabel,
  type SocialContentInsight,
} from "@/modules/team-workspace/lib/dashboard-projections/social-content-insights";
import {
  type DistributionFilter,
  displayMetricLabel,
  displayMetricValue,
  embedUrlForContent,
  fallbackMetricChips,
  filterLabel,
  formatPublishedAt,
  numberText,
  platformLabel,
  shortUrl,
  sortMetricChips,
  sortSeriesRows,
  type TimeframeFilter,
  timeframeLabel,
} from "./distribution-model";

export function DistributionContentRow({ item }: { item: SocialContentInsight }): ReactElement {
  const hasRetention = typeof item.content_metrics.retention_score === "number";
  const chips = sortMetricChips(
    item.metric_chips.length > 0 ? item.metric_chips : fallbackMetricChips(item),
  );
  return (
    <div className="grid min-w-0 gap-3 rounded-md border bg-muted/20 p-3 xl:grid-cols-[minmax(13rem,0.85fr)_minmax(0,1.35fr)_minmax(14rem,0.8fr)]">
      <div className="min-w-0 space-y-2">
        <ContentIdentity item={item} />
      </div>
      <div className="min-w-0 space-y-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 2xl:grid-cols-4">
          {chips.map((metric) => (
            <MetricCell
              key={metric.metricId}
              label={displayMetricLabel(metric.metricId, metric.label)}
              metricId={metric.metricId}
              unit={metric.unit}
              value={metric.current}
            />
          ))}
        </div>
        {item.series_rows.length > 0 ? (
          <div className="grid gap-1 rounded-md border bg-background/40 p-2 text-xs md:grid-cols-2">
            {sortSeriesRows(item.series_rows).map((row) => (
              <div
                key={`${row.metricId}:${row.date}:${row.value}`}
                className="flex min-w-0 items-center justify-between gap-2"
              >
                <span className="min-w-0 truncate text-muted-foreground">
                  {row.date} · {displayMetricLabel(row.metricId, row.label)}
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {displayMetricValue(row.metricId, row.value, row.unit)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="min-w-0 space-y-2">
        <ContentPreview item={item} />
        {hasRetention ? (
          <Badge variant="outline" className="w-fit">
            {retentionLabel(item)}
          </Badge>
        ) : null}
        {item.gaps.map((gap) => (
          <p
            key={gap}
            className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]"
          >
            gap: {gap}
          </p>
        ))}
        {item.url ? (
          <Button asChild variant="outline" size="sm" className="w-fit px-2">
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        ) : (
          <Badge variant="secondary">no url</Badge>
        )}
        {item.approval_ref ? (
          <details className="text-xs text-muted-foreground">
            <summary className="w-fit cursor-pointer select-none rounded-md border px-2 py-1">
              Audit
            </summary>
            <p className="mt-2 break-words [overflow-wrap:anywhere]">{item.approval_ref}</p>
          </details>
        ) : null}
      </div>
    </div>
  );
}

export function DistributionControls({
  filter,
  setFilter,
  setTimeframe,
  timeframe,
}: {
  filter: DistributionFilter;
  setFilter: (value: DistributionFilter) => void;
  setTimeframe: (value: TimeframeFilter) => void;
  timeframe: TimeframeFilter;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Filter className="h-4 w-4 text-muted-foreground" />
      <select
        className="h-8 rounded-md border bg-background px-2 text-xs"
        value={filter}
        onChange={(event) => setFilter(event.target.value as DistributionFilter)}
      >
        {(["all", "instagram", "x", "gaps"] as const).map((value) => (
          <option key={value} value={value}>
            {filterLabel(value)}
          </option>
        ))}
      </select>
      <select
        className="h-8 rounded-md border bg-background px-2 text-xs"
        value={timeframe}
        onChange={(event) => setTimeframe(event.target.value as TimeframeFilter)}
      >
        {(["month", "all"] as const).map((value) => (
          <option key={value} value={value}>
            {timeframeLabel(value)}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SummaryTile({
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

function ContentIdentity({ item }: { item: SocialContentInsight }): ReactElement {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{platformLabel(item.platform)}</Badge>
        <Badge variant="secondary" className="capitalize">
          {item.kind.replace(/_/g, " ")}
        </Badge>
        {item.status ? (
          <Badge variant={item.status === "posted" ? "outline" : "secondary"}>{item.status}</Badge>
        ) : null}
        {item.approval ? <Badge variant="outline">{item.approval}</Badge> : null}
      </div>
      {item.title ? (
        <p className="break-words text-sm font-medium [overflow-wrap:anywhere]">{item.title}</p>
      ) : null}
      <p className="break-all font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">
        {item.content_id}
      </p>
      {item.external_id ? (
        <p className="break-all font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {item.external_id}
        </p>
      ) : null}
      {item.url ? (
        <a
          className="block truncate text-xs text-primary underline-offset-4 hover:underline"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          title={item.url}
        >
          {shortUrl(item.url)}
        </a>
      ) : null}
      <p className="text-xs text-muted-foreground">{formatPublishedAt(item.published_at)}</p>
      {item.campaign ? (
        <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {item.campaign}
        </p>
      ) : null}
    </>
  );
}

function ContentPreview({ item }: { item: SocialContentInsight }): ReactElement | null {
  if (!item.url) return null;
  const embedUrl = embedUrlForContent(item);
  if (!embedUrl) {
    return (
      <a
        className="block truncate rounded-md border bg-background/50 px-2 py-2 text-xs text-primary underline-offset-4 hover:underline"
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        title={item.url}
      >
        {shortUrl(item.url)}
      </a>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border bg-background/50">
      <iframe
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        className="h-[22rem] w-full"
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
        src={embedUrl}
        title={item.title || item.content_id}
      />
    </div>
  );
}

function MetricCell({
  label,
  metricId,
  unit,
  value,
}: {
  label: string;
  metricId: string;
  unit: string;
  value: number | null;
}): ReactElement {
  return (
    <div className="rounded-md border bg-background/50 p-2">
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium tabular-nums">
        {displayMetricValue(metricId, value, unit)}
      </p>
    </div>
  );
}

export { numberText };
