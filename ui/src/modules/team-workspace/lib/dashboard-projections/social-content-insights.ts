/**
 * Social content projection model.
 * Owns pure parsing and derived review cues for project-local social metric
 * sources; React presentation stays under Team Workspace components.
 */

import type {
  FarplaneProjectConfig,
  FarplaneRuntimeSource,
} from "@/modules/team-workspace/lib/project-config";
import type { ContentMetricRow, MetricsUiSnapshot } from "./goal-kpi-model";

type NullableNumber = number | null;
export type SocialPlatform = "x" | "instagram" | "unknown";

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

export type SocialContentMetricChip = {
  metricId: string;
  label: string;
  unit: string;
  product: string;
  current: NullableNumber;
};

export type SocialContentSeriesRow = {
  metricId: string;
  label: string;
  unit: string;
  date: string;
  value: NullableNumber;
};

export type SocialContentInsight = {
  platform: SocialPlatform;
  content_id: string;
  approval?: string;
  approval_ref?: string;
  campaign?: string;
  external_id?: string;
  kpis: string[];
  url: string | null;
  published_at: string | null;
  kind: string;
  media_product_type?: string;
  media_type?: string;
  status?: string;
  title?: string;
  content_metrics: SocialContentMetrics;
  metric_chips: SocialContentMetricChip[];
  series_rows: SocialContentSeriesRow[];
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

function platformFromContentId(contentId: string): SocialPlatform {
  const prefix = contentId.split(":")[0]?.toLowerCase();
  if (prefix === "x" || prefix === "instagram") return prefix;
  return "unknown";
}

function platformFromUnknown(value: unknown, contentId: string): SocialPlatform {
  return value === "x" || value === "instagram" ? value : platformFromContentId(contentId);
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

function metricValue(metric: ContentMetricRow): number | null {
  return metric.current ?? metric.series.at(-1)?.value ?? null;
}

function contentMetricKey(metricId: string): keyof SocialContentMetrics | null {
  if (/views|reach|impressions/i.test(metricId)) return "views";
  if (/likes/i.test(metricId)) return "likes";
  if (/engagement|total_interactions|interactions/i.test(metricId)) return "engagements";
  if (/comments|replies/i.test(metricId)) return "comments";
  if (/shares|reposts/i.test(metricId)) return "shares";
  if (/saves|bookmarks/i.test(metricId)) return "saves";
  if (/profile.*click/i.test(metricId)) return "profile_clicks";
  if (/url.*click|link.*click/i.test(metricId)) return "url_clicks";
  if (/retention/i.test(metricId)) return "retention_score";
  return null;
}

function emptyContentMetrics(): SocialContentMetrics {
  return {
    views: null,
    likes: null,
    engagements: null,
    comments: null,
    shares: null,
    saves: null,
    profile_clicks: null,
    url_clicks: null,
    retention_score: null,
  };
}

function contentMetricsFromSnapshotMetrics(metrics: ContentMetricRow[]): SocialContentMetrics {
  const values = emptyContentMetrics();
  for (const metric of metrics) {
    const key = contentMetricKey(metric.metricId);
    if (!key) continue;
    values[key] = metricValue(metric);
  }
  return values;
}

function metricChipsFromSnapshotMetrics(metrics: ContentMetricRow[]): SocialContentMetricChip[] {
  return metrics.map((metric) => ({
    metricId: metric.metricId,
    label: metric.label,
    unit: metric.unit,
    product: metric.product,
    current: metricValue(metric),
  }));
}

function seriesRowsFromSnapshotMetrics(metrics: ContentMetricRow[]): SocialContentSeriesRow[] {
  return metrics.flatMap((metric) =>
    metric.series.map((point) => ({
      metricId: metric.metricId,
      label: metric.label,
      unit: metric.unit,
      date: point.date,
      value: point.value,
    })),
  );
}

function kindFromContent({
  contentId,
  mediaProductType,
  url,
}: {
  contentId: string;
  mediaProductType?: string;
  url: string | null;
}): string {
  if (mediaProductType?.toUpperCase() === "REELS") return "reels";
  if (url?.includes("/reel/")) return "reel";
  if (url?.includes("/p/")) return "post";
  return contentId.includes(":") ? "content" : "item";
}

export function parseSocialContentItems(value: unknown): SocialContentInsight[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): SocialContentInsight | null => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const contentId = stringOrNull(row.content_id);
      if (!contentId) return null;
      const mediaProductType = stringOrNull(row.media_product_type) ?? undefined;
      const kind =
        stringOrNull(row.kind) ??
        kindFromContent({ contentId, mediaProductType, url: stringOrNull(row.url) });
      return {
        platform: platformFromUnknown(row.platform, contentId),
        content_id: contentId,
        approval: stringOrNull(row.approval) ?? undefined,
        approval_ref: stringOrNull(row.approval_ref) ?? undefined,
        campaign: stringOrNull(row.campaign) ?? undefined,
        external_id: stringOrNull(row.external_id) ?? undefined,
        kpis: stringArray(row.kpis),
        url: stringOrNull(row.url),
        published_at: stringOrNull(row.published_at),
        kind,
        media_product_type: mediaProductType,
        media_type: stringOrNull(row.media_type) ?? undefined,
        status: stringOrNull(row.status) ?? undefined,
        title: stringOrNull(row.title) ?? undefined,
        content_metrics: parseContentMetrics(row.content_metrics),
        metric_chips: [],
        series_rows: [],
        gaps: stringArray(row.gaps),
        source_metric_ids: stringArray(row.source_metric_ids),
      };
    })
    .filter((entry): entry is SocialContentInsight => Boolean(entry));
}

export function parseSocialContentFromMetricsSnapshot(
  snapshot: MetricsUiSnapshot | null,
): SocialContentInsight[] {
  return (snapshot?.contents ?? []).map((content) => ({
    platform: platformFromUnknown(content.platform, content.contentId),
    content_id: content.contentId,
    approval: content.approval,
    approval_ref: content.approvalRef,
    campaign: content.campaign,
    external_id: content.externalId,
    kpis: content.kpis,
    url: content.url,
    published_at: content.publishedAt ?? null,
    kind:
      content.kind ??
      kindFromContent({
        contentId: content.contentId,
        mediaProductType: content.mediaProductType,
        url: content.url,
      }),
    media_product_type: content.mediaProductType,
    media_type: content.mediaType,
    status: content.status,
    title: content.title,
    content_metrics: contentMetricsFromSnapshotMetrics(content.metrics),
    metric_chips: metricChipsFromSnapshotMetrics(content.metrics),
    series_rows: seriesRowsFromSnapshotMetrics(content.metrics),
    gaps: [],
    source_metric_ids: content.metrics.map((metric) => metric.metricId),
  }));
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
  snapshot: MetricsUiSnapshot | null = null,
): SocialContentInsightsModel {
  const snapshotItems = parseSocialContentFromMetricsSnapshot(snapshot);
  if (snapshotItems.length > 0) {
    return {
      items: snapshotItems,
      windows: [
        {
          id: "metrics-ui-contents",
          label: "Compiled content",
          detail: `${snapshotItems.length} content item${snapshotItems.length === 1 ? "" : "s"}`,
          state: "ready",
        },
      ],
      sourceLabel: "content metrics",
    };
  }
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
  return "retention unavailable";
}

export function isReelContent(item: SocialContentInsight): boolean {
  return (
    item.media_product_type?.toUpperCase() === "REELS" ||
    /^reels?$/i.test(item.kind) ||
    Boolean(item.url?.includes("/reel/"))
  );
}
