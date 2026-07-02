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
import { isConvexEnabled } from "@/providers/convex-provider";
import { api } from "../../../../../convex/_generated/api";
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
import type { CommunicationRow, TeamMemoryRow } from "./team-panel-types";
import { buildTeamTimelineRows } from "./team-timeline";

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
  const timelineProjectId = useMemo(
    () => (projectPath?.trim() ? codexProjectIdFromPath(projectPath) : (projectId ?? teamScopeId)),
    [projectId, projectPath, teamScopeId],
  );
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
  const timelineRows = timelineLoading
    ? []
    : buildTeamTimelineRows({
        convexTimeline: hookRows,
        memoryRows,
        communicationRows,
        projectId: teamScopeId ?? undefined,
      });
  const selectedRow = timelineRows.find((row) => row._id === selectedRowId) ?? null;
  const groupedClusters = useMemo(() => groupTimelineClusters(timelineRows), [timelineRows]);
  const sourceLabel = timelineLoading
    ? "Loading hook timeline"
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
              {sourceLabel} · {timelineRows.length} event{timelineRows.length === 1 ? "" : "s"}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={onConfigureHooks}>
            <Settings2 className="size-4" />
            Configure Hooks
          </Button>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-hidden">
        <div
          className={`grid h-full min-h-0 gap-3 ${
            selectedRow ? "grid-cols-[minmax(0,1fr)_360px]" : "grid-cols-1"
          }`}
        >
          <ScrollArea className="h-full min-h-0 rounded-md border bg-background">
            {timelineLoading ? (
              <TimelineLoadingState />
            ) : timelineRows.length > 0 ? (
              <TimelineEventsList
                groups={groupedClusters}
                selectedRowId={selectedRow?._id}
                onSelect={setSelectedRowId}
              />
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
