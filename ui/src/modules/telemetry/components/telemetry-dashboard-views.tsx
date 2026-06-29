"use client";

/**
 * TELEMETRY DASHBOARD VIEWS
 * =========================
 * Ownership: Telemetry module.
 * Inputs: reduced runtime telemetry summaries and paged turn rows.
 * Outputs: Recharts-backed dashboard and summary tables.
 * Side effects: none.
 * Invariants: views render derived metadata only; no raw transcripts are shown.
 */

import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, type ReactElement, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatHours, formatRelativeTime } from "../telemetry-dashboard-format";
import type { TelemetryBreakdown } from "../telemetry-dashboard-types";

type BreakdownTableProps = {
  rows: TelemetryBreakdown[];
  emptyLabel: string;
};

export { TelemetryDashboardView } from "./telemetry-dashboard-recharts";

export function BreakdownTable({ rows, emptyLabel }: BreakdownTableProps): ReactElement {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  if (rows.length === 0) {
    return (
      <TelemetryStateCard
        title={emptyLabel}
        detail="Lifecycle rows will appear here after hooks report activity."
      />
    );
  }

  return (
    <ScrollArea className="h-full pr-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Hours</TableHead>
            <TableHead className="text-right">Turns</TableHead>
            <TableHead className="text-right">Open</TableHead>
            <TableHead className="text-right">Unmatched</TableHead>
            <TableHead>Last seen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const sources = row.sourceBreakdowns ?? [];
            const isExpanded = Boolean(expandedRows[row.key]);
            return (
              <Fragment key={row.key}>
                <TableRow>
                  <TableCell className="max-w-[240px] font-medium">
                    <div className="flex min-w-0 items-center gap-1.5">
                      {sources.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 shrink-0"
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? "Hide" : "Show"} source identities for ${row.displayName}`}
                          onClick={() =>
                            setExpandedRows((current) => ({
                              ...current,
                              [row.key]: !current[row.key],
                            }))
                          }
                        >
                          {isExpanded ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </Button>
                      ) : (
                        <span className="size-6 shrink-0" aria-hidden="true" />
                      )}
                      <span className="min-w-0 truncate">{row.displayName}</span>
                      {sources.length > 1 ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {sources.length}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatHours(row.agentHours)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.completedTurnCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.inProgressTurnCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.unmatchedTurnCount}
                  </TableCell>
                  <TableCell>
                    {row.lastSeenAt ? formatRelativeTime(row.lastSeenAt) : "never"}
                  </TableCell>
                </TableRow>
                {isExpanded ? (
                  <TableRow>
                    <TableCell colSpan={6} className="bg-muted/20 py-2">
                      <div className="space-y-1 pl-8">
                        {sources.map((source) => (
                          <div
                            key={source.key}
                            className="grid grid-cols-[minmax(0,1fr)_72px_56px_56px_72px_96px] items-center gap-3 rounded-sm px-2 py-1 text-xs"
                            title={source.key}
                          >
                            <div className="min-w-0">
                              <div className="truncate font-medium">{source.sourceLabel}</div>
                              <div className="truncate text-muted-foreground">{source.key}</div>
                            </div>
                            <div className="text-right tabular-nums">
                              {formatHours(source.agentHours)}
                            </div>
                            <div className="text-right tabular-nums">
                              {source.completedTurnCount}
                            </div>
                            <div className="text-right tabular-nums">
                              {source.inProgressTurnCount}
                            </div>
                            <div className="text-right tabular-nums">
                              {source.unmatchedTurnCount}
                            </div>
                            <div className="tabular-nums text-muted-foreground">
                              {source.lastSeenAt ? formatRelativeTime(source.lastSeenAt) : "never"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

export function TelemetryStateCard({
  detail,
  title,
}: {
  detail: string;
  title: string;
}): ReactElement {
  return (
    <Card className="rounded-md">
      <CardContent className="py-8">
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
