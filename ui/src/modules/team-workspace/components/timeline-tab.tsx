"use client";

/**
 * TIMELINE TAB
 * ============
 * Project decision and activity timeline backed by memory docs or live activity rows.
 *
 * KEY CONCEPTS:
 * - Project memory/history rows are the preferred event spine.
 * - Live AgentActivityFeed remains available when no memory events are present.
 * - Communication rows are the final fallback.
 *
 * USAGE:
 * - Rendered inside TeamPanel as the "timeline" TabsContent.
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AgentActivityFeed } from "./agent-activity-feed";
import { buildTeamTimelineRows } from "./team-timeline";
import type { AgentCandidate, CommunicationRow, TeamMemoryRow } from "./team-panel-types";

interface TimelineTabProps {
  convexEnabled: boolean;
  teamScopeId: string | null;
  memoryRows: TeamMemoryRow[];
  activityFeedCandidates: AgentCandidate[];
  communicationRows: CommunicationRow[];
}

export function TimelineTab({
  convexEnabled,
  teamScopeId,
  memoryRows,
  activityFeedCandidates,
  communicationRows,
}: TimelineTabProps): JSX.Element {
  const timelineRows = buildTeamTimelineRows({
    convexTimeline: undefined,
    memoryRows,
    communicationRows,
    projectId: teamScopeId ?? undefined,
  });
  const hasMemoryTimeline = timelineRows.some((row) => row.sourceType === "memory_event");

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">Project Timeline</CardTitle>
          {teamScopeId ? (
            <Badge variant="outline" className="text-[10px] uppercase">
              {teamScopeId}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="h-[calc(100%-3rem)] overflow-hidden">
        {hasMemoryTimeline ? (
          <ScrollArea className="h-full rounded-md border p-3">
            <div className="space-y-2">
              {timelineRows.map((row) => (
                <div key={row._id} className="rounded-md border bg-muted/20 p-3 text-sm">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {row.eventType ?? row.activityType ?? row.sourceType}
                      </Badge>
                      {row.memoryId ? (
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {row.memoryId}
                        </Badge>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(row.occurredAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="break-words font-medium [overflow-wrap:anywhere]">{row.label}</p>
                  {row.detail ? (
                    <p className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                      {row.detail}
                    </p>
                  ) : null}
                  {row.sourcePath ? (
                    <p className="mt-2 break-words text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
                      {row.sourcePath}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : convexEnabled && teamScopeId ? (
          <AgentActivityFeed teamId={teamScopeId} candidates={activityFeedCandidates} />
        ) : (
          <ScrollArea className="h-full rounded-md border p-3">
            <div className="space-y-2">
              {communicationRows.map((row) => (
                <div
                  key={`timeline-fallback-${row.id}`}
                  className="rounded-md border bg-muted/20 p-2 text-sm"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{row.agentId}</span>
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {row.activityType}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(row.occurredAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="font-medium">{row.label}</p>
                  {row.detail ? (
                    <p className="text-xs text-muted-foreground">{row.detail}</p>
                  ) : null}
                  {row.taskId ? (
                    <p className="text-[11px] text-muted-foreground">task: {row.taskId}</p>
                  ) : null}
                </div>
              ))}
              {communicationRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Enable Convex and team logging to view beat drill-down timeline.
                </p>
              ) : null}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
