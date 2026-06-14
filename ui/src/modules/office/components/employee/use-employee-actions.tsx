"use client";

/**
 * Employee radial action composition.
 *
 * Ownership: maps employee/entity state to context-menu actions.
 * Inputs: employee id, onboarding state, runtime capabilities, and shell callbacks.
 * Outputs: memoized ContextMenu actions.
 * Side effects: action callbacks update app panels or show small toasts.
 */

import { useMemo } from "react";
import { Book, Brain, MessageSquare, Monitor, UserCog } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/lib/entity-types";
import { useOfficeRuntimeAdapter } from "@/modules/runtime";
import { useAppStore } from "@/store";
import type { MenuAction } from "../context-menu";

export function useEmployeeActions(input: {
  id: Id<"employees">;
  isCEO?: boolean;
  onClick: (employeeId: Id<"employees">) => void;
}): MenuAction[] {
  const { id, isCEO, onClick } = input;
  const setSelectedObjectId = useAppStore((state) => state.setSelectedObjectId);
  const setManageAgentEmployeeId = useAppStore((state) => state.setManageAgentEmployeeId);
  const setMemoryPanelEmployeeId = useAppStore((state) => state.setMemoryPanelEmployeeId);
  const setKanbanFocusAgentId = useAppStore((state) => state.setKanbanFocusAgentId);
  const setIsSkillsPanelOpen = useAppStore((state) => state.setIsSkillsPanelOpen);
  const setSelectedSkillStudioSkillId = useAppStore((state) => state.setSelectedSkillStudioSkillId);
  const setSkillStudioFocusAgentId = useAppStore((state) => state.setSkillStudioFocusAgentId);
  const isOfficeOnboardingVisible = useAppStore((state) => state.isOfficeOnboardingVisible);
  const officeOnboardingStep = useAppStore((state) => state.officeOnboardingStep);
  const runtimeAdapter = useOfficeRuntimeAdapter();

  return useMemo(
    () =>
      [
        {
          id: "chat",
          label: "Chat",
          icon: MessageSquare,
          color: "blue",
          position: "top" as const,
          isHighlighted:
            isOfficeOnboardingVisible && officeOnboardingStep === "open-chat" && Boolean(isCEO),
          onClick: () => {
            setSelectedObjectId(null);
            onClick(id);
          },
        },
        {
          id: "computer",
          label: "Computer",
          icon: Monitor,
          color: "green",
          position: "right" as const,
          onClick: () => {
            toast.info("Computer view is hidden for this demo.");
          },
        },
        {
          id: "manage",
          label: "Manage",
          icon: UserCog,
          color: "amber",
          position: "bottom" as const,
          onClick: () => {
            setManageAgentEmployeeId(id);
          },
        },
        {
          id: "training",
          label: "Skills",
          icon: Book,
          color: "indigo",
          onClick: () => {
            const employeeId = String(id);
            const focusedAgentId = employeeId.startsWith("employee-")
              ? employeeId.replace(/^employee-/, "")
              : employeeId;
            setSelectedSkillStudioSkillId(null);
            setSkillStudioFocusAgentId(focusedAgentId);
            setIsSkillsPanelOpen(true);
          },
        },
        {
          id: "memory",
          label: "Context",
          icon: Brain,
          color: "purple",
          position: "left" as const,
          onClick: () => {
            const employeeId = String(id);
            const focusedAgentId = employeeId.startsWith("employee-")
              ? employeeId.replace(/^employee-/, "")
              : employeeId;
            setSelectedObjectId(null);
            setKanbanFocusAgentId(focusedAgentId);
            setMemoryPanelEmployeeId(id);
          },
        },
      ].filter(
        (action) => action.id !== "training" || runtimeAdapter.capabilities.employeeSkillEquip,
      ),
    [
      id,
      isCEO,
      isOfficeOnboardingVisible,
      officeOnboardingStep,
      onClick,
      runtimeAdapter.capabilities.employeeSkillEquip,
      setIsSkillsPanelOpen,
      setKanbanFocusAgentId,
      setManageAgentEmployeeId,
      setMemoryPanelEmployeeId,
      setSelectedObjectId,
      setSelectedSkillStudioSkillId,
      setSkillStudioFocusAgentId,
    ],
  );
}
