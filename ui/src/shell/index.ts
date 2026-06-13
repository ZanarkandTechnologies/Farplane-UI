export { FarplaneShell, type FarplaneShellProps } from "./FarplaneShell";
export {
  getEnabledModules,
  getRegisteredModuleIds,
  moduleRegistry,
  type FarplaneUiModuleId,
} from "./module-registry";
export {
  DEFAULT_FARPLANE_UI_CONFIG,
  isFarplaneUiModuleId,
  isFarplaneUiPersistence,
  isFarplaneUiRenderer,
  normalizeFarplaneUiConfig,
  type FarplaneShellConfig,
} from "./shell-config";
export type {
  FarplaneRendererComponent,
  FarplaneRendererProps,
  FarplaneUiConfig,
  FarplaneUiPersistence,
  FarplaneUiRenderer,
  ShellModuleDefinition,
  ShellModuleSurface,
} from "./types";
