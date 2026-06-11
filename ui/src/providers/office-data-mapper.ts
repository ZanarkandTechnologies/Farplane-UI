"use client";

/**
 * OFFICE DATA MAPPER
 * ==================
 * Pure office-data derivation helpers shared by the office provider and tests.
 *
 * KEY CONCEPTS:
 * - Canonicalize sidecar office objects before building scene state.
 * - Derive teams, desks, office objects, and employees from unified runtime data.
 * - Keep React/provider orchestration outside this module.
 *
 * USAGE:
 * - Import `fallbackData()` for explicit adapter-empty fallback state.
 * - Import `toOfficeData()` to derive the office context snapshot from unified data.
 *
 * MEMORY REFERENCES:
 * - MEM-0176
 * - MEM-0182
 * - MEM-0183
 * - MEM-0185
 * - MEM-0194
 */

import { normalizeOfficeObjectId } from "@/modules/office/components/office-object-id";
import { parseOfficeObjectInteractionConfig } from "@/modules/office/office-object-ui";
import {
  buildSkillEffectSeed,
  resolveSkillEffectVariant,
} from "@/modules/office/skill-effects";
import {
  buildSkillTargetObjectMap,
  getOfficeSkillAnchorPositionForOccupant,
} from "@/modules/office/skill-targeting";
import {
  getAbsoluteDeskPosition,
  getClusterOccupancyFootprint,
  getDeskRotation,
  getEmployeePositionAtDesk,
} from "@/modules/office/utils/layout";
import {
  computeBusinessReadinessIssues,
  projectToBusinessBuilderDraft,
} from "@/modules/business";
import { DEFAULT_OFFICE_FOOTPRINT } from "@/modules/office/lib/office-footprint";
import {
  clampPositionToOfficeLayout,
  createRectangularOfficeLayout,
  getManagementAnchorFromOfficeLayout,
  type OfficeLayoutModel,
} from "@/modules/office/lib/office-layout";
import {
  countObjectFootprintCollisions,
  isObjectFootprintInsideLayout,
  objectFootprintsCollide,
  type ObjectFootprintInput,
} from "@/modules/office/utils/object-footprints";
import type {
  AgentCardModel,
  AgentLiveStatus,
  CompanyModel,
  FederatedTaskProvider,
  FederationProjectPolicy,
  OfficeSettingsModel,
  OpenClawConfigSnapshot,
  PendingApprovalModel,
  ProjectWorkloadSummary,
  ProviderIndexProfile,
  ReconciliationWarning,
  UnifiedOfficeModel,
} from "@/modules/runtime";
import type { Company, DeskLayoutData, EmployeeData, OfficeObject, TeamData } from "@/modules/office/lib/types";

type ScenePlacementObject = ObjectFootprintInput;
const DEFAULT_PROJECT_CLUSTER_POSITIONS: Array<[number, number, number]> = [
  [0, 0, 13],
  [-12, 0, 4.25],
  [12, 0, 4.25],
  [-12, 0, -4.5],
  [0, 0, -4.5],
  [12, 0, -4.5],
  [-12, 0, -13],
  [0, 0, -13],
  [12, 0, -13],
  [-12, 0, 13],
  [12, 0, 13],
  [0, 0, 4.25],
];

export interface OfficeDataContextValue {
  company: Company | null;
  teams: TeamData[];
  employees: EmployeeData[];
  officeObjects: OfficeObject[];
  desks: DeskLayoutData[];
  officeSettings: OfficeSettingsModel;
  companyModel: CompanyModel | null;
  workload: ProjectWorkloadSummary[];
  warnings: ReconciliationWarning[];
  refresh: () => Promise<void>;
  applyOfficeSettings: (settings: OfficeSettingsModel) => void;
  manualResync: (
    projectId: string,
    provider?: FederatedTaskProvider,
  ) => Promise<{ ok: boolean; error?: string }>;
  upsertFederationPolicy: (
    policy: FederationProjectPolicy,
  ) => Promise<{ ok: boolean; error?: string }>;
  upsertProviderIndexProfile: (
    profile: ProviderIndexProfile,
  ) => Promise<{ ok: boolean; error?: string }>;
  isLoading: boolean;
}

