import {
  getRegisteredModuleIds,
  moduleRegistry,
  type FarplaneUiModuleId,
} from "./module-registry";
import type {
  FarplaneUiPersistence,
  FarplaneUiRenderer,
} from "./types";

export type FarplaneShellConfig = {
  renderer: FarplaneUiRenderer;
  persistence: FarplaneUiPersistence;
  modules: readonly FarplaneUiModuleId[];
};

export type FarplaneShellConfigInput = {
  renderer?: string;
  persistence?: string;
  modules?: readonly string[];
};

export const DEFAULT_FARPLANE_UI_CONFIG: FarplaneShellConfig = {
  renderer: "office3d",
  persistence: "local",
  modules: getRegisteredModuleIds(),
};

export function isFarplaneUiRenderer(value: string): value is FarplaneUiRenderer {
  return value === "standard" || value === "office3d";
}

export function isFarplaneUiPersistence(value: string): value is FarplaneUiPersistence {
  return value === "local" || value === "cloud";
}

export function isFarplaneUiModuleId(value: string): value is FarplaneUiModuleId {
  return value in moduleRegistry;
}

export function normalizeFarplaneUiConfig(
  config: FarplaneShellConfigInput | null | undefined,
): FarplaneShellConfig {
  const renderer =
    typeof config?.renderer === "string" && isFarplaneUiRenderer(config.renderer)
      ? config.renderer
      : DEFAULT_FARPLANE_UI_CONFIG.renderer;
  const persistence =
    typeof config?.persistence === "string" && isFarplaneUiPersistence(config.persistence)
      ? config.persistence
      : DEFAULT_FARPLANE_UI_CONFIG.persistence;
  const modules = Array.isArray(config?.modules)
    ? config.modules.filter(isFarplaneUiModuleId)
    : DEFAULT_FARPLANE_UI_CONFIG.modules;

  return {
    renderer,
    persistence,
    modules: modules.length > 0 ? modules : DEFAULT_FARPLANE_UI_CONFIG.modules,
  };
}
