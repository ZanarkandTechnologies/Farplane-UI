import type { OfficeSettingsModel } from "@/modules/runtime";
import type { EmployeeData, OfficeObject } from "@/modules/office/lib/types";
import type { OfficeAreaNode } from "@/modules/office/lib/office-area-layout";

type OfficeDataStabilityShape = {
  company: { _id: string; name: string } | null;
  teams: unknown[];
  employees: EmployeeData[];
  officeObjects: OfficeObject[];
  officeAreas: OfficeAreaNode[];
  desks: Array<{ id: string; deskIndex: number; team: string }>;
  officeSettings: OfficeSettingsModel;
  companyModel: unknown;
  workload: unknown;
  warnings: unknown;
  isLoading: boolean;
};

function buildPositionSignature(
  position: [number, number, number] | undefined,
): string {
  if (!position) return "";
  return position.join(",");
}

function buildCompanySignature(
  company: OfficeDataStabilityShape["company"],
): string {
  if (!company) return "";
  return `${company._id}|${company.name}`;
}

function buildTeamSignature(teams: OfficeDataStabilityShape["teams"]): string {
  return teams.map((team) => JSON.stringify(team)).join("||");
}

function buildDeskSignature(desks: OfficeDataStabilityShape["desks"]): string {
  return desks
    .map((desk) => `${desk.id}|${desk.deskIndex}|${desk.team}`)
    .join("||");
}