type EmployeeAppearance = NonNullable<EmployeeData["appearance"]>;

const demoCompany: Company = { _id: "company-demo", name: "Farplane AI" };

function isAppearanceClothesStyle(
  value: unknown,
): value is NonNullable<EmployeeAppearance["clothesStyle"]> {
  return (
    value === "default" ||
    value === "dj" ||
    value === "professional" ||
    value === "techBro"
  );
}

function isAppearancePetType(
  value: unknown,
): value is NonNullable<EmployeeAppearance["petType"]> {
  return (
    value === "none" ||
    value === "dog" ||
    value === "cat" ||
    value === "goldfish" ||
    value === "rabbit" ||
    value === "lobster"
  );
}

function getDefaultProjectClusterPosition(projectIndex: number): [number, number, number] {
  const safeIndex = Number.isFinite(projectIndex) ? Math.max(0, Math.floor(projectIndex)) : 0;
  return DEFAULT_PROJECT_CLUSTER_POSITIONS[safeIndex % DEFAULT_PROJECT_CLUSTER_POSITIONS.length] ?? [
    0,
    0,
    8,
  ];
}

function getTeamClusterPlacementMetadata(
  metadata: Record<string, unknown> | undefined,
  deskCount: number,
): Record<string, unknown> {
  const footprint = getClusterOccupancyFootprint(deskCount);
  return {
    ...(metadata ?? {}),
    deskCount,
    footprintWidth: footprint.width,
    footprintDepth: footprint.depth,
    footprintClearance: footprint.clearance,
  };
}

function resolveSceneObjectPosition(input: {
  object: ScenePlacementObject;
  officeLayout: OfficeLayoutModel;
  reservedObjects: ScenePlacementObject[];
  allowCollisionFallback?: boolean;
}): [number, number, number] | null {
  const clampedPreferred = clampPositionToOfficeLayout(input.object.position, input.officeLayout, 0);
  const preferredObject = { ...input.object, position: clampedPreferred };
  if (
    isObjectFootprintInsideLayout(preferredObject, input.officeLayout) &&
    !input.reservedObjects.some((object) => objectFootprintsCollide(preferredObject, object))
  ) {
    input.reservedObjects.push(preferredObject);
    return clampedPreferred;
  }

  const candidates = input.officeLayout.tiles
    .map((tile) => {
      const [xRaw, zRaw] = tile.split(":");
      return [Number(xRaw), input.object.position[1], Number(zRaw)] as [number, number, number];
    })
    .filter((position) => Number.isFinite(position[0]) && Number.isFinite(position[2]))
    .sort((left, right) => {
      const leftDistance =
        (left[0] - input.object.position[0]) ** 2 + (left[2] - input.object.position[2]) ** 2;
      const rightDistance =
        (right[0] - input.object.position[0]) ** 2 + (right[2] - input.object.position[2]) ** 2;
      return leftDistance - rightDistance;
    });

  let lowestCollisionCandidate: {
    position: [number, number, number];
    collisionCount: number;
    distance: number;
  } | null = null;

  for (const position of candidates) {
    const candidateObject = { ...input.object, position };
    if (!isObjectFootprintInsideLayout(candidateObject, input.officeLayout)) continue;
    const collisionCount = countObjectFootprintCollisions(candidateObject, input.reservedObjects);
    if (collisionCount === 0) {
      input.reservedObjects.push(candidateObject);
      return position;
    }
    const distance =
      (position[0] - input.object.position[0]) ** 2 + (position[2] - input.object.position[2]) ** 2;
    if (
      lowestCollisionCandidate === null ||
      collisionCount < lowestCollisionCandidate.collisionCount ||
      (collisionCount === lowestCollisionCandidate.collisionCount &&
        distance < lowestCollisionCandidate.distance)
    ) {
      lowestCollisionCandidate = { position, collisionCount, distance };
    }
  }

  if (input.allowCollisionFallback !== false && lowestCollisionCandidate) {
    const fallbackObject = { ...input.object, position: lowestCollisionCandidate.position };
    input.reservedObjects.push(fallbackObject);
    return lowestCollisionCandidate.position;
  }

  return null;
}

