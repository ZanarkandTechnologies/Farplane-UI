/**
 * Distribution tab projection helpers.
 * Owns filter windows, metric formatting, source-gap copy, and embed URL derivation.
 */

import type { MetricsUiSnapshot } from "@/modules/team-workspace/lib/dashboard-projections/goal-kpi-model";
import type { SocialContentInsight } from "@/modules/team-workspace/lib/dashboard-projections/social-content-insights";

export type DistributionFilter = "all" | "x" | "instagram" | "gaps";
export type TimeframeFilter = "month" | "all";

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function fallbackMetricChips(
  item: SocialContentInsight,
): SocialContentInsight["metric_chips"] {
  return [
    metricChip("views", "Views", item.content_metrics.views),
    metricChip("likes", "Likes", item.content_metrics.likes),
    metricChip("engagements", "Eng.", item.content_metrics.engagements),
    metricChip("comments", "Comments", item.content_metrics.comments),
    metricChip("shares", "Shares", item.content_metrics.shares),
    metricChip("saves", "Saves", item.content_metrics.saves),
    metricChip("profile_clicks", "Profile", item.content_metrics.profile_clicks),
    metricChip("url_clicks", "URL", item.content_metrics.url_clicks),
  ];
}

function metricChip(
  metricId: string,
  label: string,
  current: number | null,
): SocialContentInsight["metric_chips"][number] {
  return { metricId, label, unit: "", product: "distribution", current };
}

export function sortMetricChips(
  chips: SocialContentInsight["metric_chips"],
): SocialContentInsight["metric_chips"] {
  return [...chips].sort((left, right) => {
    const leftPriority = metricChipPriority(left.metricId);
    const rightPriority = metricChipPriority(right.metricId);
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return left.label.localeCompare(right.label);
  });
}

export function sortSeriesRows(
  rows: SocialContentInsight["series_rows"],
): SocialContentInsight["series_rows"] {
  return [...rows].sort((left, right) => {
    const dateOrder = left.date.localeCompare(right.date);
    if (dateOrder !== 0) return dateOrder;
    const leftPriority = metricChipPriority(left.metricId);
    const rightPriority = metricChipPriority(right.metricId);
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return left.label.localeCompare(right.label);
  });
}

function metricChipPriority(metricId: string): number {
  if (/views/i.test(metricId)) return 10;
  if (/reach|impressions/i.test(metricId)) return 20;
  if (/avg_watch_time/i.test(metricId)) return 30;
  if (/total_watch_time/i.test(metricId)) return 35;
  if (/total_interactions|engagement/i.test(metricId)) return 40;
  if (/likes/i.test(metricId)) return 40;
  if (/comments|replies/i.test(metricId)) return 50;
  if (/shares|reposts/i.test(metricId)) return 60;
  if (/saves|bookmarks/i.test(metricId)) return 70;
  if (/retention/i.test(metricId)) return 80;
  return 100;
}

export function displayMetricLabel(metricId: string, label: string): string {
  if (/avg_watch_time/i.test(metricId)) return "Avg watch";
  if (/total_watch_time/i.test(metricId)) return "Total watch";
  return label.replace(/^Instagram\s+/i, "");
}

export function displayMetricValue(metricId: string, value: number | null, unit: string): string {
  if (value === null) return "-";
  if (/watch_time/i.test(metricId) || unit === "milliseconds") return durationText(value);
  return unit ? `${numberText(value)} ${unit}` : numberText(value);
}

function durationText(milliseconds: number): string {
  if (!Number.isFinite(milliseconds)) return "-";
  const seconds = milliseconds / 1000;
  if (seconds < 60) return `${numberFormatter.format(seconds)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${numberFormatter.format(minutes)}m`;
  return `${numberFormatter.format(minutes / 60)}h`;
}

export function buildDistributionTotals(
  items: SocialContentInsight[],
  snapshot: MetricsUiSnapshot | null,
): { views: number; engagements: number } {
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
  return { views: itemViews || snapshotViews, engagements };
}

export function metricCurrent(snapshot: MetricsUiSnapshot | null, metricId: string): number | null {
  return snapshot?.metrics.find((metric) => metric.metricId === metricId)?.current ?? null;
}

