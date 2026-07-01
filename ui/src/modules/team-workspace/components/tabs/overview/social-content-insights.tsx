"use client";

import { ExternalLink, MessageCircle, MousePointerClick, Repeat2, ThumbsUp } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FarplaneProjectConfig, FarplaneRuntimeSource } from "../project-config";

type NullableNumber = number | null;

export type SocialContentMetrics = {
  views: NullableNumber;
  likes: NullableNumber;
  engagements: NullableNumber;
  comments: NullableNumber;
  shares: NullableNumber;
  saves: NullableNumber;
  profile_clicks: NullableNumber;
  url_clicks: NullableNumber;
  retention_score: NullableNumber;
};

export type SocialContentInsight = {
  platform: "x" | "instagram";
  content_id: string;
  url: string | null;
  published_at: string | null;
  kind: string;
  content_metrics: SocialContentMetrics;
  gaps: string[];
  source_metric_ids: string[];
};

export type SocialContentWindowSummary = {
  id: string;
  label: string;
  detail: string;
  state: "ready" | "empty" | "gap";
};

export type SocialContentInsightsModel = {
  items: SocialContentInsight[];
  windows: SocialContentWindowSummary[];
  sourceLabel: string;
};

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function metricText(value: NullableNumber): string {
  return typeof value === "number" && Number.isFinite(value) ? numberFormatter.format(value) : "-";
}

function formatPublishedAt(value: string | null): string {
  if (!value) return "time unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "time unknown" : dateFormatter.format(date);
}

function platformLabel(platform: SocialContentInsight["platform"]): string {
  return platform === "x" ? "X" : "Instagram";
}

function kindLabel(kind: string): string {
  return kind.replace(/_/g, " ");
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function parseContentMetrics(value: unknown): SocialContentMetrics {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    views: numberOrNull(row.views),
    likes: numberOrNull(row.likes),
    engagements: numberOrNull(row.engagements),
    comments: numberOrNull(row.comments),
    shares: numberOrNull(row.shares),
    saves: numberOrNull(row.saves),
    profile_clicks: numberOrNull(row.profile_clicks),
    url_clicks: numberOrNull(row.url_clicks),
    retention_score: numberOrNull(row.retention_score),
  };
}

export function parseSocialContentItems(value: unknown): SocialContentInsight[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): SocialContentInsight | null => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const platform = row.platform === "x" || row.platform === "instagram" ? row.platform : null;
      const contentId = stringOrNull(row.content_id);
      const kind = stringOrNull(row.kind);
      if (!platform || !contentId || !kind) return null;
      return {
        platform,
        content_id: contentId,
        url: stringOrNull(row.url),
        published_at: stringOrNull(row.published_at),
        kind,
        content_metrics: parseContentMetrics(row.content_metrics),
        gaps: stringArray(row.gaps),
        source_metric_ids: stringArray(row.source_metric_ids),
      };
    })
    .filter((entry): entry is SocialContentInsight => Boolean(entry));
}

function contentItemsFromRuntimeSource(source: FarplaneRuntimeSource): SocialContentInsight[] {
  const parsed = source.parsedJson;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  return parseSocialContentItems((parsed as Record<string, unknown>).content_items);
}

function windowSummaryFromRuntimeSource(source: FarplaneRuntimeSource): SocialContentWindowSummary {
  const items = contentItemsFromRuntimeSource(source);
  const exists = source.exists && !source.error;
  return {
    id: source.id,
    label: source.label,
    detail: exists
      ? `${items.length} selected content item${items.length === 1 ? "" : "s"}`
      : source.error || `${source.path} missing`,
    state: exists ? (items.length > 0 ? "ready" : "empty") : "gap",
  };
}

export function buildSocialContentInsightsModel(
  config: FarplaneProjectConfig | null,
): SocialContentInsightsModel {
  const socialSources =
    config?.runtimeSources.filter((source) => source.id.startsWith("social-")) ?? [];
  const existingSourceCount = socialSources.filter(
    (source) => source.exists && !source.error,
  ).length;
  const items = socialSources.flatMap(contentItemsFromRuntimeSource);
  return {
    items,
    windows: socialSources.map(windowSummaryFromRuntimeSource),
    sourceLabel:
      existingSourceCount > 0
        ? `${existingSourceCount}/${socialSources.length} project-local social file(s)`
        : "content_items not found in this project's local files",
  };
}

export function retentionLabel(item: SocialContentInsight): string {
  const retention = item.content_metrics.retention_score;
  if (typeof retention === "number" && Number.isFinite(retention)) {
    return `${numberFormatter.format(retention)} retention`;
  }
  return item.kind.toLowerCase() === "reels" ? "retention missing" : "retention n/a";
}