function buildHeartbeatBubbleSignature(
  bubbles: Array<{ label: string; weight?: number }> | undefined,
): string {
  return (bubbles ?? [])
    .map((bubble) => `${bubble.label}:${bubble.weight ?? ""}`)
    .join(",");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export function buildEmployeeSignature(employees: EmployeeData[]): string {
  return employees
    .map((employee) =>
      [
        employee._id,
        employee.companyId ?? "",
        employee.name,
        employee.teamId,
        employee.builtInRole ?? "",
        employee.jobTitle ?? "",
        employee.team ?? "",
        buildPositionSignature(employee.initialPosition),
        employee.status ?? "",
        employee.statusMessage ?? "",
        employee.isBusy ? "1" : "0",
        employee.isCEO ? "1" : "0",
        employee.isSupervisor ? "1" : "0",
        employee.gender ?? "",
        employee.deskId ?? "",
        employee.wantsToWander ? "1" : "0",
        employee.notificationCount ?? 0,
        employee.notificationPriority ?? 0,
        employee.activityState ?? "",
        employee.activityLabel ?? "",
        employee.activityDetail ?? "",
        employee.activityUpdatedAt ?? "",
        employee.heartbeatState ?? "",
        employee.profileImageUrl ?? "",
        buildHeartbeatBubbleSignature(employee.heartbeatBubbles),
        employee.activityTargetSkillId ?? "",
        buildPositionSignature(employee.activityTargetPosition),
        buildPositionSignature(employee.activityTargetObjectPosition),
        employee.activityEffectVariant ?? "",
      ].join("|"),
    )
    .join("||");
}

export function buildOfficeObjectSignature(
  officeObjects: OfficeObject[],
): string {
  return officeObjects
    .map((officeObject) => {
      const uiBinding = asRecord(officeObject.metadata?.uiBinding);
      const skillBinding = asRecord(officeObject.metadata?.skillBinding);
      return [
        officeObject._id,
        officeObject.meshType,
        buildPositionSignature(officeObject.position),
        buildPositionSignature(officeObject.rotation),
        buildPositionSignature(officeObject.scale),
        typeof officeObject.metadata?.displayName === "string"
          ? officeObject.metadata.displayName
          : "",
        typeof officeObject.metadata?.teamId === "string"
          ? officeObject.metadata.teamId
          : "",
        typeof officeObject.metadata?.meshPublicPath === "string"
          ? officeObject.metadata.meshPublicPath
          : "",
        typeof uiBinding.kind === "string" ? uiBinding.kind : "",
        typeof uiBinding.title === "string" ? uiBinding.title : "",
        typeof uiBinding.url === "string" ? uiBinding.url : "",
        typeof uiBinding.aspectRatio === "string" ? uiBinding.aspectRatio : "",
        typeof uiBinding.openMode === "string" ? uiBinding.openMode : "",
        typeof skillBinding.skillId === "string" ? skillBinding.skillId : "",
        typeof skillBinding.label === "string" ? skillBinding.label : "",
      ].join("|");
    })
    .join("||");
}

function buildOfficeAreaSignature(officeAreas: OfficeAreaNode[]): string {
  return officeAreas
    .map((area) =>
      [
        area.id,
        area.label,
        area.depth,
        area.parentId ?? "",
        area.projectId ?? "",
        area.departmentId ?? "",
        area.weight,
        area.color,
        area.rect.minX.toFixed(2),
        area.rect.maxX.toFixed(2),
        area.rect.minZ.toFixed(2),
        area.rect.maxZ.toFixed(2),
      ].join("|"),
    )
    .join("||");
}

function buildOfficeSettingsSignature(settings: OfficeSettingsModel): string {
  return [
    settings.meshAssetDir,
    settings.layoutStrategy ?? "team_neighborhoods",
    settings.officeFootprint.width,
    settings.officeFootprint.depth,
    settings.officeLayout.version,
    settings.officeLayout.tileSize,
    settings.officeLayout.tiles.join(","),
    settings.decor.floorPatternId,
    settings.decor.wallColorId,
    settings.decor.backgroundId,
    settings.viewProfile,
    settings.orbitControlsEnabled ? "1" : "0",
    settings.cameraOrientation,
  ].join("|");
}

function buildUnknownSignature(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

export function stabilizeOfficeData<T extends OfficeDataStabilityShape>(
  current: T,
  next: T,
): T {
  const stabilizedCompany =
    buildCompanySignature(current.company) ===
    buildCompanySignature(next.company)
      ? current.company
      : next.company;
  const stabilizedTeams =
    buildTeamSignature(current.teams) === buildTeamSignature(next.teams)
      ? current.teams
      : next.teams;
  const stabilizedEmployees =
    buildEmployeeSignature(current.employees) ===
    buildEmployeeSignature(next.employees)
      ? current.employees
      : next.employees;
  const stabilizedOfficeObjects =
    buildOfficeObjectSignature(current.officeObjects) ===
    buildOfficeObjectSignature(next.officeObjects)
      ? current.officeObjects
      : next.officeObjects;
  const stabilizedOfficeAreas =
    buildOfficeAreaSignature(current.officeAreas) ===
    buildOfficeAreaSignature(next.officeAreas)
      ? current.officeAreas
      : next.officeAreas;
  const stabilizedDesks =
    buildDeskSignature(current.desks) === buildDeskSignature(next.desks)
      ? current.desks
      : next.desks;
  const stabilizedOfficeSettings =
    buildOfficeSettingsSignature(current.officeSettings) ===
    buildOfficeSettingsSignature(next.officeSettings)
      ? current.officeSettings
      : next.officeSettings;
  const stabilizedCompanyModel =
    buildUnknownSignature(current.companyModel) ===
    buildUnknownSignature(next.companyModel)
      ? current.companyModel
      : next.companyModel;
  const stabilizedWorkload =
    buildUnknownSignature(current.workload) ===
    buildUnknownSignature(next.workload)
      ? current.workload
      : next.workload;
  const stabilizedWarnings =
    buildUnknownSignature(current.warnings) ===
    buildUnknownSignature(next.warnings)
      ? current.warnings
      : next.warnings;

  if (
    current.isLoading === next.isLoading &&
    current.company === stabilizedCompany &&
    current.teams === stabilizedTeams &&
    current.employees === stabilizedEmployees &&
    current.officeObjects === stabilizedOfficeObjects &&
    current.officeAreas === stabilizedOfficeAreas &&
    current.desks === stabilizedDesks &&
    current.officeSettings === stabilizedOfficeSettings &&
    current.companyModel === stabilizedCompanyModel &&
    current.workload === stabilizedWorkload &&
    current.warnings === stabilizedWarnings
  ) {
    return current;
  }

  return {
    ...next,
    company: stabilizedCompany,
    teams: stabilizedTeams,
    employees: stabilizedEmployees,
    officeObjects: stabilizedOfficeObjects,
    officeAreas: stabilizedOfficeAreas,
    desks: stabilizedDesks,
    officeSettings: stabilizedOfficeSettings,
    companyModel: stabilizedCompanyModel,
    workload: stabilizedWorkload,
    warnings: stabilizedWarnings,
  };
}
