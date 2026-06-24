"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CornerDownRight, MessageSquare, Plus, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface ThreadItem {
  _id: string;
  title?: string;
  parentThreadId?: string;
}

interface PmPinControls {
  selectedProjectName?: string;
  statusText?: string;
}

interface ChatSidebarProps {
  threads: Array<ThreadItem> | undefined;
  subthreadsMap: Record<string, Array<ThreadItem>>;
  threadId: string | null;
  onThreadSelect: (threadId: string) => void;
  onNewThread: () => void;
  onDeleteChat: (threadId: string) => Promise<{ ok: boolean; error?: string }>;
  sidebarOpen: boolean;
  isCreatingThread?: boolean;
  disableNewThread?: boolean;
  pmPinControls?: PmPinControls;
}

export function ChatSidebar({
  threads,
  subthreadsMap,
  threadId,
  onThreadSelect,
  onNewThread,
  onDeleteChat,
  sidebarOpen,
  isCreatingThread,
  disableNewThread,
  pmPinControls,
}: ChatSidebarProps) {
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);
  const flatThreads = [...(threads ?? []), ...Object.values(subthreadsMap).flat()];
  const deleteTarget = flatThreads.find((thread) => thread._id === deleteTargetId) ?? null;

  return (
    <div
      className={cn(
        "border-r bg-muted/10 transition-all duration-300 flex min-h-0 shrink-0 flex-col overflow-hidden",
        sidebarOpen ? "w-64 min-w-64 max-w-64" : "w-0 min-w-0 max-w-0",
      )}
    >
      {sidebarOpen ? (
        <>
          <div className="p-4 border-b flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="font-semibold text-sm">Conversations</h2>
              {pmPinControls?.selectedProjectName ? (
                <p className="truncate text-xs text-muted-foreground">
                  PM: {pmPinControls.selectedProjectName}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={onNewThread}
                disabled={isCreatingThread || disableNewThread}
                className="h-8 w-8 p-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="w-full space-y-1 p-2">
              {deleteError ? (
                <p className="px-3 py-1 text-xs text-destructive">{deleteError}</p>
              ) : null}
              {threads?.map((thread) => {
                const subthreads = subthreadsMap[thread._id] ?? [];
                return (
                  <div key={thread._id} className="space-y-1">
                    <ThreadRow
                      thread={thread}
                      activeThreadId={threadId}
                      onThreadSelect={onThreadSelect}
                      onDelete={(id) => {
                        setDeleteError("");
                        setDeleteTargetId(id);
                      }}
                    />
                    {subthreads.map((subthread) => (
                      <ThreadRow
                        key={subthread._id}
                        thread={subthread}
                        activeThreadId={threadId}
                        depth="child"
                        onThreadSelect={onThreadSelect}
                        onDelete={(id) => {
                          setDeleteError("");
                          setDeleteTargetId(id);
                        }}
                      />
                    ))}
                  </div>
                );
              })}
              {pmPinControls?.statusText ? (
                <p className="px-3 py-1 text-xs text-muted-foreground">
                  {pmPinControls.statusText}
                </p>
              ) : null}
            </div>
          </ScrollArea>
        </>
      ) : null}
      <AlertDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTargetId(null);
          }
        }}
      >
        <AlertDialogContent className="z-[3001]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected chat session and its transcript.
              {deleteTarget ? ` (${deleteTarget.title || deleteTarget._id})` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting || !deleteTargetId}
              onClick={async (event) => {
                event.preventDefault();
                if (!deleteTargetId || isDeleting) return;
                setIsDeleting(true);
                const result = await onDeleteChat(deleteTargetId);
                setIsDeleting(false);
                if (result.ok) {
                  setDeleteTargetId(null);
                  return;
                }
                setDeleteError(result.error ?? "Failed to delete session.");
              }}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ThreadRow({
  activeThreadId,
  depth = "root",
  onDelete,
  onThreadSelect,
  thread,
}: {
  activeThreadId: string | null;
  depth?: "root" | "child";
  onDelete: (threadId: string) => void;
  onThreadSelect: (threadId: string) => void;
  thread: ThreadItem;
}) {
  const isChild = depth === "child";
  const Icon = isChild ? CornerDownRight : MessageSquare;

  return (
    <div
      className={cn(
        "grid w-full grid-cols-[minmax(0,1fr)_24px] items-start gap-2 overflow-hidden rounded-md py-2 transition-colors hover:bg-accent",
        isChild ? "ml-5 px-2 text-muted-foreground" : "px-3",
        thread._id === activeThreadId ? "bg-accent text-foreground" : "",
      )}
    >
      <button
        type="button"
        className={cn(
          "grid min-w-0 items-start gap-2 text-left",
          isChild ? "grid-cols-[14px_minmax(0,1fr)]" : "grid-cols-[16px_minmax(0,1fr)]",
        )}
        onClick={() => {
          onThreadSelect(thread._id);
        }}
      >
        <Icon
          className={cn(
            "mt-0.5 flex-shrink-0 text-muted-foreground",
            isChild ? "h-3.5 w-3.5" : "h-4 w-4",
          )}
        />
        <span className={cn("block min-w-0 truncate pr-1", isChild ? "text-xs" : "text-sm")}>
          {thread.title || "New Chat"}
        </span>
      </button>
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Delete ${thread.title || "chat"}`}
        className="h-6 w-6 shrink-0 p-0 text-muted-foreground/80 hover:bg-destructive/20 hover:text-destructive"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(thread._id);
        }}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
