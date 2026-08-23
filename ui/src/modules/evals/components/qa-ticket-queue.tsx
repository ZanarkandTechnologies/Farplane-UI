"use client";

/**
 * QA Ticket Queue
 * ===============
 * Phase-skill surface for QA Lab. Proof validates existing ticket work; it does
 * not create blank artifact jobs like a studio station.
 */

import { MessageCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { type ReactElement, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getExecutiveSpecialist } from "@/lib/executive-specialists";
import { useChatActions, useChatStore } from "@/modules/chat";
import { getOperatingRoomDefinition } from "@/modules/office/lib/operating-room-catalog";
import { buildRoomHostConversationKey } from "@/modules/office/lib/room-hosts";
import { type PanelTask, useProjectKanban } from "@/modules/team-workspace";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useAppStore } from "@/store";

type QaProject = {
  id: string;
  name: string;
  path: string;
};

function configuredProjects(
  projects: Array<{ id: string; name: string; trackingContext?: string }>,
): QaProject[] {
  return projects
    .map((project) => ({
      id: project.id,
      name: project.name,
      path: project.trackingContext?.trim() ?? "",
    }))
    .filter((project) => project.path.startsWith("/"));
}

function isQaCandidate(task: PanelTask): boolean {
  if (task.status === "review") return true;
  if (task.status === "done") return false;
  return task.frontMatter?.requires_qa === "true";
}

function taskStatusLabel(task: PanelTask): string {
  return task.status.replace("_", " ");
}

function taskSortKey(task: PanelTask): number {
  if (task.status === "review") return 0;
  if (task.status === "blocked") return 1;
  if (task.status === "in_progress") return 2;
  return 3;
}

export function QaTicketQueue(): ReactElement | null {
  const { companyModel } = useOfficeDataContext();
  const { openEmployeeChat } = useChatActions();
  const selectedOfficeProjectId = useAppStore((state) => state.selectedProjectId);
  const setSelectedProjectId = useAppStore((state) => state.setSelectedProjectId);
  const projects = useMemo(
    () => configuredProjects(companyModel?.projects ?? []),
    [companyModel?.projects],
  );
  const [projectId, setProjectId] = useState("");
  const selectedProject = projects.find((project) => project.id === projectId) ?? null;
  const {
    tasks,
    state: queueState,
    error: queueError,
    refresh,
  } = useProjectKanban({
    projectPath: selectedProject?.path,
    projectId: selectedProject?.id,
    enabled: Boolean(selectedProject),
  });
  const qaTasks = useMemo(
    () =>
      tasks
        .filter(isQaCandidate)
        .sort(
          (left, right) =>
            taskSortKey(left) - taskSortKey(right) ||
            (right.updatedAt ?? 0) - (left.updatedAt ?? 0),
        ),
    [tasks],
  );
  const room = getOperatingRoomDefinition("qa");
  const host = getExecutiveSpecialist(room.hostAgentId);
  const hostName = host?.name ?? "Proof";

  useEffect(() => {
    const preferredProject = projects.find((project) => project.id === selectedOfficeProjectId);
    setProjectId((current) => {
      if (projects.some((project) => project.id === current)) return current;
      return preferredProject?.id ?? projects[0]?.id ?? "";
    });
  }, [projects, selectedOfficeProjectId]);

  function openTaskChat(threadId: string, project: QaProject): void {
    const sessionKey = `codex-thread:${threadId}`;
    const appState = useAppStore.getState();
    appState.setSelectedProjectId(project.id);
    appState.setSelectedAgentId(sessionKey);
    appState.setSelectedSessionKey(sessionKey);
    const chatState = useChatStore.getState();
    chatState.setCurrentEmployeeId(null);
    chatState.setCurrentTeamId(null);
    chatState.setPresentationMode("classic");
    chatState.setThreadId(sessionKey);
    chatState.setIsChatOpen(true);
  }

  async function talkToProof(): Promise<void> {
    if (!selectedProject) return;
    const conversationKey = buildRoomHostConversationKey({
      hostAgentId: room.hostAgentId,
      selectedProjectId: selectedProject.id,
    });
    if (!conversationKey) return;
    setSelectedProjectId(selectedProject.id);
    await openEmployeeChat(`employee-${room.hostAgentId}`, {
      openDialog: true,
      displayName: hostName,
      conversationKey,
    });
  }

  if (!projects.length) return null;

  return (
    <section className="rounded-md border bg-card/70 px-3 py-3" aria-label="QA Lab ticket queue">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md border bg-background text-primary">
            <ShieldCheck className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">QA Lab · Proof</p>
              <Badge variant="outline">phase skill</Badge>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              QA validates existing ticket work and writes evidence back to the ticket. It does not
              create blank artifact jobs.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={projectId}
            onChange={(event) => {
              const nextProjectId = event.target.value;
              setProjectId(nextProjectId);
              setSelectedProjectId(nextProjectId);
            }}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!selectedProject}
            onClick={() => void talkToProof()}
          >
            <MessageCircle className="size-4" />
            Talk to {hostName}
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={!selectedProject || queueState === "loading"}
            onClick={() => void refresh()}
            aria-label="Refresh QA queue"
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {queueState === "loading" ? (
          <p className="text-sm text-muted-foreground">Loading ticket queue…</p>
        ) : null}
        {queueError ? (
          <p className="text-sm text-destructive">Could not read ticket queue: {queueError}</p>
        ) : null}
        {queueState === "ready" && qaTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No review or QA-required tickets for this project.
          </p>
        ) : null}
        {qaTasks.map((task) => (
          <article
            key={task.id}
            className="min-w-[260px] rounded-md border bg-background px-3 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{task.title}</p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {task.id} · {taskStatusLabel(task)}
                </p>
              </div>
              <Badge variant={task.status === "review" ? "secondary" : "outline"}>
                {task.frontMatter?.requires_qa === "true" ? "QA" : "review"}
              </Badge>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3 w-full"
              disabled={!task.threadId || !selectedProject}
              onClick={() => {
                if (task.threadId && selectedProject) openTaskChat(task.threadId, selectedProject);
              }}
            >
              <MessageCircle className="size-4" />
              Open task chat
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}
