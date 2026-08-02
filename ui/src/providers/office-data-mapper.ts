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
  hasCanonicalActivityRoomSeed,
  hydrateCanonicalActivityRooms,
  restoreCanonicalActivityRooms,
} from "@/modules/office/lib/canonical-activity-rooms";
import { createCommandCommonsObject } from "@/modules/office/lib/central-command-commons";
import {
  buildOfficeAreaLayout,
  getOfficeAreaAnchor,
  type OfficeAreaNode,
  type ProjectActivitySummary,
} from "@/modules/office/lib/office-area-layout";
import { DEFAULT_OFFICE_DECOR } from "@/modules/office/lib/office-decor";
import { DEFAULT_OFFICE_FOOTPRINT } from "@/modules/office/lib/office-footprint";
import {
  buildDefaultFurnitureObjects,
  getCompactFurnitureAnchor,
  getOfficeObjectFootprintTileBounds,
  isAutoPackableStarterObject,
  isOfficeObjectPlacementLocked,
  isPreservedOfficeObjectPlacement,
  placeFurnitureInEmptySpace,
  placeFurnitureObjects,
  toPlacementObject,
} from "@/modules/office/lib/office-furniture-placement";
import { COMMAND_OFFICE_PROJECT_CAPACITY } from "@/modules/office/lib/office-kit";
import {
  clampPositionToOfficeLayout,
  createRectangularOfficeLayout,
  getManagementAnchorFromOfficeLayout,
  getOfficeFootprintFromLayout,
  getOfficeLayoutBounds,
  getOfficeLayoutTileSet,
  type OfficeLayoutModel,
  officeLayoutTileKey,
  parseOfficeLayoutTileKey,
} from "@/modules/office/lib/office-layout";
import {
  evaluateOfficeLayoutQuality,
  evaluateOfficePoiGraph,
} from "@/modules/office/lib/office-layout-quality";
import { solveOfficeAutoLayout } from "@/modules/office/lib/office-layout-solver";
import {
  addPaddedOfficeLayoutTile as addPaddedTile,
  buildOfficeConnectivityGraphEdges as buildConnectivityGraphEdges,
  getOfficeExteriorVoidTiles as getExteriorVoidTiles,
  isOfficeExteriorBoundaryLayoutTile as isExteriorBoundaryLayoutTile,
  sortOfficeLayoutTiles as sortLayoutTiles,
} from "@/modules/office/lib/office-layout-topology";
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
  getObjectFootprintAabb,
  getObjectFootprintCells,
} from "@/modules/office/systems/occupancy-system";
import {
  canReserveOfficeObject,
  createOfficePlacementReservation,
  getOfficeLayoutCandidatePositions,
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
  resolveTeamStationLayout,
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
  ProjectModel,
  ProjectWorkloadSummary,
  ProviderIndexProfile,
  ReconciliationWarning,
  UnifiedOfficeModel,
} from "@/modules/runtime";
import { EXECUTIVE_SPECIALISTS, resolveExecutiveHostTeamId } from "@/lib/executive-specialists";
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
const AUTO_FIT_OFFICE_PADDING_TILES = 1;
const AUTO_FIT_OFFICE_MIN_WIDTH = 8;
const AUTO_FIT_OFFICE_MIN_DEPTH = 7;
const AUTO_FIT_CORRIDOR_RADIUS_TILES = 1;
const AUTO_FIT_EMPTY_AREA_TARGET = 0.3;
const COMPACT_CLUSTER_GAP_TILES = 1.25;
const TEAM_NEIGHBORHOOD_ANCHOR_SCALE = 0.55;
const AREA_PLANNER_TARGET_ASPECT = 1.65;
const AREA_PLANNER_TABLE_PADDING_TILES = 2.75;
const AREA_PLANNER_LABEL_CLEARANCE_TILES = 1.5;
const AREA_PLANNER_MIN_TEAM_WIDTH = 11;
const AREA_PLANNER_MIN_TEAM_DEPTH = 9;

function getAgentOverflowOffset(agentId: string): [number, number] {
  let hash = 0;
  for (let index = 0; index < agentId.length; index += 1) {
    hash = (hash * 31 + agentId.charCodeAt(index)) >>> 0;
  }
  const angle = ((hash % 360) / 180) * Math.PI;
  const radius = 0.8 + ((hash >>> 9) % 4) * 0.18;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}
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
  const id = row.id === "three-human" || row.id === "sprite-sheet-2d" ? row.id : undefined;
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
  const commandCommonsNeighborhood = metadata?.commandCommonsNeighborhood === true;
  return {
    ...(metadata ?? {}),
    deskCount,
    footprintWidth: commandCommonsNeighborhood ? 6.25 : footprint.width,
    footprintDepth: commandCommonsNeighborhood ? 4.75 : footprint.depth,
    footprintClearance: commandCommonsNeighborhood ? 0.65 : footprint.clearance,
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

function createRectangularOfficeLayoutFromTileBounds(input: {
  minTileX: number;
  maxTileX: number;
  minTileZ: number;
  maxTileZ: number;
}): OfficeLayoutModel {
  const tiles: string[] = [];
  for (let x = input.minTileX; x <= input.maxTileX; x += 1) {
    for (let z = input.minTileZ; z <= input.maxTileZ; z += 1) {
      tiles.push(officeLayoutTileKey(x, z));
    }
  }
  return {
    version: 1,
    tileSize: 1,
    tiles: sortLayoutTiles(tiles),
  };
}

function expandTileBoundsToMinimum(input: {
  minTileX: number;
  maxTileX: number;
  minTileZ: number;
  maxTileZ: number;
  minWidth: number;
  minDepth: number;
}): {
  minTileX: number;
  maxTileX: number;
  minTileZ: number;
  maxTileZ: number;
} {
  let { minTileX, maxTileX, minTileZ, maxTileZ } = input;
  const width = maxTileX - minTileX + 1;
  const depth = maxTileZ - minTileZ + 1;
  if (width < input.minWidth) {
    const delta = input.minWidth - width;
    minTileX -= Math.floor(delta / 2);
    maxTileX += Math.ceil(delta / 2);
  }
  if (depth < input.minDepth) {
    const delta = input.minDepth - depth;
    minTileZ -= Math.floor(delta / 2);
    maxTileZ += Math.ceil(delta / 2);
  }
  return { minTileX, maxTileX, minTileZ, maxTileZ };
}

function addCorridorTiles(input: {
  tileSet: Set<string>;
  from: { x: number; z: number };
  to: { x: number; z: number };
  radius: number;
}): void {
  const stepX = input.from.x <= input.to.x ? 1 : -1;
  for (let x = input.from.x; x !== input.to.x + stepX; x += stepX) {
    addPaddedTile(input.tileSet, x, input.from.z, input.radius);
  }
  const stepZ = input.from.z <= input.to.z ? 1 : -1;
  for (let z = input.from.z; z !== input.to.z + stepZ; z += stepZ) {
    addPaddedTile(input.tileSet, input.to.x, z, input.radius);
  }
}

function addRoutedCorridorTiles(input: {
  tileSet: Set<string>;
  occupiedTiles: Set<string>;
  from: { x: number; z: number };
  to: { x: number; z: number };
  radius: number;
}): void {
  const seedLayout = createTileMaskLayoutFromTileSet(input.tileSet);
  if (!seedLayout) return;
  const bounds = getOfficeLayoutBounds(seedLayout);
  const minX = Math.min(bounds.minTileX, input.from.x, input.to.x) - 3;
  const maxX = Math.max(bounds.maxTileX, input.from.x, input.to.x) + 3;
  const minZ = Math.min(bounds.minTileZ, input.from.z, input.to.z) - 3;
  const maxZ = Math.max(bounds.maxTileZ, input.from.z, input.to.z) + 3;
  const startKey = officeLayoutTileKey(input.from.x, input.from.z);
  const targetKey = officeLayoutTileKey(input.to.x, input.to.z);
  const visited = new Set<string>([startKey]);
  const previous = new Map<string, string | null>([[startKey, null]]);
  const queue = [input.from];

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (officeLayoutTileKey(current.x, current.z) === targetKey) break;
    const neighbors = [
      { x: current.x + 1, z: current.z },
      { x: current.x - 1, z: current.z },
      { x: current.x, z: current.z + 1 },
      { x: current.x, z: current.z - 1 },
    ].sort((left, right) => {
      const leftDistance = Math.abs(left.x - input.to.x) + Math.abs(left.z - input.to.z);
      const rightDistance = Math.abs(right.x - input.to.x) + Math.abs(right.z - input.to.z);
      return leftDistance - rightDistance;
    });
    for (const neighbor of neighbors) {
      if (neighbor.x < minX || neighbor.x > maxX || neighbor.z < minZ || neighbor.z > maxZ) {
        continue;
      }
      const key = officeLayoutTileKey(neighbor.x, neighbor.z);
      if (visited.has(key)) continue;
      if (input.occupiedTiles.has(key) && key !== targetKey) continue;
      visited.add(key);
      previous.set(key, officeLayoutTileKey(current.x, current.z));
      queue.push(neighbor);
    }
  }

  if (!previous.has(targetKey)) {
    addCorridorTiles(input);
    return;
  }

  let currentKey: string | null = targetKey;
  while (currentKey) {
    const [x, z] = currentKey.split(":").map(Number);
    if (Number.isFinite(x) && Number.isFinite(z)) {
      addPaddedTile(input.tileSet, x, z, input.radius);
    }
    currentKey = previous.get(currentKey) ?? null;
  }
}

