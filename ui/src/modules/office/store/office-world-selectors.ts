import type { OfficeDataContextValue } from "@/providers/office-data-provider";
import type { OfficeWorldStore } from "./office-world-store";

export type OfficeWorldContextData = Omit<
  OfficeDataContextValue,
  | "refresh"
  | "applyOfficeSettings"
  | "manualResync"
  | "upsertFederationPolicy"
  | "upsertProviderIndexProfile"
>;

export function selectOfficeWorldContextData(state: OfficeWorldStore): OfficeWorldContextData {
  return {
    company: state.company,
    teams: state.teams,
    employees: state.employees,
    officeObjects: state.officeObjects,
    officeAreas: state.officeAreas,
    desks: state.desks,
    officeSettings: state.officeSettings,
    companyModel: state.companyModel,
    workload: state.workload,
    warnings: state.warnings,
    isLoading: state.isLoading,
  };
}

export function selectSceneEmployees(state: OfficeWorldStore) {
  return state.employees;
}

export function selectSceneOfficeObjects(state: OfficeWorldStore) {
  return state.officeObjects;
}

export function selectSceneOfficeSettings(state: OfficeWorldStore) {
  return state.officeSettings;
}

export function selectSceneOfficeAreas(state: OfficeWorldStore) {
  return state.officeAreas;
}

export function selectOfficeBootstrapState(state: OfficeWorldStore) {
  return {
    isLoading: state.isLoading,
    officeObjects: state.officeObjects,
  };
}
