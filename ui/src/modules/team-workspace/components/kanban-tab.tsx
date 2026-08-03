"use client";

/**
 * KANBAN TAB
 * ==========
 * Renders the canonical filesystem ticket projection as an explicitly read-only board.
 * Loading, source-gap, read-error, and empty states remain visible instead of falling
 * back to sidecar or Convex task rows.
 */

import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KanbanColumn } from "./kanban-column";
import { TaskDetailModal } from "./task-detail-modal";
import {
  buildKanbanColumns,
  derivePanelFoundationState,
  type KanbanLaneKey,
  type PanelTask,
} from "./team-panel-types";
import type { ProjectKanbanLoadState, ProjectKanbanSnapshot } from "./use-project-kanban";

interface KanbanTabProps {
  projectTasks: PanelTask[];
  focusAgentId?: string | null;
  ownerLabelById: Map<string, string>;
  kanbanSnapshot?: ProjectKanbanSnapshot | null;
  kanbanState?: ProjectKanbanLoadState;
  kanbanError?: string | null;
  onRefreshKanban?: () => Promise<void>;
  showReadOnlyNotice?: boolean;
}

const COLUMN_ORDER: KanbanLaneKey[] = ["todo", "in_progress", "review", "blocked", "done"];

export function KanbanTab({
  projectTasks,
  focusAgentId,
  ownerLabelById,
  kanbanSnapshot = null,
  kanbanState = "idle",
  kanbanError = null,
  onRefreshKanban,
  showReadOnlyNotice = true,
}: KanbanTabProps): JSX.Element {
  const [selectedTask, setSelectedTask] = useState<PanelTask | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const foundation = useMemo(() => derivePanelFoundationState(projectTasks), [projectTasks]);

  const visibleTasks = useMemo(() => {
    if (kanbanState !== "ready") return [];
    if (foundation.mode === "locked") return foundation.activeTasks;
    return focusAgentId
      ? projectTasks.filter((task) => task.ownerAgentId === focusAgentId)
      : projectTasks;
  }, [focusAgentId, foundation, kanbanState, projectTasks]);
  const columns = buildKanbanColumns(visibleTasks);
  const sourceLabel =
    kanbanSnapshot?.providerConfig.provider.replace(/_/g, " ") ?? "filesystem tickets";
  const refreshedLabel = kanbanSnapshot?.readAtMs
    ? `${Math.max(0, Math.floor((Date.now() - kanbanSnapshot.readAtMs) / 1000))}s ago`
    : "not refreshed";
  const showColumns = kanbanState === "ready";

  function openTask(task: PanelTask): void {
    setSelectedTask(task);
    setIsDetailOpen(true);
  }

  function closeDetail(): void {
    setIsDetailOpen(false);
    setSelectedTask(null);
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2 text-xs">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-muted-foreground">
          <span className="font-medium text-foreground">Source</span>
          <Badge variant="outline" className="rounded-md">
            {sourceLabel}
          </Badge>
          <span>{visibleTasks.length} tasks</span>
          <span>refreshed {refreshedLabel}</span>
          <Badge variant="secondary">read-only</Badge>
        </div>
        {onRefreshKanban ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={kanbanState === "loading"}
            onClick={() => void onRefreshKanban()}
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Refresh
          </Button>
        ) : null}
      </div>

      {focusAgentId && foundation.mode !== "locked" ? (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Showing tasks owned by <span className="font-mono">{focusAgentId}</span> in this panel
          scope.
        </div>
      ) : null}

      {kanbanState === "ready" && foundation.mode === "locked" ? (
        <div
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3"
          data-testid="business-foundation-gate"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Business foundation {foundation.completedCount}/{foundation.totalCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Finish these starter quests before creating normal work or enabling automation.
              </p>
            </div>
            <Badge variant="outline" className="border-amber-500/50 text-amber-600">
              Next: {foundation.activeTasks[0]?.title ?? "Complete the foundation"}
            </Badge>
          </div>
        </div>
      ) : null}

      {showReadOnlyNotice ? (
        <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          {foundation.mode === "locked"
            ? "Only foundation tickets are shown. Close them through the normal review flow to unlock the full project."
            : "Task changes are made in the canonical ticket files. This board refreshes from those files."}
        </div>
      ) : null}

      {kanbanState === "loading" ? (
        <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          Loading filesystem tickets…
        </div>
      ) : null}
      {kanbanState === "idle" ? (
        <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed px-6 text-center text-sm text-muted-foreground">
          No tracked project path is available for this team, so its filesystem tickets cannot be
          read.
        </div>
      ) : null}
      {kanbanState === "error" ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Could not read filesystem tickets: {kanbanError ?? "unknown read error"}
        </div>
      ) : null}
      {kanbanState === "ready" && visibleTasks.length === 0 ? (
        <div className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
          No active filesystem tickets were found for this project.
        </div>
      ) : null}

      {showColumns ? (
        <div className="min-h-0 flex-1 overflow-x-auto pb-2">
          <div className="grid h-full min-w-[90rem] grid-cols-5 gap-4">
            {COLUMN_ORDER.map((laneKey) => (
              <KanbanColumn
                key={laneKey}
                laneKey={laneKey}
                tasks={columns[laneKey]}
                ownerLabelById={ownerLabelById}
                onOpenTask={openTask}
              />
            ))}
          </div>
        </div>
      ) : null}

      <TaskDetailModal
        task={selectedTask}
        isOpen={isDetailOpen}
        onClose={closeDetail}
        ownerLabelById={ownerLabelById}
      />
    </div>
  );
}
