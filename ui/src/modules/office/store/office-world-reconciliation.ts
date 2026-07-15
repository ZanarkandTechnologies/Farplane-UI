import type { OfficeAreaNode } from "@/modules/office/lib/office-area-layout";
import { DEFAULT_OFFICE_FOOTPRINT } from "@/modules/office/lib/office-footprint";
import { createRectangularOfficeLayout } from "@/modules/office/lib/office-layout";
import type {
  Company,
  DeskLayoutData,
  EmployeeData,
  OfficeObject,
  TeamData,
} from "@/modules/office/lib/types";
import type {
  AgentLiveStatus,
  CompanyModel,
  OfficeSettingsModel,
  ProjectWorkloadSummary,
  ReconciliationWarning,
} from "@/modules/runtime";
import { stabilizeOfficeData } from "@/providers/office-data-stability";

export type OfficeWorldRefreshReason =
  | "initial"
  | "poll"
  | "manual"
  | "settings"
  | "resync"
  | "policy"
  | "provider-profile"
  | "live-status"
  | "error";

export type OfficeWorldChangedKey =
  | "company"
  | "teams"
  | "employees"
  | "desks"
  | "officeObjects"
  | "officeAreas"
  | "officeSettings"
  | "companyModel"
  | "workload"
  | "warnings"
  | "liveStatus"
  | "loading"
  | "error";

export type OfficeWorldSnapshot = {
  company: Company | null;
  teams: TeamData[];
  employees: EmployeeData[];
  desks: DeskLayoutData[];
  officeObjects: OfficeObject[];
  officeAreas: OfficeAreaNode[];
  officeSettings: OfficeSettingsModel;
  companyModel: CompanyModel | null;
  workload: ProjectWorkloadSummary[];
  warnings: ReconciliationWarning[];
  liveStatusByAgentId: Record<string, AgentLiveStatus>;
  isLoading: boolean;
  error?: string;
};

export type OfficeWorldData = OfficeWorldSnapshot & {
  teamIds: string[];
  teamsById: Record<string, TeamData>;
  employeeIds: string[];
  employeesById: Record<string, EmployeeData>;
  deskIds: string[];
  desksById: Record<string, DeskLayoutData>;
  officeObjectIds: string[];
  officeObjectsById: Record<string, OfficeObject>;
  officeAreaIds: string[];
  officeAreasById: Record<string, OfficeAreaNode>;
  lastRefreshReason: OfficeWorldRefreshReason | null;
  lastChangedKeys: OfficeWorldChangedKey[];
  lastUpdatedAt: number | null;
};

function createDefaultOfficeSettings(): OfficeSettingsModel {
  return {
    meshAssetDir: "",
    officeFootprint: DEFAULT_OFFICE_FOOTPRINT,
    officeLayout: createRectangularOfficeLayout(DEFAULT_OFFICE_FOOTPRINT),
    decor: {
      floorPatternId: "sandstone_tiles",
      wallColorId: "gallery_cream",
      backgroundId: "estuary_glow",
    },
    viewProfile: "free_orbit_3d",
    orbitControlsEnabled: true,
    cameraOrientation: "south_east",
  };
}

function indexById<T>(items: T[], getId: (item: T) => string): Record<string, T> {
  return Object.fromEntries(items.map((item) => [getId(item), item]));
}

function areJsonEqual(current: unknown, next: unknown): boolean {
  return JSON.stringify(current) === JSON.stringify(next);
}

