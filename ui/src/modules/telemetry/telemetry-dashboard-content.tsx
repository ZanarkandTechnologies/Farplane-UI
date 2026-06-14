"use client";

/**
 * TELEMETRY DASHBOARD CONTENT
 * ===========================
 * Ownership: Telemetry module.
 * Inputs: Convex telemetry dashboard queries and optional team/project scope.
 * Outputs: compact shadcn-native runtime telemetry views.
 * Side effects: none beyond Convex subscriptions.
 * Invariants: UI displays completed agent hours separately from lifecycle diagnostics.
 */

import { useMemo, useState, type ReactElement } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isConvexEnabled } from "@/providers/convex-provider";
import { useOfficeAccessMode } from "@/providers/office-access-mode-provider";
import type {
  DurationCapValue,
  RangeDays,
  RawSourceFilter,
  RawStatusFilter,
  TelemetrySummary,
} from "./telemetry-dashboard-types";
import {
  BreakdownTable,
  RawTelemetryTable,
  TelemetryDashboardView,
  TelemetryMetricGrid,
  TelemetryStateCard,
} from "./telemetry-dashboard-views";

const MS_PER_HOUR = 60 * 60 * 1000;
const TURN_PAGE_SIZE = 25;

type TelemetryDashboardContentProps = {
  mode: "global" | "team";
  projectId?: string | null;
  teamId?: string | null;
  title?: string;
};

const RANGE_OPTIONS: Array<{ label: string; value: RangeDays }> = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

const DURATION_CAP_OPTIONS: Array<{ label: string; value: DurationCapValue; maxTurnDurationMs: number | null }> = [
  { label: "Cap 2h", value: "2h", maxTurnDurationMs: 2 * MS_PER_HOUR },
  { label: "Cap 4h", value: "4h", maxTurnDurationMs: 4 * MS_PER_HOUR },
  { label: "Cap 8h", value: "8h", maxTurnDurationMs: 8 * MS_PER_HOUR },
  { label: "No cap", value: "none", maxTurnDurationMs: null },
];

export function TelemetryDashboardContent({
  mode,
  projectId,
  teamId,
  title,
}: TelemetryDashboardContentProps): ReactElement {
  const { isPublic } = useOfficeAccessMode();
  const convexEnabled = isConvexEnabled();
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const [durationCap, setDurationCap] = useState<DurationCapValue>("4h");
  const [turnPage, setTurnPage] = useState(1);
  const [rawStatusFilter, setRawStatusFilter] = useState<RawStatusFilter>("all");
  const [rawSourceFilter, setRawSourceFilter] = useState<RawSourceFilter>("all");
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const maxTurnDurationMs = useMemo(
    () => DURATION_CAP_OPTIONS.find((option) => option.value === durationCap)?.maxTurnDurationMs ?? null,
    [durationCap],
  );
  const queryArgs = useMemo(
    () => ({
      maxTurnDurationMs,
      rangeDays,
      timezone,
      turnPage,
      turnPageSize: TURN_PAGE_SIZE,
    }),
    [maxTurnDurationMs, rangeDays, timezone, turnPage],
  );
  const globalData = useQuery(
    api.modules.runtimeTelemetry.telemetry.getTelemetryDashboard,
    convexEnabled && mode === "global" ? queryArgs : "skip",
  ) as TelemetrySummary | undefined;
  const teamData = useQuery(
    api.modules.runtimeTelemetry.telemetry.getTeamTelemetry,
    convexEnabled && mode === "team"
      ? { ...queryArgs, projectId: projectId ?? undefined, teamId: teamId ?? undefined }
      : "skip",
  ) as TelemetrySummary | undefined;
  const data = mode === "global" ? globalData : teamData;

  const handleRangeDaysChange = (value: string): void => {
    setRangeDays(Number(value) as RangeDays);
    setTurnPage(1);
  };

  const handleDurationCapChange = (value: string): void => {
    setDurationCap(value as DurationCapValue);
    setTurnPage(1);
  };

  if (!convexEnabled) {
    return <TelemetryStateCard title="Telemetry unavailable" detail="Convex is not configured for this UI session." />;
  }

  if (data === undefined) {
    return <TelemetryStateCard title="Loading telemetry" detail="Reading runtime lifecycle rows..." />;
  }

  const diagnosticsCount = data.stats.inProgressTurnCount + data.stats.unmatchedTurnCount;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold">
              {mode === "global" ? "Runtime Telemetry" : title || "Team Telemetry"}
            </h2>
            <Badge variant={diagnosticsCount > 0 ? "secondary" : "outline"}>
              {diagnosticsCount} diagnostic{diagnosticsCount === 1 ? "" : "s"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Completed hours exclude over-cap turns.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(rangeDays)} onValueChange={handleRangeDaysChange}>
            <SelectTrigger size="sm" className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={durationCap} onValueChange={handleDurationCapChange}>
            <SelectTrigger size="sm" className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATION_CAP_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <TelemetryMetricGrid data={data} />

      <Tabs defaultValue="dashboard" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="w-fit">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          {!isPublic ? <TabsTrigger value="raw">Raw Telemetry</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="dashboard" className="min-h-0 flex-1">
          <TelemetryDashboardView data={data} mode={mode} />
        </TabsContent>
        <TabsContent value="projects" className="min-h-0 flex-1">
          <BreakdownTable rows={data.projectBreakdown} emptyLabel="No project telemetry yet." />
        </TabsContent>
        <TabsContent value="teams" className="min-h-0 flex-1">
          <BreakdownTable rows={data.teamBreakdown} emptyLabel="No team telemetry yet." />
        </TabsContent>
        {!isPublic ? (
          <TabsContent value="raw" className="min-h-0 flex-1">
            <RawTelemetryTable
              onPageChange={setTurnPage}
              onSourceFilterChange={setRawSourceFilter}
              onStatusFilterChange={setRawStatusFilter}
              page={data.turnsPage.page}
              pageCount={data.turnsPage.pageCount}
              rows={data.turnsPage.rows}
              sourceFilter={rawSourceFilter}
              statusFilter={rawStatusFilter}
              total={data.turnsPage.total}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
