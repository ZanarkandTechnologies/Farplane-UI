/**
 * OFFICE BOOTSTRAP
 * ================
 * Central readiness model for the office experience.
 *
 * KEY CONCEPTS:
 * - React does not need Unity-style init interfaces on every object.
 * - Each subsystem exposes a small readiness signal instead.
 * - The loader composes those signals in one ordered place.
 *
 * USAGE:
 * - Build stage rows from subsystem booleans with `buildOfficeBootstrapStages`
 * - Derive the active loader state with `getOfficeBootstrapState`
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 */

export type OfficeBootstrapStageId = "data" | "meshes" | "navigation";

export type OfficeBootstrapSignals = {
  dataReady: boolean;
  meshesReady: boolean;
  navigationReady: boolean;
};

export type OfficeBootstrapStage = {
  id: OfficeBootstrapStageId;
  label: string;
  detail: string;
  isReady: boolean;
};

const STAGE_ORDER: Array<{
  id: OfficeBootstrapStageId;
  label: string;
  detail: string;
}> = [
  {
    id: "data",
    label: "Syncing office data",
    detail: "Loading company, team, employee, desk, and office object state.",
  },
  {
    id: "meshes",
    label: "Preparing scene assets",
    detail: "Preloading custom meshes so object instances can render without local pop-in.",
  },
  {
    id: "navigation",
    label: "Building navigation grid",
    detail: "Finalizing obstacle registration and pathfinding startup for the live office scene.",
  },
];

export function buildOfficeBootstrapStages(
  signals: OfficeBootstrapSignals,
): OfficeBootstrapStage[] {
  return STAGE_ORDER.map((stage) => ({
    ...stage,
    isReady:
      stage.id === "data"
        ? signals.dataReady
        : stage.id === "meshes"
          ? signals.meshesReady
          : signals.navigationReady,
  }));
}

export function getOfficeBootstrapState(stages: OfficeBootstrapStage[]): {
  activeStage: OfficeBootstrapStage;
  completionRatio: number;
  isReady: boolean;
} {
  const readyCount = stages.filter((stage) => stage.isReady).length;
  const activeStage = stages.find((stage) => !stage.isReady) ?? stages[stages.length - 1];

  return {
    activeStage,
    completionRatio: stages.length === 0 ? 1 : readyCount / stages.length,
    isReady: readyCount === stages.length,
  };
}
