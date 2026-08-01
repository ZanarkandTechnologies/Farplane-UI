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
  Archive,
  BarChart3,
  BookOpen,
  Building2,
  CircleDollarSign,
  Database,
  FileCode2,
  GitPullRequestArrow,
  Globe2,
  Hammer,
  LibraryBig,
  type LucideIcon,
  MessageSquareText,
  Network,
  RadioTower,
  ScanSearch,
  Settings,
  ShoppingBag,
  TestTube2,
  Users,
} from "lucide-react";

import { getOfficeInternalPanelEntry } from "@/modules/office/panels/internal-panel-catalog";

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
  | "organization"
  | "team-workspace"
  | "telemetry"
  | "finance"
  | "raw-telemetry"
  | "thread-data"
  | "resource-bank"
  | "video-intelligence"
  | "world"
  | "document-library"
  | "skill-os"
  | "rollout"
  | "template-tracking"
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
  openUserCommunications: () => void;
  openDecoration: () => void;
  openEvals: () => void;
  openHarness: () => void;
  openRollout: () => void;
  openSkillOs: () => void;
  openTemplateTracking: () => void;
  openGlobalTeamWorkspace: () => void;
  openOrganization: () => void;
  openSettings: () => void;
  openSkillInvocations: () => void;
  openResourceBank: () => void;
  openVideoIntelligence: () => void;
  openWorld: () => void;
  openDocumentLibrary: () => void;
  openCeoWorkbench: () => void;
  openHumanReview: () => void;
  openTelemetry: () => void;
  openFinance: () => void;
  openRawTelemetry: () => void;
  openThreadData: () => void;
  toggleBuilderMode: () => void;
};

export const OFFICE_COMMAND_PALETTE_SHORTCUT: OfficeShortcut = {
  key: "k",
  label: "Ctrl/Cmd+K",
  metaOrCtrlKey: true,
};

