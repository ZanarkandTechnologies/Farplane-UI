import type { ShellModuleDefinition } from "./types";

export const moduleRegistry = {
  soundtrack: {
    id: "soundtrack",
    label: "Farplane Radio",
    description: "Shared background soundtrack and playback controls.",
    surfaces: ["hud"],
  },
  runtime: {
    id: "runtime",
    label: "Runtime",
    description: "Codex/OpenClaw adapter status, controls, and connection settings.",
    surfaces: ["nav", "panel", "hud"],
  },
  settings: {
    id: "settings",
    label: "Settings",
    description: "Operator configuration for runtime, office, and local UI behavior.",
    surfaces: ["panel", "hud"],
  },
  finance: {
    id: "finance",
    label: "Finance",
    description: "Company cash balance, daily flow observations, and close history.",
    surfaces: ["nav", "panel", "hud"],
  },
  leverage: {
    id: "leverage",
    label: "Leverage",
    description: "Read-only global capital, distribution, Edge, and evidence coverage.",
    surfaces: ["nav", "panel"],
  },
  "skills-studio": {
    id: "skills-studio",
    label: "Skills Studio",
    description: "Skill catalog, skill metadata, demos, diagrams, and assignment surfaces.",
    surfaces: ["nav", "panel", "office-object"],
  },
  "skill-invocations": {
    id: "skill-invocations",
    label: "Skill Invocations",
    description: "Codex skill-read telemetry, counts, and recent invocation diagnostics.",
    surfaces: ["nav", "panel", "hud"],
  },
  "resource-bank": {
    id: "resource-bank",
    label: "Resource Bank",
    description:
      "Saved media references, analysis, extracted skill findings, and retrieval handles.",
    surfaces: ["nav", "panel", "hud", "office-object"],
  },
  "content-intelligence": {
    id: "content-intelligence",
    label: "Content Intelligence",
    description: "External sources, cited stories, concepts, and the read-only World projection.",
    surfaces: ["nav", "panel", "hud", "office-object"],
  },
  "thread-data": {
    id: "thread-data",
    label: "Thread Data",
    description: "Historical Codex thread mining programs, backfill jobs, and output review.",
    surfaces: ["nav", "panel", "hud"],
  },
  "review-board": {
    id: "review-board",
    label: "Review Board",
    description: "Human review and approval surfaces for board-native work.",
    surfaces: ["nav", "panel"],
  },
  "user-communications": {
    id: "user-communications",
    label: "User Communications",
    description: "Human request inbox, Telegram reply routing, and communication handoff rules.",
    surfaces: ["panel", "hud"],
  },
  chat: {
    id: "chat",
    label: "Chat",
    description: "Operator intervention, thread messages, and chat panels.",
    surfaces: ["panel", "hud", "office-object"],
  },
  "realtime-call": {
    id: "realtime-call",
    label: "Realtime Call",
    description: "Project-scoped voice, camera, and screen-share calls with employees.",
    surfaces: ["hud", "office-object"],
  },
} as const satisfies Record<string, ShellModuleDefinition>;

export type FarplaneUiModuleId = keyof typeof moduleRegistry;

export function getRegisteredModuleIds(): FarplaneUiModuleId[] {
  return Object.keys(moduleRegistry) as FarplaneUiModuleId[];
}

export function getEnabledModules(
  moduleIds: readonly FarplaneUiModuleId[],
): ShellModuleDefinition[] {
  return moduleIds.map((moduleId) => moduleRegistry[moduleId]);
}
