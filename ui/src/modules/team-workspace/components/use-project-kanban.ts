"use client";

/**
 * PROJECT KANBAN HOOK
 * ===================
 * Ownership: Team Workspace module.
 * Inputs: active project path/id plus panel visibility.
 * Outputs: one active Kanban provider snapshot, refresh state, and manual refresh command.
 * Side effects: read-only polling of the local Farplane Kanban bridge.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PanelTask } from "./team-panel-types";

export type KanbanProviderKind = "filesystem_tickets" | "notion" | "linear";
export type KanbanWritePolicy = "read_only_ui" | "local_first" | "provider_first";
export type ProjectKanbanLoadState = "idle" | "loading" | "ready" | "error";

export type ProjectKanbanProviderConfig = {
  provider: KanbanProviderKind;
  ticketsDir: string;
  archiveDir: string;
  writePolicy: KanbanWritePolicy;
  pollSeconds: number;
  configPath: string;
  exists: boolean;
};

export type ProjectKanbanSnapshot = {
  ok: boolean;
  provider: KanbanProviderKind;
  providerConfig: ProjectKanbanProviderConfig;
  projectId: string;
  projectPath: string;
  ticketsDir?: string;
  ticketRoot?: string;
  tasks: PanelTask[];
  taskCount: number;
  readAtMs: number;
  sourceVersion: string;
  readOnly: boolean;
  error?: string;
};

type ProjectKanbanResponse = Omit<ProjectKanbanSnapshot, "tasks"> & {
  tasks?: Array<Partial<PanelTask>>;
};

function normalizePanelTask(task: Partial<PanelTask>): PanelTask | null {
  const id = String(task.id ?? "").trim();
  const title = String(task.title ?? "").trim();
  if (!id || !title) return null;
  return {
    id,
    title,
    status:
      task.status === "in_progress" ||
      task.status === "review" ||
      task.status === "blocked" ||
      task.status === "done"
        ? task.status
        : "todo",
    ownerAgentId: task.ownerAgentId,
    priority: task.priority === "low" || task.priority === "high" ? task.priority : "medium",
    provider:
      task.provider === "notion" || task.provider === "vibe" || task.provider === "linear"
        ? task.provider
        : "internal",
    providerUrl: task.providerUrl,
    artefactPath: task.artefactPath,
    syncState:
      task.syncState === "pending" || task.syncState === "conflict" || task.syncState === "error"
        ? task.syncState
        : "healthy",
    syncError: task.syncError,
    frontMatter:
      task.frontMatter && typeof task.frontMatter === "object" ? task.frontMatter : undefined,
    markdown: typeof task.markdown === "string" ? task.markdown : undefined,
    notes: task.notes,
    taskType: task.taskType,
    specialist: task.specialist,
    approvalState: task.approvalState,
    threadId: task.threadId,
    createdTeamId: task.createdTeamId,
    createdProjectId: task.createdProjectId,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    dueAt: task.dueAt,
  };
}

function normalizeSnapshot(payload: ProjectKanbanResponse): ProjectKanbanSnapshot {
  const tasks = (Array.isArray(payload.tasks) ? payload.tasks : [])
    .map(normalizePanelTask)
    .filter((task): task is PanelTask => task !== null);
  return {
    ...payload,
    tasks,
    taskCount: typeof payload.taskCount === "number" ? payload.taskCount : tasks.length,
    readOnly: payload.readOnly !== false,
  };
}

export function useProjectKanban({
  projectPath,
  projectId,
  enabled,
}: {
  projectPath?: string | null;
  projectId?: string | null;
  enabled: boolean;
}): {
  snapshot: ProjectKanbanSnapshot | null;
  tasks: PanelTask[];
  state: ProjectKanbanLoadState;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [snapshot, setSnapshot] = useState<ProjectKanbanSnapshot | null>(null);
  const [state, setState] = useState<ProjectKanbanLoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const latestRequestRef = useRef(0);

  const canRead = Boolean(enabled && projectPath?.trim());

  const refresh = useCallback(async (): Promise<void> => {
    if (!canRead || !projectPath?.trim()) return;
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    setState((current) => (current === "ready" ? current : "loading"));
    setError(null);
    const params = new URLSearchParams({ projectPath: projectPath.trim() });
    if (projectId?.trim()) params.set("projectId", projectId.trim());
    try {
      const response = await fetch(`/farplane/kanban/read?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ProjectKanbanResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? `kanban_read_failed:${response.status}`);
      }
      if (latestRequestRef.current !== requestId) return;
      setSnapshot(normalizeSnapshot(payload));
      setState("ready");
    } catch (refreshError) {
      if (latestRequestRef.current !== requestId) return;
      setError(refreshError instanceof Error ? refreshError.message : "kanban_read_failed");
      setState("error");
    }
  }, [canRead, projectId, projectPath]);

  useEffect(() => {
    if (!canRead) {
      setSnapshot(null);
      setState("idle");
      setError(null);
      return;
    }
    setSnapshot(null);
    void refresh();
  }, [canRead, refresh]);

  useEffect(() => {
    if (!canRead) return;
    const pollMs = Math.max(10, snapshot?.providerConfig.pollSeconds ?? 60) * 1000;
    const timer = window.setInterval(() => {
      void refresh();
    }, pollMs);
    return () => window.clearInterval(timer);
  }, [canRead, refresh, snapshot?.providerConfig.pollSeconds]);

  useEffect(() => {
    if (!canRead) return;
    function handleFocus(): void {
      void refresh();
    }
    function handleVisibility(): void {
      if (document.visibilityState === "visible") void refresh();
    }
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [canRead, refresh]);

  const tasks = useMemo(() => snapshot?.tasks ?? [], [snapshot]);

  return { snapshot, tasks, state, error, refresh };
}
