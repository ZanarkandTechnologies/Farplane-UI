import { MessageSquare, Radio, Send } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type AgentPresenceRow, PRIORITY_COLORS, STATUS_LABELS } from "../../team-panel-types";
import { MiniEmployeePreview } from "./employee-preview";
import { formatRelativeTime } from "./overview-helpers";

type EmployeeModel = {
  _id: string;
};

type TeamMembersSectionProps = {
  employees: EmployeeModel[];
  teamEmployees: EmployeeModel[];
  globalMode: boolean;
  highlightedEmployeeIds: Set<string>;
  presenceRows: AgentPresenceRow[];
  setHighlightedEmployeeIds: (ids: string[] | null) => void;
  onMessageAgent: (agentId: string) => void;
  onOpenAgentSession: (agentId: string) => void;
};

export function TeamMembersSection({
  employees,
  globalMode,
  highlightedEmployeeIds,
  onMessageAgent,
  onOpenAgentSession,
  presenceRows,
  setHighlightedEmployeeIds,
  teamEmployees,
}: TeamMembersSectionProps): ReactElement {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">Team Members</CardTitle>
          <span className="text-xs text-muted-foreground">Mission crew</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => {
              const ids = (globalMode ? employees : teamEmployees).map((entry) => entry._id);
              setHighlightedEmployeeIds(ids);
            }}
          >
            Locate All
          </Button>
          {highlightedEmployeeIds.size > 0 ? (
            <Button variant="outline" size="sm" onClick={() => setHighlightedEmployeeIds(null)}>
              Clear Highlight
            </Button>
          ) : null}
        </div>

        {presenceRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No team members assigned.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {presenceRows.map((presence) => (
              <div
                key={presence.employeeId}
                className="rounded-md border bg-muted/20 p-3 transition hover:border-border hover:bg-muted/30"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0">
                    <MiniEmployeePreview seed={`${presence.employeeId}:${presence.name}`} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-medium">{presence.name}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {presence.roleLabel}
                          </Badge>
                          {presence.liveState ? (
                            <Badge variant="secondary" className="text-[10px] uppercase">
                              {presence.liveState}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {formatRelativeTime(presence.latestOccurredAt)}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setHighlightedEmployeeIds([presence.employeeId])}
                      >
                        Locate
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">Current State</p>
                        <p className="text-sm font-medium">{presence.statusText}</p>
                      </div>
                      <div className="rounded-md border bg-background/40 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Latest Task
                          </p>
                          {presence.latestTaskStatus ? (
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase ${PRIORITY_COLORS[presence.latestTaskPriority ?? "medium"]}`}
                            >
                              {STATUS_LABELS[presence.latestTaskStatus]}
                            </Badge>
                          ) : null}
                        </div>
                        {presence.latestTaskTitle ? (
                          <>
                            <p className="text-sm font-medium">{presence.latestTaskTitle}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {presence.latestTaskDetail ?? "No task detail yet."}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No assigned task yet. This agent is currently available for new work.
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                          <span>{presence.openTaskCount} open</span>
                          <span>{presence.blockedTaskCount} blocked</span>
                          <span>{presence.completedTaskCount} done</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => onMessageAgent(presence.agentId)}>
                        <MessageSquare className="mr-2 h-3.5 w-3.5" />
                        Message
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenAgentSession(presence.agentId)}
                      >
                        <Radio className="mr-2 h-3.5 w-3.5" />
                        Open Session
                      </Button>
                      <Badge variant="secondary" className="px-2 py-1 text-[10px] uppercase">
                        <Send className="mr-1 h-3 w-3" />
                        Board-first
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
