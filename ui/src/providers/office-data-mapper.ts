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

import { computeBusinessReadinessIssues, projectToBusinessBuilderDraft } from "@/modules/business";
import { normalizeOfficeObjectId } from "@/modules/office/components/office-object-id";
import {
  buildOfficeAreaLayout,
  getOfficeAreaAnchor,
  type OfficeAreaNode,
} from "@/modules/office/lib/office-area-layout";
import { DEFAULT_OFFICE_FOOTPRINT } from "@/modules/office/lib/office-footprint";
import {
  clampPositionToOfficeLayout,
  createRectangularOfficeLayout,
  getOfficeFootprintFromLayout,
  getOfficeLayoutBounds,
  getManagementAnchorFromOfficeLayout,
  officeLayoutTileKey,
  type OfficeLayoutModel,
} from "@/modules/office/lib/office-layout";
import type {
  Company,
  DeskLayoutData,
  EmployeeCharacterRendererSource,
  EmployeeData,
  OfficeObject,
  TeamData,
} from "@/modules/office/lib/types";
import { parseOfficeObjectInteractionConfig } from "@/modules/office/office-object-ui";
import { buildSkillEffectSeed, resolveSkillEffectVariant } from "@/modules/office/skill-effects";
import {
  buildSkillTargetObjectMap,
  getOfficeSkillAnchorPositionForOccupant,
} from "@/modules/office/skill-targeting";
import {
  createOfficePlacementReservation,
  type OfficePlacementObject,
  type OfficePlacementReservation,
  reserveOfficeObjectPlacement,
} from "@/modules/office/systems/placement-engine";
import {
  getAbsoluteDeskPosition,
  getClusterOccupancyFootprint,
  getDeskRotation,
  getEmployeePositionAtDesk,
  getEmployeePositionAtRoundTableStation,
  shouldUseRoundTeamTable,
  solveRoundTeamTableLayout,
} from "@/modules/office/utils/layout";
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
import { deriveEmployeeActivity } from "./office-employee-activity";

type ScenePlacementObject = OfficePlacementObject;
type SidecarOfficeObject = UnifiedOfficeModel["officeObjects"][number];
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
  officeAreas: OfficeAreaNode[];
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

const demoCompany: Company = { _id: "company-demo", name: "Farplane UI" };

function isAppearanceClothesStyle(
  value: unknown,
): value is NonNullable<EmployeeAppearance["clothesStyle"]> {
  return value === "default" || value === "dj" || value === "professional" || value === "techBro";
}

function isAppearancePetType(value: unknown): value is NonNullable<EmployeeAppearance["petType"]> {
  return (
    value === "none" ||
    value === "dog" ||
    value === "cat" ||
    value === "goldfish" ||
    value === "rabbit" ||
    value === "lobster"
  );
}

function parseAppearanceCharacterRenderer(
  value: unknown,
): EmployeeAppearance["characterRenderer"] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const id =
    row.id === "three-human" || row.id === "sprite-sheet-2d"
      ? row.id
      : undefined;
  let source: EmployeeCharacterRendererSource | undefined;
  if (row.source && typeof row.source === "object") {
    const sourceRow = row.source as Record<string, unknown>;
    if (sourceRow.type === "codex-pet" && typeof sourceRow.petId === "string") {
      source = { type: "codex-pet", petId: sourceRow.petId.trim() };
    } else if (sourceRow.type === "url" && typeof sourceRow.atlasUrl === "string") {
      source = {
        type: "url",
        atlasUrl: sourceRow.atlasUrl,
        manifestUrl: typeof sourceRow.manifestUrl === "string" ? sourceRow.manifestUrl : undefined,
      };
    }
  }
  return id || source ? { id, source } : undefined;
}

