"use client";

/**
 * OFFICE PANEL REGISTRY
 * =====================
 * Shared registry for the office's global panel launchers, shortcuts, and QA hooks.
 *
 * KEY CONCEPTS:
 * - One source of truth for menu items, command-palette actions, and keyboard shortcuts.
 * - Registry actions must call the same real UI state paths used by the HUD.
 * - Dev-only QA helpers may call this registry, but they must not bypass normal panel logic.
 *
 * USAGE:
 * - Built by `office-menu.tsx` and consumed by the speed-dial, command palette, and dev QA bridge.
 *
 * MEMORY REFERENCES:
 * - MEM-0220
 */

import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Hammer,
  Home,
  type LucideIcon,
  MessageSquareText,
  Network,
  Archive,
  Settings,
  ShoppingBag,
  TestTube2,
  Users,
} from "lucide-react";

import type { CeoWorkbenchView } from "@/store";

const SECONDARY_BUTTON_COLOR = "bg-secondary hover:bg-secondary/80 text-secondary-foreground";
const GUIDED_BUTTON_CLASS =
  "ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse";

export type OfficeShortcut = {
  key: string;
  label: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  metaOrCtrlKey?: boolean;
  shiftKey?: boolean;
};

export type OfficeActionGroup = "navigation" | "panel" | "action";
export type OfficeAccessPolicy = "operator" | "read-only";

export type OfficePanelActionId =
  | "back-landing"
  | "organization"
  | "team-workspace"
  | "telemetry"
  | "resource-bank"
  | "skill-os"
  | "evals"
  | "harness"
  | "ceo-workbench"
  | "human-review"
  | "user-communications"
  | "builder-mode"
  | "office-shop"
  | "settings";

export type OfficePanelAction = {
  id: OfficePanelActionId;
  label: string;
  description: string;
  group: OfficeActionGroup;
  icon: LucideIcon;
  keywords: string[];
  shortcut?: OfficeShortcut;
  badge?: number;
  color: string;
  disabled?: boolean;
  buttonClassName?: string;
  showInMenu?: boolean;
  showInPalette?: boolean;
  perform: () => void;
};

export type OfficePanelRegistryDependencies = {
  accessPolicy?: OfficeAccessPolicy;
  highlightedMenuActionId: string | null;
  isAnimatingCamera: boolean;
  isBuilderMode: boolean;
  navigateToLanding: () => void;
  openCeoWorkbench: (view: CeoWorkbenchView) => void;
  openUserCommunications: () => void;
  openDecoration: () => void;
  openEvals: () => void;
  openHarness: () => void;
  openSkillOs: () => void;
  openGlobalTeamWorkspace: () => void;
  openOrganization: () => void;
  openSettings: () => void;
  openSkillInvocations: () => void;
  openResourceBank: () => void;
  openTelemetry: () => void;
  toggleBuilderMode: () => void;
};

export const OFFICE_COMMAND_PALETTE_SHORTCUT: OfficeShortcut = {
  key: "k",
  label: "Ctrl/Cmd+K",
  metaOrCtrlKey: true,
};

export function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") {
    return false;
  }

  const candidate = target as {
    closest?: (selector: string) => unknown;
    isContentEditable?: boolean;
  };

  if (candidate.isContentEditable) {
    return true;
  }

  if (typeof candidate.closest !== "function") {
    return false;
  }

  return Boolean(
    candidate.closest(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"]',
    ),
  );
}

export function eventMatchesShortcut(
  event: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey">,
  shortcut: OfficeShortcut,
): boolean {
  const eventKey = event.key.toLowerCase();
  const shortcutKey = shortcut.key.toLowerCase();

  if (eventKey !== shortcutKey) {
    return false;
  }

  if (Boolean(event.altKey) !== Boolean(shortcut.altKey)) {
    return false;
  }
  if (Boolean(event.shiftKey) !== Boolean(shortcut.shiftKey)) {
    return false;
  }

  if (shortcut.metaOrCtrlKey) {
    if (!(event.metaKey || event.ctrlKey)) {
      return false;
    }
  } else {
    if (Boolean(event.metaKey) !== Boolean(shortcut.metaKey)) {
      return false;
    }
    if (Boolean(event.ctrlKey) !== Boolean(shortcut.ctrlKey)) {
      return false;
    }
  }

  return true;
}

