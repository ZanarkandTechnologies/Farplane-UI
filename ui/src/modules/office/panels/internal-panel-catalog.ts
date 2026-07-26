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
  | "organization"
  | "team-workspace"
  | "telemetry"
  | "finance"
  | "raw-telemetry"
  | "thread-data"
  | "resource-bank"
  | "world"
  | "document-library"
  | "skill-os"
  | "skill-rollout"
  | "harness-graph"
  | "harness-rollout"
  | "rollout"
  | "template-tracking"
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
    id: "organization",
    label: "Organization",
    description: "Open the organization overview and people operations panel.",
    keywords: ["organization", "org chart", "teams", "people", "directory"],
  },
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
    id: "finance",
    label: "Finance",
    description: "Open company cash balance, daily flow observations, and close history.",
    keywords: ["finance", "money", "cash flow", "income", "expenses", "weekly close"],
  },
  {
    id: "raw-telemetry",
    label: "Raw Telemetry",
    description: "Inspect hook events, distributions, and hook setup.",
    keywords: ["telemetry", "hooks", "events", "raw", "kibana"],
  },
  {
    id: "thread-data",
    label: "Thread Data",
    description: "Open mining runs, backfill programs, artifacts, and output review.",
    keywords: ["thread", "data", "mining", "runs", "backfill", "tickets", "eval"],
  },
  {
    id: "resource-bank",
    label: "Resource Bank",
    description: "Open saved media references, analysis, and extracted skill findings.",
    keywords: ["resource", "bank", "assets", "references", "ingestion"],
  },
  {
    id: "world",
    label: "World",
    description: "Inspect project entities, locations, and explicit associations on a map.",
    keywords: ["world", "map", "knowledge graph", "crm", "supply chain", "entities"],
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
    description:
      "Open the global skill registry, graph, standards, and skill-template control plane.",
    keywords: ["skills", "skill os", "registry", "templates", "rollout"],
  },
  {
    id: "skill-rollout",
    label: "Skill Rollout",
    description:
      "Open Skill OS Rollout for template adoption, weighted health, and feature coverage.",
    keywords: ["skills", "skill rollout", "skill heat", "tier", "compounding", "lifecycle"],
  },
  {
    id: "template-tracking",
    label: "Template Tracking",
    description: "Open the Harness OS Template Tracking tab for template version adoption.",
    keywords: ["template", "templates", "tracking", "versions", "manifest", "standards"],
  },
  {
    id: "template-rollout",
    label: "Template Tracking",
    description: "Legacy alias for template version tracking.",
    keywords: ["template", "templates", "tracking", "versions", "legacy"],
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
    description: "Open the Harness OS semantic graph, lifecycle, and feature registry.",
    keywords: ["harness", "harness os", "map", "graph", "lifecycle", "features", "registry"],
  },
  {
    id: "harness-graph",
    label: "Harness Map",
    description: "Legacy alias for the generated Harness map.",
    keywords: ["harness", "graph", "map", "docs", "features", "skills", "legacy"],
  },
  {
    id: "rollout",
    label: "Project Rollout",
    description: "Open the Harness OS Project Rollout tab for project manifest adoption.",
    keywords: ["harness", "rollout", "projects", "framework", "versions"],
  },
  {
    id: "harness-rollout",
    label: "Rollout",
    description: "Legacy alias for project-level rollout.",
    keywords: ["harness", "rollout", "projects", "templates", "versions", "legacy"],
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