function buildOfficeWorldData(
  current: OfficeWorldData,
  snapshot: OfficeWorldSnapshot,
  reason: OfficeWorldRefreshReason,
): { next: OfficeWorldData; changedKeys: OfficeWorldChangedKey[] } {
  if (reason === "live-status") {
    const changedKeys: OfficeWorldChangedKey[] = [];
    if (!areJsonEqual(current.liveStatusByAgentId, snapshot.liveStatusByAgentId)) {
      changedKeys.push("liveStatus");
    }
    if (current.isLoading !== snapshot.isLoading) changedKeys.push("loading");
    if ((current.error ?? "") !== (snapshot.error ?? "")) changedKeys.push("error");
    if (changedKeys.length === 0) {
      return { next: current, changedKeys };
    }
    return {
      changedKeys,
      next: {
        ...current,
        liveStatusByAgentId: changedKeys.includes("liveStatus")
          ? snapshot.liveStatusByAgentId
          : current.liveStatusByAgentId,
        isLoading: snapshot.isLoading,
        error: snapshot.error,
        lastRefreshReason: reason,
        lastChangedKeys: changedKeys,
        lastUpdatedAt: Date.now(),
      },
    };
  }

  const stabilized = stabilizeOfficeData(current, snapshot);
  const changedKeys: OfficeWorldChangedKey[] = [];

  if (current.company !== stabilized.company) changedKeys.push("company");
  if (current.teams !== stabilized.teams) changedKeys.push("teams");
  if (current.employees !== stabilized.employees) changedKeys.push("employees");
  if (current.desks !== stabilized.desks) changedKeys.push("desks");
  if (current.officeObjects !== stabilized.officeObjects) changedKeys.push("officeObjects");
  if (current.officeAreas !== stabilized.officeAreas) changedKeys.push("officeAreas");
  if (current.officeSettings !== stabilized.officeSettings) changedKeys.push("officeSettings");
  if (current.companyModel !== stabilized.companyModel) changedKeys.push("companyModel");
  if (current.workload !== stabilized.workload) changedKeys.push("workload");
  if (current.warnings !== stabilized.warnings) changedKeys.push("warnings");
  if (!areJsonEqual(current.liveStatusByAgentId, snapshot.liveStatusByAgentId)) {
    changedKeys.push("liveStatus");
  }
  if (current.isLoading !== snapshot.isLoading) changedKeys.push("loading");
  if ((current.error ?? "") !== (snapshot.error ?? "")) changedKeys.push("error");

  if (changedKeys.length === 0) {
    return { next: current, changedKeys };
  }

  const liveStatusByAgentId = changedKeys.includes("liveStatus")
    ? snapshot.liveStatusByAgentId
    : current.liveStatusByAgentId;

  return {
    changedKeys,
    next: {
      ...current,
      ...stabilized,
      liveStatusByAgentId,
      isLoading: snapshot.isLoading,
      error: snapshot.error,
      teamIds: stabilized.teams.map((team) => team._id),
      teamsById: indexById(stabilized.teams, (team) => team._id),
      employeeIds: stabilized.employees.map((employee) => employee._id),
      employeesById: indexById(stabilized.employees, (employee) => employee._id),
      deskIds: stabilized.desks.map((desk) => desk.id),
      desksById: indexById(stabilized.desks, (desk) => desk.id),
      officeObjectIds: stabilized.officeObjects.map((object) => object._id),
      officeObjectsById: indexById(stabilized.officeObjects, (object) => object._id),
      officeAreaIds: stabilized.officeAreas.map((area) => area.id),
      officeAreasById: indexById(stabilized.officeAreas, (area) => area.id),
      lastRefreshReason: reason,
      lastChangedKeys: changedKeys,
      lastUpdatedAt: Date.now(),
    },
  };
}

export function createInitialOfficeWorldData(): OfficeWorldData {
  return {
    company: null,
    teams: [],
    employees: [],
    desks: [],
    officeObjects: [],
    officeAreas: [],
    officeSettings: createDefaultOfficeSettings(),
    companyModel: null,
    workload: [],
    warnings: [],
    liveStatusByAgentId: {},
    isLoading: true,
    teamIds: [],
    teamsById: {},
    employeeIds: [],
    employeesById: {},
    deskIds: [],
    desksById: {},
    officeObjectIds: [],
    officeObjectsById: {},
    officeAreaIds: [],
    officeAreasById: {},
    error: undefined,
    lastRefreshReason: null,
    lastChangedKeys: [],
    lastUpdatedAt: null,
  };
}

export function reconcileOfficeWorldSnapshot(
  current: OfficeWorldData,
  snapshot: OfficeWorldSnapshot,
  reason: OfficeWorldRefreshReason,
): { next: OfficeWorldData; changedKeys: OfficeWorldChangedKey[] } {
  return buildOfficeWorldData(current, snapshot, reason);
}
