"use client";

/**
 * KANBAN TAB
 * ==========
 * Orchestrates the Team Kanban board: status lanes, review lane, and task detail modal.
 *
 * KEY CONCEPTS:
 * - Board state is read from Convex (canonical) or sidecar (fallback).
 * - All mutations go through boardCommand via the onBoardCommand callback.
 * - Task detail modal is driven by selectedTask local state.
 * - Quick-add at the bottom of each status lane uses task_add command.
 *
 * USAGE:
 * - Rendered inside TeamPanel as the "kanban" TabsContent.
 */

import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KanbanColumn } from "./kanban-column";
import { TaskDetailModal } from "./task-detail-modal";
import {
  buildKanbanColumns,
  type KanbanLaneKey,
  type PanelTask,
  type TaskStatus,
} from "./team-panel-types";
import type { ProjectKanbanLoadState, ProjectKanbanSnapshot } from "./use-project-kanban";

type EmployeeModel = {
  _id: string;
  name: string;
};

interface KanbanTabProps {
  projectTasks: PanelTask[];
  focusAgentId?: string | null;
  teamEmployees: EmployeeModel[];
  ownerLabelById: Map<string, string>;
  convexEnabled: boolean;
  kanbanSnapshot?: ProjectKanbanSnapshot | null;
  kanbanState?: ProjectKanbanLoadState;
  kanbanError?: string | null;
  onRefreshKanban?: () => Promise<void>;
  showReadOnlyNotice?: boolean;
  boardActionState: { pending: boolean; error?: string; ok?: string };
  onBoardCommand: (
    command: string,
    payload: Record<string, unknown>,
    successMessage: string,
  ) => Promise<void>;
}

const COLUMN_ORDER: KanbanLaneKey[] = ["todo", "in_progress", "review", "blocked", "done"];

export function KanbanTab({
  projectTasks,
  focusAgentId,
  teamEmployees,
  ownerLabelById,
  convexEnabled,
  kanbanSnapshot = null,
  kanbanState = "idle",
  kanbanError = null,
  onRefreshKanban,
  showReadOnlyNotice = true,
  boardActionState,
  onBoardCommand,
}: KanbanTabProps): JSX.Element {
  const [selectedTask, setSelectedTask] = useState<PanelTask | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const visibleTasks = useMemo(
    () =>
      focusAgentId ? projectTasks.filter((t) => t.ownerAgentId === focusAgentId) : projectTasks,
    [focusAgentId, projectTasks],
  );

  const columns = buildKanbanColumns(visibleTasks);
  const boardWritable = convexEnabled && kanbanSnapshot?.readOnly !== true;
  const sourceLabel = kanbanSnapshot
    ? kanbanSnapshot.providerConfig.provider.replace(/_/g, " ")
    : convexEnabled
      ? "convex board"
      : "office snapshot";
  const refreshedLabel = kanbanSnapshot?.readAtMs
    ? `${Math.max(0, Math.floor((Date.now() - kanbanSnapshot.readAtMs) / 1000))}s ago`
    : "not refreshed";

  const employeeOptions = useMemo(
    () =>
      teamEmployees
        .map((employee) => {
          const rawId = String(employee._id ?? "").trim();
          const agentId = rawId.startsWith("employee-") ? rawId.slice("employee-".length) : rawId;
          return { id: agentId, name: employee.name };
        })
        .filter((employee) => employee.id.length > 0),
    [teamEmployees],
  );

  function openTask(task: PanelTask): void {
    setSelectedTask(task);
    setIsDetailOpen(true);
  }

  function closeDetail(): void {
    setIsDetailOpen(false);
    setSelectedTask(null);
  }

  async function handleAddTask(title: string, status: TaskStatus): Promise<void> {
    if (!boardWritable) return;
    await onBoardCommand("task_add", { title, status, priority: "medium" }, "Task added.");
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
          {kanbanSnapshot?.readOnly ? <Badge variant="secondary">read-only</Badge> : null}
          {kanbanState === "error" ? (
            <Badge variant="destructive">{kanbanError ?? "kanban read failed"}</Badge>
          ) : null}
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

      {focusAgentId ? (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Showing tasks owned by <span className="font-mono">{focusAgentId}</span> in this panel
          scope.
        </div>
      ) : null}

      {!boardWritable && showReadOnlyNotice ? (
        <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          {kanbanSnapshot?.readOnly
            ? "Filesystem tickets are read-only in this first pass."
            : "Read-only view — connect a writable Kanban provider to enable task creation and edits."}
        </div>
      ) : null}

      {boardActionState.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {boardActionState.error}
        </div>
      ) : null}
      {boardActionState.ok ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600">
          {boardActionState.ok}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-x-auto pb-2">
        <div className="grid h-full min-w-[90rem] grid-cols-5 gap-4">
          {COLUMN_ORDER.map((laneKey) => (
            <KanbanColumn
              key={laneKey}
              laneKey={laneKey}
              tasks={columns[laneKey]}
              ownerLabelById={ownerLabelById}
              convexEnabled={boardWritable}
              isPending={boardActionState.pending}
              onOpenTask={openTask}
              onAddTask={handleAddTask}
            />
          ))}
        </div>
      </div>

      <TaskDetailModal
        task={selectedTask}
        isOpen={isDetailOpen}
        onClose={closeDetail}
        employees={employeeOptions}
        ownerLabelById={ownerLabelById}
        convexEnabled={boardWritable}
        isPending={boardActionState.pending}
        onCommand={onBoardCommand}
      />
    </div>
  );
}
