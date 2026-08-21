"use client";

/**
 * ROOM HOST PROJECT SELECTOR
 * ==========================
 * Keeps project scope beside the chat composer for project-isolated room hosts.
 * Selecting a project immediately switches to that host's scoped conversation.
 */

import { FolderOpen, Loader2 } from "lucide-react";
import { type ReactElement, useEffect, useMemo, useState } from "react";
import { useChatActions } from "@/modules/chat";
import { getOperatingRoomByHostAgentId } from "@/modules/office/lib/operating-room-catalog";
import { buildRoomHostConversationKey } from "@/modules/office/lib/room-hosts";
import { useOfficeWorldStore } from "@/modules/office/store";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useAppStore } from "@/store";

type RoomHostProject = {
  id: string;
  name: string;
};

export function RoomHostProjectSelector({
  employeeId,
}: {
  employeeId: string;
}): ReactElement | null {
  const { companyModel } = useOfficeDataContext();
  const employees = useOfficeWorldStore((state) => state.employees);
  const setPendingEmployeeId = useAppStore((state) => state.setPendingRoomHostEmployeeId);
  const selectedOfficeProjectId = useAppStore((state) => state.selectedProjectId);
  const setSelectedProjectId = useAppStore((state) => state.setSelectedProjectId);
  const setActiveChatParticipant = useAppStore((state) => state.setActiveChatParticipant);
  const { openEmployeeChat } = useChatActions();
  const [projectId, setProjectId] = useState("");
  const [isOpening, setIsOpening] = useState(false);
  const [errorText, setErrorText] = useState("");

  const employee = employees.find((entry) => String(entry._id) === employeeId) ?? null;
  const hostAgentId = employee ? String(employee._id).replace(/^employee-/, "") : "";
  const room = hostAgentId ? getOperatingRoomByHostAgentId(hostAgentId) : undefined;
  const projects = useMemo<RoomHostProject[]>(
    () =>
      (companyModel?.projects ?? [])
        .filter((project) => project.trackingContext?.trim().startsWith("/"))
        .map((project) => ({ id: project.id, name: project.name })),
    [companyModel?.projects],
  );

  useEffect(() => {
    const preferredProject = projects.find((project) => project.id === selectedOfficeProjectId);
    setProjectId(preferredProject?.id ?? "");
  }, [projects, selectedOfficeProjectId]);

  async function openScopedChat(nextProjectId: string): Promise<void> {
    const selectedProject = projects.find((project) => project.id === nextProjectId);
    if (!employee || !room || !selectedProject || isOpening) return;
    const conversationKey = buildRoomHostConversationKey({
      hostAgentId: room.hostAgentId,
      selectedProjectId: selectedProject.id,
    });
    if (!conversationKey) return;

    setIsOpening(true);
    setErrorText("");
    try {
      setSelectedProjectId(selectedProject.id);
      setActiveChatParticipant({
        type: "employee",
        companyId: employee.companyId,
        employeeId: employee._id,
        teamId: employee.teamId,
        builtInRole: employee.builtInRole,
      });
      await openEmployeeChat(employee._id, {
        openDialog: true,
        displayName: employee.name,
        conversationKey,
      });
      setPendingEmployeeId(null);
    } catch {
      setErrorText("Could not open this project's conversation. Try again.");
    } finally {
      setIsOpening(false);
    }
  }

  if (!employee || !room || room.hostScope !== "selected-project") return null;

  return (
    <div className="border-t bg-background">
      <div className="container mx-auto max-w-4xl px-4 pt-3">
        <label className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <FolderOpen className="size-4 shrink-0" aria-hidden="true" />
          <span className="sr-only">Project</span>
          <select
            aria-label="Project"
            className="h-9 min-w-0 max-w-72 rounded-md border bg-muted/30 px-3 text-sm text-foreground"
            value={projectId}
            disabled={isOpening}
            onChange={(event) => {
              const nextProjectId = event.target.value;
              setProjectId(nextProjectId);
              if (nextProjectId) void openScopedChat(nextProjectId);
            }}
          >
            <option value="">Choose project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          {isOpening ? (
            <Loader2 className="size-4 animate-spin" aria-label="Opening project" />
          ) : null}
        </label>

        {projects.length === 0 ? (
          <output className="mt-2 block text-xs text-muted-foreground">
            No project with a local folder is configured yet.
          </output>
        ) : null}
        {errorText ? (
          <output className="mt-2 block text-xs text-destructive">{errorText}</output>
        ) : null}
      </div>
    </div>
  );
}