export function distributionSourceGaps(
  snapshot: MetricsUiSnapshot | null,
): Array<{ detail: string; label: string; metricId: string; reason: string }> {
  const hasReach = hasAvailableMetric(snapshot, /(?:^|_)reach$/i);
  const hasWatchTime = hasAvailableMetric(snapshot, /(?:avg|total)_watch_time/i);
  return (snapshot?.sourceGaps ?? [])
    .filter((gap) =>
      /distribution|content|ledger|evidence_distribution_reach|instagram_retention_score/i.test(
        `${gap.metricId} ${gap.sourceId} ${gap.reason}`,
      ),
    )
    .filter((gap) => {
      if (gap.metricId === "evidence_distribution_reach" && hasReach) return false;
      if (gap.metricId === "instagram_retention_score" && hasWatchTime) return false;
      return true;
    })
    .map((gap) => ({
      metricId: gap.metricId,
      reason: gap.reason || "source gap",
      ...sourceGapCopy(gap.metricId, gap.reason || "source gap"),
    }));
}

function hasAvailableMetric(snapshot: MetricsUiSnapshot | null, pattern: RegExp): boolean {
  return (
    snapshot?.metrics.some(
      (metric) =>
        pattern.test(metric.metricId) &&
        metric.status === "available" &&
        typeof metric.current === "number",
    ) ?? false
  );
}

function sourceGapCopy(metricId: string, reason: string): { detail: string; label: string } {
  if (metricId === "instagram_retention_score") {
    if (reason === "instagram_retention_score_requires_duration_seconds") {
      return { label: "Retention score", detail: "add reel duration to normalize watch time" };
    }
    return { label: "Retention score", detail: "watch-time source unavailable" };
  }
  if (metricId === "evidence_distribution_reach") {
    return { label: "Distribution evidence reach", detail: "no reach observation yet" };
  }
  return { label: displayMetricLabel(metricId, metricId), detail: reason };
}

export function sortContentItems(items: SocialContentInsight[]): SocialContentInsight[] {
  return [...items].sort((left, right) => {
    const leftPosted = left.status === "posted" ? 1 : 0;
    const rightPosted = right.status === "posted" ? 1 : 0;
    if (leftPosted !== rightPosted) return rightPosted - leftPosted;
    return contentTime(right) - contentTime(left);
  });
}

function contentTime(item: SocialContentInsight): number {
  const date = item.published_at ? new Date(item.published_at) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

export function filterLabel(value: DistributionFilter): string {
  if (value === "x") return "X";
  if (value === "instagram") return "Instagram";
  if (value === "gaps") return "Gaps only";
  return "All";
}

export function timeframeLabel(value: TimeframeFilter): string {
  return value === "month" ? "1 month" : "All time";
}

export function platformLabel(value: SocialContentInsight["platform"]): string {
  if (value === "x") return "X";
  if (value === "instagram") return "Instagram";
  return "Unknown";
}

export function formatPublishedAt(value: string | null): string {
  if (!value) return "time unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "time unknown" : dateFormatter.format(date);
}

export function shortUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return value;
  }
}

export function embedUrlForContent(item: SocialContentInsight): string | null {
  if (item.platform === "instagram") return instagramEmbedUrl(item.url);
  return null;
}

function instagramEmbedUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    const type = parts[0];
    const shortcode = parts[1];
    if ((type === "p" || type === "reel" || type === "tv") && shortcode) {
      return `https://www.instagram.com/${type}/${shortcode}/embed`;
    }
  } catch {
    return null;
  }
  return null;
}

export function buildTimeframeWindow(snapshotDate?: string): { start: Date; end: Date } | null {
  if (!snapshotDate) return null;
  const end = new Date(`${snapshotDate}T23:59:59Z`);
  if (Number.isNaN(end.getTime())) return null;
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - 1);
  return { start, end };
}

function dateFromIsoDate(value: string): Date | null {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isInTimeframe(
  item: SocialContentInsight,
  timeframe: TimeframeFilter,
  window: { start: Date; end: Date } | null,
): boolean {
  if (timeframe === "all" || !window) return true;
  const dates = [item.published_at, ...item.series_rows.map((row) => row.date)]
    .filter((value): value is string => Boolean(value))
    .map(dateFromIsoDate)
    .filter((date): date is Date => Boolean(date));
  if (dates.length === 0) return true;
  return dates.some((date) => date >= window.start && date <= window.end);
}

export function numberText(value: number | null): string {
  return value === null ? "-" : numberFormatter.format(value);
}
