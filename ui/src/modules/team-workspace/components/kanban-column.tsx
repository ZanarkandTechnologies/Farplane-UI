"use client";

/**
 * KANBAN COLUMN
 * =============
 * A single Team Kanban lane with CEO-workbench-aligned board styling.
 *
 * KEY CONCEPTS:
 * - Header shows lane dot, label, count badge, and compact description.
 * - Cards scroll independently per lane.
 * - Empty state uses a dashed border placeholder.
 *
 * USAGE:
 * - Render inside KanbanTab, one per board lane.
 */

import { ScrollArea } from "@/components/ui/scroll-area";
import { KanbanTaskCard } from "./kanban-task-card";
import {
  type KanbanLaneKey,
  type PanelTask,
  STATUS_COLORS,
  STATUS_LABELS,
} from "./team-panel-types";

interface KanbanColumnProps {
  laneKey: KanbanLaneKey;
  tasks: PanelTask[];
  ownerLabelById: Map<string, string>;
  onOpenTask: (task: PanelTask) => void;
}

const LANE_BORDER: Record<KanbanLaneKey, string> = {
  todo: "border-border",
  in_progress: "border-primary/40",
  review: "border-amber-500/40",
  blocked: "border-destructive/30",
  done: "border-emerald-500/30",
};

const LANE_ACCENT: Record<KanbanLaneKey, string> = {
  todo: "text-muted-foreground",
  in_progress: "text-primary",
  review: "text-amber-500",
  blocked: "text-destructive",
  done: "text-emerald-500",
};

const LANE_LABELS: Record<KanbanLaneKey, string> = {
  todo: STATUS_LABELS.todo,
  in_progress: STATUS_LABELS.in_progress,
  review: "Review",
  blocked: STATUS_LABELS.blocked,
  done: STATUS_LABELS.done,
};

const LANE_DESCRIPTIONS: Record<KanbanLaneKey, string> = {
  todo: "Queued work waiting to start.",
  in_progress: "Active tasks the team is moving now.",
  review: "Needs human sign-off or requested changes.",
  blocked: "Needs intervention before work can continue.",
  done: "Completed tasks stay here for quick audit.",
};

export function KanbanColumn({
  laneKey,
  tasks,
  ownerLabelById,
  onOpenTask,
}: KanbanColumnProps): JSX.Element {
  const dotClass = STATUS_COLORS[laneKey];

  return (
    <section className={`flex min-h-0 flex-col border bg-card ${LANE_BORDER[laneKey]}`}>
      <div className="space-y-2 border-b border-border px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass}`} />
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground">
              {LANE_LABELS[laneKey]}
            </h3>
          </div>
          <span className="border border-border bg-background px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        <p className={`text-xs leading-5 ${LANE_ACCENT[laneKey]}`}>{LANE_DESCRIPTIONS[laneKey]}</p>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-3 py-3">
        <div className="space-y-3 pb-3">
          {tasks.length === 0 ? (
            <div className="border border-dashed border-border bg-background p-4 text-center">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {laneKey === "todo"
                  ? "No tasks yet"
                  : laneKey === "in_progress"
                    ? "Nothing running"
                    : laneKey === "review"
                      ? "No tasks awaiting review"
                      : laneKey === "blocked"
                        ? "All clear"
                        : "Completed tasks appear here"}
              </p>
            </div>
          ) : null}

          {tasks.map((task) => (
            <KanbanTaskCard
              key={task.id}
              task={task}
              ownerLabel={
                task.ownerAgentId
                  ? (ownerLabelById.get(task.ownerAgentId) ?? task.ownerAgentId)
                  : "unassigned"
              }
              onOpen={onOpenTask}
            />
          ))}
        </div>
      </ScrollArea>
    </section>
  );
}
