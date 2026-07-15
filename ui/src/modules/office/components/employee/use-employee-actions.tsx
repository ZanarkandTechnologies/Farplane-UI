"use client";

/**
 * Employee radial action composition.
 *
 * Ownership: maps employee/runtime capabilities to honest context-menu actions.
 * Inputs: employee identity, Codex observation metadata, and shell callbacks.
 * Outputs: memoized ContextMenu actions; OpenClaw retains its management controls.
 * Side effects: action callbacks update transient app panels or scene intent.
 */

import {
  Activity,
  Book,
  Brain,
  Gamepad2,
  GitFork,
  MessageSquare,
  Monitor,
  Search,
  UserCog,
} from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import type { Id } from "@/lib/entity-types";
import type { EmployeeData } from "@/modules/office/lib/types";
import { useOfficeRuntimeAdapter } from "@/modules/runtime";
import { useAppStore } from "@/store";
import type { MenuAction } from "../context-menu";

export function useEmployeeActions(input: {
  id: Id<"employees">;
  isCEO?: boolean;
  observedRuntime?: EmployeeData["observedRuntime"];
  onClick: (employeeId: Id<"employees">) => void;
}): MenuAction[] {
  const { id, isCEO, observedRuntime, onClick } = input;
  const setSelectedObjectId = useAppStore((state) => state.setSelectedObjectId);
  const controlledEmployeeId = useAppStore((state) => state.controlledEmployeeId);
  const setControlledEmployeeId = useAppStore((state) => state.setControlledEmployeeId);
  const setManageAgentEmployeeId = useAppStore((state) => state.setManageAgentEmployeeId);
  const setThreadLineageReveal = useAppStore((state) => state.setThreadLineageReveal);
  const setMemoryPanelEmployeeId = useAppStore((state) => state.setMemoryPanelEmployeeId);
  const setKanbanFocusAgentId = useAppStore((state) => state.setKanbanFocusAgentId);
  const setIsSkillsPanelOpen = useAppStore((state) => state.setIsSkillsPanelOpen);
  const setSelectedSkillStudioSkillId = useAppStore((state) => state.setSelectedSkillStudioSkillId);
  const setSkillStudioFocusAgentId = useAppStore((state) => state.setSkillStudioFocusAgentId);
  const isOfficeOnboardingVisible = useAppStore((state) => state.isOfficeOnboardingVisible);
  const officeOnboardingStep = useAppStore((state) => state.officeOnboardingStep);
  const runtimeAdapter = useOfficeRuntimeAdapter();
  const isControlled = controlledEmployeeId === id;
  const isCodex = runtimeAdapter.runtimeKind === "codex";

  return useMemo(() => {
    const openConversation = () => {
      setSelectedObjectId(null);
      onClick(id);
    };

    if (isCodex) {
      const threadId = observedRuntime?.threadId ?? observedRuntime?.sessionKey;
      const isHookObserved = observedRuntime?.controllable === false;
      const actions: MenuAction[] = [
        {
          id: isHookObserved ? "activity" : "chat",
          label: isHookObserved ? "Activity" : "Chat",
          icon: isHookObserved ? Activity : MessageSquare,
          color: "blue",
          position: "top",
          isHighlighted:
            isOfficeOnboardingVisible && officeOnboardingStep === "open-chat" && Boolean(isCEO),
          onClick: () => {
            if (isHookObserved) {
              setSelectedObjectId(null);
              setManageAgentEmployeeId(id);
              return;
            }
            openConversation();
          },
        },
        {
          id: "control",
          label: isControlled ? "Release" : "Move",
          icon: Gamepad2,
          color: isControlled ? "red" : "green",
          position: "bottom",
          onClick: () => {
            setSelectedObjectId(null);
            setControlledEmployeeId(isControlled ? null : id);
          },
        },
      ];

      if (!isHookObserved) {
        actions.splice(1, 0, {
          id: "inspect",
          label: "Inspect",
          icon: Search,
          color: "amber",
          position: "right",
          onClick: () => {
            setSelectedObjectId(null);
            setManageAgentEmployeeId(id);
          },
        });
      }

      const parentThreadId = observedRuntime?.parentThreadId;
      if (parentThreadId && threadId) {
        actions.push({
          id: "show-parent",
          label: "Parent",
          icon: GitFork,
          color: "purple",
          position: "left",
          onClick: () => {
            setSelectedObjectId(null);
            const requestedAt = Date.now();
            setThreadLineageReveal({
              id: `manual-parent:${threadId}:${requestedAt}`,
              source: parentThreadId,
              target: threadId,
              kind: "spawned",
              requestedAt,
            });
          },
        });
      }
      return actions;
    }

    return [
      {
        id: "chat",
        label: "Chat",
        icon: MessageSquare,
        color: "blue",
        position: "top" as const,
        isHighlighted:
          isOfficeOnboardingVisible && officeOnboardingStep === "open-chat" && Boolean(isCEO),
        onClick: openConversation,
      },
      {
        id: "computer",
        label: "Computer",
        icon: Monitor,
        color: "green",
        position: "right" as const,
        onClick: () => toast.info("Computer view is hidden for this demo."),
      },
      {
        id: "manage",
        label: "Manage",
        icon: UserCog,
        color: "amber",
        position: "bottom" as const,
        onClick: () => setManageAgentEmployeeId(id),
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
        id: "control",
        label: isControlled ? "Release" : "Control",
        icon: Gamepad2,
        color: isControlled ? "red" : "green",
        onClick: () => setControlledEmployeeId(isControlled ? null : id),
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
    );
  }, [
    id,
    isCodex,
    isControlled,
    isCEO,
    isOfficeOnboardingVisible,
    observedRuntime,
    officeOnboardingStep,
    onClick,
    runtimeAdapter.capabilities.employeeSkillEquip,
    setControlledEmployeeId,
    setIsSkillsPanelOpen,
    setKanbanFocusAgentId,
    setManageAgentEmployeeId,
    setMemoryPanelEmployeeId,
    setSelectedObjectId,
    setSelectedSkillStudioSkillId,
    setSkillStudioFocusAgentId,
    setThreadLineageReveal,
  ]);
}
