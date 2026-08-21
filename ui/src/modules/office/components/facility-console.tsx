"use client";

/**
 * Facility Console
 * =================
 * Artifact studios are durable service stations, not employees. This console
 * shows the selected project's existing jobs, opens their bound task chats,
 * and creates exactly one new ticket plus its one task thread when briefed.
 */

import { ArrowRight, MessageCircle, RefreshCw, Sparkles } from "lucide-react";
import { type ReactElement, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getExecutiveSpecialist } from "@/lib/executive-specialists";
import { resolveTicketSpecialist } from "@/lib/ticket-routing/specialist-registry";
import { UI_Z } from "@/lib/z-index";
import { useChatActions, useChatStore } from "@/modules/chat";
import { getOperatingRoomDefinition } from "@/modules/office/lib/operating-room-catalog";
import { buildRoomHostConversationKey } from "@/modules/office/lib/room-hosts";
import { type PanelTask, useProjectKanban } from "@/modules/team-workspace";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useAppStore } from "@/store";

type FacilityProject = {
  id: string;
  name: string;
  path: string;
};

type FacilityJobResponse = {
  ok?: boolean;
  error?: string;
  threadId?: string;
  ticket?: { id?: string; title?: string };
};

function configuredFacilityProjects(
  projects: Array<{ id: string; name: string; trackingContext?: string }>,
): FacilityProject[] {
  return projects
    .map((project) => ({
      id: project.id,
      name: project.name,
      path: project.trackingContext?.trim() ?? "",
    }))
    .filter((project) => project.path.startsWith("/"));
}

function readableError(payload: FacilityJobResponse, status: number): string {
  if (payload.ticket?.id) {
    return `${payload.ticket.id} was created, but its task could not start. Open it from the project board to continue.`;
  }
  if (status === 403) return "Only an operator can start work from this facility.";
  return "Could not start this task. Check the Office connection and try again.";
}

function studioName(displayName: string): string {
  return displayName.replace(/ Specialist$/, "");
}

function taskStatusLabel(task: PanelTask): string {
  return task.status.replace("_", " ");
}