function resolveTeamClusterScenePosition(input: {
  position: [number, number, number];
  deskCount: number;
  officeLayout: OfficeLayoutModel;
  reservedObjects: ScenePlacementObject[];
  metadata?: Record<string, unknown>;
  rotation?: [number, number, number];
}): [number, number, number] {
  return resolveSceneObjectPosition({
    object: {
      meshType: "team-cluster",
      position: input.position,
      metadata: getTeamClusterPlacementMetadata(input.metadata, input.deskCount),
      rotation: input.rotation,
    },
    officeLayout: input.officeLayout,
    reservedObjects: input.reservedObjects,
    allowCollisionFallback: true,
  }) ?? clampPositionToOfficeLayout(input.position, input.officeLayout, 0);
}

function shouldReplaceCanonicalSidecarObject(
  current: UnifiedOfficeModel["officeObjects"][number],
  next: UnifiedOfficeModel["officeObjects"][number],
  canonicalId: string,
): boolean {
  const currentIsCanonical = current.id === canonicalId;
  const nextIsCanonical = next.id === canonicalId;
  if (currentIsCanonical !== nextIsCanonical) return nextIsCanonical;
  return false;
}

function dedupeCanonicalSidecarObjects(
  objects: UnifiedOfficeModel["officeObjects"],
): UnifiedOfficeModel["officeObjects"] {
  const byCanonicalId = new Map<string, UnifiedOfficeModel["officeObjects"][number]>();
  for (const object of objects) {
    const canonicalId = normalizeOfficeObjectId(object.id);
    const existing = byCanonicalId.get(canonicalId);
    if (!existing) {
      byCanonicalId.set(canonicalId, object);
      continue;
    }
    if (shouldReplaceCanonicalSidecarObject(existing, object, canonicalId)) {
      byCanonicalId.set(canonicalId, object);
    }
  }
  return [...byCanonicalId.values()];
}

function resolveTeamClusterTeamId(
  object: UnifiedOfficeModel["officeObjects"][number],
): string | null {
  const metadataTeamId =
    object.metadata && typeof object.metadata.teamId === "string"
      ? object.metadata.teamId.trim()
      : "";
  if (metadataTeamId) return metadataTeamId;
  const candidates = [object.id, object.identifier].filter(
    (value): value is string => typeof value === "string",
  );
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (trimmed.startsWith("cluster-team-")) {
      return trimmed.replace(/^cluster-/, "");
    }
  }
  return null;
}

function buildPersistedTeamClusterByTeamId(
  objects: UnifiedOfficeModel["officeObjects"],
): Map<string, UnifiedOfficeModel["officeObjects"][number]> {
  const clusterByTeamId = new Map<string, UnifiedOfficeModel["officeObjects"][number]>();
  for (const object of objects) {
    if (object.meshType !== "team-cluster") continue;
    const teamId = resolveTeamClusterTeamId(object);
    if (!teamId) continue;
    const existing = clusterByTeamId.get(teamId);
    if (!existing) {
      clusterByTeamId.set(teamId, object);
      continue;
    }
    const existingCanonical = normalizeOfficeObjectId(existing.id);
    const nextCanonical = normalizeOfficeObjectId(object.id);
    const existingIsCurrent = existing.id.startsWith("team-cluster-");
    const nextIsCurrent = object.id.startsWith("team-cluster-");
    if (existingCanonical !== nextCanonical ? nextIsCurrent : !existingIsCurrent && nextIsCurrent) {
      clusterByTeamId.set(teamId, object);
    }
  }
  return clusterByTeamId;
}