const OFFICE_LAUNCHER_ACTION_ORDER: OfficePanelActionId[] = [
  "organization",
  "ceo-workbench",
  "user-communications",
  "harness",
  "skill-os",
  "evals",
  "resource-bank",
  "video-intelligence",
  "world",
  "document-library",
  "telemetry",
  "finance",
  "raw-telemetry",
  "thread-data",
  "builder-mode",
  "office-shop",
  "settings",
];

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
  const teamWorkspacePanel = getOfficeInternalPanelEntry("team-workspace");
  const telemetryPanel = getOfficeInternalPanelEntry("telemetry");
  const financePanel = getOfficeInternalPanelEntry("finance");
  const rawTelemetryPanel = getOfficeInternalPanelEntry("raw-telemetry");
  const threadDataPanel = getOfficeInternalPanelEntry("thread-data");
  const resourceBankPanel = getOfficeInternalPanelEntry("resource-bank");
  const videoIntelligencePanel = getOfficeInternalPanelEntry("video-intelligence");
  const worldPanel = getOfficeInternalPanelEntry("world");
  const documentLibraryPanel = getOfficeInternalPanelEntry("document-library");
  const skillOsPanel = getOfficeInternalPanelEntry("skill-os");
  const rolloutPanel = getOfficeInternalPanelEntry("rollout");
  const templateTrackingPanel = getOfficeInternalPanelEntry("template-tracking");
  const evalsPanel = getOfficeInternalPanelEntry("evals");
  const harnessPanel = getOfficeInternalPanelEntry("harness");
  const ceoWorkbenchPanel = getOfficeInternalPanelEntry("ceo-workbench");
  const humanReviewPanel = getOfficeInternalPanelEntry("human-review");
  const userCommsPanel = getOfficeInternalPanelEntry("user-communications");
  const officeShopPanel = getOfficeInternalPanelEntry("office-shop");
  const settingsPanel = getOfficeInternalPanelEntry("settings");
  return [
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
      label: teamWorkspacePanel.label,
      description: teamWorkspacePanel.description,
      group: "panel",
      icon: Users,
      keywords: [...teamWorkspacePanel.keywords, "panel"],
      shortcut: { key: "t", label: "Alt+Shift+T", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      buttonClassName:
        deps.highlightedMenuActionId === "team-workspace" ? GUIDED_BUTTON_CLASS : undefined,
      disabled: readOnly,
      showInMenu: false,
      showInPalette: false,
      perform: readOnly ? noop : deps.openGlobalTeamWorkspace,
    },
    {
      id: "telemetry",
      label: telemetryPanel.label,
      description: telemetryPanel.description,
      group: "panel",
      icon: BarChart3,
      keywords: [...telemetryPanel.keywords, "dashboard"],
      shortcut: { key: "m", label: "Alt+Shift+M", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: deps.openTelemetry,
    },
    {
      id: "finance",
      label: financePanel.label,
      description: financePanel.description,
      group: "panel",
      icon: CircleDollarSign,
      keywords: [...financePanel.keywords, "firm"],
      shortcut: { key: "f", label: "Alt+Shift+F", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: deps.openFinance,
    },
    {
      id: "raw-telemetry",
      label: rawTelemetryPanel.label,
      description: rawTelemetryPanel.description,
      group: "panel",
      icon: RadioTower,
      keywords: [...rawTelemetryPanel.keywords, "hooks"],
      color: SECONDARY_BUTTON_COLOR,
      perform: readOnly ? noop : deps.openRawTelemetry,
      disabled: readOnly,
      showInMenu: !readOnly,
      showInPalette: !readOnly,
    },
    {
      id: "thread-data",
      label: threadDataPanel.label,
      description: threadDataPanel.description,
      group: "panel",
      icon: Database,
      keywords: [...threadDataPanel.keywords, "mining", "runs"],
      shortcut: { key: "i", label: "Alt+Shift+I", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: readOnly ? noop : deps.openThreadData,
      disabled: readOnly,
      showInMenu: !readOnly,
      showInPalette: !readOnly,
    },
    {
      id: "resource-bank",
      label: resourceBankPanel.label,
      description: resourceBankPanel.description,
      group: "panel",
      icon: Archive,
      keywords: [...resourceBankPanel.keywords, "pinterest", "media"],
      shortcut: { key: "r", label: "Alt+Shift+R", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: deps.openResourceBank,
    },
    {
      id: "video-intelligence",
      label: videoIntelligencePanel.label,
      description: videoIntelligencePanel.description,
      group: "panel",
      icon: ScanSearch,
      keywords: [...videoIntelligencePanel.keywords, "video", "stories", "perspectives"],
      shortcut: { key: "v", label: "Alt+Shift+V", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: deps.openVideoIntelligence,
    },
    {
      id: "world",
      label: worldPanel.label,
      description: worldPanel.description,
      group: "panel",
      icon: Globe2,
      keywords: [...worldPanel.keywords, "map", "graph", "supply chain"],
      shortcut: { key: "w", label: "Alt+Shift+W", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: deps.openWorld,
    },
    {
      id: "document-library",
      label: documentLibraryPanel.label,
      description: documentLibraryPanel.description,
      group: "panel",
      icon: LibraryBig,
      keywords: documentLibraryPanel.keywords,
      color: SECONDARY_BUTTON_COLOR,
      perform: deps.openDocumentLibrary,
    },
    {
      id: "skill-os",
      label: skillOsPanel.label,
      description: skillOsPanel.description,
      group: "panel",
      icon: BookOpen,
      keywords: [...skillOsPanel.keywords, "panel"],
      shortcut: { key: "s", label: "Alt+Shift+S", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: deps.openSkillOs,
    },
    {
      id: "harness",
      label: harnessPanel.label,
      description: harnessPanel.description,
      group: "panel",
      icon: Network,
      keywords: [...harnessPanel.keywords, "agents", "panel"],
      shortcut: { key: "h", label: "Alt+Shift+H", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: deps.openHarness,
    },
    {
      id: "rollout",
      label: rolloutPanel.label,
      description: rolloutPanel.description,
      group: "panel",
      icon: GitPullRequestArrow,
      keywords: [...rolloutPanel.keywords, "panel"],
      color: SECONDARY_BUTTON_COLOR,
      showInMenu: false,
      showInPalette: false,
      perform: deps.openRollout,
    },
    {
      id: "template-tracking",
      label: templateTrackingPanel.label,
      description: templateTrackingPanel.description,
      group: "panel",
      icon: FileCode2,
      keywords: [...templateTrackingPanel.keywords, "standards", "panel"],
      shortcut: { key: "l", label: "Alt+Shift+L", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      showInMenu: false,
      showInPalette: false,
      perform: deps.openTemplateTracking,
    },
    {
      id: "evals",
      label: evalsPanel.label,
      description: evalsPanel.description,
      group: "panel",
      icon: TestTube2,
      keywords: [...evalsPanel.keywords, "panel"],
      shortcut: { key: "e", label: "Alt+Shift+E", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: deps.openEvals,
    },
    {
      id: "user-communications",
      label: userCommsPanel.label,
      description: userCommsPanel.description,
      group: "panel",
      icon: MessageSquareText,
      keywords: [...userCommsPanel.keywords, "panel"],
      shortcut: { key: "u", label: "Alt+Shift+U", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: readOnly ? noop : deps.openUserCommunications,
      disabled: readOnly,
      showInMenu: !readOnly,
      showInPalette: !readOnly,
    },
    {
      id: "ceo-workbench",
      label: ceoWorkbenchPanel.label,
      description: ceoWorkbenchPanel.description,
      group: "panel",
      icon: Building2,
      keywords: [...ceoWorkbenchPanel.keywords, "panel"],
      shortcut: { key: "c", label: "Alt+Shift+C", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: readOnly ? noop : deps.openCeoWorkbench,
      disabled: readOnly,
      showInMenu: !readOnly,
      showInPalette: !readOnly,
    },
    {
      id: "human-review",
      label: humanReviewPanel.label,
      description: humanReviewPanel.description,
      group: "panel",
      icon: GitPullRequestArrow,
      keywords: [...humanReviewPanel.keywords, "panel"],
      color: SECONDARY_BUTTON_COLOR,
      perform: readOnly ? noop : deps.openHumanReview,
      disabled: readOnly,
      showInMenu: false,
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
      label: officeShopPanel.label,
      description: officeShopPanel.description,
      group: "panel",
      icon: ShoppingBag,
      keywords: [...officeShopPanel.keywords, "panel"],
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
      label: settingsPanel.label,
      description: settingsPanel.description,
      group: "panel",
      icon: Settings,
      keywords: [...settingsPanel.keywords, "panel"],
      shortcut: { key: "p", label: "Alt+Shift+P", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      disabled: readOnly,
      showInMenu: !readOnly,
      showInPalette: !readOnly,
      perform: readOnly ? noop : deps.openSettings,
    },
  ];
}

export function createOfficeLauncherActions(actions: OfficePanelAction[]): OfficePanelAction[] {
  const actionById = new Map(actions.map((action) => [action.id, action]));

  return OFFICE_LAUNCHER_ACTION_ORDER.map((actionId) => actionById.get(actionId)).filter(
    (action): action is OfficePanelAction =>
      Boolean(action && action.showInMenu !== false && !action.disabled),
  );
}

function noop(): void {}
