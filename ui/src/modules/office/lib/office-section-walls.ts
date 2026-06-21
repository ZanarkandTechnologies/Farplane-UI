/**
 * OFFICE SECTION WALLS
 * ====================
 * Derives generated inner divider walls around meaningful placed team groups.
 *
 * Inputs are already-placed team cluster objects and project metadata. Output is
 * ordinary `office-divider` office objects so renderer, occupancy, and auto-fit
 * logic consume the same object contract as user-placed dividers. Generated
 * walls wrap existing clusters; they do not repartition or move the office.
 */

import type { OfficeObject } from "@/modules/office/lib/types";
import { getObjectFootprintCells } from "@/modules/office/systems/occupancy-system";
import type { ProjectModel } from "@/modules/runtime";

export const PROJECT_SECTION_MIN_SUBPROJECTS = 4;
export const TEAM_SECTION_MIN_DESKS = 6;

const SECTION_WALL_MARGIN_TILES = 2;
const SECTION_DOOR_WIDTH_TILES = 4;
const SECTION_MIN_WALL_SPAN = 0.75;

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

function splitSpanAroundDoor(input: {
  start: number;
  end: number;
  doorCenter: number;
  doorWidth: number;
}): Array<{ start: number; end: number }> {
  const start = Math.min(input.start, input.end);
  const end = Math.max(input.start, input.end);
  const length = end - start;
  if (length <= SECTION_MIN_WALL_SPAN) return [];
  if (length <= input.doorWidth + SECTION_MIN_WALL_SPAN * 2) return [{ start, end }];

  const doorMin = Math.max(start, input.doorCenter - input.doorWidth / 2);
  const doorMax = Math.min(end, input.doorCenter + input.doorWidth / 2);
  return [
    { start, end: doorMin },
    { start: doorMax, end },
  ].filter((span) => span.end - span.start >= SECTION_MIN_WALL_SPAN);
}

function createDividerObject(input: {
  companyId: string;
  group: SectionWallGroup;
  wallId: string;
  length: number;
  position: [number, number, number];
  rotation: [number, number, number];
}): OfficeObject {
  return {
    _id: `generated-section-wall-${input.group.id}-${input.wallId}`,
    companyId: input.companyId,
    meshType: "office-divider",
    position: input.position,
    rotation: input.rotation,
    scale: [Math.max(0.2, input.length / 4), 1, 1],
    metadata: {
      generated: true,
      sectionBasis: "cluster-footprint",
      sectionId: input.group.id,
      sectionType: input.group.sectionType,
      footprintWidth: input.length,
      footprintDepth: 0.32,
      footprintClearance: 0.05,
      dividerHeight: 2.4,
    },
  };
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
  let wallIndex = 0;
  const addWall = (params: {
    side: "north" | "south" | "west" | "east";
    length: number;
    position: [number, number, number];
    rotation: [number, number, number];
  }) => {
    if (params.length < SECTION_MIN_WALL_SPAN) return;
    walls.push(
      createDividerObject({
        companyId: input.companyId,
        group: input.group,
        wallId: `${params.side}-${wallIndex}`,
        length: params.length,
        position: params.position,
        rotation: params.rotation,
      }),
    );
    wallIndex += 1;
  };

  for (const span of splitSpanAroundDoor({
    start: minX,
    end: maxX,
    doorCenter: centerX,
    doorWidth: SECTION_DOOR_WIDTH_TILES,
  })) {
    const length = span.end - span.start;
    addWall({
      side: "north",
      length,
      position: [span.start + length / 2, 0, minZ],
      rotation: [0, 0, 0],
    });
    addWall({
      side: "south",
      length,
      position: [span.start + length / 2, 0, maxZ],
      rotation: [0, 0, 0],
    });
  }

  for (const span of splitSpanAroundDoor({
    start: minZ,
    end: maxZ,
    doorCenter: centerZ,
    doorWidth: SECTION_DOOR_WIDTH_TILES,
  })) {
    const length = span.end - span.start;
    addWall({
      side: "west",
      length,
      position: [minX, 0, span.start + length / 2],
      rotation: [0, Math.PI / 2, 0],
    });
    addWall({
      side: "east",
      length,
      position: [maxX, 0, span.start + length / 2],
      rotation: [0, Math.PI / 2, 0],
    });
  }

  return walls;
}

function dedupeOfficeObjectsById(objects: OfficeObject[]): OfficeObject[] {
  const seen = new Set<string>();
  return objects.filter((object) => {
    if (seen.has(object._id)) {
      return false;
    }
    seen.add(object._id);
    return true;
  });
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
        objects: dedupeOfficeObjectsById(objects),
      });
    }
  }
  return groups;
}

function deriveLargeTeamGroups(input: {
  clusterObjects: OfficeObject[];
}): SectionWallGroup[] {
  return input.clusterObjects.flatMap((object) => {
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
    ...deriveLargeTeamGroups({
      clusterObjects: input.clusterObjects,
    }),
  ];
  return groups.flatMap((group) => buildWallsForGroup({ companyId: input.companyId, group }));
}
