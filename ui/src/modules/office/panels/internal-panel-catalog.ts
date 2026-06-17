"use client";

/**
 * OFFICE INTERNAL PANEL CATALOG
 * =============================
 * Static registry of office panels that can be opened by launch surfaces.
 *
 * KEY CONCEPTS:
 * - Panel IDs are stable metadata values for object bindings and launcher UI.
 * - Entries stay data-only so HUD menus, object inspectors, and tests share one catalog.
 * - Only panels with global app-store launch paths are object-bindable.
 */

export type OfficeInternalPanelId =
  | "team-workspace"
  | "telemetry"
  | "raw-telemetry"
  | "resource-bank"
  | "document-library"
  | "skill-os"
  | "template-rollout"
  | "evals"
  | "harness"
  | "ceo-workbench"
  | "human-review"
  | "user-communications"
  | "office-shop"
  | "settings";

export type OfficeInternalPanelCatalogEntry = {
  id: OfficeInternalPanelId;
  label: string;
  description: string;
  keywords: string[];
};

export const OFFICE_INTERNAL_PANEL_CATALOG: OfficeInternalPanelCatalogEntry[] = [
  {
    id: "team-workspace",
    label: "Team Workspace",
    description: "Open the global team workspace with overview and board access.",
    keywords: ["team", "workspace", "kanban", "board", "overview"],
  },
  {
    id: "telemetry",
    label: "Harness Usage",
    description: "Open project and team agent-hour usage dashboards.",
    keywords: ["harness", "usage", "agent hours", "runtime", "projects"],
  },
  {
    id: "raw-telemetry",
    label: "Raw Telemetry",
    description: "Inspect hook events, distributions, and hook setup.",
    keywords: ["telemetry", "hooks", "events", "raw", "kibana"],
  },
  {
    id: "resource-bank",
    label: "Resource Bank",
    description: "Open saved media references, analysis, and extracted skill findings.",
    keywords: ["resource", "bank", "assets", "references", "ingestion"],
  },
  {
    id: "document-library",
    label: "Docs Library",
    description: "Open project documentation gathered from every office project folder.",
    keywords: ["docs", "documents", "library", "bookshelf", "project docs", "files"],
  },
  {
    id: "skill-os",
    label: "Skill OS",
    description: "Open the global skill registry, graph, rollout, and template control plane.",
    keywords: ["skills", "skill os", "registry", "templates", "rollout"],
  },
  {
    id: "template-rollout",
    label: "Template Rollout",
    description: "Open the rollout tracker for reusable Farplane template families.",
    keywords: ["template", "templates", "rollout", "tracking", "drift"],
  },
  {
    id: "evals",
    label: "Evals",
    description: "Open global eval runs, skill eval files, hardcases, and suite status.",
    keywords: ["eval", "evals", "tests", "hardcases", "suite"],
  },
  {
    id: "harness",
    label: "Harness OS",
    description: "Open the repo-wide Harness OS map.",
    keywords: ["harness", "harness os", "map", "graph", "docs", "features"],
  },
  {
    id: "ceo-workbench",
    label: "CEO Workbench",
    description: "Open the CEO workbench board view.",
    keywords: ["ceo", "workbench", "board", "tasks"],
  },
  {
    id: "human-review",
    label: "Human Review",
    description: "Open the CEO workbench review lane for founder approval tasks.",
    keywords: ["review", "approval", "human", "ceo"],
  },
  {
    id: "user-communications",
    label: "User Comms",
    description: "Configure Telegram reply routing and the main Codex thread.",
    keywords: ["user", "communications", "telegram", "human", "requests"],
  },
  {
    id: "office-shop",
    label: "Decoration",
    description: "Open the decoration shop for office objects and furniture.",
    keywords: ["shop", "decoration", "furniture", "office"],
  },
  {
    id: "settings",
    label: "Settings",
    description: "Open office settings and configuration preferences.",
    keywords: ["settings", "preferences", "config"],
  },
];

const OFFICE_INTERNAL_PANEL_IDS = new Set<OfficeInternalPanelId>(
  OFFICE_INTERNAL_PANEL_CATALOG.map((entry) => entry.id),
);

export function isOfficeInternalPanelId(value: unknown): value is OfficeInternalPanelId {
  return typeof value === "string" && OFFICE_INTERNAL_PANEL_IDS.has(value as OfficeInternalPanelId);
}

export function getOfficeInternalPanelEntry(
  panelId: OfficeInternalPanelId,
): OfficeInternalPanelCatalogEntry {
  return (
    OFFICE_INTERNAL_PANEL_CATALOG.find((entry) => entry.id === panelId) ??
    OFFICE_INTERNAL_PANEL_CATALOG[0]
  );
}
