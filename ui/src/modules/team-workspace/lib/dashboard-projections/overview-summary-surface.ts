/**
 * Overview summary surface builder.
 * Converts project config and metrics snapshots into the same OverviewSurface
 * shape used by the compiled dashboard projection when that projection is absent.
 */

import type {
  FarplaneProjectConfig,
  FarplaneRuntimeReport,
} from "@/modules/team-workspace/lib/project-config";
import { findMetricsSnapshot } from "./goal-kpi-model";
import type { OverviewReportLink, OverviewSurface } from "./overview-surface";
import { buildSocialContentInsightsModel } from "./social-content-insights";

function numberText(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function pathToFileHref(path: string): string {
  return `file://${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function buildOverviewSummarySurface({
  projectConfig,
  aiBurn24hUsd,
  aiUsageUnavailableText,
}: {
  projectConfig: FarplaneProjectConfig | null;
  aiBurn24hUsd: number;
  aiUsageUnavailableText?: string | null;
}): OverviewSurface {
  const metricsSnapshot = findMetricsSnapshot(projectConfig);
  const socialContent = buildSocialContentInsightsModel(projectConfig, metricsSnapshot);
  const availableMetricCount =
    metricsSnapshot?.metrics.filter((metric) => metric.status === "available").length ?? 0;
  const actionableSourceGaps = metricsSnapshot ? visibleOverviewSourceGaps(metricsSnapshot) : [];
  const sourceGapCount = metricsSnapshot ? actionableSourceGaps.length : 0;
  const distributionViews = socialContent.items.reduce(
    (total, item) => total + (item.content_metrics.views ?? 0),
    0,
  );
  const distributionGaps = socialContent.items.reduce(
    (total, item) => total + item.gaps.length,
    0,
  );
  const latestDailyDiff = metricsSnapshot?.metrics
    .flatMap((metric) => metric.series.slice(-1).map((point) => point.dailyDiff))
    .filter((value): value is number => typeof value === "number")
    .reduce((total, value) => total + value, 0);
  const reportsSource = projectConfig?.runtimeSources.find((source) => source.id === "reports");
  const reportBaseHref = reportsSource?.absolutePath
    ? pathToFileHref(reportsSource.absolutePath)
    : null;
  const reportLinks = reportsSource ? reportLinksFromRuntimeReports(reportsSource.reports) : [];
  const openGaps = [
    ...actionableSourceGaps.slice(0, 4).map((gap) => ({
      id: `gap:${gap.metricId}`,
      title: gap.label,
      reason: gap.detail,
    })),
    ...socialContent.items
      .flatMap((item) =>
        item.gaps.map((gap) => ({
          id: `gap:${item.content_id}:${gap}`,
          title: `${item.platform} ${item.kind}`,
          reason: gap,
        })),
      )
      .slice(0, 2),
  ];

  return {
    generatedAt: projectConfig ? new Date(projectConfig.generatedAtMs).toISOString() : "",
    projectId: projectConfig?.projectPath ?? "unknown",
    pins: [
      {
        id: "goal_health",
        label: "Goal Health",
        value: metricsSnapshot ? `${availableMetricCount} live` : "missing",
        detail:
          sourceGapCount > 0
            ? `${sourceGapCount} source gap${sourceGapCount === 1 ? "" : "s"}`
            : "no metric source gaps",
        target: "strategy contract",
        provider: metricsSnapshot ? "latest.json" : "provider_missing",
        status: metricsSnapshot ? "available" : "missing",
        priority: 1,
        cardKind: "status",
      },
      {
        id: "today_move",
        label: "Today Move",
        value:
          typeof latestDailyDiff === "number"
            ? `${latestDailyDiff >= 0 ? "+" : ""}${numberText(latestDailyDiff)}`
            : "n/a",
        detail: "sum of latest daily KPI diffs",
        target: "daily motion",
        provider: metricsSnapshot ? "series.daily_diff" : "provider_missing",
        status: metricsSnapshot ? "available" : "missing",
        priority: 2,
        cardKind: "trend",
      },
      {
        id: "distribution",
        label: "Distribution",
        value: numberText(distributionViews),
        detail: `${socialContent.items.length} selected content item(s), ${distributionGaps} gap(s)`,
        target: "content reach",
        provider: socialContent.sourceLabel,
        status: socialContent.items.length > 0 ? "available" : "source_gap",
        priority: 3,
        cardKind: "number",
      },
      {
        id: "ai_burn_24h",
        label: "AI Burn 24h",
        value: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
          aiBurn24hUsd,
        ),
        detail: aiUsageUnavailableText ?? "runtime usage",
        target: "operator cost",
        provider: aiUsageUnavailableText ? "usage_unavailable" : "runtime usage",
        status: aiUsageUnavailableText ? "source_gap" : "available",
        priority: 4,
        cardKind: "cost",
      },
    ],
    attention: openGaps.map((gap) => ({
      id: gap.id,
      kind: "gap",
      title: gap.title,
      attentionReason: gap.reason,
      owner: "system",
    })),
    reports:
      reportLinks.length > 0
        ? reportLinks
        : reportBaseHref
          ? [
              {
                id: "daily-report",
                label: "Daily report",
                path: `${reportsSource?.absolutePath ?? ""}/interval/daily_interval`,
                href: `${reportBaseHref}/interval/daily_interval`,
                updatedAtMs: reportsSource?.updatedAtMs ?? null,
              },
              {
                id: "weekly-report",
                label: "Weekly report",
                path: `${reportsSource?.absolutePath ?? ""}/interval/weekly_interval`,
                href: `${reportBaseHref}/interval/weekly_interval`,
                updatedAtMs: reportsSource?.updatedAtMs ?? null,
              },
            ]
          : [],
    sources:
      projectConfig?.runtimeSources.map((source) => ({
        id: source.id,
        label: source.label,
        path: source.path,
        exists: source.exists,
        updatedAtMs: source.updatedAtMs,
      })) ?? [],
  };
}

function reportLinksFromRuntimeReports(
  reports: FarplaneRuntimeReport[] | undefined,
): OverviewReportLink[] {
  if (!Array.isArray(reports)) return [];
  return reports
    .filter((report) => report.path.trim().length > 0)
    .map((report) => ({
      id: report.id,
      label: report.label,
      path: report.absolutePath || report.path,
      href: pathToFileHref(report.absolutePath || report.path),
      summary: report.summary,
      summaryRows: report.summaryRows,
      content: report.content,
      intervalId: report.intervalId,
      createdAt: report.createdAt,
      frontMatter: report.frontMatter,
      updatedAtMs: report.updatedAtMs,
    }));
}

function visibleOverviewSourceGaps(
  snapshot: NonNullable<ReturnType<typeof findMetricsSnapshot>>,
): Array<{ detail: string; label: string; metricId: string }> {
  const hasReach = hasAvailableMetric(snapshot, /(?:^|_)reach$/i);
  const hasWatchTime = hasAvailableMetric(snapshot, /(?:avg|total)_watch_time/i);
  return snapshot.sourceGaps
    .filter((gap) => {
      if (gap.metricId === "evidence_distribution_reach" && hasReach) return false;
      if (gap.metricId === "instagram_retention_score" && hasWatchTime) return false;
      return true;
    })
    .map((gap) => ({
      metricId: gap.metricId,
      ...sourceGapCopy(gap.metricId, gap.reason || "not connected yet"),
    }));
}

function hasAvailableMetric(
  snapshot: NonNullable<ReturnType<typeof findMetricsSnapshot>>,
  pattern: RegExp,
): boolean {
  return snapshot.metrics.some(
    (metric) =>
      pattern.test(metric.metricId) &&
      metric.status === "available" &&
      typeof metric.current === "number",
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
  return { label: metricId.replace(/[_-]+/g, " "), detail: reason };
}
