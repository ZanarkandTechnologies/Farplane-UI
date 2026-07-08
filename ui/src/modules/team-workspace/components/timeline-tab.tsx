"use client";

/**
 * TIMELINE TAB
 * ============
 * Orchestrates project timeline sources and delegates rendering to timeline components.
 */

import { useQuery } from "convex/react";
import { Settings2 } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_TIMELINE_REPORT_PATTERNS,
  type TimelineReportPatternConfig,
  useProjectTimelinePages,
} from "@/modules/team-workspace/lib/timeline";
import { isConvexEnabled } from "@/providers/convex-provider";
import { api } from "../../../../../convex/_generated/api";
import type { CommunicationRow, TeamMemoryRow } from "./team-panel-types";
import { buildTeamTimelineRows } from "./team-timeline";
import {
  EmptyTimelineState,
  TimelineDetailPanel,
  TimelineEventsList,
  TimelineLoadingState,
} from "./timeline-components";
import {
  codexProjectIdFromPath,
  groupTimelineClusters,
  type LearningTimelineResponse,
  learningRowToTeamTimelineRow,
} from "./timeline-model";

type TimelineReportPreset = "pinned" | "all_interval" | "feed_scout" | "pulse";
type TimelineSourceFilter = "all" | "hooks" | "reports" | "memory" | "communications";

function reportPatternsForPreset(preset: TimelineReportPreset): TimelineReportPatternConfig {
  if (preset === "all_interval") {
    return { include: ["reports/interval/*/*.md"], exclude: ["reports/*/context/*.md"] };
  }
  if (preset === "feed_scout") {
    return { include: ["reports/feed-scout/*.md"], exclude: [] };
  }
  if (preset === "pulse") {
    return { include: ["reports/pulse/*.md"], exclude: [] };
  }
  return DEFAULT_TIMELINE_REPORT_PATTERNS;
}

function filterTimelineRows(
  rows: ReturnType<typeof buildTeamTimelineRows>,
  filter: TimelineSourceFilter,
): ReturnType<typeof buildTeamTimelineRows> {
  if (filter === "hooks") return rows.filter((row) => row.sourceType === "hook_event");
  if (filter === "reports") return rows.filter((row) => row.sourceType === "report_event");
  if (filter === "memory") return rows.filter((row) => row.sourceType === "memory_event");
  if (filter === "communications") return rows.filter((row) => row.sourceType === "agent_event");
  return rows;
}

interface TimelineTabProps {
  convexEnabled: boolean;
  projectId: string | null;
  projectPath?: string | null;
  teamScopeId: string | null;
  memoryRows: TeamMemoryRow[];
  communicationRows: CommunicationRow[];
  onOpenMineRun?: (target: { outputId?: string; projectPath?: string; runId: string }) => void;
  onConfigureHooks: () => void;
}