export function createOfficePanelActions(
  deps: OfficePanelRegistryDependencies,
): OfficePanelAction[] {
  const readOnly = deps.accessPolicy === "read-only";
  return [
    {
      id: "back-landing",
      label: "Back to Landing",
      description: "Leave the office and return to the public landing page.",
      group: "navigation",
      icon: Home,
      keywords: ["home", "landing", "exit", "navigate"],
      color: SECONDARY_BUTTON_COLOR,
      perform: deps.navigateToLanding,
    },
    {
      id: "organization",
      label: "Organization",
      description: "Open the organization overview and people operations panel.",
      group: "panel",
      icon: Building2,
      keywords: ["teams", "people", "directory", "organization", "panel"],
      shortcut: { key: "o", label: "Alt+Shift+O", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: deps.openOrganization,
    },
    {
      id: "team-workspace",
      label: "Team Workspace",
      description: "Open the global team workspace with overview and kanban access.",
      group: "panel",
      icon: Users,
      keywords: ["team", "workspace", "kanban", "overview", "panel"],
      shortcut: { key: "t", label: "Alt+Shift+T", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      buttonClassName:
        deps.highlightedMenuActionId === "team-workspace" ? GUIDED_BUTTON_CLASS : undefined,
      disabled: readOnly,
      showInMenu: !readOnly,
      showInPalette: !readOnly,
      perform: readOnly ? noop : deps.openGlobalTeamWorkspace,
    },
    {
      id: "telemetry",
      label: "Telemetry",
      description: "Open overall project and team runtime telemetry.",
      group: "panel",
      icon: BarChart3,
      keywords: ["telemetry", "agent hours", "runtime", "projects", "dashboard"],
      shortcut: { key: "m", label: "Alt+Shift+M", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: deps.openTelemetry,
    },
    {
      id: "resource-bank",
      label: "Resource Bank",
      description: "Open saved media references, analysis, and extracted skill findings.",
      group: "panel",
      icon: Archive,
      keywords: ["resource", "bank", "assets", "references", "ingestion", "pinterest", "media"],
      shortcut: { key: "r", label: "Alt+Shift+R", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: deps.openResourceBank,
    },
    {
      id: "skill-os",
      label: "Skill OS",
      description: "Open the global skill registry, graph, rollout, and template control plane.",
      group: "panel",
      icon: BookOpen,
      keywords: ["skills", "skill os", "registry", "templates", "rollout", "panel"],
      shortcut: { key: "s", label: "Alt+Shift+S", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: deps.openSkillOs,
    },
    {
      id: "evals",
      label: "Evals",
      description: "Open global eval runs, skill eval files, hardcases, and suite status.",
      group: "panel",
      icon: TestTube2,
      keywords: ["eval", "evals", "tests", "hardcases", "suite", "panel"],
      shortcut: { key: "e", label: "Alt+Shift+E", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: deps.openEvals,
    },
    {
      id: "harness",
      label: "Harness OS",
      description:
        "Open the repo-wide Harness OS map across skills, docs, features, agents, templates, and validators.",
      group: "panel",
      icon: Network,
      keywords: ["harness", "harness os", "map", "graph", "docs", "features", "agents", "templates", "panel"],
      shortcut: { key: "h", label: "Alt+Shift+H", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: deps.openHarness,
    },
    {
      id: "ceo-workbench",
      label: "CEO Workbench",
      description: "Open the CEO workbench board view.",
      group: "panel",
      icon: BriefcaseBusiness,
      keywords: ["ceo", "workbench", "board", "tasks", "panel"],
      shortcut: { key: "w", label: "Alt+Shift+W", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: readOnly ? noop : () => deps.openCeoWorkbench("board"),
      disabled: readOnly,
      showInMenu: !readOnly,
      showInPalette: !readOnly,
    },
    {
      id: "human-review",
      label: "Human Review",
      description: "Open the CEO workbench review lane for founder approval tasks.",
      group: "panel",
      icon: BriefcaseBusiness,
      keywords: ["review", "approval", "human", "ceo", "panel"],
      shortcut: { key: "r", label: "Alt+Shift+R", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: readOnly ? noop : () => deps.openCeoWorkbench("review"),
      disabled: readOnly,
      showInMenu: !readOnly,
      showInPalette: !readOnly,
    },
    {
      id: "user-communications",
      label: "User Comms",
      description: "Configure Telegram reply routing and the main Codex thread.",
      group: "panel",
      icon: MessageSquareText,
      keywords: ["user", "communications", "telegram", "human", "requests", "panel"],
      shortcut: { key: "u", label: "Alt+Shift+U", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: readOnly ? noop : deps.openUserCommunications,
      disabled: readOnly,
      showInMenu: !readOnly,
      showInPalette: !readOnly,
    },
    {
      id: "builder-mode",
      label: deps.isBuilderMode ? "Exit Builder Mode" : "Builder Mode",
      description: "Toggle builder mode for placement and transform workflows.",
      group: "action",
      icon: Hammer,
      keywords: ["builder", "layout", "decor", "placement", "mode"],
      shortcut: { key: "b", label: "Alt+Shift+B", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      disabled: deps.isAnimatingCamera || readOnly,
      showInMenu: !readOnly,
      showInPalette: !readOnly,
      perform: readOnly ? noop : deps.toggleBuilderMode,
    },
    {
      id: "office-shop",
      label: "Decoration",
      description: "Open the decoration shop for office objects and furniture.",
      group: "panel",
      icon: ShoppingBag,
      keywords: ["shop", "decoration", "furniture", "office", "panel"],
      shortcut: { key: "d", label: "Alt+Shift+D", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      buttonClassName:
        deps.highlightedMenuActionId === "office-shop" ? GUIDED_BUTTON_CLASS : undefined,
      disabled: readOnly,
      showInMenu: !readOnly,
      showInPalette: !readOnly,
      perform: readOnly ? noop : deps.openDecoration,
    },
    {
      id: "settings",
      label: "Settings",
      description: "Open office settings and configuration preferences.",
      group: "panel",
      icon: Settings,
      keywords: ["settings", "preferences", "config", "panel"],
      shortcut: { key: "p", label: "Alt+Shift+P", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      disabled: readOnly,
      showInMenu: !readOnly,
      showInPalette: !readOnly,
      perform: readOnly ? noop : deps.openSettings,
    },
  ];
}

function noop(): void {}
