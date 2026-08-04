/**
 * OFFICE SCENE INTERACTIONS
 * =========================
 * Centralized click handlers for office scene entities and background resets.
 *
 * KEY CONCEPTS:
 * - Scene interaction routing should live in one hook instead of being recreated inline.
 * - Placement mode remains the guardrail for scene click side-effects.
 *
 * USAGE:
 * - Call from `scene-contents.tsx` and pass the returned callbacks to scene entities.
 *
 * MEMORY REFERENCES:
 * - MEM-0108
 * - MEM-0143
 * - MEM-0153
 */

import type { ThreeEvent } from "@react-three/fiber";
import { useCallback } from "react";
import { toast } from "sonner";
import { TOTAL_HEIGHT } from "@/constants";
import { useChatActions } from "@/modules/chat";
import { getOperatingRoomByHostAgentId } from "@/modules/office/lib/operating-room-catalog";
import { buildRoomHostConversationKey } from "@/modules/office/lib/room-hosts";
import type { EmployeeData, TeamData } from "@/modules/office/lib/types";
import { useAppStore } from "@/store";

export function useOfficeSceneInteractions(params: { employees: EmployeeData[] }): {
  handleBackgroundClick: (event: ThreeEvent<MouseEvent>) => void;
  handleBackgroundContextMenu: (event: ThreeEvent<MouseEvent>) => void;
  handleEmployeeClick: (employeeId: EmployeeData["_id"]) => Promise<void>;
  handleTeamClick: (team: TeamData) => Promise<void>;
  handleCeoDeskClick: (event: ThreeEvent<MouseEvent>) => void;
} {
  const { employees } = params;
  const { openEmployeeChat } = useChatActions();

  const setActiveChatParticipant = useAppStore((state) => state.setActiveChatParticipant);
  const setIsTeamPanelOpen = useAppStore((state) => state.setIsTeamPanelOpen);
  const setActiveTeamId = useAppStore((state) => state.setActiveTeamId);
  const setSelectedTeamId = useAppStore((state) => state.setSelectedTeamId);
  const setSelectedProjectId = useAppStore((state) => state.setSelectedProjectId);
  const setKanbanFocusAgentId = useAppStore((state) => state.setKanbanFocusAgentId);
  const setIsCeoWorkbenchOpen = useAppStore((state) => state.setIsCeoWorkbenchOpen);
  const placementMode = useAppStore((state) => state.placementMode);
  const isDragging = useAppStore((state) => state.isDragging);
  const setSelectedObjectId = useAppStore((state) => state.setSelectedObjectId);
  const setControlledEmployeeDestination = useAppStore(
    (state) => state.setControlledEmployeeDestination,
  );

  const handleEmployeeClick = useCallback(
    async (employeeId: EmployeeData["_id"]) => {
      const employee = employees.find((entry) => entry._id === employeeId);
      if (!employee) return;
      if (useAppStore.getState().placementMode.active) return;
      if (!employee.companyId) return;

      const hostAgentId = String(employee._id).replace(/^employee-/, "");
      const operatingRoom = getOperatingRoomByHostAgentId(hostAgentId);
      const conversationKey = buildRoomHostConversationKey({
        hostAgentId,
        selectedProjectId: useAppStore.getState().selectedProjectId,
      });
      if (operatingRoom?.hostScope === "selected-project" && !conversationKey) {
        toast.info(`Select a project before chatting with ${employee.name}.`);
        return;
      }

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
        conversationKey: conversationKey ?? undefined,
      });
    },
    [employees, openEmployeeChat, setActiveChatParticipant],
  );

  const handleTeamClick = useCallback(
    async (team: TeamData) => {
      if (useAppStore.getState().placementMode.active) return;

      if (!team.companyId) {
        console.error("Team has no company:", team);
        return;
      }

      setActiveTeamId(team._id);
      setSelectedTeamId(team._id);
      if (String(team._id).startsWith("team-")) {
        setSelectedProjectId(String(team._id).replace(/^team-/, ""));
      }
      setKanbanFocusAgentId(null);
      setIsTeamPanelOpen(true);
    },
    [
      setActiveTeamId,
      setIsTeamPanelOpen,
      setKanbanFocusAgentId,
      setSelectedProjectId,
      setSelectedTeamId,
    ],
  );

  const handleBackgroundClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (!placementMode.active && !isDragging) {
        event.stopPropagation();
        setSelectedObjectId(null);
      }
    },
    [isDragging, placementMode.active, setSelectedObjectId],
  );

  const handleBackgroundContextMenu = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      const state = useAppStore.getState();
      if (
        !state.controlledEmployeeId ||
        state.placementMode.active ||
        state.isDragging ||
        state.isBuilderMode
      ) {
        return;
      }

      event.stopPropagation();
      event.nativeEvent.preventDefault();
      setControlledEmployeeDestination([event.point.x, TOTAL_HEIGHT / 2, event.point.z]);
    },
    [setControlledEmployeeDestination],
  );

  const handleCeoDeskClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (useAppStore.getState().placementMode.active) return;
      event.stopPropagation();
      setSelectedObjectId(null);
      setIsCeoWorkbenchOpen(true);
    },
    [setIsCeoWorkbenchOpen, setSelectedObjectId],
  );

  return {
    handleBackgroundClick,
    handleBackgroundContextMenu,
    handleEmployeeClick,
    handleTeamClick,
    handleCeoDeskClick,
  };
}