function getDefaultProjectClusterPosition(projectIndex: number): [number, number, number] {
  const safeIndex = Number.isFinite(projectIndex) ? Math.max(0, Math.floor(projectIndex)) : 0;
  return (
    DEFAULT_PROJECT_CLUSTER_POSITIONS[safeIndex % DEFAULT_PROJECT_CLUSTER_POSITIONS.length] ?? [
      0, 0, 8,
    ]
  );
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

function hasPinnedCeoThread(companyAgents: CompanyModel["agents"]): boolean {
  return companyAgents.some(
    (agent) => agent.role === "ceo" && agent.agentId.startsWith("codex-thread:"),
  );
}

function arePositionsEqual(
  left: [number, number, number] | undefined,
  right: [number, number, number],
): boolean {
  return Boolean(left && left[0] === right[0] && left[1] === right[1] && left[2] === right[2]);
}

function areOfficeLayoutTilesEqual(left: OfficeLayoutModel, right: OfficeLayoutModel): boolean {
  if (left.tiles.length !== right.tiles.length) return false;
  return left.tiles.every((tile, index) => tile === right.tiles[index]);
}

function sortLayoutTiles(tiles: Iterable<string>): string[] {
  return [...tiles].sort((left, right) => {
    const [leftX, leftZ] = left.split(":").map(Number);
    const [rightX, rightZ] = right.split(":").map(Number);
    if (!Number.isFinite(leftX) || !Number.isFinite(leftZ)) return left.localeCompare(right);
    if (!Number.isFinite(rightX) || !Number.isFinite(rightZ)) return left.localeCompare(right);
    return leftZ === rightZ ? leftX - rightX : leftZ - rightZ;
  });
}

function expandOfficeLayoutWithAnnex(input: {
  layout: OfficeLayoutModel;
  minimumWidth: number;
  minimumDepth: number;
  pass: number;
}): OfficeLayoutModel {
  const bounds = getOfficeLayoutBounds(input.layout);
  const tileSet = new Set(input.layout.tiles);
  const width = Math.max(8, Math.ceil(input.minimumWidth) + 4 + input.pass * 2);
  const depth = Math.max(8, Math.ceil(input.minimumDepth) + 4 + input.pass * 2);
  const startX = bounds.maxTileX + 1;
  const centerZ = Math.round(bounds.centerZ);
  const minZ = centerZ - Math.floor(depth / 2);
  const maxZ = minZ + depth - 1;

  for (let x = startX; x < startX + width; x += 1) {
    for (let z = minZ; z <= maxZ; z += 1) {
      tileSet.add(officeLayoutTileKey(x, z));
    }
  }

  return {
    version: 1,
    tileSize: 1,
    tiles: sortLayoutTiles(tileSet),
  };
}

interface TeamClusterRepairSpec {
  teamId: string;
  name: string;
  description: string;
  deskCount: number;
  preferredPosition: [number, number, number];
  existing?: SidecarOfficeObject;
}

function getTeamClusterRepairSpecs(input: {
  unified: UnifiedOfficeModel;
  officeLayout: OfficeLayoutModel;
}): TeamClusterRepairSpec[] {
  const sidecarObjects = dedupeCanonicalSidecarObjects(input.unified.officeObjects ?? []);
  const persistedTeamClusterByTeamId = buildPersistedTeamClusterByTeamId(sidecarObjects);
  const companyAgents = input.unified.company.agents ?? [];
  const officeAreaLayout = buildOfficeAreaLayout({
    company: input.unified.company,
    officeLayout: input.officeLayout,
    workload: input.unified.workload,
  });
  const specs: TeamClusterRepairSpec[] = [];

  if (!hasPinnedCeoThread(companyAgents)) {
    const teamId = "team-management";
    const existing = persistedTeamClusterByTeamId.get(teamId);
    specs.push({
      teamId,
      name: "Management",
      description: "Executive control desk inside the dedicated management zone.",
      deskCount: 1,
      preferredPosition:
        existing?.position ?? getManagementAnchorFromOfficeLayout(input.officeLayout),
      existing,
    });
  }

  input.unified.company.projects
    .filter((project) => project.status !== "archived")
    .forEach((project, projectIndex) => {
      const teamId = `team-${project.id}`;
      const projectAgents = companyAgents.filter((agent) => agent.projectId === project.id);
      const existing = persistedTeamClusterByTeamId.get(teamId);
      const preferredAreaAnchor = officeAreaLayout.projectAreaByProjectId[project.id]
        ? getOfficeAreaAnchor(officeAreaLayout.projectAreaByProjectId[project.id])
        : undefined;
      specs.push({
        teamId,
        name: project.name,
        description: project.goal,
        deskCount: Math.max(projectAgents.length, 1),
        preferredPosition:
          existing?.position ??
          preferredAreaAnchor ??
          getDefaultProjectClusterPosition(projectIndex),
        existing,
      });
    });

  return specs;
}

function buildRepairedTeamClusterObject(
  spec: TeamClusterRepairSpec,
  position: [number, number, number],
): SidecarOfficeObject {
  const id = spec.existing?.id ?? `team-cluster-${spec.teamId}`;
  return {
    ...spec.existing,
    id,
    identifier: spec.existing?.identifier ?? id,
    meshType: "team-cluster",
    position,
    rotation: spec.existing?.rotation ?? [0, 0, 0],
    scale: spec.existing?.scale,
    metadata: {
      ...getTeamClusterPlacementMetadata(spec.existing?.metadata, spec.deskCount),
      teamId: spec.teamId,
      name: spec.name,
      description: spec.description,
      temporaryAnnex:
        spec.existing?.metadata && "temporaryAnnex" in spec.existing.metadata
          ? spec.existing.metadata.temporaryAnnex
          : undefined,
    },
  };
}

function resolveTeamClusterRepairPass(input: {
  specs: TeamClusterRepairSpec[];
  officeLayout: OfficeLayoutModel;
  sidecarObjects: SidecarOfficeObject[];
}): { objects: SidecarOfficeObject[]; unresolved: TeamClusterRepairSpec[] } {
  const teamIds = new Set(input.specs.map((spec) => spec.teamId));
  const reservation = createOfficePlacementReservation(
    input.sidecarObjects
      .filter((object) => {
        if (object.meshType === "wall-art") return false;
        if (object.meshType !== "team-cluster") return true;
        const teamId = resolveTeamClusterTeamId(object);
        return !teamId || !teamIds.has(teamId);
      })
      .map((object) => ({
        meshType: object.meshType,
        position: object.position,
        metadata: object.metadata,
        rotation: object.rotation,
      })),
  );
  const objects: SidecarOfficeObject[] = [];
  const unresolved: TeamClusterRepairSpec[] = [];

  for (const spec of input.specs) {
    const object = {
      meshType: "team-cluster",
      position: spec.preferredPosition,
      metadata: getTeamClusterPlacementMetadata(spec.existing?.metadata, spec.deskCount),
      rotation: spec.existing?.rotation,
    };
    const result = reserveOfficeObjectPlacement({
      object,
      layout: input.officeLayout,
      reservation,
      allowCollisionFallback: false,
    });
    if (!result) {
      unresolved.push(spec);
      continue;
    }
    const repaired = buildRepairedTeamClusterObject(spec, result.position);
    objects.push(repaired);
  }

  return { objects, unresolved };
}

export interface TeamClusterPlacementRepairResult {
  unified: UnifiedOfficeModel;
  officeSettings: OfficeSettingsModel;
  changed: boolean;
  expandedLayout: boolean;
  repairedTeamIds: string[];
}

export function repairTeamClusterPlacements(input: {
  unified: UnifiedOfficeModel;
  officeSettings: OfficeSettingsModel;
}): TeamClusterPlacementRepairResult {
  const originalObjects = dedupeCanonicalSidecarObjects(input.unified.officeObjects ?? []);
  const specs = getTeamClusterRepairSpecs({
    unified: input.unified,
    officeLayout: input.officeSettings.officeLayout,
  });
  if (specs.length === 0) {
    return {
      unified: input.unified,
      officeSettings: input.officeSettings,
      changed: false,
      expandedLayout: false,
      repairedTeamIds: [],
    };
  }

  let officeLayout = input.officeSettings.officeLayout;
  let pass = resolveTeamClusterRepairPass({
    specs,
    officeLayout,
    sidecarObjects: originalObjects,
  });
  let expandedLayout = false;
  let annexPass = 0;
  const largestFootprint = specs.reduce(
    (largest, spec) => {
      const footprint = getClusterOccupancyFootprint(spec.deskCount);
      return {
        width: Math.max(largest.width, footprint.width + footprint.clearance * 2),
        depth: Math.max(largest.depth, footprint.depth + footprint.clearance * 2),
      };
    },
    { width: 0, depth: 0 },
  );

  while (pass.unresolved.length > 0 && annexPass < 4) {
    expandedLayout = true;
    officeLayout = expandOfficeLayoutWithAnnex({
      layout: officeLayout,
      minimumWidth: largestFootprint.width,
      minimumDepth: largestFootprint.depth,
      pass: annexPass,
    });
    pass = resolveTeamClusterRepairPass({
      specs,
      officeLayout,
      sidecarObjects: originalObjects,
    });
    annexPass += 1;
  }

  const repairedByTeamId = new Map<string, SidecarOfficeObject>();
  for (const object of pass.objects) {
    const teamId = resolveTeamClusterTeamId(object);
    if (teamId) repairedByTeamId.set(teamId, object);
  }
  const expectedTeamIds = new Set(specs.map((spec) => spec.teamId));
  const nextObjects = [
    ...originalObjects.filter((object) => {
      if (object.meshType !== "team-cluster") return true;
      const teamId = resolveTeamClusterTeamId(object);
      return !teamId || !expectedTeamIds.has(teamId);
    }),
    ...specs.map(
      (spec) =>
        repairedByTeamId.get(spec.teamId) ??
        buildRepairedTeamClusterObject(spec, spec.preferredPosition),
    ),
  ];

  const repairedTeamIds = specs
    .filter((spec) => {
      const repaired = repairedByTeamId.get(spec.teamId);
      return Boolean(
        repaired &&
          (!spec.existing ||
            !arePositionsEqual(spec.existing.position, repaired.position) ||
            spec.existing.metadata?.deskCount !== spec.deskCount ||
            spec.existing.metadata?.footprintWidth !== repaired.metadata?.footprintWidth ||
            spec.existing.metadata?.footprintDepth !== repaired.metadata?.footprintDepth),
      );
    })
    .map((spec) => spec.teamId);

  const officeSettings = {
    ...input.officeSettings,
    officeLayout,
    officeFootprint: getOfficeFootprintFromLayout(officeLayout),
  };
  const changed =
    repairedTeamIds.length > 0 ||
    originalObjects.length !== nextObjects.length ||
    !areOfficeLayoutTilesEqual(input.officeSettings.officeLayout, officeLayout);

  return {
    unified: changed ? { ...input.unified, officeObjects: nextObjects } : input.unified,
    officeSettings: changed ? officeSettings : input.officeSettings,
    changed,
    expandedLayout,
    repairedTeamIds,
  };
}

function resolveSceneObjectPosition(input: {
  object: ScenePlacementObject;
  officeLayout: OfficeLayoutModel;
  reservation: OfficePlacementReservation;
  allowCollisionFallback?: boolean;
}): [number, number, number] | null {
  return (
    reserveOfficeObjectPlacement({
      object: input.object,
      layout: input.officeLayout,
      reservation: input.reservation,
      allowCollisionFallback: input.allowCollisionFallback,
    })?.position ?? null
  );
}

function resolveTeamClusterScenePosition(input: {
  position: [number, number, number];
  deskCount: number;
  officeLayout: OfficeLayoutModel;
  reservation: OfficePlacementReservation;
  metadata?: Record<string, unknown>;
  rotation?: [number, number, number];
}): [number, number, number] {
  return (
    resolveSceneObjectPosition({
      object: {
        meshType: "team-cluster",
        position: input.position,
        metadata: getTeamClusterPlacementMetadata(input.metadata, input.deskCount),
        rotation: input.rotation,
      },
      officeLayout: input.officeLayout,
      reservation: input.reservation,
      allowCollisionFallback: true,
    }) ?? clampPositionToOfficeLayout(input.position, input.officeLayout, 0)
  );
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
    officeAreas: [],
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
  companyAgentRole: string | undefined,
  companyAgentProjectId: string | undefined,
  projectToTeamId: Map<string, string>,
  hasPinnedCeoThread: boolean,
): string {
  if (agentId === "main") return "team-management";
  if (companyAgentProjectId) return projectToTeamId.get(companyAgentProjectId) ?? "team-management";
  if (companyAgentRole === "ceo" && hasPinnedCeoThread) return "team-ceo-thread";
  return "team-management";
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
  const hasPinnedCeoThread = companyAgents.some(
    (agent) => agent.role === "ceo" && agent.agentId.startsWith("codex-thread:"),
  );
  const officeAreaLayout = buildOfficeAreaLayout({
    company: companyModel,
    officeLayout,
    workload,
  });

  const appearanceByAgentId = new Map<
    string,
    {
      clothesStyle?: EmployeeAppearance["clothesStyle"];
      hairColor?: string;
      petType?: EmployeeAppearance["petType"];
      characterRenderer?: EmployeeAppearance["characterRenderer"];
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
      const characterRenderer = parseAppearanceCharacterRenderer(row.characterRenderer);
      appearanceByAgentId.set(agentId, { clothesStyle, hairColor, petType, characterRenderer });
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
  const scenePlacementReservation = createOfficePlacementReservation();
  const sidecarFurnitureEntries = sidecarObjects.filter(
    (entry) => entry.meshType !== "team-cluster" && entry.meshType !== "wall-art",
  );
  let sidecarFurniture: OfficeObject[] = [];

  if (!hasPinnedCeoThread) {
    const managementClusterPosition = resolveTeamClusterScenePosition({
      position: teamClusterAnchorsByTeamId.get("team-management") ?? ceoAnchor,
      deskCount: 1,
      officeLayout,
      reservation: scenePlacementReservation,
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
  }

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
      const preferredAreaAnchor = officeAreaLayout.projectAreaByProjectId[project.id]
        ? getOfficeAreaAnchor(officeAreaLayout.projectAreaByProjectId[project.id])
        : undefined;
      const clusterPosition = resolveTeamClusterScenePosition({
        position:
          persistedClusterPosition ??
          preferredAreaAnchor ??
          getDefaultProjectClusterPosition(projectIndex),
        deskCount,
        officeLayout,
        reservation: scenePlacementReservation,
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
      reservation: scenePlacementReservation,
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

  const employees: EmployeeData[] = agents.map((agent) => {
    const companyAgent = companyAgentsById.get(agent.agentId);
    const runtimeAgent = runtimeById.get(agent.agentId);
    const isRuntimeRunning = Boolean(runtimeAgent);
    const isMainAgent = agent.agentId === "main";
    const teamId = resolveRuntimeTeamId(
      agent.agentId,
      companyAgent?.role,
      companyAgent?.projectId,
      projectToTeamId,
      hasPinnedCeoThread,
    );
    const team = teams.find((item) => item._id === teamId);
    const heartbeat = companyModel.heartbeatProfiles.find(
      (item) => item.id === companyAgent?.heartbeatProfileId,
    );
    const liveStatus = liveStatusByAgent[agent.agentId];
    const isOfficeCeo = companyAgent?.role === "ceo" || (isMainAgent && !hasPinnedCeoThread);
    const isOfficeSupervisor =
      isOfficeCeo || companyAgent?.role === "pm" || companyAgent?.role === "biz_pm";
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
    const roundTableStation =
      initialDeskLayout && shouldUseRoundTeamTable(initialDeskLayout.total)
        ? solveRoundTeamTableLayout(initialDeskLayout.total).stations[initialDeskLayout.layoutIndex]
        : null;
    const roundTableEmployeePosition = roundTableStation
      ? getEmployeePositionAtRoundTableStation(roundTableStation)
      : null;
    const deskPosition =
      initialDeskLayout && !roundTableStation
        ? getAbsoluteDeskPosition(
            teamCenter,
            initialDeskLayout.layoutIndex,
            initialDeskLayout.total,
          )
        : null;
    const deskRotation =
      initialDeskLayout && !roundTableStation
        ? getDeskRotation(initialDeskLayout.layoutIndex, initialDeskLayout.total)
        : null;
    const initialPosition: [number, number, number] =
      isMainAgent && initialDeskLayout == null
        ? ceoAnchor
        : roundTableEmployeePosition
          ? [
              teamCenter[0] + roundTableEmployeePosition[0],
              teamCenter[1] + roundTableEmployeePosition[1],
              teamCenter[2] + roundTableEmployeePosition[2],
            ]
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

    const activity = deriveEmployeeActivity(liveStatus);
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
      isCEO: isOfficeCeo,
      isSupervisor: isOfficeSupervisor,
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
      activityState: activity.state,
      activityLabel: activity.label,
      activityDetail: activity.detail,
      activityUpdatedAt: liveStatus?.updatedAt,
      heartbeatState: liveStatus?.state,
      heartbeatBubbles:
        liveStatus?.bubbles?.map((bubble) => ({ label: bubble.label, weight: bubble.weight })) ??
        [],
      wantsToWander: roundTableStation ? false : undefined,
      appearance,
    };
  });

  return {
    company: demoCompany,
    teams,
    employees,
    officeObjects,
    officeAreas: officeAreaLayout.areas,
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