function getObjectAccessTile(input: {
  cells: Array<{ x: number; z: number; key: string }>;
  position: [number, number, number];
}): { x: number; z: number } | null {
  if (input.cells.length === 0) return null;
  const occupied = new Set(input.cells.map((cell) => cell.key));
  const minX = Math.min(...input.cells.map((cell) => cell.x));
  const maxX = Math.max(...input.cells.map((cell) => cell.x));
  const minZ = Math.min(...input.cells.map((cell) => cell.z));
  const maxZ = Math.max(...input.cells.map((cell) => cell.z));
  const centerX = Math.round(input.position[0]);
  const centerZ = Math.round(input.position[2]);
  const candidates = [
    { x: maxX + 1, z: centerZ },
    { x: minX - 1, z: centerZ },
    { x: centerX, z: maxZ + 1 },
    { x: centerX, z: minZ - 1 },
  ];
  return (
    candidates.find((candidate) => !occupied.has(officeLayoutTileKey(candidate.x, candidate.z))) ??
    null
  );
}

function createUniformLayoutFromTileSet(input: {
  tileSet: Set<string>;
  minWidth: number;
  minDepth: number;
}): OfficeLayoutModel | null {
  if (input.tileSet.size === 0) return null;
  const seedLayout = {
    version: 1 as const,
    tileSize: 1 as const,
    tiles: sortLayoutTiles(input.tileSet),
  };
  const bounds = getOfficeLayoutBounds(seedLayout);
  return createRectangularOfficeLayoutFromTileBounds(
    expandTileBoundsToMinimum({
      minTileX: bounds.minTileX,
      maxTileX: bounds.maxTileX,
      minTileZ: bounds.minTileZ,
      maxTileZ: bounds.maxTileZ,
      minWidth: input.minWidth,
      minDepth: input.minDepth,
    }),
  );
}

function createTileMaskLayoutFromTileSet(tileSet: Set<string>): OfficeLayoutModel | null {
  if (tileSet.size === 0) return null;
  return {
    version: 1,
    tileSize: 1,
    tiles: sortLayoutTiles(tileSet),
  };
}

function trimUniformLayoutToObjectEdges(input: {
  layout: OfficeLayoutModel;
  objects: OfficeObject[];
  minWidth: number;
  minDepth: number;
}): OfficeLayoutModel {
  const objectBounds = getOfficeObjectFootprintTileBounds(input.objects);
  if (!objectBounds) return input.layout;
  const layoutBounds = getOfficeLayoutBounds(input.layout);
  const isUniformLayout = input.layout.tiles.length === layoutBounds.width * layoutBounds.depth;
  const trimmedBounds = expandTileBoundsToMinimum({
    minTileX: Math.max(layoutBounds.minTileX, objectBounds.minTileX),
    maxTileX: Math.min(layoutBounds.maxTileX, objectBounds.maxTileX),
    minTileZ: Math.max(layoutBounds.minTileZ, objectBounds.minTileZ),
    maxTileZ: Math.min(layoutBounds.maxTileZ, objectBounds.maxTileZ),
    minWidth: input.minWidth,
    minDepth: input.minDepth,
  });
  if (!isUniformLayout) {
    const tiles = input.layout.tiles.filter((tile) => {
      const [x, z] = tile.split(":").map(Number);
      return (
        Number.isFinite(x) &&
        Number.isFinite(z) &&
        x >= trimmedBounds.minTileX &&
        x <= trimmedBounds.maxTileX &&
        z >= trimmedBounds.minTileZ &&
        z <= trimmedBounds.maxTileZ
      );
    });
    return tiles.length > 0
      ? {
          version: 1,
          tileSize: 1,
          tiles: sortLayoutTiles(tiles),
        }
      : input.layout;
  }
  return createRectangularOfficeLayoutFromTileBounds({
    minTileX: Math.max(layoutBounds.minTileX, trimmedBounds.minTileX),
    maxTileX: Math.min(layoutBounds.maxTileX, trimmedBounds.maxTileX),
    minTileZ: Math.max(layoutBounds.minTileZ, trimmedBounds.minTileZ),
    maxTileZ: Math.min(layoutBounds.maxTileZ, trimmedBounds.maxTileZ),
  });
}

function getOfficeLayoutEmptyPercent(input: {
  layout: OfficeLayoutModel;
  objects: OfficeObject[];
}): number {
  const layoutTiles = getOfficeLayoutTileSet(input.layout);
  if (layoutTiles.size === 0) return 0;
  const occupiedTiles = new Set<string>();
  for (const object of input.objects) {
    if (object.meshType === "wall-art") continue;
    for (const cell of getObjectFootprintCells({
      meshType: object.meshType,
      position: object.position,
      metadata: object.metadata,
      rotation: object.rotation,
    })) {
      if (layoutTiles.has(cell.key)) occupiedTiles.add(cell.key);
    }
  }
  return Math.max(0, layoutTiles.size - occupiedTiles.size) / layoutTiles.size;
}

function getOccupiedOfficeLayoutTiles(input: {
  layout: OfficeLayoutModel;
  objects: OfficeObject[];
}): Set<string> {
  const layoutTiles = getOfficeLayoutTileSet(input.layout);
  const occupiedTiles = new Set<string>();
  for (const object of input.objects) {
    if (object.meshType === "wall-art") continue;
    for (const cell of getObjectFootprintCells({
      meshType: object.meshType,
      position: object.position,
      metadata: object.metadata,
      rotation: object.rotation,
    })) {
      if (layoutTiles.has(cell.key)) occupiedTiles.add(cell.key);
    }
  }
  return occupiedTiles;
}

function pruneEmptyLayoutTilesForTarget(input: {
  layout: OfficeLayoutModel;
  objects: OfficeObject[];
  targetEmptyPercent: number;
}): OfficeLayoutModel {
  let current = input.layout;
  const occupiedTiles = getOccupiedOfficeLayoutTiles({
    layout: input.layout,
    objects: input.objects,
  });

  while (
    getOfficeLayoutEmptyPercent({ layout: current, objects: input.objects }) >=
    input.targetEmptyPercent
  ) {
    const currentTileSet = getOfficeLayoutTileSet(current);
    const exteriorVoid = getExteriorVoidTiles(currentTileSet);
    const removableTiles = current.tiles
      .filter(
        (tile) => !occupiedTiles.has(tile) && isExteriorBoundaryLayoutTile({ tile, exteriorVoid }),
      )
      .sort((left, right) => {
        const leftParsed = parseOfficeLayoutTileKey(left);
        const rightParsed = parseOfficeLayoutTileKey(right);
        const leftDistance = Math.abs(leftParsed?.x ?? 0) + Math.abs(leftParsed?.z ?? 0);
        const rightDistance = Math.abs(rightParsed?.x ?? 0) + Math.abs(rightParsed?.z ?? 0);
        return rightDistance - leftDistance;
      });
    let removedTile = false;
    for (const tile of removableTiles) {
      const nextTiles = current.tiles.filter((candidate) => candidate !== tile);
      if (nextTiles.length === current.tiles.length) continue;
      const nextLayout: OfficeLayoutModel = {
        version: 1,
        tileSize: 1,
        tiles: sortLayoutTiles(nextTiles),
      };
      const graph = evaluateOfficePoiGraph({
        layout: nextLayout,
        objects: input.objects,
      });
      if (graph.disconnectedCount > 0) continue;
      current = nextLayout;
      removedTile = true;
      break;
    }
    if (!removedTile) break;
    if (
      getOfficeLayoutEmptyPercent({ layout: current, objects: input.objects }) <
      input.targetEmptyPercent
    ) {
      break;
    }
  }
  return current;
}

function buildAutoFitOfficeLayout(input: {
  fallbackLayout: OfficeLayoutModel;
  objects: OfficeObject[];
  paddingTiles: number;
  corridorRadiusTiles: number;
  minWidth: number;
  minDepth: number;
  connectClusters: boolean;
  uniformShape?: boolean;
}): OfficeLayoutModel {
  const tileSet = new Set<string>();
  const occupiedTiles = new Set<string>();
  const centers: Array<{ x: number; z: number }> = [];

  for (const object of input.objects) {
    if (object.meshType === "wall-art") continue;
    const isWallBoundary = object.meshType === "office-divider" || object.meshType === "glass-wall";
    const cells = getObjectFootprintCells({
      meshType: object.meshType,
      position: object.position,
      metadata: object.metadata,
      rotation: object.rotation,
    });
    for (const cell of cells) occupiedTiles.add(cell.key);
    for (const cell of cells) {
      addPaddedTile(tileSet, cell.x, cell.z, isWallBoundary ? 0 : input.paddingTiles);
    }
    if (isWallBoundary) continue;
    const accessTile = getObjectAccessTile({
      cells,
      position: object.position,
    });
    if (accessTile) {
      addPaddedTile(tileSet, accessTile.x, accessTile.z, input.corridorRadiusTiles);
      centers.push(accessTile);
    }
  }
  if (tileSet.size === 0) return input.fallbackLayout;

  if (input.connectClusters) {
    for (const edge of buildConnectivityGraphEdges(centers)) {
      const corridorInput = {
        tileSet,
        from: centers[edge.from],
        to: centers[edge.to],
        radius: input.corridorRadiusTiles,
      };
      if (input.uniformShape === false) {
        addRoutedCorridorTiles({ ...corridorInput, occupiedTiles });
      } else {
        addCorridorTiles(corridorInput);
      }
    }
  }

  if (input.uniformShape === false) {
    return createTileMaskLayoutFromTileSet(tileSet) ?? input.fallbackLayout;
  }

  return (
    createUniformLayoutFromTileSet({
      tileSet,
      minWidth: input.minWidth,
      minDepth: input.minDepth,
    }) ?? input.fallbackLayout
  );
}

