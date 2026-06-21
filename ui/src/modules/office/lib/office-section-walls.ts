/**
 * OFFICE SECTION WALLS
 * ====================
 * Derives generated glass-wall partitions around meaningful table groups.
 *
 * Inputs are already-placed team cluster objects and project metadata. Output is
 * ordinary `glass-wall` office objects so renderer, occupancy, and auto-fit
 * logic can consume the same object contract as user-placed walls.
 */

import type { OfficeObject } from "@/modules/office/lib/types";
import { getObjectFootprintCells } from "@/modules/office/systems/occupancy-system";
import type { ProjectModel } from "@/modules/runtime";

export const PROJECT_SECTION_MIN_SUBPROJECTS = 4;
export const TEAM_SECTION_MIN_DESKS = 6;

const SECTION_WALL_MARGIN_TILES = 2;
const SECTION_WALL_SEGMENT_LENGTH = 4;
const SECTION_DOOR_WIDTH_TILES = 4;

interface TileBounds {
  minTileX: number;
  maxTileX: number;
  minTileZ: number;
  maxTileZ: number;
}

interface SectionWallGroup {
  id: string;
  sectionType: "project-subprojects" | "large-team";
  objects: OfficeObject[];
}

function normalizeProjectPath(path: string | undefined): string {
  return (path ?? "").trim().replace(/\\/g, "/").replace(/\/+$/, "");
}

function findParentProject(project: ProjectModel, projects: ProjectModel[]): ProjectModel | null {
  const projectPath = normalizeProjectPath(project.trackingContext);
  if (!projectPath) return null;
  return (
    projects
      .filter((candidate) => candidate.id !== project.id)
      .filter((candidate) => {
        const candidatePath = normalizeProjectPath(candidate.trackingContext);
        return candidatePath && projectPath.startsWith(`${candidatePath}/`);
      })
      .sort(
        (left, right) =>
          normalizeProjectPath(right.trackingContext).length -
          normalizeProjectPath(left.trackingContext).length,
      )[0] ?? null
  );
}

function getClusterTeamId(object: OfficeObject): string | null {
  return typeof object.metadata?.teamId === "string" ? object.metadata.teamId : null;
}

function getClusterDeskCount(object: OfficeObject): number {
  const raw = object.metadata?.deskCount;
  return typeof raw === "number" && Number.isFinite(raw) ? Math.max(1, Math.floor(raw)) : 1;
}

export function getOfficeObjectFootprintTileBounds(objects: OfficeObject[]): TileBounds | null {
  let minTileX = Number.POSITIVE_INFINITY;
  let maxTileX = Number.NEGATIVE_INFINITY;
  let minTileZ = Number.POSITIVE_INFINITY;
  let maxTileZ = Number.NEGATIVE_INFINITY;
  let hasCells = false;

  for (const object of objects) {
    if (object.meshType === "wall-art") continue;
    for (const cell of getObjectFootprintCells(object)) {
      hasCells = true;
      minTileX = Math.min(minTileX, cell.x);
      maxTileX = Math.max(maxTileX, cell.x);
      minTileZ = Math.min(minTileZ, cell.z);
      maxTileZ = Math.max(maxTileZ, cell.z);
    }
  }

  return hasCells ? { minTileX, maxTileX, minTileZ, maxTileZ } : null;
}

function shouldSkipSectionDoor(input: {
  start: number;
  end: number;
  doorCenter: number;
  doorWidth: number;
}): boolean {
  const min = Math.min(input.start, input.end);
  const max = Math.max(input.start, input.end);
  const doorMin = input.doorCenter - input.doorWidth / 2;
  const doorMax = input.doorCenter + input.doorWidth / 2;
  return max > doorMin && min < doorMax;
}

