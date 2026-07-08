/**
 * Timeline page contracts.
 * Inputs/outputs: Vite bridge day-window responses consumed by Team Workspace Timeline.
 */

import type { TeamTimelineRow } from "@/modules/team-workspace/components/team-timeline";

export type ProjectTimelineSource = "hooks" | "memory" | "communications" | "reports";

export type TimelineReportPatternConfig = {
  include: string[];
  exclude: string[];
};

export type ProjectTimelinePageParams = {
  projectPath?: string | null;
  day: string;
  cursor?: string | null;
  limit?: number;
  sources?: ProjectTimelineSource[];
  reportPatterns?: TimelineReportPatternConfig;
};

export type ProjectTimelinePage = {
  ok: true;
  projectPath: string;
  day: string;
  timezone: string;
  rows: TeamTimelineRow[];
  nextCursor?: string;
  previousDay?: string;
  sourceCounts: Partial<Record<ProjectTimelineSource | "total", number>>;
  appliedReportPatterns: string[];
};

export type ProjectTimelinePageError = {
  ok: false;
  error: string;
};

export const DEFAULT_TIMELINE_REPORT_PATTERNS: TimelineReportPatternConfig = {
  include: ["reports/interval/daily_interval/*.md", "reports/interval/weekly_interval/*.md"],
  exclude: ["reports/pulse/*.md", "reports/*/context/*.md"],
};
