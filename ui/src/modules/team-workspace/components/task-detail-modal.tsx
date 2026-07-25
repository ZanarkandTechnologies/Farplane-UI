"use client";

/**
 * TASK DETAIL MODAL
 * =================
 * Read-only detail view for canonical filesystem tickets.
 * Task mutation and review decisions stay in the ticket lifecycle rather than
 * presenting controls that cannot safely update the source file.
 */

import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UI_Z } from "@/lib/z-index";
import { useAppStore } from "@/store";
import {
  formatDate,
  frontMatterEntries,
  parseAgentIdFromSessionKey,
  stripYamlFrontMatter,
} from "./task-detail-modal.helpers";
import { TaskLinkedContextPanel } from "./task-detail-sections";
import { TaskMemoryView } from "./task-memory-view";
import { type PanelTask, PRIORITY_COLORS, STATUS_COLORS } from "./team-panel-types";
import { TicketMarkdownDialog } from "./ticket-markdown-dialog";

interface TaskDetailModalProps {
  task: PanelTask | null;
  isOpen: boolean;
  onClose: () => void;
  ownerLabelById: Map<string, string>;
}

export function TaskDetailModal({
  task,
  isOpen,
  onClose,
  ownerLabelById,
}: TaskDetailModalProps): ReactElement | null {
  const setSelectedAgentId = useAppStore((state) => state.setSelectedAgentId);
  const setSelectedSessionKey = useAppStore((state) => state.setSelectedSessionKey);
  const setIsAgentSessionPanelOpen = useAppStore((state) => state.setIsAgentSessionPanelOpen);

  if (!task) return null;

  const currentOwnerLabel = task.ownerAgentId
    ? (ownerLabelById.get(task.ownerAgentId) ?? task.ownerAgentId)
    : "unassigned";
  const linkedAgentId = parseAgentIdFromSessionKey(task.linkedSessionKey);
  const ticketMarkdown = task.markdown?.trim();
  const ticketFrontMatterEntries = frontMatterEntries(task);
  const ticketBodyMarkdown = ticketMarkdown ? stripYamlFrontMatter(ticketMarkdown) : "";

  if (ticketMarkdown) {
    return (
      <TicketMarkdownDialog
        isOpen={isOpen}
        onClose={onClose}
        task={task}
        ticketBodyMarkdown={ticketBodyMarkdown}
        ticketFrontMatterEntries={ticketFrontMatterEntries}
        ticketMarkdown={ticketMarkdown}
      />
    );
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-w-[min(96vw,900px)] border border-border bg-background p-0"
        style={{ zIndex: UI_Z.panelModal }}
        overlayStyle={{ zIndex: UI_Z.panelModal - 1 }}
      >
        <DialogHeader className="space-y-3 border-b border-border bg-card px-6 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">read-only</Badge>
            <Badge variant="outline" className="rounded-none">
              {task.id}
            </Badge>
          </div>
          <DialogTitle className="text-left text-xl">{task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-md border bg-muted/20 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</p>
              <p className="mt-2 flex items-center gap-2 font-medium">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${STATUS_COLORS[task.status]}`}
                />
                {task.status.replace(/_/g, " ")}
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Priority</p>
              <Badge
                variant="outline"
                className={`mt-2 rounded-none text-[10px] shadow-none ${PRIORITY_COLORS[task.priority]}`}
              >
                {task.priority}
              </Badge>
            </div>
            <div className="rounded-md border bg-muted/20 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Owner</p>
              <p className="mt-2 font-medium">{currentOwnerLabel}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {task.approvalState ? (
              <Badge variant="outline" className="rounded-none text-[10px] shadow-none">
                approval: {task.approvalState.replace(/_/g, " ")}
              </Badge>
            ) : null}
            {task.artefactPath ? <span>{task.artefactPath}</span> : null}
          </div>

          <TaskLinkedContextPanel
            linkedAgentId={linkedAgentId}
            onOpenLinkedSession={() => {
              if (!linkedAgentId) return;
              setSelectedAgentId(linkedAgentId);
              setSelectedSessionKey(task.linkedSessionKey ?? null);
              setIsAgentSessionPanelOpen(true);
            }}
            task={task}
          />

          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Task Memory</p>
            <TaskMemoryView notes={task.notes} variant="full" />
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
            <div>
              <span className="uppercase tracking-wide">Created</span>
              <br />
              {formatDate(task.createdAt)}
            </div>
            <div>
              <span className="uppercase tracking-wide">Updated</span>
              <br />
              {formatDate(task.updatedAt)}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