function buildDefaultFurnitureObjects(companyId: string): OfficeObject[] {
  return [
    { _id: "plant-1", companyId, meshType: "plant", position: [-14, 0, -14], rotation: [0, 0, 0] },
    { _id: "plant-2", companyId, meshType: "plant", position: [14, 0, -14], rotation: [0, 0, 0] },
    {
      _id: "bookshelf-1",
      companyId,
      meshType: "bookshelf",
      position: [0, 0, -15],
      rotation: [0, 0, 0],
    },
    {
      _id: "couch-1",
      companyId,
      meshType: "couch",
      position: [12, 0, -14],
      rotation: [0, Math.PI, 0],
    },
    {
      _id: "pantry-1",
      companyId,
      meshType: "pantry",
      position: [-12, 0, -14],
      rotation: [0, 0, 0],
    },
  ];
}

export function fallbackData(): OfficeDataContextValue {
  const teamId = "team-farplane";
  const companyId = demoCompany._id;
  const teams: TeamData[] = [
    {
      _id: teamId,
      companyId,
      name: "Farplane",
      description: "Default project cluster",
      deskCount: 3,
      clusterPosition: [0, 0, 8],
      employees: ["employee-main"],
    },
  ];
  const desks: DeskLayoutData[] = [
    { id: "desk-farplane-0", deskIndex: 0, team: "Farplane" },
    { id: "desk-farplane-1", deskIndex: 1, team: "Farplane" },
    { id: "desk-farplane-2", deskIndex: 2, team: "Farplane" },
  ];
  const employees: EmployeeData[] = [
    {
      _id: "employee-main",
      companyId,
      teamId,
      builtInRole: "operator",
      name: "Main Agent",
      team: "Farplane",
      initialPosition: [0, 0, 8],
      isBusy: false,
      isCEO: true,
      isSupervisor: false,
      jobTitle: "Farplane Operator",
      status: "info",
      statusMessage: "Waiting for runtime adapter data.",
    },
  ];
  const officeObjects: OfficeObject[] = [
    {
      _id: "cluster-farplane",
      companyId,
      meshType: "team-cluster",
      position: [0, 0, 8],
      rotation: [0, 0, 0],
      metadata: { teamId },
    },
  ];
  return {
    company: demoCompany,
    teams,
    employees,
    officeObjects,
    desks,
    officeSettings: {
      meshAssetDir: "",
      officeFootprint: DEFAULT_OFFICE_FOOTPRINT,
      officeLayout: createRectangularOfficeLayout(DEFAULT_OFFICE_FOOTPRINT),
      decor: {
        floorPatternId: "sandstone_tiles",
        wallColorId: "gallery_cream",
        backgroundId: "shell_haze",
      },
      viewProfile: "free_orbit_3d",
      orbitControlsEnabled: true,
      cameraOrientation: "south_east",
    },
    companyModel: null,
    workload: [],
    warnings: [],
    refresh: async () => {},
    applyOfficeSettings: () => {},
    manualResync: async () => ({ ok: false, error: "adapter_unavailable" }),
    upsertFederationPolicy: async () => ({ ok: false, error: "adapter_unavailable" }),
    upsertProviderIndexProfile: async () => ({ ok: false, error: "adapter_unavailable" }),
    isLoading: false,
  };
}

function resolveRuntimeTeamId(
  agentId: string,
  companyAgentProjectId: string | undefined,
  projectToTeamId: Map<string, string>,
): string {
  if (agentId === "main") return "team-management";
  if (!companyAgentProjectId) return "team-management";
  return projectToTeamId.get(companyAgentProjectId) ?? "team-management";
}

export function areStringArraysEqual(current: string[], next: string[]): boolean {
  if (current.length !== next.length) return false;
  return current.every((value, index) => value === next[index]);
}

