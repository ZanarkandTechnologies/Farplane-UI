import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PanelTask } from "./team-panel-types";

type TaskReviewPanelProps = {
  isPending: boolean;
  reviewNote: string;
  reviewStatusText: string;
  setReviewNote: (note: string) => void;
  onReviewDecision: (nextState: "approved" | "changes_requested" | "rejected") => Promise<void>;
};

export function TaskReviewPanel({
  isPending,
  onReviewDecision,
  reviewNote,
  reviewStatusText,
  setReviewNote,
}: TaskReviewPanelProps): ReactElement {
  return (
    <div className="space-y-3 border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Review</p>
      <Textarea
        value={reviewNote}
        onChange={(event) => setReviewNote(event.target.value)}
        placeholder="Write review guidance directly on the shared task."
        className="min-h-24 rounded-none border-border bg-background text-sm"
        disabled={isPending}
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={isPending} onClick={() => void onReviewDecision("approved")}>
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-none border-border bg-background shadow-none"
          disabled={isPending}
          onClick={() => void onReviewDecision("changes_requested")}
        >
          Request Changes
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-none border-border bg-background shadow-none"
          disabled={isPending}
          onClick={() => void onReviewDecision("rejected")}
        >
          Reject
        </Button>
      </div>
      {reviewStatusText ? (
        <div className="border border-border bg-background p-3 text-sm text-muted-foreground">
          {reviewStatusText}
        </div>
      ) : null}
    </div>
  );
}

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
  if (!task.linkedSessionKey && !task.createdTeamId && !task.createdProjectId) return null;
  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
      {task.linkedSessionKey ? (
        <div className="space-y-2">
          <p>
            <span className="font-medium text-foreground">Linked session:</span>{" "}
            {task.linkedSessionKey}
          </p>
          {linkedAgentId ? (
            <Button size="sm" variant="outline" onClick={onOpenLinkedSession}>
              Open linked session
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