function deriveAutoFitOfficeLayout(input: {
  fallbackLayout: OfficeLayoutModel;
  objects: OfficeObject[];
}): OfficeLayoutModel {
  const candidates = [
    buildAutoFitOfficeLayout({
      fallbackLayout: input.fallbackLayout,
      objects: input.objects,
      paddingTiles: AUTO_FIT_OFFICE_PADDING_TILES,
      corridorRadiusTiles: AUTO_FIT_CORRIDOR_RADIUS_TILES,
      minWidth: AUTO_FIT_OFFICE_MIN_WIDTH,
      minDepth: AUTO_FIT_OFFICE_MIN_DEPTH,
      connectClusters: true,
    }),
    buildAutoFitOfficeLayout({
      fallbackLayout: input.fallbackLayout,
      objects: input.objects,
      paddingTiles: AUTO_FIT_OFFICE_PADDING_TILES,
      corridorRadiusTiles: 0,
      minWidth: 1,
      minDepth: 1,
      connectClusters: true,
      uniformShape: false,
    }),
    buildAutoFitOfficeLayout({
      fallbackLayout: input.fallbackLayout,
      objects: input.objects,
      paddingTiles: 0,
      corridorRadiusTiles: 0,
      minWidth: 1,
      minDepth: 1,
      connectClusters: true,
      uniformShape: false,
    }),
    buildAutoFitOfficeLayout({
      fallbackLayout: input.fallbackLayout,
      objects: input.objects,
      paddingTiles: 0,
      corridorRadiusTiles: 1,
      minWidth: 1,
      minDepth: 1,
      connectClusters: true,
      uniformShape: false,
    }),
    buildAutoFitOfficeLayout({
      fallbackLayout: input.fallbackLayout,
      objects: input.objects,
      paddingTiles: 0,
      corridorRadiusTiles: 0,
      minWidth: 1,
      minDepth: 1,
      connectClusters: true,
    }),
    buildAutoFitOfficeLayout({
      fallbackLayout: input.fallbackLayout,
      objects: input.objects,
      paddingTiles: 0,
      corridorRadiusTiles: 0,
      minWidth: 1,
      minDepth: 1,
      connectClusters: false,
    }),
  ].map((layout) => ({
    layout,
    emptyPercent: getOfficeLayoutEmptyPercent({
      layout,
      objects: input.objects,
    }),
    quality: evaluateOfficeLayoutQuality({ layout, objects: input.objects }),
    poiGraph: evaluateOfficePoiGraph({ layout, objects: input.objects }),
  }));
  const compactCandidates = candidates.filter(
    (candidate) =>
      candidate.emptyPercent <= AUTO_FIT_EMPTY_AREA_TARGET &&
      candidate.poiGraph.disconnectedCount === 0,
  );
  const connectedCandidates = candidates.filter(
    (candidate) => candidate.poiGraph.disconnectedCount === 0,
  );
  const candidatePool =
    compactCandidates.length > 0
      ? compactCandidates
      : connectedCandidates.length > 0
        ? connectedCandidates
        : candidates;
  const cappedLayout =
    [...candidatePool].sort((left, right) => {
      if (left.poiGraph.disconnectedCount !== right.poiGraph.disconnectedCount) {
        return left.poiGraph.disconnectedCount - right.poiGraph.disconnectedCount;
      }
      if (compactCandidates.length === 0 && left.emptyPercent !== right.emptyPercent) {
        return left.emptyPercent - right.emptyPercent;
      }
      if (right.quality.score !== left.quality.score)
        return right.quality.score - left.quality.score;
      if (right.quality.reachablePercent !== left.quality.reachablePercent) {
        return right.quality.reachablePercent - left.quality.reachablePercent;
      }
      if (left.quality.chokePointCount !== right.quality.chokePointCount) {
        return left.quality.chokePointCount - right.quality.chokePointCount;
      }
      if (left.quality.deadEndCount !== right.quality.deadEndCount) {
        return left.quality.deadEndCount - right.quality.deadEndCount;
      }
      return left.emptyPercent - right.emptyPercent;
    })[0]?.layout ?? input.fallbackLayout;
  const rectangularCappedLayout =
    createUniformLayoutFromTileSet({
      tileSet: getOfficeLayoutTileSet(cappedLayout),
      minWidth: AUTO_FIT_OFFICE_MIN_WIDTH,
      minDepth: AUTO_FIT_OFFICE_MIN_DEPTH,
    }) ?? cappedLayout;
  const edgeTrimmedLayout = trimUniformLayoutToObjectEdges({
    layout: rectangularCappedLayout,
    objects: input.objects,
    minWidth: AUTO_FIT_OFFICE_MIN_WIDTH,
    minDepth: AUTO_FIT_OFFICE_MIN_DEPTH,
  });
  const prunedLayout = pruneEmptyLayoutTilesForTarget({
    layout: edgeTrimmedLayout,
    objects: input.objects,
    targetEmptyPercent: AUTO_FIT_EMPTY_AREA_TARGET,
  });
  return areOfficeLayoutTilesEqual(input.fallbackLayout, prunedLayout)
    ? input.fallbackLayout
    : prunedLayout;
}

function isTeamClusterPlacementLocked(
  object: UnifiedOfficeModel["officeObjects"][number] | undefined,
): boolean {
  return isOfficeObjectPlacementLocked(object);
}

function isSolverOwnedActivityDestination(
  object: { meshType?: string },
  isManualLayout: boolean,
): boolean {
  return !isManualLayout && object.meshType === "activity-landmark";
}

interface TeamAreaPlanningEntry {
  teamId: string;
  projectId?: string;
  deskCount: number;
}

function getReadableTeamAreaSize(
  deskCount: number,
  _layoutStrategy: NonNullable<OfficeSettingsModel["layoutStrategy"]>,
): {
  width: number;
  depth: number;
} {
  const footprint = getClusterOccupancyFootprint(deskCount);
  const edgeClearance =
    footprint.clearance * 2 +
    AREA_PLANNER_TABLE_PADDING_TILES * 2 +
    AREA_PLANNER_LABEL_CLEARANCE_TILES;
  return {
    width: Math.max(AREA_PLANNER_MIN_TEAM_WIDTH, Math.ceil(footprint.width + edgeClearance)),
    depth: Math.max(AREA_PLANNER_MIN_TEAM_DEPTH, Math.ceil(footprint.depth + edgeClearance)),
  };
}