export function retentionGapLabel(item: SocialContentInsight): string | null {
  if (typeof item.content_metrics.retention_score === "number") return null;
  return item.kind.toLowerCase() === "reels"
    ? "Reel retention metric missing"
    : "Retention only applies to Reel review";
}

export function reviewCue(item: SocialContentInsight): string {
  const metrics = item.content_metrics;
  if ((metrics.comments ?? 0) > 0 && (metrics.likes ?? 0) === 0) return "Reply thread first";
  if ((metrics.views ?? 0) >= 1000 && (metrics.engagements ?? 0) >= 100)
    return "Inspect hook + CTA";
  if ((metrics.shares ?? 0) > 0 || (metrics.saves ?? 0) > 0) return "Reuse angle";
  return "Watch next window";
}

function MetricPill({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: NullableNumber;
  icon?: typeof ThumbsUp;
}): ReactElement | null {
  if (value === null) return null;
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-md border bg-background px-2 text-xs tabular-nums">
      {Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground" /> : null}
      <span className="font-medium">{metricText(value)}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function WindowBadge({ summary }: { summary: SocialContentWindowSummary }): ReactElement {
  const variant = summary.state === "ready" ? "outline" : "secondary";
  return (
    <Badge
      variant={variant}
      className="max-w-full whitespace-normal rounded-md px-2 py-1 text-left [overflow-wrap:anywhere]"
    >
      {summary.label}: {summary.detail}
    </Badge>
  );
}

function ContentInsightRow({ item }: { item: SocialContentInsight }): ReactElement {
  const retention = retentionLabel(item);
  const hasRetention = typeof item.content_metrics.retention_score === "number";
  const retentionGap = retentionGapLabel(item);
  const gaps = item.gaps.length > 0 ? item.gaps : retentionGap ? [retentionGap] : [];

  return (
    <div className="grid min-w-0 gap-3 rounded-md border bg-muted/20 p-3 xl:grid-cols-[minmax(13rem,0.8fr)_minmax(0,1.8fr)_minmax(9rem,0.7fr)]">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{platformLabel(item.platform)}</Badge>
          <Badge variant="secondary" className="capitalize">
            {kindLabel(item.kind)}
          </Badge>
        </div>
        <p className="break-all font-mono text-xs text-muted-foreground">{item.content_id}</p>
        <p className="text-xs text-muted-foreground">{formatPublishedAt(item.published_at)}</p>
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap gap-2">
          <MetricPill label="views" value={item.content_metrics.views} />
          <MetricPill label="likes" value={item.content_metrics.likes} icon={ThumbsUp} />
          <MetricPill label="eng" value={item.content_metrics.engagements} />
          <MetricPill label="comments" value={item.content_metrics.comments} icon={MessageCircle} />
          <MetricPill label="shares" value={item.content_metrics.shares} icon={Repeat2} />
          <MetricPill label="saves" value={item.content_metrics.saves} />
          <MetricPill
            label="profile clicks"
            value={item.content_metrics.profile_clicks}
            icon={MousePointerClick}
          />
          <MetricPill
            label="url clicks"
            value={item.content_metrics.url_clicks}
            icon={MousePointerClick}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={hasRetention ? "outline" : "secondary"}>{retention}</Badge>
          {gaps.map((gap) => (
            <Badge
              key={gap}
              variant="secondary"
              className="max-w-full whitespace-normal text-left [overflow-wrap:anywhere]"
            >
              gap: {gap}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-col justify-between gap-2">
        <Badge variant="outline" className="w-fit">
          {reviewCue(item)}
        </Badge>
        {item.url ? (
          <Button asChild variant="outline" size="sm" className="w-fit">
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Open
            </a>
          </Button>
        ) : (
          <Badge variant="secondary" className="w-fit">
            no url
          </Badge>
        )}
      </div>
    </div>
  );
}

export function SocialContentInsightsPanel({
  items,
  windows,
}: {
  items: SocialContentInsight[];
  windows: SocialContentWindowSummary[];
}): ReactElement {
  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Repeat2 className="h-4 w-4" />
            Content Insights
          </CardTitle>
          <span className="text-xs text-muted-foreground">latest social review items</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {windows.map((summary) => (
            <WindowBadge key={summary.id} summary={summary} />
          ))}
        </div>
        <div className="space-y-2">
          {items.length > 0 ? (
            items.map((item) => <ContentInsightRow key={item.content_id} item={item} />)
          ) : (
            <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
              No selected content items in this window.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
