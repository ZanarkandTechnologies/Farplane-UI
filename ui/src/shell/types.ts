import type { ComponentType } from "react";

export type FarplaneUiRenderer = "standard" | "office3d";

export type FarplaneUiPersistence = "local" | "cloud";

export type ShellModuleSurface = "nav" | "route" | "panel" | "office-object" | "hud";

export type ShellModuleDefinition = {
  id: string;
  label: string;
  description: string;
  surfaces: readonly ShellModuleSurface[];
};

export type FarplaneUiConfig<ModuleId extends string = string> = {
  renderer: FarplaneUiRenderer;
  persistence: FarplaneUiPersistence;
  modules: readonly ModuleId[];
};

export type FarplaneRendererProps<ModuleId extends string = string> = {
  config: FarplaneUiConfig<ModuleId>;
  moduleRegistry: Readonly<Record<ModuleId, ShellModuleDefinition>>;
};

export type FarplaneRendererComponent<ModuleId extends string = string> =
  ComponentType<FarplaneRendererProps<ModuleId>>;