function deriveAreaFirstPlanningOfficeLayout(input: {
  fallbackLayout: OfficeLayoutModel;
  teams: TeamAreaPlanningEntry[];
  layoutStrategy: NonNullable<OfficeSettingsModel["layoutStrategy"]>;
  furnitureObjects: Array<{
    meshType: string;
    position: [number, number, number];
    metadata?: Record<string, unknown>;
    rotation?: [number, number, number];
  }>;
}): OfficeLayoutModel {
  const teamCount = input.teams.length;
  if (teamCount === 0 && input.furnitureObjects.length === 0) return input.fallbackLayout;

  const teamSizes = input.teams.map((team) =>
    getReadableTeamAreaSize(team.deskCount, input.layoutStrategy),
  );
  const demand = teamSizes.reduce(
    (result, size) => {
      return {
        totalArea: result.totalArea + size.width * size.depth,
        maxWidth: Math.max(result.maxWidth, size.width),
        maxDepth: Math.max(result.maxDepth, size.depth),
      };
    },
    { totalArea: 0, maxWidth: 0, maxDepth: 0 },
  );

  const targetWidth = Math.ceil(
    Math.sqrt(Math.max(1, demand.totalArea) * AREA_PLANNER_TARGET_ASPECT),
  );
  const targetDepth = Math.ceil(Math.max(1, demand.totalArea) / Math.max(1, targetWidth));
  const baseLayout =
    teamCount > 0
      ? createRectangularOfficeLayout({
          width: Math.max(AUTO_FIT_OFFICE_MIN_WIDTH, demand.maxWidth + 3, targetWidth + 2),
          depth: Math.max(AUTO_FIT_OFFICE_MIN_DEPTH, demand.maxDepth + 3, targetDepth + 2),
        })
      : createRectangularOfficeLayout({
          width: AUTO_FIT_OFFICE_MIN_WIDTH,
          depth: AUTO_FIT_OFFICE_MIN_DEPTH,
        });
  const baseBounds = getOfficeLayoutBounds(baseLayout);
  const furnitureCells = input.furnitureObjects.flatMap((object) =>
    object.meshType === "wall-art" ? [] : getObjectFootprintCells(object),
  );
  if (furnitureCells.length === 0) return baseLayout;

  const furnitureBounds = furnitureCells.reduce(
    (bounds, cell) => ({
      minTileX: Math.min(bounds.minTileX, cell.x),
      maxTileX: Math.max(bounds.maxTileX, cell.x),
      minTileZ: Math.min(bounds.minTileZ, cell.z),
      maxTileZ: Math.max(bounds.maxTileZ, cell.z),
    }),
    {
      minTileX: Number.POSITIVE_INFINITY,
      maxTileX: Number.NEGATIVE_INFINITY,
      minTileZ: Number.POSITIVE_INFINITY,
      maxTileZ: Number.NEGATIVE_INFINITY,
    },
  );
  return createRectangularOfficeLayoutFromTileBounds(
    expandTileBoundsToMinimum({
      minTileX: Math.min(baseBounds.minTileX, furnitureBounds.minTileX - 1),
      maxTileX: Math.max(baseBounds.maxTileX, furnitureBounds.maxTileX + 1),
      minTileZ: Math.min(baseBounds.minTileZ, furnitureBounds.minTileZ - 1),
      maxTileZ: Math.max(baseBounds.maxTileZ, furnitureBounds.maxTileZ + 1),
      minWidth: AUTO_FIT_OFFICE_MIN_WIDTH,
      minDepth: AUTO_FIT_OFFICE_MIN_DEPTH,
    }),
  );
}

function getFurnitureCentroid(
  objects: Array<{
    meshType: string;
    position: [number, number, number];
    metadata?: Record<string, unknown>;
    rotation?: [number, number, number];
  }>,
): [number, number, number] {
  const cells = objects.flatMap((object) =>
    object.meshType === "wall-art" ? [] : getObjectFootprintCells(object),
  );
  if (cells.length === 0) return [0, 0, 0];
  const center = cells.reduce((sum, cell) => ({ x: sum.x + cell.x, z: sum.z + cell.z }), {
    x: 0,
    z: 0,
  });
  return [Math.round(center.x / cells.length), 0, Math.round(center.z / cells.length)];
}

function getCompactTeamAnchor(input: {
  index: number;
  total: number;
  origin: [number, number, number];
  largestFootprint: { width: number; depth: number };
  footprint?: { width: number; depth: number };
}): [number, number, number] {
  const columns = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, input.total) * 1.35)));
  const col = input.index % columns;
  const row = Math.floor(input.index / columns);
  const rows = Math.max(1, Math.ceil(input.total / columns));
  const spacingFootprint = input.footprint ?? input.largestFootprint;
  const spacingX = Math.max(3, Math.ceil(spacingFootprint.width + COMPACT_CLUSTER_GAP_TILES));
  const spacingZ = Math.max(3, Math.ceil(spacingFootprint.depth + COMPACT_CLUSTER_GAP_TILES));
  return [
    Math.round(input.origin[0] + (col - (columns - 1) / 2) * spacingX),
    0,
    Math.round(input.origin[2] + (row - (rows - 1) / 2) * spacingZ),
  ];
}

function getCentralCommandTeamAnchor(input: {
  index: number;
  total: number;
  origin: [number, number, number];
}): [number, number, number] {
  const ringSlots: Array<[number, number]> = [
    [-8.5, -11.5],
    [8.5, -11.5],
    [11.5, -3.5],
    [11.5, 3.5],
    [-8.5, 11.5],
    [8.5, 11.5],
    [-11.5, -3.5],
    [-11.5, 3.5],
  ];
  const slot = ringSlots[input.index];
  if (slot) {
    return [Math.round(input.origin[0] + slot[0]), 0, Math.round(input.origin[2] + slot[1])];
  }
  const overflowIndex = input.index - ringSlots.length;
  const angle = (overflowIndex / Math.max(1, input.total - ringSlots.length)) * Math.PI * 2;
  return [
    Math.round(input.origin[0] + Math.cos(angle) * 9.5),
    0,
    Math.round(input.origin[2] + Math.sin(angle) * 8.5),
  ];
}

interface TeamClusterRepairSpec {
  teamId: string;
  name: string;
  description: string;
  deskCount: number;
  preferredPosition: [number, number, number];
  existing?: SidecarOfficeObject;
}

interface ProjectPlacementEntry {
  project: ProjectModel;
  sourceIndex: number;
  projectAgents: CompanyModel["agents"];
  deskCount: number;
}

function compareProjectPlacementEntries(input: {
  layoutStrategy: NonNullable<OfficeSettingsModel["layoutStrategy"]>;
  projects: ProjectModel[];
  left: ProjectPlacementEntry;
  right: ProjectPlacementEntry;
}): number {
  const { left, right } = input;
  return right.deskCount === left.deskCount
    ? left.sourceIndex - right.sourceIndex
    : right.deskCount - left.deskCount;
}