function buildWallsForGroup(input: {
  companyId: string;
  group: SectionWallGroup;
}): OfficeObject[] {
  const bounds = getOfficeObjectFootprintTileBounds(input.group.objects);
  if (!bounds) return [];

  const minX = bounds.minTileX - SECTION_WALL_MARGIN_TILES;
  const maxX = bounds.maxTileX + SECTION_WALL_MARGIN_TILES;
  const minZ = bounds.minTileZ - SECTION_WALL_MARGIN_TILES;
  const maxZ = bounds.maxTileZ + SECTION_WALL_MARGIN_TILES;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const walls: OfficeObject[] = [];
  const addWall = (params: {
    side: string;
    segmentIndex: number;
    position: [number, number, number];
    rotation: [number, number, number];
    length: number;
  }) => {
    walls.push({
      _id: `generated-section-wall-${input.group.id}-${params.side}-${params.segmentIndex}`,
      companyId: input.companyId,
      meshType: "glass-wall",
      position: params.position,
      rotation: params.rotation,
      scale: [params.length / SECTION_WALL_SEGMENT_LENGTH, 1, 1],
      metadata: {
        generated: true,
        sectionId: input.group.id,
        sectionType: input.group.sectionType,
        footprintWidth: params.length,
        footprintDepth: 0.35,
        footprintClearance: 0.05,
      },
    });
  };

  let segmentIndex = 0;
  for (let x = minX; x < maxX; x += SECTION_WALL_SEGMENT_LENGTH) {
    const nextX = Math.min(maxX, x + SECTION_WALL_SEGMENT_LENGTH);
    const length = Math.max(1, nextX - x);
    const segmentCenterX = x + length / 2;
    const skipsDoor = shouldSkipSectionDoor({
      start: x,
      end: nextX,
      doorCenter: centerX,
      doorWidth: SECTION_DOOR_WIDTH_TILES,
    });
    if (!skipsDoor) {
      addWall({
        side: "north",
        segmentIndex,
        position: [segmentCenterX, 0, minZ],
        rotation: [0, 0, 0],
        length,
      });
      segmentIndex += 1;
      addWall({
        side: "south",
        segmentIndex,
        position: [segmentCenterX, 0, maxZ],
        rotation: [0, 0, 0],
        length,
      });
      segmentIndex += 1;
    }
  }

  for (let z = minZ; z < maxZ; z += SECTION_WALL_SEGMENT_LENGTH) {
    const nextZ = Math.min(maxZ, z + SECTION_WALL_SEGMENT_LENGTH);
    const length = Math.max(1, nextZ - z);
    const segmentCenterZ = z + length / 2;
    const skipsDoor = shouldSkipSectionDoor({
      start: z,
      end: nextZ,
      doorCenter: centerZ,
      doorWidth: SECTION_DOOR_WIDTH_TILES,
    });
    if (!skipsDoor) {
      addWall({
        side: "west",
        segmentIndex,
        position: [minX, 0, segmentCenterZ],
        rotation: [0, Math.PI / 2, 0],
        length,
      });
      segmentIndex += 1;
      addWall({
        side: "east",
        segmentIndex,
        position: [maxX, 0, segmentCenterZ],
        rotation: [0, Math.PI / 2, 0],
        length,
      });
      segmentIndex += 1;
    }
  }

  return walls;
}

function deriveProjectSubprojectGroups(input: {
  projects: ProjectModel[];
  clusterObjects: OfficeObject[];
}): SectionWallGroup[] {
  const activeProjects = input.projects.filter((project) => project.status !== "archived");
  const clustersByTeamId = new Map(
    input.clusterObjects.flatMap((object) => {
      const teamId = getClusterTeamId(object);
      return teamId ? [[teamId, object] as const] : [];
    }),
  );
  const childrenByParentId = new Map<string, ProjectModel[]>();
  for (const project of activeProjects) {
    const parent = findParentProject(project, activeProjects);
    if (!parent) continue;
    const children = childrenByParentId.get(parent.id) ?? [];
    children.push(project);
    childrenByParentId.set(parent.id, children);
  }

  const groups: SectionWallGroup[] = [];
  for (const [parentProjectId, children] of childrenByParentId) {
    if (children.length < PROJECT_SECTION_MIN_SUBPROJECTS) continue;
    const projectIds = [parentProjectId, ...children.map((child) => child.id)];
    const objects = projectIds.flatMap((projectId) => {
      const object = clustersByTeamId.get(`team-${projectId}`);
      return object ? [object] : [];
    });
    if (objects.length > 0) {
      groups.push({
        id: `project-${parentProjectId}`,
        sectionType: "project-subprojects",
        objects,
      });
    }
  }
  return groups;
}

function deriveLargeTeamGroups(clusterObjects: OfficeObject[]): SectionWallGroup[] {
  return clusterObjects.flatMap((object) => {
    const teamId = getClusterTeamId(object);
    if (!teamId || getClusterDeskCount(object) < TEAM_SECTION_MIN_DESKS) return [];
    return [
      {
        id: `team-${teamId}`,
        sectionType: "large-team" as const,
        objects: [object],
      },
    ];
  });
}

export function buildOfficeSectionWallObjects(input: {
  companyId: string;
  projects: ProjectModel[];
  clusterObjects: OfficeObject[];
}): OfficeObject[] {
  const groups = [
    ...deriveProjectSubprojectGroups({
      projects: input.projects,
      clusterObjects: input.clusterObjects,
    }),
    ...deriveLargeTeamGroups(input.clusterObjects),
  ];
  return groups.flatMap((group) => buildWallsForGroup({ companyId: input.companyId, group }));
}
