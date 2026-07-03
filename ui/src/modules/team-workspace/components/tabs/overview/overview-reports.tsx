"use client";

/**
 * Overview report cards and in-panel reader.
 * Inputs are projected interval report links; outputs are read-only summary rows and full report body.
 */

import { ExternalLink, FileText, X } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { OverviewReportLink } from "@/modules/team-workspace/lib/dashboard-projections/overview-surface";
import { formatReportDate, pathToFileHref, reportSummaryRows } from "./overview-report-model";

export function OverviewReportsCard({
  onOpenReport,
  reports,
  selectedReportId,
}: {
  onOpenReport: (reportId: string) => void;
  reports: OverviewReportLink[];
  selectedReportId: string | null;
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
            {reports.length > 0 ? `${reports.length} projected` : "reports source missing"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {reports.length > 0 ? (
          <div className="overflow-hidden rounded-md border bg-background/40">
            {reports.map((report) => (
              <ReportSummaryCard
                key={report.id}
                report={report}
                selected={selectedReportId === report.id}
                onOpen={() => onOpenReport(report.id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No reports source available.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function ReportReader({
  onClose,
  report,
}: {
  onClose: () => void;
  report: OverviewReportLink;
}): ReactElement {
  const reportHref = report.href ?? pathToFileHref(report.path);
  return (
    <aside className="sticky top-0 max-h-[calc(100vh-10rem)] rounded-md border bg-card">
      <div className="flex items-start justify-between gap-3 border-b p-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-medium [overflow-wrap:anywhere]">
            {report.label}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{formatReportDate(report)}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close report">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="h-[min(70vh,44rem)]">
        <div className="space-y-3 p-3">
          <ReportSummaryRows rows={reportSummaryRows(report)} />
          {report.content ? (
            <ReportMarkdown content={report.content} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Full report content is not in the current projection.
            </p>
          )}
        </div>
      </ScrollArea>
      <div className="border-t p-3">
        <Button asChild variant="outline" size="sm">
          <a href={reportHref} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            Open file
          </a>
        </Button>
      </div>
    </aside>
  );
}

function ReportSummaryCard({
  onOpen,
  report,
  selected,
}: {
  onOpen: () => void;
  report: OverviewReportLink;
  selected: boolean;
}): ReactElement {
  return (
    <div
      className={cn(
        "border-t px-3 py-3 first:border-t-0",
        selected ? "border-primary/50 bg-primary/5" : "",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-medium [overflow-wrap:anywhere]">
            {report.label}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{formatReportDate(report)}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onOpen}>
          <FileText className="h-4 w-4" />
          Open
        </Button>
      </div>
      <ReportSummaryRows rows={reportSummaryRows(report)} compact />
    </div>
  );
}

function ReportSummaryRows({
  compact = false,
  rows,
}: {
  compact?: boolean;
  rows: string[];
}): ReactElement {
  return (
    <div className={cn("space-y-2", compact ? "mt-3" : "")}>
      {rows.map((row) => (
        <div
          key={row}
          className={cn(
            "text-sm leading-6 text-muted-foreground",
            compact ? "" : "rounded-md border bg-muted/20 p-3",
          )}
        >
          <span className="break-words [overflow-wrap:anywhere]">{row}</span>
        </div>
      ))}
    </div>
  );
}

function ReportMarkdown({ content }: { content: string }): ReactElement {
  return (
    <div className="whitespace-pre-wrap rounded-md border bg-muted/10 p-3 font-mono text-xs leading-5 text-muted-foreground">
      {content.trim()}
    </div>
  );
}