function getTeamClusterRepairSpecs(input: {
  unified: UnifiedOfficeModel;
  officeLayout: OfficeLayoutModel;
  commandOfficeCapacity?: number;
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
      deskCount: EXECUTIVE_SPECIALISTS.length + 1,
      preferredPosition:
        existing?.position ?? getManagementAnchorFromOfficeLayout(input.officeLayout),
      existing,
    });
  }

  const activeProjects = input.unified.company.projects.filter(
    (project) => project.status !== "archived",
  );
  const selectedProjects =
    input.commandOfficeCapacity == null
      ? activeProjects
      : activeProjects.slice(0, input.commandOfficeCapacity);
  if (input.commandOfficeCapacity != null) {
    selectedProjects.sort((left, right) => left.id.localeCompare(right.id));
  }
  selectedProjects.forEach((project, projectIndex) => {
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
      deskCount: input.commandOfficeCapacity == null ? Math.max(projectAgents.length, 1) : 1,
      preferredPosition:
        existing?.position ?? preferredAreaAnchor ?? getDefaultProjectClusterPosition(projectIndex),
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
    commandOfficeCapacity:
      input.officeSettings.officeKit?.kitId === "command-office"
        ? COMMAND_OFFICE_PROJECT_CAPACITY
        : undefined,
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
  const nextObjects = [
    ...originalObjects.filter((object) => {
      if (object.meshType !== "team-cluster") return true;
      const teamId = resolveTeamClusterTeamId(object);
      return !teamId;
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
            spec.existing.metadata?.name !== repaired.metadata?.name ||
            spec.existing.metadata?.description !== repaired.metadata?.description ||
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

function isObjectInsideOfficeArea(
  object: ScenePlacementObject,
  area: OfficeAreaNode["rect"],
): boolean {
  const bounds = getObjectFootprintAabb(object);
  return (
    bounds.minX >= area.minX &&
    bounds.maxX <= area.maxX &&
    bounds.minZ >= area.minZ &&
    bounds.maxZ <= area.maxZ
  );
}

function resolveSceneObjectPositionInsideArea(input: {
  object: ScenePlacementObject;
  area: OfficeAreaNode["rect"] | undefined;
  officeLayout: OfficeLayoutModel;
  reservation: OfficePlacementReservation;
}): [number, number, number] | null {
  if (!input.area) return null;
  for (const position of getOfficeLayoutCandidatePositions({
    layout: input.officeLayout,
    y: input.object.position[1],
    preferredPosition: input.object.position,
  })) {
    const candidate = { ...input.object, position };
    if (!isObjectInsideOfficeArea(candidate, input.area)) continue;
    if (
      canReserveOfficeObject({
        object: candidate,
        layout: input.officeLayout,
        reservation: input.reservation,
      })
    ) {
      input.reservation.objects.push(candidate);
      return position;
    }
  }
  return null;
}

function resolveTeamClusterScenePosition(input: {
  position: [number, number, number];
  deskCount: number;
  officeLayout: OfficeLayoutModel;
  reservation: OfficePlacementReservation;
  area?: OfficeAreaNode["rect"];
  metadata?: Record<string, unknown>;
  rotation?: [number, number, number];
  allowCollisionFallback?: boolean;
}): [number, number, number] {
  const object = {
    meshType: "team-cluster",
    position: input.position,
    metadata: getTeamClusterPlacementMetadata(input.metadata, input.deskCount),
    rotation: input.rotation,
  };
  const areaPosition = resolveSceneObjectPositionInsideArea({
    object,
    area: input.area,
    officeLayout: input.officeLayout,
    reservation: input.reservation,
  });
  if (areaPosition) return areaPosition;
  return (
    resolveSceneObjectPosition({
      object,
      officeLayout: input.officeLayout,
      reservation: input.reservation,
      allowCollisionFallback: input.allowCollisionFallback ?? true,
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

export function fallbackData(): OfficeDataContextValue {
  const teamId = "team-farplane";
  const companyId = demoCompany._id;
  const executiveLayout = solveRoundTeamTableLayout(EXECUTIVE_SPECIALISTS.length + 1);
  const executiveEmployeePosition = (stationIndex: number): [number, number, number] => {
    const station = executiveLayout.stations[stationIndex];
    const local = getEmployeePositionAtRoundTableStation(station);
    return [local[0], local[1], 8 + local[2]];
  };
  const teams: TeamData[] = [
    {
      _id: teamId,
      companyId,
      name: "Farplane",
      description: "Default project cluster",
      deskCount: EXECUTIVE_SPECIALISTS.length + 1,
      clusterPosition: [0, 0, 8],
      employees: [
        "employee-main",
        ...EXECUTIVE_SPECIALISTS.map((specialist) => `employee-${specialist.agentId}`),
      ],
    },
  ];
  const desks: DeskLayoutData[] = [
    { id: "desk-farplane-0", deskIndex: 0, team: "Farplane" },
    { id: "desk-farplane-1", deskIndex: 1, team: "Farplane" },
    { id: "desk-farplane-2", deskIndex: 2, team: "Farplane" },
    { id: "desk-farplane-3", deskIndex: 3, team: "Farplane" },
  ];
  const employees: EmployeeData[] = [
    {
      _id: "employee-main",
      companyId,
      teamId,
      builtInRole: "operator",
      name: "Main Agent",
      team: "Farplane",
      initialPosition: executiveEmployeePosition(0),
      isBusy: false,
      isCEO: true,
      isSupervisor: false,
      jobTitle: "Farplane Operator",
      status: "info",
      statusMessage: "Waiting for runtime adapter data.",
    },
    ...EXECUTIVE_SPECIALISTS.map(
      (specialist, index): EmployeeData => ({
        _id: `employee-${specialist.agentId}`,
        companyId,
        teamId,
        builtInRole: specialist.role,
        name: specialist.name,
        team: "Executive Office",
        initialPosition: executiveEmployeePosition(index + 1),
        isBusy: false,
        isCEO: false,
        isSupervisor: true,
        jobTitle: specialist.title,
        status: "info",
        statusMessage: specialist.status,
        presencePersistent: true,
        persistenceTag: "pinned",
        wantsToWander: false,
        appearance: specialist.appearance,
      }),
    ),
  ];
  const officeObjects: OfficeObject[] = [
    {
      _id: "cluster-farplane",
      companyId,
      meshType: "team-cluster",
      position: [0, 0, 8],
      rotation: [0, 0, 0],
      metadata: { teamId, executivePod: true },
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
      decor: { ...DEFAULT_OFFICE_DECOR },
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
    upsertFederationPolicy: async () => ({
      ok: false,
      error: "adapter_unavailable",
    }),
    upsertProviderIndexProfile: async () => ({
      ok: false,
      error: "adapter_unavailable",
    }),
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

function timestampToMs(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return value < 10_000_000_000 ? value * 1000 : value;
}

function deriveProjectActivitySummaries(input: {
  companyAgents: CompanyModel["agents"];
  runtimeAgents: AgentCardModel[];
  nowMs?: number;
}): ProjectActivitySummary[] {
  const runtimeById = new Map(input.runtimeAgents.map((agent) => [agent.agentId, agent]));
  const nowMs = input.nowMs ?? Date.now();
  const activityByProjectId = new Map<string, number>();
  for (const agent of input.companyAgents) {
    if (!agent.projectId) continue;
    const runtime = runtimeById.get(agent.agentId);
    const updatedAt = timestampToMs(runtime?.lastUpdatedAt);
    const ageHours = updatedAt
      ? Math.max(0, (nowMs - updatedAt) / (60 * 60 * 1000))
      : Number.POSITIVE_INFINITY;
    const recencyScore = Number.isFinite(ageHours) ? Math.max(0, 4 - ageHours / 6) : 0;
    activityByProjectId.set(
      agent.projectId,
      (activityByProjectId.get(agent.projectId) ?? 0) + recencyScore,
    );
  }
  return [...activityByProjectId.entries()].map(([projectId, recentActivityScore]) => ({
    projectId,
    recentActivityScore,
  }));
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
  const sourceOfficeLayout = officeSettings.officeLayout;
  const layoutStrategy = officeSettings.layoutStrategy ?? "team_neighborhoods";
  const isManualLayout = layoutStrategy === "manual";
  const usesCanonicalAutoLayoutSolver = !isManualLayout;
  const usesCentralCommandCommons =
    (!isManualLayout && layoutStrategy === "team_neighborhoods") ||
    officeSettings.officeKit?.kitId === "command-office";
  const usesProjectDistricts =
    layoutStrategy === "team_neighborhoods" ||
    layoutStrategy === "activity_treemap" ||
    layoutStrategy === "hierarchical_treemap" ||
    layoutStrategy === "area_sorted_pack" ||
    layoutStrategy === "command_districts";
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
  const configuredCeo = companyAgents.find((agent) => agent.isCeo || agent.role === "ceo");
  const executiveProjectId = configuredCeo?.projectId;
  const executiveSeatCount = EXECUTIVE_SPECIALISTS.length + 1;
  const projectPlacementEntries: ProjectPlacementEntry[] = projectList
    .map((project, sourceIndex) => {
      const projectAgents = companyAgents.filter((agent) => agent.projectId === project.id);
      return {
        project,
        sourceIndex,
        projectAgents,
        deskCount:
          project.id === executiveProjectId
            ? Math.max(projectAgents.length, 1) + EXECUTIVE_SPECIALISTS.length
            : usesCentralCommandCommons
              ? 1
              : Math.max(projectAgents.length, 1),
      };
    })
    .sort((left, right) =>
      compareProjectPlacementEntries({
        layoutStrategy,
        projects: projectList,
        left,
        right,
      }),
    );
  const projectAgentsByProjectId = new Map(
    projectPlacementEntries.map((entry) => [entry.project.id, entry.projectAgents]),
  );
  const seatedCommandProjectIds = new Set(
    projectPlacementEntries
      .slice(0, COMMAND_OFFICE_PROJECT_CAPACITY)
      .map((entry) => entry.project.id),
  );
  const projectActivity = deriveProjectActivitySummaries({
    companyAgents,
    runtimeAgents,
  });
  const projectDeskCountByProjectId = new Map(
    projectPlacementEntries.map((entry) => [
      entry.project.id,
      usesCentralCommandCommons && !seatedCommandProjectIds.has(entry.project.id)
        ? 0
        : entry.deskCount,
    ]),
  );
  const sidecarFurnitureEntries = sidecarObjects.filter(
    (entry) => entry.meshType !== "team-cluster" && entry.meshType !== "wall-art",
  );
  const lockedSidecarFurnitureEntries = sidecarFurnitureEntries.filter(
    (entry) =>
      !isSolverOwnedActivityDestination(entry, isManualLayout) &&
      (isOfficeObjectPlacementLocked(entry) ||
        (!usesCanonicalAutoLayoutSolver && !isAutoPackableStarterObject(entry))),
  );
  const lockedTeamClusterEntries = sidecarObjects.filter(
    (entry) => entry.meshType === "team-cluster" && isTeamClusterPlacementLocked(entry),
  );
  const planningTeams: TeamAreaPlanningEntry[] = [
    ...projectPlacementEntries
      .filter(
        (entry) => !usesCentralCommandCommons || seatedCommandProjectIds.has(entry.project.id),
      )
      .map((entry) => ({
        teamId: `team-${entry.project.id}`,
        projectId: entry.project.id,
        deskCount: entry.deskCount,
      })),
    ...(!hasPinnedCeoThread ? [{ teamId: "team-management", deskCount: executiveSeatCount }] : []),
  ];
  const officeLayout = isManualLayout
    ? sourceOfficeLayout
    : usesProjectDistricts
      ? deriveAreaFirstPlanningOfficeLayout({
          fallbackLayout: sourceOfficeLayout,
          teams: planningTeams,
          layoutStrategy,
          furnitureObjects: [...lockedSidecarFurnitureEntries, ...lockedTeamClusterEntries].map(
            (entry) => ({
              meshType: entry.meshType,
              position: entry.position,
              metadata: entry.metadata,
              rotation: entry.rotation,
            }),
          ),
        })
      : createRectangularOfficeLayout(officeSettings.officeFootprint);
  const planningAreaLayout = buildOfficeAreaLayout({
    company: companyModel,
    officeLayout,
    layoutStrategy,
    workload,
    activity: projectActivity,
  });
  const compactAnchorOrigin = getFurnitureCentroid(
    lockedSidecarFurnitureEntries.map((entry) => ({
      meshType: entry.meshType,
      position: entry.position,
      metadata: entry.metadata,
      rotation: entry.rotation,
    })),
  );
  const largestTeamFootprint = planningTeams.reduce(
    (largest, deskCount) => {
      const footprint = getClusterOccupancyFootprint(deskCount.deskCount);
      return {
        width: Math.max(largest.width, footprint.width + footprint.clearance * 2),
        depth: Math.max(largest.depth, footprint.depth + footprint.clearance * 2),
      };
    },
    { width: 0, depth: 0 },
  );
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
      appearanceByAgentId.set(agentId, {
        clothesStyle,
        hairColor,
        petType,
        characterRenderer,
      });
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
  const scenePlacementReservation = createOfficePlacementReservation(
    lockedSidecarFurnitureEntries
      .filter((entry) => entry.meshType !== "wall-art")
      .map((entry) => ({
        meshType: entry.meshType,
        position: entry.position,
        metadata: entry.metadata,
        rotation: entry.rotation,
      })),
  );
  const persistedCommandCommonsEntry = usesCentralCommandCommons
    ? sidecarFurnitureEntries.find((entry) => entry.meshType === "command-commons")
    : undefined;
  const persistedCommandCommonsObject: OfficeObject | null = persistedCommandCommonsEntry
    ? {
        _id: normalizeOfficeObjectId(persistedCommandCommonsEntry.id),
        companyId,
        meshType: "command-commons",
        position: persistedCommandCommonsEntry.position,
        rotation: persistedCommandCommonsEntry.rotation ?? [0, 0, 0],
        scale: persistedCommandCommonsEntry.scale,
        metadata: { ...(persistedCommandCommonsEntry.metadata ?? {}) },
      }
    : null;
  const commandCommonsSeed =
    usesCentralCommandCommons && !persistedCommandCommonsObject
      ? createCommandCommonsObject({ center: compactAnchorOrigin, companyId })
      : null;
  const commandCommonsPosition = commandCommonsSeed
    ? resolveSceneObjectPosition({
        object: toPlacementObject(commandCommonsSeed),
        officeLayout,
        reservation: scenePlacementReservation,
        allowCollisionFallback: true,
      })
    : null;
  const commandCommonsObject =
    persistedCommandCommonsObject ??
    (commandCommonsSeed && commandCommonsPosition
      ? { ...commandCommonsSeed, position: commandCommonsPosition }
      : null);
  const teamAnchorOrigin = commandCommonsObject?.position ?? compactAnchorOrigin;
  const teamClusterPositionsByTeamId = new Map<string, [number, number, number]>();
  let managementClusterPosition: [number, number, number] | undefined;
  let sidecarFurniture: OfficeObject[] = [];

  for (const [placementIndex, entry] of projectPlacementEntries.entries()) {
    const { project, deskCount } = entry;
    const teamId = `team-${project.id}`;
    projectToTeamId.set(project.id, teamId);
    const persistedClusterPosition = teamClusterAnchorsByTeamId.get(teamId);
    const persistedCluster = persistedTeamClusterByTeamId.get(teamId);
    const shouldPreservePersistedCluster =
      (isManualLayout && Boolean(persistedClusterPosition)) ||
      isTeamClusterPlacementLocked(persistedCluster);
    const compactAnchor = usesCentralCommandCommons
      ? getCentralCommandTeamAnchor({
          index: placementIndex,
          total: planningTeams.length,
          origin: teamAnchorOrigin,
        })
      : getCompactTeamAnchor({
          index: placementIndex,
          total: planningTeams.length,
          origin: teamAnchorOrigin,
          largestFootprint: largestTeamFootprint,
          footprint: usesCanonicalAutoLayoutSolver
            ? {
                width:
                  getClusterOccupancyFootprint(deskCount).width * TEAM_NEIGHBORHOOD_ANCHOR_SCALE,
                depth:
                  getClusterOccupancyFootprint(deskCount).depth * TEAM_NEIGHBORHOOD_ANCHOR_SCALE,
              }
            : undefined,
        });
    if (usesCentralCommandCommons && !seatedCommandProjectIds.has(project.id)) {
      teamClusterPositionsByTeamId.set(teamId, compactAnchor);
      continue;
    }
    const projectArea = usesProjectDistricts
      ? planningAreaLayout.projectAreaByProjectId[project.id]
      : undefined;
    const areaAnchor = projectArea ? getOfficeAreaAnchor(projectArea) : undefined;
    const generatedAnchor = usesCentralCommandCommons
      ? compactAnchor
      : usesProjectDistricts
        ? (areaAnchor ?? compactAnchor)
        : compactAnchor;
    const clusterPosition = resolveTeamClusterScenePosition({
      position:
        (shouldPreservePersistedCluster ? persistedClusterPosition : undefined) ?? generatedAnchor,
      deskCount,
      officeLayout,
      reservation: scenePlacementReservation,
      area:
        usesProjectDistricts && !usesCentralCommandCommons && !shouldPreservePersistedCluster
          ? projectArea?.rect
          : undefined,
      metadata: { ...(persistedCluster?.metadata ?? {}), teamId },
      rotation: persistedCluster?.rotation,
      allowCollisionFallback: isManualLayout && persistedClusterPosition ? false : undefined,
    });
    teamClusterPositionsByTeamId.set(teamId, clusterPosition);
  }

  if (!hasPinnedCeoThread) {
    const managementCompactAnchor = usesCentralCommandCommons
      ? getCentralCommandTeamAnchor({
          index: Math.min(projectPlacementEntries.length, COMMAND_OFFICE_PROJECT_CAPACITY),
          total: planningTeams.length,
          origin: teamAnchorOrigin,
        })
      : getCompactTeamAnchor({
          index: projectPlacementEntries.length,
          total: planningTeams.length,
          origin: teamAnchorOrigin,
          largestFootprint: largestTeamFootprint,
          footprint: usesCanonicalAutoLayoutSolver
            ? {
                width:
                  getClusterOccupancyFootprint(executiveSeatCount).width *
                  TEAM_NEIGHBORHOOD_ANCHOR_SCALE,
                depth:
                  getClusterOccupancyFootprint(executiveSeatCount).depth *
                  TEAM_NEIGHBORHOOD_ANCHOR_SCALE,
              }
            : undefined,
        });
    managementClusterPosition = resolveTeamClusterScenePosition({
      position:
        isManualLayout ||
        isTeamClusterPlacementLocked(persistedTeamClusterByTeamId.get("team-management"))
          ? (teamClusterAnchorsByTeamId.get("team-management") ?? ceoAnchor)
          : managementCompactAnchor,
      deskCount: executiveSeatCount,
      officeLayout,
      reservation: scenePlacementReservation,
      metadata: { teamId: "team-management" },
      rotation: persistedTeamClusterByTeamId.get("team-management")?.rotation,
      allowCollisionFallback:
        isManualLayout && teamClusterAnchorsByTeamId.has("team-management") ? false : undefined,
    });
    teamClusterPositionsByTeamId.set("team-management", managementClusterPosition);

    teams.push({
      _id: "team-management",
      companyId,
      name: "Management",
      description: "Executive control desk inside the dedicated management zone.",
      deskCount: executiveSeatCount,
      clusterPosition: managementClusterPosition,
      employees: EXECUTIVE_SPECIALISTS.map((specialist) => `employee-${specialist.agentId}`),
    });
  }

  if (projectList.length > 0) {
    for (const project of projectList) {
      const teamId = `team-${project.id}`;
      const projectAgents = projectAgentsByProjectId.get(project.id) ?? [];
      const deskCount = projectDeskCountByProjectId.get(project.id) ?? 1;
      projectToTeamId.set(project.id, teamId);
      const summary = workload.find((item) => item.projectId === project.id);
      const revenueCents = (project.ledger ?? [])
        .filter((entry) => entry.type === "revenue")
        .reduce((total, entry) => total + Math.max(0, Math.round(entry.amount)), 0);
      const costCents = (project.ledger ?? [])
        .filter((entry) => entry.type === "cost")
        .reduce((total, entry) => total + Math.max(0, Math.round(entry.amount)), 0);
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
        clusterPosition: teamClusterPositionsByTeamId.get(teamId),
        employees: [
          ...(usesCentralCommandCommons ? [`employee-project-pulse:${project.id}`] : []),
          ...projectAgents.map((agent) => `employee-${agent.agentId}`),
        ],
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
        characterPolicy: project.characterPolicy,
      });
    }
  }

  const executiveHostTeamId = resolveExecutiveHostTeamId({
    agents: companyAgents,
    projectTeamIds: projectToTeamId,
    availableTeamIds: new Set(teams.map((team) => String(team._id))),
  });
  const executiveHostTeam = teams.find((team) => team._id === executiveHostTeamId);
  if (executiveHostTeam) {
    const specialistEmployeeIds = EXECUTIVE_SPECIALISTS.map(
      (specialist) => `employee-${specialist.agentId}`,
    );
    executiveHostTeam.employees = [
      ...new Set([...executiveHostTeam.employees, ...specialistEmployeeIds]),
    ];
    const hostAlreadyReserved =
      executiveHostTeamId === "team-management" ||
      (executiveProjectId && executiveHostTeamId === projectToTeamId.get(executiveProjectId));
    if (!hostAlreadyReserved) {
      executiveHostTeam.deskCount =
        Math.max(executiveHostTeam.deskCount ?? 1, 1) + EXECUTIVE_SPECIALISTS.length;
    }
  }

  const desks: DeskLayoutData[] = teams.flatMap((team) =>
    Array.from(
      {
        length:
          team.name === "Management"
            ? Math.max(team.deskCount ?? 1, 1)
            : usesCentralCommandCommons
              ? Math.max(team.deskCount ?? 0, 0)
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
    const orderedDesks = desks
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
      );
    if (orderedDesks.length === 0) {
      normalizedDeskLayoutsByTeamId.set(team._id, []);
      continue;
    }
    const stationLayout = resolveTeamStationLayout({
      deskCount: orderedDesks.length,
      employeeCount: team.employees.length,
      forceGrid: usesCentralCommandCommons && team._id !== executiveHostTeamId,
      forceRound: team._id === executiveHostTeamId,
    });
    const total = stationLayout.usesRoundTable
      ? stationLayout.stationCount
      : stationLayout.visibleGridDeskCount;
    const normalizedDesks = Array.from({ length: total }, (_, layoutIndex) => ({
      deskId: orderedDesks[layoutIndex]?.desk.id ?? `desk-${team._id}-${layoutIndex}`,
      layoutIndex,
      total,
    }));
    normalizedDeskLayoutsByTeamId.set(team._id, normalizedDesks);
  }
  const teamDeskCursor = new Map<string, number>();

  const approvalsByAgent = new Map<string, { count: number; maxRisk: number }>();
  for (const approval of pendingApprovals) {
    const existing = approvalsByAgent.get(approval.agentId) ?? {
      count: 0,
      maxRisk: 0,
    };
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

  const clusterObjects: OfficeObject[] = teams
    .filter((team) => !usesCentralCommandCommons || (team.deskCount ?? 0) > 0)
    .map((team, index) => {
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
          executivePod: team._id === executiveHostTeamId,
          commandCommonsNeighborhood: usesCentralCommandCommons,
          ...(usesCentralCommandCommons
            ? {
                footprintWidth: 6.25,
                footprintDepth: 4.75,
                footprintClearance: 0.65,
                visualFootprintWidth: 7.4,
                visualFootprintDepth: 5.8,
              }
            : {}),
        },
      };
    });
  const officeLayoutContentObjects = [
    ...(commandCommonsObject ? [commandCommonsObject] : []),
    ...clusterObjects,
    ...sidecarFurniture.filter(
      (object) => !isSolverOwnedActivityDestination(object, isManualLayout),
    ),
  ];
  let preliminaryOfficeLayout = usesProjectDistricts
    ? officeLayout
    : isManualLayout
      ? officeLayout
      : deriveAutoFitOfficeLayout({
          fallbackLayout: officeLayout,
          objects: officeLayoutContentObjects,
        });
  const fittedAreaLayout = buildOfficeAreaLayout({
    company: companyModel,
    officeLayout: preliminaryOfficeLayout,
    layoutStrategy,
    workload,
    activity: projectActivity,
  });
  let unlockedFurnitureIndex = 0;
  const mappedSidecarFurnitureCandidates: OfficeObject[] = sidecarFurnitureEntries
    .filter((item) => item !== persistedCommandCommonsEntry)
    .map((item) => {
      const rotation = item.rotation ?? [0, 0, 0];
      const metadata = { ...(item.metadata ?? {}) };
      const preservePlacement =
        isManualLayout ||
        isOfficeObjectPlacementLocked(item) ||
        (!usesCanonicalAutoLayoutSolver && !isAutoPackableStarterObject(item));
      const position = preservePlacement
        ? item.position
        : getCompactFurnitureAnchor({
            meshType: item.meshType,
            index: unlockedFurnitureIndex,
            officeLayout: preliminaryOfficeLayout,
          });
      if (!preservePlacement) unlockedFurnitureIndex += 1;
      return {
        _id: normalizeOfficeObjectId(item.id),
        companyId,
        meshType: item.meshType,
        position,
        rotation,
        scale: item.scale,
        metadata,
      };
    });
  const dedupedSidecarFurnitureCandidates = hydrateCanonicalActivityRooms(
    mappedSidecarFurnitureCandidates,
    companyId,
  );
  const sidecarFurnitureCandidates =
    usesCentralCommandCommons &&
    !isManualLayout &&
    hasCanonicalActivityRoomSeed(dedupedSidecarFurnitureCandidates)
      ? restoreCanonicalActivityRooms(dedupedSidecarFurnitureCandidates, companyId)
      : dedupedSidecarFurnitureCandidates;
  const defaultFurnitureCandidates = buildDefaultFurnitureObjects(
    companyId,
    preliminaryOfficeLayout,
    clusterObjects,
  );
  const furnitureCandidates =
    sidecarFurnitureCandidates.length > 0 ? sidecarFurnitureCandidates : defaultFurnitureCandidates;
  if (!usesProjectDistricts && !isManualLayout) {
    preliminaryOfficeLayout = deriveAutoFitOfficeLayout({
      fallbackLayout: preliminaryOfficeLayout,
      objects: [
        ...clusterObjects,
        ...furnitureCandidates.filter(
          (object) => !isSolverOwnedActivityDestination(object, isManualLayout),
        ),
      ],
    });
  }
  const preservedSidecarFurniture = sidecarFurnitureCandidates.filter(
    (object) =>
      isManualLayout ||
      (!isSolverOwnedActivityDestination(object, isManualLayout) &&
        isPreservedOfficeObjectPlacement(object)),
  );
  const movableSidecarFurniture = sidecarFurnitureCandidates.filter(
    (object) =>
      !isManualLayout &&
      (isSolverOwnedActivityDestination(object, isManualLayout) ||
        !isPreservedOfficeObjectPlacement(object)),
  );
  const solverCandidateFurniture =
    sidecarFurnitureCandidates.length > 0 ? movableSidecarFurniture : defaultFurnitureCandidates;
  const movableDestinationFurniture = solverCandidateFurniture.filter(
    (object) => object.meshType === "activity-landmark",
  );
  const movableDecorFurniture = solverCandidateFurniture.filter(
    (object) => object.meshType !== "activity-landmark",
  );
  const projectDistrictInfillFurniture =
    usesProjectDistricts && !usesCentralCommandCommons && !isManualLayout
      ? placeFurnitureInEmptySpace({
          objects: movableDecorFurniture,
          officeLayout: preliminaryOfficeLayout,
          reservation: createOfficePlacementReservation([
            ...(commandCommonsObject ? [toPlacementObject(commandCommonsObject)] : []),
            ...clusterObjects.map(toPlacementObject),
            ...preservedSidecarFurniture.map(toPlacementObject),
          ]),
          coreAreas: fittedAreaLayout.areas,
        })
      : [];
  let furnitureObjects: OfficeObject[];

  if (usesCanonicalAutoLayoutSolver && !isManualLayout) {
    const optionalSolverFurniture = usesProjectDistricts
      ? movableDestinationFurniture
      : solverCandidateFurniture;
    const solver = solveOfficeAutoLayout({
      sourceLayout: preliminaryOfficeLayout,
      requiredObjects: [
        ...(commandCommonsObject ? [commandCommonsObject] : []),
        ...clusterObjects,
        ...preservedSidecarFurniture,
        ...projectDistrictInfillFurniture,
      ],
      optionalObjects: optionalSolverFurniture,
      strategyId: layoutStrategy,
    });
    preliminaryOfficeLayout = solver.officeLayout;
    if (usesProjectDistricts) {
      sidecarFurniture =
        sidecarFurnitureCandidates.length > 0
          ? [
              ...preservedSidecarFurniture,
              ...projectDistrictInfillFurniture,
              ...solver.placedOptionalObjects,
            ]
          : [];
      furnitureObjects =
        sidecarFurnitureCandidates.length > 0
          ? sidecarFurniture
          : [...projectDistrictInfillFurniture, ...solver.placedOptionalObjects];
    } else {
      sidecarFurniture =
        sidecarFurnitureCandidates.length > 0
          ? [...preservedSidecarFurniture, ...solver.placedOptionalObjects]
          : [];
      furnitureObjects =
        sidecarFurnitureCandidates.length > 0 ? sidecarFurniture : solver.placedOptionalObjects;
    }
  } else {
    const furnitureReservation = createOfficePlacementReservation([
      ...clusterObjects.map(toPlacementObject),
      ...preservedSidecarFurniture.map(toPlacementObject),
    ]);
    sidecarFurniture = [
      ...preservedSidecarFurniture,
      ...placeFurnitureObjects({
        objects: movableSidecarFurniture,
        officeLayout: preliminaryOfficeLayout,
        reservation: furnitureReservation,
      }),
    ];
    furnitureObjects = sidecarFurniture.length > 0 ? sidecarFurniture : defaultFurnitureCandidates;
  }
  const officeObjects = [
    ...(commandCommonsObject ? [commandCommonsObject] : []),
    ...clusterObjects,
    ...furnitureObjects,
  ];
  const fittedOfficeLayout = usesCanonicalAutoLayoutSolver
    ? preliminaryOfficeLayout
    : isManualLayout
      ? preliminaryOfficeLayout
      : deriveAutoFitOfficeLayout({
          fallbackLayout: preliminaryOfficeLayout,
          objects: officeObjects,
        });
  const finalOfficeAreaLayout = buildOfficeAreaLayout({
    company: companyModel,
    officeLayout: fittedOfficeLayout,
    layoutStrategy,
    workload,
    activity: projectActivity,
  });
  const renderedOfficeAreaLayout = usesProjectDistricts ? fittedAreaLayout : finalOfficeAreaLayout;
  const fittedOfficeSettings = areOfficeLayoutTilesEqual(sourceOfficeLayout, fittedOfficeLayout)
    ? usesCentralCommandCommons
      ? {
          ...officeSettings,
          decor: {
            floorPatternId: "graphite_grid" as const,
            wallColorId: "command_charcoal" as const,
            backgroundId: "estuary_glow" as const,
          },
        }
      : officeSettings
    : {
        ...officeSettings,
        officeLayout: fittedOfficeLayout,
        officeFootprint: getOfficeFootprintFromLayout(fittedOfficeLayout),
        decor: usesCentralCommandCommons
          ? {
              floorPatternId: "graphite_grid" as const,
              wallColorId: "command_charcoal" as const,
              backgroundId: "estuary_glow" as const,
            }
          : officeSettings.decor,
      };
  const skillTargetObjects = buildSkillTargetObjectMap(officeObjects);
  const skillOccupants = new Map<string, string[]>();
  for (const agent of agents) {
    const activeSkillId = liveStatusByAgent[agent.agentId]?.currentSkillId?.trim();
    if (!activeSkillId) continue;
    const occupants = skillOccupants.get(activeSkillId) ?? [];
    occupants.push(agent.agentId);
    skillOccupants.set(activeSkillId, occupants);
  }

  const runtimeEmployees: EmployeeData[] = agents.map((agent) => {
    const companyAgent = companyAgentsById.get(agent.agentId);
    const runtimeAgent = runtimeById.get(agent.agentId);
    const observedCodex =
      agent.runtimeMetadata?.observedCodex ?? companyAgent?.runtimeMetadata?.observedCodex;
    const codexThreadGoal =
      agent.runtimeMetadata?.codexThreadGoal ?? companyAgent?.runtimeMetadata?.codexThreadGoal;
    const isRuntimeRunning = Boolean(runtimeAgent);
    const isMainAgent = agent.agentId === "main";
    const isCodexAgent = agent.agentId === "codex-main" || agent.agentId.startsWith("codex-");
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
    const presencePersistent = isCodexAgent
      ? isOfficeSupervisor || agent.agentId === "codex-main" || Boolean(codexThreadGoal)
      : undefined;
    const claimsPersistentDesk =
      !usesCentralCommandCommons || (isOfficeCeo && teamId === executiveHostTeamId);
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
      claimsPersistentDesk && currentDeskCursor < teamDeskLayouts.length
        ? teamDeskLayouts[currentDeskCursor]
        : null;
    if (claimsPersistentDesk) {
      teamDeskCursor.set(teamId, currentDeskCursor + 1);
    }
    const roundTableStation =
      initialDeskLayout &&
      resolveTeamStationLayout({
        deskCount: teamDeskLayouts.length,
        employeeCount: team?.employees.length ?? 0,
        forceGrid: usesCentralCommandCommons && teamId !== executiveHostTeamId,
        forceRound: teamId === executiveHostTeamId,
      }).usesRoundTable
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
    const overflowOffset = getAgentOverflowOffset(agent.agentId);
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
            : usesCentralCommandCommons && !isMainAgent
              ? [
                  teamCenter[0] + overflowOffset[0],
                  teamCenter[1],
                  teamCenter[2] + overflowOffset[1],
                ]
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
    const hasActiveThread = liveStatus
      ? activity.state !== "idle"
      : (runtimeAgent?.sessionCount ?? 0) > 0;
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
      statusMessage:
        codexThreadGoal?.objective ?? liveStatus?.statusText ?? heartbeat?.goal ?? "Idle",
      notificationCount: agentApprovals?.count,
      notificationPriority: agentApprovals?.maxRisk,
      activityState: activity.state,
      activityLabel: activity.label,
      activityDetail: activity.detail,
      activityUpdatedAt: liveStatus?.updatedAt,
      bubbleMessages: liveStatus?.bubbleMessages,
      heartbeatState: liveStatus?.state,
      heartbeatBubbles:
        liveStatus?.bubbles?.map((bubble) => ({
          label: bubble.label,
          weight: bubble.weight,
        })) ?? [],
      presencePersistent,
      persistenceTag: presencePersistent
        ? codexThreadGoal
          ? "goal"
          : heartbeat
            ? "heartbeat"
            : "pinned"
        : undefined,
      presenceExpiresAt: presencePersistent === false ? companyAgent?.presenceExpiresAt : undefined,
      codexThreadGoal,
      teamCharacterPolicy: team?.characterPolicy,
      observedRuntime: observedCodex
        ? {
            kind: "codex",
            sourceInstanceId: observedCodex.sourceInstanceId,
            machineId: observedCodex.machineId,
            machineName: observedCodex.machineName,
            sessionKey: observedCodex.sessionKey,
            threadId: observedCodex.threadId,
            parentThreadId: observedCodex.parentThreadId,
            controllable: false,
          }
        : undefined,
      wantsToWander: roundTableStation || hasActiveThread ? false : undefined,
      appearance,
    };
  });
  const executiveSpecialistEmployees: EmployeeData[] = executiveHostTeam
    ? EXECUTIVE_SPECIALISTS.map((specialist, index) => {
        const teamCenter =
          executiveHostTeam.clusterPosition ?? ([0, 0, 8] as [number, number, number]);
        const teamDeskLayouts = normalizedDeskLayoutsByTeamId.get(executiveHostTeam._id) ?? [];
        const specialistLayouts = teamDeskLayouts.slice(-EXECUTIVE_SPECIALISTS.length);
        const desk = specialistLayouts[index];
        const station = desk
          ? solveRoundTeamTableLayout(desk.total).stations[desk.layoutIndex]
          : undefined;
        const localPosition = station ? getEmployeePositionAtRoundTableStation(station) : null;
        return {
          _id: `employee-${specialist.agentId}`,
          companyId,
          teamId: executiveHostTeam._id,
          builtInRole: specialist.role,
          name: specialist.name,
          team: "Executive Office",
          initialPosition: localPosition
            ? [
                teamCenter[0] + localPosition[0],
                teamCenter[1] + localPosition[1],
                teamCenter[2] + localPosition[2],
              ]
            : teamCenter,
          isBusy: false,
          deskId: desk?.deskId as EmployeeData["deskId"],
          isCEO: false,
          isSupervisor: true,
          jobTitle: specialist.title,
          status: "info",
          statusMessage: specialist.status,
          activityState: "idle",
          activityLabel: "Executive specialist",
          presencePersistent: true,
          persistenceTag: "pinned",
          wantsToWander: false,
          teamCharacterPolicy: executiveHostTeam.characterPolicy,
          appearance: specialist.appearance,
        };
      })
    : [];
  const projectPulseEmployees: EmployeeData[] = usesCentralCommandCommons
    ? projectPlacementEntries
        .filter(({ project }) => `team-${project.id}` !== executiveHostTeamId)
        .map(({ project }) => {
          const teamId = `team-${project.id}`;
          const team = teams.find((entry) => entry._id === teamId);
          const teamCenter = team?.clusterPosition ?? [0, 0, 8];
          const desk = normalizedDeskLayoutsByTeamId.get(teamId)?.[0];
          const deskPosition = desk
            ? getAbsoluteDeskPosition(teamCenter, desk.layoutIndex, desk.total)
            : teamCenter;
          const deskRotation = desk ? getDeskRotation(desk.layoutIndex, desk.total) : 0;
          return {
            _id: `employee-project-pulse:${project.id}`,
            companyId,
            teamId,
            builtInRole: "pm",
            name: `${project.name} Pulse`,
            team: project.name,
            initialPosition: desk
              ? getEmployeePositionAtDesk(deskPosition, deskRotation)
              : teamCenter,
            isBusy: false,
            deskId: desk?.deskId as EmployeeData["deskId"],
            isCEO: false,
            isSupervisor: true,
            jobTitle: `Project Pulse (${project.id})`,
            status: "info",
            statusMessage: "Persistent project presence",
            activityState: "idle",
            activityLabel: "Project pulse",
            activityDetail: project.goal,
            presencePersistent: true,
            projectPulse: true,
          };
        })
    : [];
  const employees: EmployeeData[] = [
    ...runtimeEmployees,
    ...executiveSpecialistEmployees,
    ...projectPulseEmployees,
  ];

  return {
    company: demoCompany,
    teams,
    employees,
    officeObjects,
    officeAreas: renderedOfficeAreaLayout.areas,
    desks,
    officeSettings: fittedOfficeSettings,
    companyModel: unified.company,
    workload,
    warnings,
    refresh: async () => {},
    applyOfficeSettings: () => {},
    manualResync: async () => ({ ok: false, error: "adapter_unavailable" }),
    upsertFederationPolicy: async () => ({
      ok: false,
      error: "adapter_unavailable",
    }),
    upsertProviderIndexProfile: async () => ({
      ok: false,
      error: "adapter_unavailable",
    }),
    isLoading: false,
  };
}