export function toOfficeData(
  unified: UnifiedOfficeModel,
  officeSettings: OfficeDataContextValue["officeSettings"],
  pendingApprovals: PendingApprovalModel[] = [],
  liveStatusByAgent: Record<string, AgentLiveStatus> = {},
  configSnapshot?: OpenClawConfigSnapshot,
): OfficeDataContextValue {
  const runtimeAgents = unified.runtimeAgents;
  const configuredAgents = unified.configuredAgents;
  const sidecarObjects = dedupeCanonicalSidecarObjects(unified.officeObjects ?? []);
  const companyModel = unified.company;
  const workload = unified.workload;
  const warnings = unified.warnings;
  const officeLayout = officeSettings.officeLayout;
  const agents: AgentCardModel[] = configuredAgents.length > 0 ? configuredAgents : runtimeAgents;
  if (agents.length === 0) return fallbackData();

  const companyId = demoCompany._id;
  const runtimeById = new Map(runtimeAgents.map((agent) => [agent.agentId, agent]));
  const companyAgentsById = new Map(companyModel.agents.map((agent) => [agent.agentId, agent]));
  const projectToTeamId = new Map<string, string>();
  const teams: TeamData[] = [];
  const projectList = (companyModel.projects ?? []).filter(
    (project) => project.status !== "archived",
  );
  const companyAgents = companyModel.agents ?? [];

  const appearanceByAgentId = new Map<
    string,
    {
      clothesStyle?: EmployeeAppearance["clothesStyle"];
      hairColor?: string;
      petType?: EmployeeAppearance["petType"];
    }
  >();

  const rootConfig = configSnapshot?.config as Record<string, unknown> | undefined;
  if (rootConfig && typeof rootConfig.agentAppearances === "object") {
    const appearancesNode = rootConfig.agentAppearances as Record<string, unknown>;
    for (const [agentId, value] of Object.entries(appearancesNode)) {
      if (!value || typeof value !== "object") continue;
      const row = value as Record<string, unknown>;
      const clothesStyle = isAppearanceClothesStyle(row.clothesStyle)
        ? row.clothesStyle
        : undefined;
      const hairColor = typeof row.hairColor === "string" ? row.hairColor : undefined;
      const petType = isAppearancePetType(row.petType) ? row.petType : undefined;
      appearanceByAgentId.set(agentId, { clothesStyle, hairColor, petType });
    }
  }
  const teamClusterAnchorsByTeamId = new Map<string, [number, number, number]>();
  const persistedTeamClusterByTeamId = buildPersistedTeamClusterByTeamId(sidecarObjects);
  for (const object of sidecarObjects.filter((entry) => entry.meshType === "team-cluster")) {
    const resolvedTeamId = resolveTeamClusterTeamId(object);
    if (!resolvedTeamId) continue;
    teamClusterAnchorsByTeamId.set(resolvedTeamId, object.position);
  }
  const ceoAnchor = getManagementAnchorFromOfficeLayout(officeLayout);
  const reservedSceneObjects: ScenePlacementObject[] = [];
  const sidecarFurnitureEntries = sidecarObjects.filter(
    (entry) => entry.meshType !== "team-cluster" && entry.meshType !== "wall-art",
  );
  let sidecarFurniture: OfficeObject[] = [];

  const managementClusterPosition = resolveTeamClusterScenePosition({
    position: teamClusterAnchorsByTeamId.get("team-management") ?? ceoAnchor,
    deskCount: 1,
    officeLayout,
    reservedObjects: reservedSceneObjects,
    metadata: { teamId: "team-management" },
    rotation: persistedTeamClusterByTeamId.get("team-management")?.rotation,
  });

  teams.push({
    _id: "team-management",
    companyId,
    name: "Management",
    description: "Executive control desk inside the dedicated management zone.",
    deskCount: 1,
    clusterPosition: managementClusterPosition,
    employees: [],
  });

  if (projectList.length > 0) {
    for (const [projectIndex, project] of projectList.entries()) {
      const teamId = `team-${project.id}`;
      const projectAgents = companyAgents.filter((agent) => agent.projectId === project.id);
      const deskCount = Math.max(projectAgents.length, 1);
      projectToTeamId.set(project.id, teamId);
      const summary = workload.find((item) => item.projectId === project.id);
      const revenueCents = (project.ledger ?? [])
        .filter((entry) => entry.type === "revenue")
        .reduce((total, entry) => total + Math.max(0, Math.round(entry.amount)), 0);
      const costCents = (project.ledger ?? [])
        .filter((entry) => entry.type === "cost")
        .reduce((total, entry) => total + Math.max(0, Math.round(entry.amount)), 0);
      const persistedClusterPosition = teamClusterAnchorsByTeamId.get(teamId);
      const persistedCluster = persistedTeamClusterByTeamId.get(teamId);
      const clusterPosition = resolveTeamClusterScenePosition({
        position: persistedClusterPosition ?? getDefaultProjectClusterPosition(projectIndex),
        deskCount,
        officeLayout,
        reservedObjects: reservedSceneObjects,
        metadata: { ...(persistedCluster?.metadata ?? {}), teamId },
        rotation: persistedCluster?.rotation,
      });
      const resources = (project.resources ?? []).map((resource) => {
        const softLimit = resource.policy.softLimit;
        const hardLimit = resource.policy.hardLimit;
        const health: "healthy" | "warning" | "depleted" =
          typeof hardLimit === "number" && resource.remaining <= hardLimit
            ? "depleted"
            : typeof softLimit === "number" && resource.remaining <= softLimit
              ? "warning"
              : "healthy";
        return {
          id: resource.id,
          type: resource.type,
          name: resource.name,
          unit: resource.unit,
          remaining: resource.remaining,
          limit: resource.limit,
          reserved: resource.reserved,
          health,
        };
      });
      const readinessIssues = computeBusinessReadinessIssues(
        projectToBusinessBuilderDraft(project),
      ).map((issue) => issue.message);
      teams.push({
        _id: teamId,
        companyId,
        name: project.name,
        description: `${project.goal} | open=${summary?.openTickets ?? 0} closed=${summary?.closedTickets ?? 0}`,
        deskCount,
        clusterPosition,
        employees: projectAgents.map((agent) => `employee-${agent.agentId}`),
        businessType: project.businessConfig?.type,
        capabilitySkills: project.businessConfig
          ? {
              measure: project.businessConfig.slots.measure.skillId,
              execute: project.businessConfig.slots.execute.skillId,
              distribute: project.businessConfig.slots.distribute.skillId,
            }
          : undefined,
        finances: {
          revenueCents,
          costCents,
          profitCents: revenueCents - costCents,
        },
        resources,
        businessReadiness: {
          ready: readinessIssues.length === 0,
          issues: readinessIssues,
        },
      });
    }
  }

  sidecarFurniture = sidecarFurnitureEntries.flatMap((item) => {
    const rotation = item.rotation ?? [0, 0, 0];
    const metadata = { ...(item.metadata ?? {}) };
    const position = resolveSceneObjectPosition({
      object: {
        meshType: item.meshType,
        position: item.position,
        metadata,
        rotation,
      },
      officeLayout,
      reservedObjects: reservedSceneObjects,
      allowCollisionFallback: false,
    });
    if (!position) return [];
    return {
      _id: normalizeOfficeObjectId(item.id),
      companyId,
      meshType: item.meshType,
      position,
      rotation,
      scale: item.scale,
      metadata,
    } satisfies OfficeObject;
  });

  const desks: DeskLayoutData[] = teams.flatMap((team) =>
    Array.from(
      {
        length:
          team.name === "Management"
            ? Math.max(team.deskCount ?? 1, 1)
            : Math.max(team.deskCount ?? 0, 1),
      },
      (_, deskIndex) => ({
        id: `desk-${team._id}-${deskIndex}`,
        deskIndex,
        team: team.name,
      }),
    ),
  );

  const normalizedDeskLayoutsByTeamId = new Map<
    string,
    Array<{
      deskId: string;
      layoutIndex: number;
      total: number;
    }>
  >();
  for (const team of teams) {
    const normalizedDesks = desks
      .filter((desk) => desk.id.startsWith(`desk-${team._id}-`))
      .map((desk, originalIndex) => ({
        desk,
        originalIndex,
        persistedIndex: Number.isFinite(desk.deskIndex) ? desk.deskIndex : Number.MAX_SAFE_INTEGER,
      }))
      .sort((a, b) =>
        a.persistedIndex === b.persistedIndex
          ? a.originalIndex - b.originalIndex
          : a.persistedIndex - b.persistedIndex,
      )
      .map(({ desk }, layoutIndex, ordered) => ({
        deskId: desk.id,
        layoutIndex,
        total: ordered.length,
      }));
    normalizedDeskLayoutsByTeamId.set(team._id, normalizedDesks);
  }
  const teamDeskCursor = new Map<string, number>();

  const approvalsByAgent = new Map<string, { count: number; maxRisk: number }>();
  for (const approval of pendingApprovals) {
    const existing = approvalsByAgent.get(approval.agentId) ?? { count: 0, maxRisk: 0 };
    existing.count += 1;
    const riskValue =
      approval.riskLevel === "critical"
        ? 3
        : approval.riskLevel === "high"
          ? 3
          : approval.riskLevel === "medium"
            ? 2
            : 1;
    existing.maxRisk = Math.max(existing.maxRisk, riskValue);
    approvalsByAgent.set(approval.agentId, existing);
  }

  const clusterObjects: OfficeObject[] = teams.map((team, index) => {
    const persistedCluster = persistedTeamClusterByTeamId.get(team._id);
    const deskCount = Math.max(team.deskCount ?? 1, 1);
    return {
      _id: persistedCluster?.id ?? `team-cluster-${team._id}`,
      companyId,
      meshType: "team-cluster",
      position: team.clusterPosition ?? getDefaultProjectClusterPosition(Math.max(0, index - 1)),
      rotation: persistedCluster?.rotation ?? [0, 0, 0],
      scale: persistedCluster?.scale,
      metadata: {
        ...getTeamClusterPlacementMetadata(persistedCluster?.metadata, deskCount),
        teamId: team._id,
      },
    };
  });
  const officeObjects = [
    ...clusterObjects,
    ...(sidecarFurniture.length > 0 ? sidecarFurniture : buildDefaultFurnitureObjects(companyId)),
  ];
  const skillTargetObjects = buildSkillTargetObjectMap(officeObjects);
  const skillOccupants = new Map<string, string[]>();
  for (const agent of agents) {
    const activeSkillId = liveStatusByAgent[agent.agentId]?.currentSkillId?.trim();
    if (!activeSkillId) continue;
    const occupants = skillOccupants.get(activeSkillId) ?? [];
    occupants.push(agent.agentId);
    skillOccupants.set(activeSkillId, occupants);
  }

  const employees: EmployeeData[] = agents.map((agent, index) => {
    const companyAgent = companyAgentsById.get(agent.agentId);
    const runtimeAgent = runtimeById.get(agent.agentId);
    const isRuntimeRunning = Boolean(runtimeAgent);
    const isMainAgent = agent.agentId === "main";
    const teamId = resolveRuntimeTeamId(agent.agentId, companyAgent?.projectId, projectToTeamId);
    const team = teams.find((item) => item._id === teamId);
    const heartbeat = companyModel.heartbeatProfiles.find(
      (item) => item.id === companyAgent?.heartbeatProfileId,
    );
    const liveStatus = liveStatusByAgent[agent.agentId];
    const activeSkillId = liveStatus?.currentSkillId?.trim();
    const skillOccupantIds = activeSkillId ? (skillOccupants.get(activeSkillId) ?? []) : [];
    const skillOccupantIndex =
      activeSkillId && skillOccupantIds.length > 0 ? skillOccupantIds.indexOf(agent.agentId) : -1;
    const skillTargetObject = activeSkillId ? skillTargetObjects.get(activeSkillId) : undefined;
    const activityEffectVariant =
      activeSkillId && skillTargetObject
        ? resolveSkillEffectVariant(
            parseOfficeObjectInteractionConfig(skillTargetObject.metadata).skillBinding ??
              undefined,
            buildSkillEffectSeed({
              agentId: agent.agentId,
              skillId: activeSkillId,
              sessionKey: liveStatus?.sessionKey,
            }),
          )
        : undefined;
    const pressure = companyAgent?.projectId
      ? workload.find((item) => item.projectId === companyAgent.projectId)?.queuePressure
      : undefined;
    const teamCenter = team?.clusterPosition ?? [0, 0, 8];
    const teamDeskLayouts = team ? (normalizedDeskLayoutsByTeamId.get(team._id) ?? []) : [];
    const currentDeskCursor = teamDeskCursor.get(teamId) ?? 0;
    const initialDeskLayout =
      teamDeskLayouts.length > 0
        ? teamDeskLayouts[Math.min(currentDeskCursor, teamDeskLayouts.length - 1)]
        : null;
    if (teamDeskLayouts.length > 0) {
      teamDeskCursor.set(teamId, currentDeskCursor + 1);
    }
    const deskPosition = initialDeskLayout
      ? getAbsoluteDeskPosition(teamCenter, initialDeskLayout.layoutIndex, initialDeskLayout.total)
      : null;
    const deskRotation = initialDeskLayout
      ? getDeskRotation(initialDeskLayout.layoutIndex, initialDeskLayout.total)
      : null;
    const initialPosition: [number, number, number] =
      isMainAgent && initialDeskLayout == null
        ? ceoAnchor
        : deskPosition && deskRotation != null
          ? getEmployeePositionAtDesk(deskPosition, deskRotation)
          : teamCenter;
    const agentApprovals = approvalsByAgent.get(agent.agentId);
    const heartbeatStatus =
      liveStatus?.state === "error"
        ? "warning"
        : liveStatus?.state === "blocked"
          ? "warning"
          : liveStatus?.state === "done"
            ? "success"
            : liveStatus?.state === "ok"
              ? "success"
              : liveStatus?.state === "running"
                ? "info"
                : liveStatus?.state === "planning" || liveStatus?.state === "executing"
                  ? "info"
                  : liveStatus?.state === "no_work"
                    ? "info"
                    : undefined;

    const appearance = appearanceByAgentId.get(agent.agentId);

    return {
      _id: `employee-${agent.agentId}`,
      companyId,
      teamId,
      builtInRole: companyAgent?.role ?? "worker",
      name: agent.displayName,
      team: team?.name ?? "Management",
      initialPosition,
      activityTargetPosition:
        skillTargetObject && skillOccupantIndex >= 0
          ? getOfficeSkillAnchorPositionForOccupant(
              skillTargetObject,
              skillOccupantIndex,
              skillOccupantIds.length,
            )
          : undefined,
      activityTargetObjectPosition: skillTargetObject?.position,
      activityTargetSkillId: activeSkillId,
      activityEffectVariant,
      isBusy: (runtimeAgent?.sessionCount ?? 0) > 0,
      deskId: initialDeskLayout?.deskId as EmployeeData["deskId"],
      isCEO: companyAgent?.role === "ceo" || isMainAgent || index === 0,
      isSupervisor:
        companyAgent?.role === "pm" ||
        companyAgent?.role === "biz_pm" ||
        companyAgent?.role === "ceo" ||
        isMainAgent ||
        index === 0,
      jobTitle: companyAgent?.role
        ? `${companyAgent.role} (${agent.agentId})`
        : `Configured Agent (${agent.agentId})`,
      status:
        heartbeatStatus ??
        (!isRuntimeRunning
          ? "warning"
          : pressure === "high"
            ? "warning"
            : (runtimeAgent?.sessionCount ?? 0) > 0
              ? "success"
              : "info"),
      statusMessage: liveStatus?.statusText ?? heartbeat?.goal ?? "Idle",
      notificationCount: agentApprovals?.count,
      notificationPriority: agentApprovals?.maxRisk,
      heartbeatState: liveStatus?.state,
      heartbeatBubbles:
        liveStatus?.bubbles?.map((bubble) => ({ label: bubble.label, weight: bubble.weight })) ??
        [],
      appearance,
    };
  });

  return {
    company: demoCompany,
    teams,
    employees,
    officeObjects,
    desks,
    officeSettings,
    companyModel: unified.company,
    workload,
    warnings,
    refresh: async () => {},
    applyOfficeSettings: () => {},
    manualResync: async () => ({ ok: false, error: "adapter_unavailable" }),
    upsertFederationPolicy: async () => ({ ok: false, error: "adapter_unavailable" }),
    upsertProviderIndexProfile: async () => ({ ok: false, error: "adapter_unavailable" }),
    isLoading: false,
  };
}
