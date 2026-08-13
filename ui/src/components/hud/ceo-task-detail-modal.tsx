"use client";

/**
 * CEO TASK DETAIL MODAL
 * =====================
 * Read-only detail view for a canonical filesystem ticket projected into the
 * company model. Review and lifecycle writes stay in the ticket workflow.
 */

import { CheckCircle2, Clock3, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UI_Z } from "@/lib/z-index";
import type { ReviewBoardTask } from "@/modules/review-board";
import { TaskMemoryView } from "@/modules/team-workspace";
import { stripYamlFrontMatter } from "@/modules/team-workspace/components/task-detail-modal.helpers";

type CeoTaskDetailModalProps = {
  task: ReviewBoardTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatProjectLabel(projectId: string): string {
  return projectId
    .replace(/^proj-/, "")
    .split("-")
    .map((part) =>
      part.length <= 2 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(" ");
}

function approvalTone(state: string | undefined): string {
  if (state === "approved" || state === "executed")
    return "border-secondary/40 bg-secondary/10 text-foreground";
  if (state === "changes_requested") return "border-primary/40 bg-accent text-foreground";
  if (state === "rejected") return "border-destructive/40 bg-destructive/10 text-foreground";
  return "border-border bg-muted/40 text-muted-foreground";
}

function statusTone(status: string): string {
  if (status === "done") return "border-secondary/40 bg-secondary/10 text-foreground";
  if (status === "blocked") return "border-destructive/40 bg-destructive/10 text-foreground";
  if (status === "in_progress" || status === "review")
    return "border-primary/40 bg-primary/10 text-foreground";
  return "border-border bg-muted/40 text-muted-foreground";
}

export function CeoTaskDetailModal({
  task,
  open,
  onOpenChange,
}: CeoTaskDetailModalProps): JSX.Element | null {
  if (!task) return null;

  const projectLabel = formatProjectLabel(task.projectId);
  const taskMemory = task.markdown?.trim() ? stripYamlFrontMatter(task.markdown) : task.notes;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[92vh] max-h-[980px] !w-[96vw] sm:!max-w-[1600px] flex-col overflow-hidden border border-border bg-background p-0 text-foreground shadow-2xl"
        style={{ zIndex: UI_Z.panelModal }}
        overlayStyle={{
          zIndex: UI_Z.panelModal - 1,
          backgroundColor: "hsl(var(--background) / 0.82)",
        }}
      >
        <DialogHeader className="border-b border-border bg-card px-8 py-7">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-none">
              read-only
            </Badge>
            <Badge
              variant="outline"
              className={`rounded-none border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${approvalTone(task.approvalState)} shadow-none`}
            >
              {task.approvalState?.replace(/_/g, " ") ?? "draft"}
            </Badge>
            <Badge
              variant="outline"
              className={`rounded-none border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${statusTone(task.status)} shadow-none`}
            >
              {task.status.replace(/_/g, " ")}
            </Badge>
            <Badge
              variant="outline"
              className="rounded-none border-border bg-background px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
            >
              {projectLabel}
            </Badge>
          </div>
          <DialogTitle className="max-w-5xl text-4xl font-semibold leading-tight tracking-tight text-foreground xl:text-5xl">
            {task.title}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <span>{task.id}</span>
            <span className="inline-flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              Task thread: {task.threadId ?? "not yet bound"}
            </span>
            {task.createdTeamId ? (
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-secondary" />
                Created team: {task.createdTeamId}
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,440px)]">
          <ScrollArea className="min-h-0 border-b border-border xl:border-r xl:border-b-0">
            <div className="space-y-6 px-6 py-6 sm:px-8 sm:py-8 xl:px-12 xl:py-10">
              <TaskMemoryView notes={taskMemory} variant="full" />
            </div>
          </ScrollArea>

          <div className="min-h-0 space-y-6 overflow-y-auto bg-card px-6 py-6 sm:px-8 sm:py-8">
            <div className="space-y-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
                Ticket lifecycle
              </div>
              <div className="border border-border bg-background p-4 text-sm text-muted-foreground">
                Review decisions and lifecycle changes are recorded through the canonical ticket
                workflow.
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
                Context
              </div>
              <div className="space-y-3 border border-border bg-background p-4 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Owner:</span>{" "}
                  {task.ownerAgentId ?? "unassigned"}
                </p>
                <p>
                  <span className="font-medium text-foreground">Priority:</span> {task.priority}
                </p>
                <p>
                  <span className="font-medium text-foreground">Project:</span> {projectLabel}
                </p>
                {task.artefactPath ? (
                  <p className="break-words">
                    <span className="font-medium text-foreground">Ticket:</span> {task.artefactPath}
                  </p>
                ) : null}
                {task.providerUrl ? (
                  <a
                    href={task.providerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:text-primary/80"
                  >
                    Open external task
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
