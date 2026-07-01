import { LocateFixed, MessageSquare, Radio, Send } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type AgentPresenceRow, STATUS_LABELS } from "../../team-panel-types";
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
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm">Persistent Agents</CardTitle>
          <span className="text-xs text-muted-foreground">
            compact runtime roster; old profile previews hidden
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{presenceRows.length} total</Badge>
            <Badge variant="secondary">
              {presenceRows.filter((presence) => presence.blockedTaskCount > 0).length} blocked
            </Badge>
            <Badge variant="secondary">
              {presenceRows.filter((presence) => presence.openTaskCount > 0).length} with open work
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const ids = (globalMode ? employees : teamEmployees).map((entry) => entry._id);
              setHighlightedEmployeeIds(ids);
            }}
          >
            <LocateFixed className="h-4 w-4" />
            Locate all
          </Button>
          {highlightedEmployeeIds.size > 0 ? (
            <Button variant="outline" size="sm" onClick={() => setHighlightedEmployeeIds(null)}>
              Clear Highlight
            </Button>
          ) : null}
        </div>

        {presenceRows.length === 0 ? (
          <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
            No persistent agents are assigned in this scope yet.
          </p>
        ) : (
          <div className="space-y-2">
            {presenceRows.map((presence) => (
              <div
                key={presence.employeeId}
                className="grid min-w-0 gap-3 rounded-md border bg-muted/20 p-3 transition hover:border-border hover:bg-muted/30 xl:grid-cols-[minmax(12rem,0.9fr)_minmax(0,1.5fr)_minmax(15rem,0.9fr)_auto]"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-background text-[11px] font-semibold uppercase">
                      {initials(presence.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{presence.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{presence.roleLabel}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {presence.liveState ? (
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {presence.liveState}
                      </Badge>
                    ) : null}
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {formatRelativeTime(presence.latestOccurredAt)}
                    </Badge>
                  </div>
                </div>

                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Current State
                  </p>
                  <p className="mt-1 break-words text-sm font-medium [overflow-wrap:anywhere]">
                    {presence.statusText}
                  </p>
                </div>

                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Latest Task
                    </p>
                    {presence.latestTaskStatus ? (
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {STATUS_LABELS[presence.latestTaskStatus]}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="break-words text-sm [overflow-wrap:anywhere]">
                    {presence.latestTaskTitle ?? "Available for new work"}
                  </p>
                  <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span>{presence.openTaskCount} open</span>
                    <span>{presence.blockedTaskCount} blocked</span>
                    <span>{presence.completedTaskCount} done</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setHighlightedEmployeeIds([presence.employeeId])}
                    aria-label={`Locate ${presence.name}`}
                  >
                    <LocateFixed className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onMessageAgent(presence.agentId)}
                    aria-label={`Message ${presence.name}`}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenAgentSession(presence.agentId)}
                    aria-label={`Open ${presence.name} session`}
                  >
                    <Radio className="h-4 w-4" />
                  </Button>
                  <Badge variant="secondary" className="px-2 py-1 text-[10px] uppercase">
                    <Send className="mr-1 h-3 w-3" />
                    Board-first
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}
