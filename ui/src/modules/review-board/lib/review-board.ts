/**
 * REVIEW BOARD HELPERS
 * ====================
 * Normalizes the filesystem-backed company task projection for CEO read-only views.
 * Canonical TASK-* identity stays separate from project scope; callers use both
 * fields when selecting a row so identical ticket ids across projects do not collide.
 */

import type { PanelTask } from "@/modules/team-workspace";

export type ReviewBoardTask = PanelTask & {
  projectId: string;
};

export type CompanyFilesystemTaskRow = {
  id: string;
  projectId: string;
  title: string;
  status?: string;
  ownerAgentId?: string;
  priority?: string;
  provider?: string;
  providerUrl?: string;
  artefactPath?: string;
  syncState?: string;
  syncError?: string;
  frontMatter?: Record<string, string>;
  markdown?: string;
  notes?: string;
  approvalState?: string;
  linkedSessionKey?: string;
  createdTeamId?: string;
  createdProjectId?: string;
  createdAt?: number;
  updatedAt?: number;
  dueAt?: number;
};

function normalizeTaskStatus(status: string | undefined): PanelTask["status"] {
  if (
    status === "in_progress" ||
    status === "review" ||
    status === "blocked" ||
    status === "done"
  ) {
    return status;
  }
  return "todo";
}

export function normalizeReviewBoardTasks(
  rows: ReadonlyArray<CompanyFilesystemTaskRow> | undefined,
): ReviewBoardTask[] {
  return (rows ?? []).flatMap((task): ReviewBoardTask[] => {
    const id = task.id.trim();
    const projectId = task.projectId.trim();
    const title = task.title.trim();
    if (!id || !projectId || !title) return [];
    return [
      {
        id,
        projectId,
        title,
        status: normalizeTaskStatus(task.status),
        ownerAgentId: task.ownerAgentId,
        priority: task.priority === "low" || task.priority === "high" ? task.priority : "medium",
        provider:
          task.provider === "notion" || task.provider === "vibe" || task.provider === "linear"
            ? task.provider
            : "internal",
        providerUrl: task.providerUrl,
        artefactPath: task.artefactPath,
        syncState:
          task.syncState === "pending" ||
          task.syncState === "conflict" ||
          task.syncState === "error"
            ? task.syncState
            : "healthy",
        syncError: task.syncError,
        frontMatter: task.frontMatter,
        markdown: task.markdown,
        notes: task.notes,
        approvalState:
          task.approvalState === "pending_review" ||
          task.approvalState === "approved" ||
          task.approvalState === "rejected" ||
          task.approvalState === "changes_requested" ||
          task.approvalState === "executed"
            ? task.approvalState
            : "draft",
        linkedSessionKey: task.linkedSessionKey,
        createdTeamId: task.createdTeamId,
        createdProjectId: task.createdProjectId,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        dueAt: task.dueAt,
      },
    ];
  });
}

export function reviewBoardTaskKey(task: Pick<ReviewBoardTask, "id" | "projectId">): string {
  return JSON.stringify([task.projectId, task.id]);
}

export function resolveReviewBoardTasks(
  rows: ReadonlyArray<CompanyFilesystemTaskRow> | undefined,
): ReviewBoardTask[] {
  return normalizeReviewBoardTasks(rows);
}

export function countReviewLaneTasks(tasks: ReadonlyArray<ReviewBoardTask>): number {
  return tasks.filter((task) => task.status === "review").length;
}
