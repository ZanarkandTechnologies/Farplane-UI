/**
 * OFFICE SYSTEM STORES
 * ====================
 *
 * Module-local Zustand stores for canonical office world state and transient
 * Three.js object registration.
 */

export { useObjectRegistrationStore } from "./object-registration-store";
export {
  useOfficeWorldStore,
  type OfficeWorldStore,
} from "./office-world-store";
export {
  createInitialOfficeWorldData,
  reconcileOfficeWorldSnapshot,
  type OfficeWorldChangedKey,
  type OfficeWorldData,
  type OfficeWorldRefreshReason,
  type OfficeWorldSnapshot,
} from "./office-world-reconciliation";
export {
  selectOfficeBootstrapState,
  selectOfficeWorldContextData,
  selectSceneEmployees,
  selectSceneOfficeAreas,
  selectSceneOfficeObjects,
  selectSceneOfficeSettings,
  type OfficeWorldContextData,
} from "./office-world-selectors";
