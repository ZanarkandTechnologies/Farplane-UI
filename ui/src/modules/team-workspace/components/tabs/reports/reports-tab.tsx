"use client";

/**
 * Reports tab.
 * Owns the full report registry surface for a project, using the same registry-backed
 * projection rows as the Overview report card.
 */

import { ArrowDownUp, FileText, Search } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { reportCadence } from "@/modules/team-workspace/lib/dashboard-projections/overview-summary-surface";
import type { OverviewReportLink } from "@/modules/team-workspace/lib/dashboard-projections/overview-surface";
import { useProjectTimelinePages } from "@/modules/team-workspace/lib/timeline";
import {
  formatReportDate,
  reportFileName,
  reportSummaryRows,
} from "../overview/overview-report-model";
import { ReportReader } from "../overview/overview-reports";
import type { FarplaneProjectConfig, ProjectConfigLoadState } from "../project-config";

type CadenceFilter = "all" | "daily_interval" | "weekly_interval" | "other";
type SortMode = "newest" | "oldest" | "filename";

const REPORTS_TAB_PATTERNS = {
  include: ["reports/*.md", "reports/*/*.md", "reports/*/*/*.md"],
  exclude: ["reports/*/context/*.md", "reports/*/*/context/*.md"],
};

export function ReportsTab({
  projectConfig,
  projectConfigError,
  projectConfigState,
}: {
  projectConfig: FarplaneProjectConfig | null;
  projectConfigError: string | null;
  projectConfigState: ProjectConfigLoadState;
}): ReactElement {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [cadenceFilter, setCadenceFilter] = useState<CadenceFilter>("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const reportPages = useProjectTimelinePages({
    enabled: projectConfigState === "ready" && Boolean(projectConfig?.projectPath),
    limit: 120,
    projectPath: projectConfig?.projectPath,
    reportPatterns: REPORTS_TAB_PATTERNS,
    sources: ["reports"],
  });
  const reports = useMemo(() => timelineRowsToReports(reportPages.rows), [reportPages.rows]);
  const reportKinds = useMemo(
    () =>
      Array.from(
        new Set(
          reports
            .map((report) => report.kind)
            .filter((kind): kind is string => typeof kind === "string" && kind.length > 0),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [reports],
  );
  const visibleReports = useMemo(
    () => filterAndSortReports(reports, { cadenceFilter, kindFilter, query, sortMode }),
    [cadenceFilter, kindFilter, query, reports, sortMode],
  );
  const selectedReport =
    visibleReports.find((report) => report.id === selectedReportId) ??
    reports.find((report) => report.id === selectedReportId) ??
    null;
  const visibleSelectedReport = selectedReportId ? selectedReport : null;

  return (
    <ScrollArea className="h-full pr-3">
      <div
        className={cn(
          "gap-4",
          visibleSelectedReport
            ? "grid xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.42fr)]"
            : "block",
        )}
      >
        <div className="space-y-4">
          <Card className="rounded-md">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4" />
                  Report Registry
                </CardTitle>
                <Badge variant={reports.length > 0 ? "outline" : "secondary"}>
                  {registryBadge(
                    projectConfigState,
                    reports.length,
                    projectConfigError,
                    reportPages.isLoading,
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <ReportsToolbar
                cadenceFilter={cadenceFilter}
                kindFilter={kindFilter}
                kinds={reportKinds}
                query={query}
                sortMode={sortMode}
                onCadenceFilterChange={setCadenceFilter}
                onKindFilterChange={setKindFilter}
                onQueryChange={setQuery}
                onSortModeChange={setSortMode}
              />
              <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                {projectConfig?.projectPath
                  ? `${projectConfig.projectPath}/.farplane/reports`
                  : "<project>/.farplane/reports"}
              </p>
            </CardContent>
          </Card>

          <ReportRows
            canLoadMore={reportPages.hasNextPage}
            loadingMore={reportPages.isFetchingNextPage}
            reports={visibleReports}
            totalReports={reports.length}
            selectedReportId={visibleSelectedReport?.id ?? null}
            onLoadMore={reportPages.fetchNextPage}
            onOpenReport={setSelectedReportId}
          />
        </div>
        {visibleSelectedReport ? (
          <ReportReader report={visibleSelectedReport} onClose={() => setSelectedReportId(null)} />
        ) : null}
      </div>
    </ScrollArea>
  );
}

function timelineRowsToReports(
  rows: ReturnType<typeof useProjectTimelinePages>["rows"],
): OverviewReportLink[] {
  return rows
    .filter((row) => row.sourceType === "report_event")
    .map((row) => ({
      id: row.reportRef ?? row._id,
      ref: row.reportRef,
      label: row.label,
      kind: row.reportKind ?? row.eventType,
      path: row.sourcePath ?? row.reportRef ?? row._id,
      href: row.sourceHref,
      summary: row.detail,
      summaryRows: row.detail ? [row.detail] : undefined,
      createdAt: new Date(row.occurredAt).toISOString(),
      updatedAtMs: row.occurredAt,
    }));
}

function ReportsToolbar({
  cadenceFilter,
  kindFilter,
  kinds,
  onCadenceFilterChange,
  onKindFilterChange,
  onQueryChange,
  onSortModeChange,
  query,
  sortMode,
}: {
  cadenceFilter: CadenceFilter;
  kindFilter: string;
  kinds: string[];
  onCadenceFilterChange: (value: CadenceFilter) => void;
  onKindFilterChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onSortModeChange: (value: SortMode) => void;
  query: string;
  sortMode: SortMode;
}): ReactElement {
  return (
    <div className="grid gap-2 lg:grid-cols-[minmax(14rem,1fr)_10rem_12rem_10rem]">
      <div className="relative">
        <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
        <Input
          className="h-9 pl-9"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search reports"
        />
      </div>
      <Select
        value={cadenceFilter}
        onValueChange={(value) => onCadenceFilterChange(value as CadenceFilter)}
      >
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Cadence" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All cadence</SelectItem>
          <SelectItem value="daily_interval">Daily</SelectItem>
          <SelectItem value="weekly_interval">Weekly</SelectItem>
          <SelectItem value="other">Other</SelectItem>
        </SelectContent>
      </Select>
      <Select value={kindFilter} onValueChange={onKindFilterChange}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Kind" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All kinds</SelectItem>
          {kinds.map((kind) => (
            <SelectItem key={kind} value={kind}>
              {kind}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={sortMode} onValueChange={(value) => onSortModeChange(value as SortMode)}>
        <SelectTrigger className="h-9">
          <ArrowDownUp className="h-4 w-4" />
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest</SelectItem>
          <SelectItem value="oldest">Oldest</SelectItem>
          <SelectItem value="filename">Filename</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function ReportRows({
  canLoadMore,
  loadingMore,
  onLoadMore,
  onOpenReport,
  reports,
  selectedReportId,
  totalReports,
}: {
  canLoadMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onOpenReport: (reportId: string) => void;
  reports: OverviewReportLink[];
  selectedReportId: string | null;
  totalReports: number;
}): ReactElement {
  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4" />
            Reports
          </CardTitle>
          <Badge variant={reports.length > 0 ? "outline" : "secondary"}>
            {reports.length} of {totalReports}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {reports.length > 0 ? (
          <>
            <div className="overflow-hidden rounded-md border bg-background/40">
              {reports.map((report) => (
                <ReportRow
                  key={report.id}
                  report={report}
                  selected={selectedReportId === report.id}
                  onOpen={() => onOpenReport(report.id)}
                />
              ))}
            </div>
            {canLoadMore ? (
              <div className="border-t p-3">
                <button
                  type="button"
                  className="w-full rounded-md border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-60"
                  disabled={loadingMore}
                  onClick={onLoadMore}
                >
                  {loadingMore ? "Loading..." : "Load older reports"}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No indexed reports match these filters.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ReportRow({
  onOpen,
  report,
  selected,
}: {
  onOpen: () => void;
  report: OverviewReportLink;
  selected: boolean;
}): ReactElement {
  const cadence = reportCadence(report);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "block w-full border-t px-3 py-3 text-left first:border-t-0 hover:bg-muted/30",
        selected ? "border-primary/50 bg-primary/5" : "",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-medium [overflow-wrap:anywhere]">{report.label}</p>
          <p className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {reportFileName(report)} · {formatReportDate(report)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {cadence ? <Badge variant="secondary">{cadence.replace("_interval", "")}</Badge> : null}
          {report.kind ? <Badge variant="outline">{report.kind}</Badge> : null}
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
        {reportSummaryRows(report).join(" ")}
      </p>
    </button>
  );
}

function filterAndSortReports(
  reports: OverviewReportLink[],
  {
    cadenceFilter,
    kindFilter,
    query,
    sortMode,
  }: {
    cadenceFilter: CadenceFilter;
    kindFilter: string;
    query: string;
    sortMode: SortMode;
  },
): OverviewReportLink[] {
  const normalizedQuery = query.trim().toLowerCase();
  return reports
    .filter((report) => {
      const cadence = reportCadence(report);
      if (cadenceFilter === "other" && cadence) return false;
      if (cadenceFilter !== "all" && cadenceFilter !== "other" && cadence !== cadenceFilter) {
        return false;
      }
      if (kindFilter !== "all" && report.kind !== kindFilter) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        report.label,
        reportFileName(report),
        report.kind,
        cadence,
        report.summary,
        report.ref,
        report.path,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    })
    .sort((left, right) => compareReports(left, right, sortMode));
}

function compareReports(
  left: OverviewReportLink,
  right: OverviewReportLink,
  sortMode: SortMode,
): number {
  if (sortMode === "filename") return reportFileName(left).localeCompare(reportFileName(right));
  const leftTime = reportTime(left);
  const rightTime = reportTime(right);
  return sortMode === "oldest" ? leftTime - rightTime : rightTime - leftTime;
}

function reportTime(report: OverviewReportLink): number {
  const value = report.createdAt ?? report.frontMatter?.created_at;
  if (value) {
    const parsed = new Date(value).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  return report.updatedAtMs ?? 0;
}

function registryBadge(
  state: ProjectConfigLoadState,
  reportCount: number,
  error: string | null,
  loading: boolean,
): string {
  if (state === "loading" || loading) return "loading";
  if (state === "error") return error || "registry unavailable";
  if (state !== "ready") return "registry idle";
  return reportCount > 0 ? `${reportCount} indexed` : "registry empty";
}
