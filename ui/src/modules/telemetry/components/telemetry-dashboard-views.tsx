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

import type { ReactElement } from "react";
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
  if (rows.length === 0) {
    return <TelemetryStateCard title={emptyLabel} detail="Lifecycle rows will appear here after hooks report activity." />;
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
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="max-w-[240px] truncate font-medium">{row.displayName}</TableCell>
              <TableCell className="text-right tabular-nums">{formatHours(row.agentHours)}</TableCell>
              <TableCell className="text-right tabular-nums">{row.completedTurnCount}</TableCell>
              <TableCell className="text-right tabular-nums">{row.inProgressTurnCount}</TableCell>
              <TableCell className="text-right tabular-nums">{row.unmatchedTurnCount}</TableCell>
              <TableCell>{row.lastSeenAt ? formatRelativeTime(row.lastSeenAt) : "never"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

export function TelemetryStateCard({ detail, title }: { detail: string; title: string }): ReactElement {
  return (
    <Card className="rounded-md">
      <CardContent className="py-8">
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