export function TimelineTab({
  convexEnabled,
  projectId,
  projectPath,
  teamScopeId,
  memoryRows,
  communicationRows,
  onOpenMineRun,
  onConfigureHooks,
}: TimelineTabProps): ReactElement {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<TimelineSourceFilter>("all");
  const [reportPreset, setReportPreset] = useState<TimelineReportPreset>("pinned");
  const timelineProjectId = useMemo(
    () => (projectPath?.trim() ? codexProjectIdFromPath(projectPath) : (projectId ?? teamScopeId)),
    [projectId, projectPath, teamScopeId],
  );
  const reportPatterns = useMemo(() => reportPatternsForPreset(reportPreset), [reportPreset]);
  const fileTimeline = useProjectTimelinePages({
    enabled: Boolean(projectPath),
    projectPath,
    reportPatterns,
    sources: ["reports"],
  });
  const shouldLoadHookTimeline = convexEnabled && isConvexEnabled() && Boolean(timelineProjectId);
  const hookTimeline = useQuery(
    api.modules.hookTelemetry.queries.getLearningTimelineFromHookTelemetry,
    shouldLoadHookTimeline && timelineProjectId
      ? { projectId: timelineProjectId, rangeDays: 14, limit: 80 }
      : "skip",
  ) as LearningTimelineResponse | undefined;
  const timelineLoading = shouldLoadHookTimeline && hookTimeline === undefined;
  const hookRows = useMemo(
    () =>
      (hookTimeline?.rows ?? []).map((row) =>
        learningRowToTeamTimelineRow(row, timelineProjectId ?? "project"),
      ),
    [hookTimeline?.rows, timelineProjectId],
  );
  const mergedTimelineRows = timelineLoading
    ? []
    : buildTeamTimelineRows({
        convexTimeline: hookRows,
        fileRows: fileTimeline.rows,
        memoryRows,
        communicationRows,
        projectId: teamScopeId ?? undefined,
      });
  const timelineRows = useMemo(
    () => filterTimelineRows(mergedTimelineRows, sourceFilter),
    [mergedTimelineRows, sourceFilter],
  );
  const selectedRow = timelineRows.find((row) => row._id === selectedRowId) ?? null;
  const groupedClusters = useMemo(() => groupTimelineClusters(timelineRows), [timelineRows]);
  const sourceLabel = timelineLoading
    ? "Loading hook timeline"
    : fileTimeline.rows.some((row) => row.sourceType === "report_event")
      ? "Paged project timeline"
      : hookRows.length
        ? "Hook timeline"
        : timelineRows.some((row) => row.sourceType === "memory_event")
          ? "Memory history"
          : convexEnabled && teamScopeId
            ? "Live activity"
            : "Communications";

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <CardTitle className="text-sm">Project Timeline</CardTitle>
              {teamScopeId ? (
                <Badge variant="outline" className="text-[10px] uppercase">
                  {teamScopeId}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {sourceLabel} · {timelineRows.length} of {mergedTimelineRows.length} event
              {mergedTimelineRows.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Select
              value={sourceFilter}
              onValueChange={(value) => setSourceFilter(value as TimelineSourceFilter)}
            >
              <SelectTrigger className="h-8 w-[150px]">
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                <SelectItem value="hooks">Hook tickets</SelectItem>
                <SelectItem value="reports">Reports</SelectItem>
                <SelectItem value="memory">Memory</SelectItem>
                <SelectItem value="communications">Comms</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={reportPreset}
              onValueChange={(value) => setReportPreset(value as TimelineReportPreset)}
            >
              <SelectTrigger className="h-8 w-[150px]">
                <SelectValue placeholder="Reports" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pinned">Pinned reports</SelectItem>
                <SelectItem value="all_interval">All interval</SelectItem>
                <SelectItem value="feed_scout">Feed scout</SelectItem>
                <SelectItem value="pulse">Pulse</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={onConfigureHooks}>
              <Settings2 className="size-4" />
              Configure Hooks
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-hidden">
        <div
          className={`grid h-full min-h-0 gap-3 ${
            selectedRow ? "grid-cols-[minmax(0,1fr)_360px]" : "grid-cols-1"
          }`}
        >
          <ScrollArea className="h-full min-h-0 rounded-md border bg-background">
            {timelineLoading || fileTimeline.isLoading ? (
              <TimelineLoadingState />
            ) : timelineRows.length > 0 ? (
              <div>
                <TimelineEventsList
                  groups={groupedClusters}
                  selectedRowId={selectedRow?._id}
                  onSelect={setSelectedRowId}
                />
                {fileTimeline.hasNextPage ? (
                  <div className="border-t p-3">
                    <Button
                      className="w-full"
                      variant="outline"
                      size="sm"
                      disabled={fileTimeline.isFetchingNextPage}
                      onClick={fileTimeline.fetchNextPage}
                    >
                      {fileTimeline.isFetchingNextPage ? "Loading..." : "Load older timeline rows"}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <EmptyTimelineState
                convexEnabled={convexEnabled}
                onConfigureHooks={onConfigureHooks}
              />
            )}
          </ScrollArea>
          {selectedRow ? (
            <TimelineDetailPanel
              row={selectedRow}
              onClose={() => setSelectedRowId(null)}
              onOpenMineRun={onOpenMineRun}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
