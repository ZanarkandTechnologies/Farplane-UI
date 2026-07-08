/**
 * Overview report presentation helpers.
 * Owns local formatting for interval report summaries and filesystem links.
 */

import type { OverviewReportLink } from "@/modules/team-workspace/lib/dashboard-projections/overview-surface";

export function reportFileName(report: OverviewReportLink): string {
  const path = report.path || report.href || report.ref || report.id;
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? report.id;
}

export function reportSummaryRows(report: OverviewReportLink): string[] {
  if (report.summaryRows?.length) return report.summaryRows;
  const summary = report.summary?.trim();
  if (!summary) return ["Open the report to review the full interval notes."];
  return [summary];
}

export function formatReportDate(report: OverviewReportLink): string {
  const value = report.createdAt ?? report.frontMatter?.created_at;
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString(undefined, {
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        month: "short",
      });
    }
    return value;
  }
  if (report.updatedAtMs) {
    return new Date(report.updatedAtMs).toLocaleString(undefined, {
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      month: "short",
    });
  }
  return report.intervalId?.replace(/[_-]+/g, " ") ?? "report";
}

export function pathToFileHref(path: string): string {
  return path.startsWith("file://")
    ? path
    : `file://${path.split("/").map(encodeURIComponent).join("/")}`;
}
