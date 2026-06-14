import type { ShellModuleDefinition } from "./types";

export const moduleRegistry = {
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
    description: "Saved media references, analysis, extracted skill findings, and retrieval handles.",
    surfaces: ["nav", "panel", "hud", "office-object"],
  },
  "review-board": {
    id: "review-board",
    label: "Review Board",
    description: "Human review and approval surfaces for board-native work.",
    surfaces: ["nav", "panel"],
  },
  chat: {
    id: "chat",
    label: "Chat",
    description: "Operator intervention, thread messages, and chat panels.",
    surfaces: ["panel", "hud", "office-object"],
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
