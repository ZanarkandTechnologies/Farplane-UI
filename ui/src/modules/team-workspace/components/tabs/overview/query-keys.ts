export const overviewQueryKeys = {
  surface: (projectPath?: string | null): readonly ["overview-surface", string] => [
    "overview-surface",
    projectPath?.trim() || "no-project",
  ],
};
