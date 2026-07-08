/**
 * Report-to-timeline helpers.
 * Owns ref/path matching and conversion of registry report rows into timeline events.
 */

import type { TeamTimelineRow } from "@/modules/team-workspace/components/team-timeline";
import type { FarplaneRuntimeReport } from "@/modules/team-workspace/lib/project-config";
import {
  DEFAULT_TIMELINE_REPORT_PATTERNS,
  type TimelineReportPatternConfig,
} from "./timeline-page-types";

function escapeRegex(value: string): string {
  return value.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

function patternToRegex(pattern: string): RegExp {
  const source = pattern.split("*").map(escapeRegex).join("[^/]*");
  return new RegExp(`^${source}$`);
}

function matchesAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => patternToRegex(pattern).test(value));
}

function reportPatternCandidates(report: Pick<FarplaneRuntimeReport, "path" | "ref">): string[] {
  const candidates = new Set<string>();
  if (report.ref) {
    candidates.add(report.ref);
    candidates.add(report.ref.endsWith(".md") ? report.ref : `${report.ref}.md`);
  }
  if (report.path) {
    candidates.add(report.path);
    candidates.add(report.path.replace(/^\.farplane\//, ""));
  }
  return [...candidates].filter(Boolean);
}

export function reportMatchesTimelinePatterns(
  report: Pick<FarplaneRuntimeReport, "path" | "ref">,
  config: TimelineReportPatternConfig = DEFAULT_TIMELINE_REPORT_PATTERNS,
): boolean {
  const candidates = reportPatternCandidates(report);
  if (!candidates.length) return false;
  const included =
    config.include.length === 0 || candidates.some((value) => matchesAny(value, config.include));
  if (!included) return false;
  return !candidates.some((value) => matchesAny(value, config.exclude));
}

export function reportToTimelineRow(
  report: FarplaneRuntimeReport,
  projectId: string,
): TeamTimelineRow | null {
  const timestamp = Date.parse(report.createdAt ?? report.frontMatter.created_at ?? "");
  if (!Number.isFinite(timestamp)) return null;
  return {
    _id: `report:${report.ref}`,
    sourceType: "report_event",
    occurredAt: timestamp,
    projectId,
    eventType: "report.generated",
    label: report.label,
    detail: report.summary,
    sourcePath: report.path,
    sourceHref: report.href,
    reportKind: report.kind,
    reportRef: report.ref,
  };
}
