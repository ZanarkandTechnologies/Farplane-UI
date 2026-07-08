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
import {
  findProjectUiSnapshot,
  type ProjectUiMetricCard,
  type ProjectUiMetricTarget,
  sourceGapText,
} from "./project-ui-snapshot";
import { buildSocialContentInsightsModel } from "./social-content-insights";

function numberText(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function pathToFileHref(path: string): string {
  return `file://${path.split("/").map(encodeURIComponent).join("/")}`;
}

function targetText(target: ProjectUiMetricTarget | number | string | null): string {
  if (typeof target === "number") return numberText(target);
  if (typeof target === "string" && target.trim()) return target;
  if (!target || typeof target !== "object") return "target pending";
  const value =
    typeof target.value === "number"
      ? numberText(target.value)
      : typeof target.value === "string"
        ? target.value
        : target.label;
  return (
    [target.direction, value, target.unit, target.deadline ? `by ${target.deadline}` : ""]
      .filter(Boolean)
      .join(" ") || "target pending"
  );
}

function metricCardValue(metric: ProjectUiMetricCard): string {
  if (typeof metric.current === "number") return numberText(metric.current);
  const latest = metric.series.at(-1);
  if (typeof latest?.current === "number") return numberText(latest.current);
  if (typeof latest?.value === "number") return numberText(latest.value);
  if (
    metric.status === "source_gap" ||
    metric.sourceGaps.length > 0 ||
    metric.sourceGapIds.length > 0
  ) {
    return "waiting";
  }
  return metric.status === "available" ? "n/a" : "missing";
}

function metricCardProvider(metric: ProjectUiMetricCard): string {
  if (metric.sourceGapIds.length > 0 || metric.sourceGaps.length > 0) return "source gap";
  return metric.primitiveId || "project snapshot";
}

function metricSourceGapDetail(metric: ProjectUiMetricCard): string | null {
  const gap = metric.sourceGaps[0];
  if (gap) {
    if (gap.reason === "no_component_view_observations" && gap.missingComponents.length > 0) {
      return `Needs same-day views from ${componentList(gap.missingComponents)}.`;
    }
    const missing = gap.missingComponents.length
      ? `missing ${componentList(gap.missingComponents)}`
      : "";
    return [gap.reason, missing].filter(Boolean).join(" · ");
  }
  if (metric.sourceGapIds.length > 0) {
    return `${metric.sourceGapIds.length} source gap${metric.sourceGapIds.length === 1 ? "" : "s"}`;
  }
  return null;
}

function componentList(components: string[]): string {
  const labels = components.map((component) =>
    component === "github_views"
      ? "GitHub"
      : component
          .replace(/_views$/i, "")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (letter) => letter.toUpperCase()),
  );
  if (labels.length <= 1) return labels.join("");
  if (labels.length === 2) return labels.join(" and ");
  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
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
  const projectUiSnapshot = findProjectUiSnapshot(projectConfig);
  const pinnedMetricIds = new Set(projectUiSnapshot?.tabs.overview.pinnedMetrics ?? []);
  const projectUiPinnedCards = projectUiSnapshot?.tabs.overview.pinnedMetricCards.length
    ? projectUiSnapshot.tabs.overview.pinnedMetricCards
    : (projectUiSnapshot?.metrics.series.filter(
        (metric) => metric.pinned || pinnedMetricIds.has(metric.metricId),
      ) ?? []);
  const projectUiGaps = sourceGapText(
    projectUiSnapshot,
    projectUiSnapshot?.tabs.overview.sourceGapIds ?? [],
  );
  const teamFocus = projectUiSnapshot?.tabs.overview.teamFocus;
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
  const distributionGaps = socialContent.items.reduce((total, item) => total + item.gaps.length, 0);
  const latestDailyDiff = metricsSnapshot?.metrics
    .flatMap((metric) => metric.series.slice(-1).map((point) => point.dailyDiff))
    .filter((value): value is number => typeof value === "number")
    .reduce((total, value) => total + value, 0);
  const reportsSource = projectConfig?.runtimeSources.find((source) => source.id === "reports");
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
    generatedAt:
      projectUiSnapshot?.generatedAt ??
      (projectConfig ? new Date(projectConfig.generatedAtMs).toISOString() : ""),
    projectId: projectUiSnapshot?.projectRoot ?? projectConfig?.projectPath ?? "unknown",
    pins:
      projectUiPinnedCards.length > 0
        ? projectUiPinnedCards.slice(0, 4).map((metric, index) => ({
            id: metric.metricId,
            label: metric.label,
            value: metricCardValue(metric),
            description: metric.description,
            detail: metricSourceGapDetail(metric) ?? `target ${targetText(metric.target)}`,
            target: metric.productId || targetText(metric.target),
            provider: metricCardProvider(metric),
            status:
              metric.status === "available" || metric.status === "source_gap"
                ? metric.status
                : "missing",
            priority: index + 1,
            cardKind: "number",
          }))
        : [
            {
              id: "goal_health",
              label: "Goal Health",
              value: metricsSnapshot ? `${availableMetricCount} live` : "missing",
              detail:
                sourceGapCount > 0
                  ? `${sourceGapCount} source gap${sourceGapCount === 1 ? "" : "s"}`
                  : "no metric source gaps",
              target: "strategy contract",
              provider: metricsSnapshot ? "project snapshot" : "provider_missing",
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
              provider: metricsSnapshot ? "metrics.series" : "provider_missing",
              status: metricsSnapshot ? "available" : "missing",
              priority: 2,
              cardKind: "trend",
            },
            {
              id: "distribution",
              label: "Distribution",
              value: numberText(distributionViews),
              detail: `${socialContent.items.length} content item(s), ${distributionGaps} gap(s)`,
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
    attention: [
      ...projectUiGaps.map((gap) => ({
        id: gap.id,
        kind: "gap" as const,
        title: gap.owner,
        attentionReason: gap.path ? `${gap.message} | ${gap.path}` : gap.message,
        owner: "system" as const,
      })),
      ...(teamFocus?.blockers ?? []).map((blocker) => ({
        id: `team-focus:${blocker}`,
        kind: "human_action" as const,
        title: "Team focus blocker",
        attentionReason: blocker,
        owner: "system" as const,
      })),
      ...openGaps.map((gap) => ({
        id: gap.id,
        kind: "gap" as const,
        title: gap.title,
        attentionReason: gap.reason,
        owner: "system" as const,
      })),
    ],
    reports: latestOverviewPinnedReports(reportLinks),
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

export function reportLinksFromRuntimeReports(
  reports: FarplaneRuntimeReport[] | undefined,
): OverviewReportLink[] {
  if (!Array.isArray(reports)) return [];
  return reports
    .filter((report) => report.path.trim().length > 0)
    .map((report) => ({
      id: report.id,
      ref: report.ref,
      parentRef: report.parentRef,
      childRefs: report.childRefs,
      ancestorRefs: report.ancestorRefs,
      groupRef: report.groupRef,
      depth: report.depth,
      label: report.label,
      kind: report.kind,
      path: report.absolutePath || report.path,
      href: report.href ?? pathToFileHref(report.absolutePath || report.path),
      summary: report.summary,
      summaryRows: report.summaryRows,
      content: report.content,
      intervalId: report.intervalId,
      createdAt: report.createdAt,
      frontMatter: report.frontMatter,
      updatedAtMs: report.updatedAtMs,
    }));
}

export function latestOverviewPinnedReports(reports: OverviewReportLink[]): OverviewReportLink[] {
  const pinnedCadences = ["daily_interval", "weekly_interval"];
  return pinnedCadences
    .map((cadence) => reports.find((report) => reportCadence(report) === cadence) ?? null)
    .filter((report): report is OverviewReportLink => Boolean(report));
}

export function reportCadence(report: OverviewReportLink): string | null {
  const source = [report.intervalId, report.ref, report.groupRef, report.path, report.id]
    .filter(Boolean)
    .join("/");
  if (source.includes("daily_interval")) return "daily_interval";
  if (source.includes("weekly_interval")) return "weekly_interval";
  return null;
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
