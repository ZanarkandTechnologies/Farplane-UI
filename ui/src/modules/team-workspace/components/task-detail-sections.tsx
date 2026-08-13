import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import type { PanelTask } from "./team-panel-types";

type TaskLinkedContextPanelProps = {
  linkedAgentId: string | null;
  onOpenLinkedSession: () => void;
  task: PanelTask;
};

export function TaskLinkedContextPanel({
  linkedAgentId,
  onOpenLinkedSession,
  task,
}: TaskLinkedContextPanelProps): ReactElement | null {
  if (!task.threadId && !task.createdTeamId && !task.createdProjectId) return null;
  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
      {task.threadId ? (
        <div className="space-y-2">
          <p>
            <span className="font-medium text-foreground">Task thread:</span> {task.threadId}
          </p>
          {linkedAgentId ? (
            <Button size="sm" variant="outline" onClick={onOpenLinkedSession}>
              Open task thread
            </Button>
          ) : null}
        </div>
      ) : null}
      {task.createdTeamId ? (
        <p>
          <span className="font-medium text-foreground">Created team:</span> {task.createdTeamId}
        </p>
      ) : null}
      {task.createdProjectId ? (
        <p>
          <span className="font-medium text-foreground">Created project:</span>{" "}
          {task.createdProjectId}
        </p>
      ) : null}
    </div>
  );
}