export function FacilityConsole(): ReactElement | null {
  const { companyModel, refresh } = useOfficeDataContext();
  const { openEmployeeChat } = useChatActions();
  const activeFacilitySpecialistId = useAppStore((state) => state.activeFacilitySpecialistId);
  const setActiveFacilitySpecialistId = useAppStore((state) => state.setActiveFacilitySpecialistId);
  const selectedOfficeProjectId = useAppStore((state) => state.selectedProjectId);
  const facility = resolveTicketSpecialist(activeFacilitySpecialistId);
  const facilityId = facility?.id ?? null;
  const isOpen = Boolean(facility);
  const projects = useMemo(
    () => configuredFacilityProjects(companyModel?.projects ?? []),
    [companyModel?.projects],
  );
  const [projectId, setProjectId] = useState("");
  const [request, setRequest] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [errorText, setErrorText] = useState("");
  const selectedProject = projects.find((project) => project.id === projectId) ?? null;
  const room = facility?.roomId ? getOperatingRoomDefinition(facility.roomId) : null;
  const host = room ? getExecutiveSpecialist(room.hostAgentId) : null;
  const {
    tasks,
    state: jobsState,
    error: jobsError,
    refresh: refreshJobs,
  } = useProjectKanban({
    projectPath: selectedProject?.path,
    projectId: selectedProject?.id,
    enabled: isOpen && Boolean(selectedProject && facilityId),
  });
  const projectJobs = useMemo(
    () =>
      tasks
        .filter(
          (task) => task.specialist === facilityId || task.frontMatter?.specialist === facilityId,
        )
        .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0)),
    [facilityId, tasks],
  );

  useEffect(() => {
    if (!facilityId) return;
    setRequest("");
    setErrorText("");
  }, [facilityId]);

  useEffect(() => {
    if (!facilityId) return;
    const preferredProject = projects.find((project) => project.id === selectedOfficeProjectId);
    setProjectId((current) => {
      if (projects.some((project) => project.id === current)) return current;
      return preferredProject?.id ?? projects[0]?.id ?? "";
    });
  }, [facilityId, projects, selectedOfficeProjectId]);

  function openTaskChat(threadId: string, project: FacilityProject): void {
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

  async function talkToHost(): Promise<void> {
    if (!room || !host || !selectedProject) return;
    const conversationKey = buildRoomHostConversationKey({
      hostAgentId: room.hostAgentId,
      selectedProjectId: selectedProject.id,
    });
    if (!conversationKey) return;
    useAppStore.getState().setSelectedProjectId(selectedProject.id);
    await openEmployeeChat(`employee-${room.hostAgentId}`, {
      openDialog: true,
      displayName: host.name,
      conversationKey,
    });
    setActiveFacilitySpecialistId(null);
  }

  async function startTask(): Promise<void> {
    if (!facility || !selectedProject || !request.trim() || isStarting) return;
    setIsStarting(true);
    setErrorText("");
    try {
      const response = await fetch("/farplane/facility-jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-farplane-actor-role": "operator",
        },
        body: JSON.stringify({
          projectId: selectedProject.id,
          specialistId: facility.id,
          request: request.trim(),
        }),
      });
      const payload = (await response.json()) as FacilityJobResponse;
      const threadId = payload.threadId?.trim() ?? "";
      if (!response.ok || payload.ok !== true || !threadId) {
        throw new Error(readableError(payload, response.status));
      }

      openTaskChat(threadId, selectedProject);
      setActiveFacilitySpecialistId(null);
      await refresh().catch(() => undefined);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Could not start this task.");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) setActiveFacilitySpecialistId(null);
      }}
    >
      <DialogContent
        className="max-w-[min(94vw,620px)] gap-0 overflow-hidden p-0"
        style={{ zIndex: UI_Z.panelElevated }}
      >
        <DialogHeader className="border-b bg-muted/25 px-6 py-5 text-left">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-md border bg-background p-2 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle>
                {facility ? `${studioName(facility.displayName)} Studio` : "Studio"}
              </DialogTitle>
              <DialogDescription className="mt-1 max-w-lg">
                Makes {facility?.deliverableLabel ?? "a project outcome"}. Starting a job creates
                one ticket and its task chat for the selected project.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="grid min-w-[220px] flex-1 gap-2 text-sm font-medium">
              Project
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm font-normal"
                value={projectId}
                disabled={isStarting || projects.length === 0}
                onChange={(event) => setProjectId(event.target.value)}
              >
                {projects.length === 0 ? (
                  <option>No local project folder is available</option>
                ) : null}
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            {host ? (
              <Button
                type="button"
                variant="outline"
                disabled={!selectedProject}
                onClick={() => void talkToHost()}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Talk to {host.name}
              </Button>
            ) : null}
          </div>

          <section className="rounded-md border bg-muted/15 p-3" aria-label="Existing studio jobs">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Existing jobs</p>
                <p className="text-xs text-muted-foreground">
                  {selectedProject
                    ? `${projectJobs.length} ${projectJobs.length === 1 ? "job" : "jobs"} for this studio in ${selectedProject.name}.`
                    : "Choose a project to see its jobs."}
                </p>
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                disabled={!selectedProject || jobsState === "loading"}
                onClick={() => void refreshJobs()}
                aria-label="Refresh studio jobs"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1">
              {jobsState === "loading" ? (
                <p className="text-sm text-muted-foreground">Loading project jobs…</p>
              ) : null}
              {jobsError ? (
                <p className="text-sm text-destructive">Could not read project jobs: {jobsError}</p>
              ) : null}
              {jobsState === "ready" && projectJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No jobs yet. Brief the studio below to create the first one.
                </p>
              ) : null}
              {projectJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{job.title}</p>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {job.id} · {taskStatusLabel(job)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!job.threadId || !selectedProject}
                    onClick={() => {
                      if (job.threadId && selectedProject)
                        openTaskChat(job.threadId, selectedProject);
                    }}
                  >
                    <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                    Open chat
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <label className="grid gap-2 text-sm font-medium">
            Brief a new {facility?.deliverableLabel ?? "job"}
            <textarea
              className="min-h-28 resize-y rounded-md border bg-background px-3 py-2 text-sm font-normal leading-6"
              value={request}
              disabled={isStarting || !selectedProject}
              placeholder="Describe the outcome, audience, and any important constraints."
              onChange={(event) => setRequest(event.target.value)}
            />
          </label>

          {errorText ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorText}
            </p>
          ) : null}

          <Button
            type="button"
            className="w-full"
            disabled={!selectedProject || !request.trim() || isStarting}
            onClick={() => void startTask()}
          >
            {isStarting ? "Starting job…" : "Start new job"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
