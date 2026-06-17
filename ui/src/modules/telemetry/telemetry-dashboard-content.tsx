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
import { isConvexEnabled } from "@/providers/convex-provider";
import { useOfficeAccessMode } from "@/providers/office-access-mode-provider";
import type {
  DurationCapValue,
  RangeDays,
  TelemetrySummary,
} from "./telemetry-dashboard-types";
import { TelemetryDashboardView } from "./components/telemetry-dashboard-recharts";
import {
  BreakdownTable,
  TelemetryStateCard,
} from "./components/telemetry-dashboard-views";
import { TelemetryMetricGrid } from "./components/telemetry-metric-ticker";

const MS_PER_HOUR = 60 * 60 * 1000;
const TURN_PAGE_SIZE = 25;

type TelemetryView = "dashboard" | "projects" | "teams";

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

const PRIVATE_VIEW_OPTIONS: Array<{ label: string; value: TelemetryView }> = [
  { label: "Dashboard", value: "dashboard" },
  { label: "Projects", value: "projects" },
  { label: "Teams", value: "teams" },
];

const PUBLIC_VIEW_OPTIONS = PRIVATE_VIEW_OPTIONS;

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
  const [activeView, setActiveView] = useState<TelemetryView>("dashboard");
  const [turnPage, setTurnPage] = useState(1);
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
  const viewOptions = isPublic ? PUBLIC_VIEW_OPTIONS : PRIVATE_VIEW_OPTIONS;
  const visibleView = activeView;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold">
              {mode === "global" ? "Harness Usage" : title || "Team Harness Usage"}
            </h2>
            <Badge variant={diagnosticsCount > 0 ? "secondary" : "outline"}>
              {diagnosticsCount} diagnostic{diagnosticsCount === 1 ? "" : "s"}
            </Badge>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Completed hours exclude over-cap turns.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={visibleView} onValueChange={(value) => setActiveView(value as TelemetryView)}>
            <SelectTrigger aria-label="Telemetry view" size="sm" className="w-[136px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {viewOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(rangeDays)} onValueChange={handleRangeDaysChange}>
            <SelectTrigger aria-label="Telemetry range" size="sm" className="w-[120px]">
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
            <SelectTrigger aria-label="Duration cap filter" size="sm" className="w-[120px]">
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

      <div className="min-h-0 flex-1">
        {visibleView === "dashboard" ? (
          <TelemetryDashboardView data={data} mode={mode} />
        ) : null}
        {visibleView === "projects" ? (
          <BreakdownTable rows={data.projectBreakdown} emptyLabel="No project telemetry yet." />
        ) : null}
        {visibleView === "teams" ? (
          <BreakdownTable rows={data.teamBreakdown} emptyLabel="No team telemetry yet." />
        ) : null}
      </div>
    </div>
  );
}
