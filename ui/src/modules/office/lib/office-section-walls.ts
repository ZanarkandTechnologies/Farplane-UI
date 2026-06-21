/**
 * OFFICE SECTION WALLS
 * ====================
 * Derives generated divider-wall partitions from the office treemap.
 *
 * Inputs are semantic project/team thresholds plus immutable OfficeAreaNode
 * rectangles. Output is ordinary `office-divider` office objects so renderer,
 * occupancy, and auto-fit logic consume the same object contract as user-placed
 * dividers. Generated walls deliberately follow area boundaries, not furniture
 * footprints, so projects can become real office sections.
 */

import type { OfficeAreaNode, OfficeAreaRect } from "@/modules/office/lib/office-area-layout";
import { getOfficeLayoutBounds, type OfficeLayoutModel } from "@/modules/office/lib/office-layout";
import type { OfficeObject } from "@/modules/office/lib/types";
import { getObjectFootprintCells } from "@/modules/office/systems/occupancy-system";
import type { ProjectModel } from "@/modules/runtime";

export const PROJECT_SECTION_MIN_SUBPROJECTS = 4;
export const TEAM_SECTION_MIN_DESKS = 6;

const SECTION_DOOR_WIDTH_TILES = 4;
const SECTION_MIN_WALL_SPAN = 0.75;
const SECTION_EDGE_EPSILON = 0.2;
const OFFICE_AREA_INSET_FROM_LAYOUT_BOUNDS = 1;

interface TileBounds {
  minTileX: number;
  maxTileX: number;
  minTileZ: number;
  maxTileZ: number;
}

interface SectionWallGroup {
  id: string;
  sectionType: "project-subprojects" | "large-team";
  areas: OfficeAreaNode[];
  dividerEdges: SectionDividerEdge[];
}

interface SectionDividerEdge {
  id: string;
  orientation: "horizontal" | "vertical";
  fixed: number;
  start: number;
  end: number;
  sourceAreaId: string;
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

function projectIdFromTeamId(teamId: string): string {
  return teamId.startsWith("team-") ? teamId.slice("team-".length) : teamId;
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

function getOfficeAreaRootRect(officeLayout: OfficeLayoutModel): OfficeAreaRect {
  const bounds = getOfficeLayoutBounds(officeLayout);
  const minX = bounds.minWorldX + OFFICE_AREA_INSET_FROM_LAYOUT_BOUNDS;
  const maxX = bounds.maxWorldX - OFFICE_AREA_INSET_FROM_LAYOUT_BOUNDS;
  const minZ = bounds.minWorldZ + OFFICE_AREA_INSET_FROM_LAYOUT_BOUNDS;
  const maxZ = bounds.maxWorldZ - OFFICE_AREA_INSET_FROM_LAYOUT_BOUNDS;
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    centerX: minX + (maxX - minX) / 2,
    centerZ: minZ + (maxZ - minZ) / 2,
    width: Math.max(0, maxX - minX),
    depth: Math.max(0, maxZ - minZ),
  };
}

function sameEdge(left: number, right: number): boolean {
  return Math.abs(left - right) <= SECTION_EDGE_EPSILON;
}

function isOfficePerimeterEdge(input: {
  orientation: "horizontal" | "vertical";
  fixed: number;
  rootRect: OfficeAreaRect;
}): boolean {
  if (input.orientation === "horizontal") {
    return sameEdge(input.fixed, input.rootRect.minZ) || sameEdge(input.fixed, input.rootRect.maxZ);
  }
  return sameEdge(input.fixed, input.rootRect.minX) || sameEdge(input.fixed, input.rootRect.maxX);
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

function wallKey(input: {
  orientation: "horizontal" | "vertical";
  fixed: number;
  start: number;
  end: number;
}): string {
  return [
    input.orientation,
    input.fixed.toFixed(2),
    Math.min(input.start, input.end).toFixed(2),
    Math.max(input.start, input.end).toFixed(2),
  ].join(":");
}

function buildWallsForArea(input: {
  companyId: string;
  group: SectionWallGroup;
  area: OfficeAreaNode;
  rootRect: OfficeAreaRect;
  seenEdges: Set<string>;
  segmentOffset: number;
}): OfficeObject[] {
  const rect = input.area.rect;
  const walls: OfficeObject[] = [];
  let segmentIndex = input.segmentOffset;
  const addWall = (params: {
    side: "north" | "south" | "west" | "east";
    orientation: "horizontal" | "vertical";
    fixed: number;
    start: number;
    end: number;
    position: [number, number, number];
    rotation: [number, number, number];
  }) => {
    if (isOfficePerimeterEdge({
      orientation: params.orientation,
      fixed: params.fixed,
      rootRect: input.rootRect,
    })) {
      return;
    }
    const edgeKey = wallKey({
      orientation: params.orientation,
      fixed: params.fixed,
      start: params.start,
      end: params.end,
    });
    if (input.seenEdges.has(edgeKey)) return;
    input.seenEdges.add(edgeKey);

    const length = Math.abs(params.end - params.start);
    if (length < SECTION_MIN_WALL_SPAN) return;
    walls.push({
      _id: `generated-section-wall-${input.group.id}-${input.area.id.replace(/[^a-z0-9]+/gi, "-")}-${params.side}-${segmentIndex}`,
      companyId: input.companyId,
      meshType: "office-divider",
      position: params.position,
      rotation: params.rotation,
      scale: [Math.max(0.2, length / 4), 1, 1],
      metadata: {
        generated: true,
        sectionBasis: "treemap",
        sectionId: input.group.id,
        sectionType: input.group.sectionType,
        sectionAreaId: input.area.id,
        footprintWidth: length,
        footprintDepth: 0.32,
        footprintClearance: 0.05,
        dividerHeight: 2.4,
      },
    });
    segmentIndex += 1;
  };

  const horizontalEdges = [
    { side: "north" as const, z: rect.minZ },
    { side: "south" as const, z: rect.maxZ },
  ];
  for (const edge of horizontalEdges) {
    for (const span of splitSpanAroundDoor({
      start: rect.minX,
      end: rect.maxX,
      doorCenter: rect.centerX,
      doorWidth: SECTION_DOOR_WIDTH_TILES,
    })) {
      const length = span.end - span.start;
      addWall({
        side: edge.side,
        orientation: "horizontal",
        fixed: edge.z,
        start: span.start,
        end: span.end,
        position: [span.start + length / 2, 0, edge.z],
        rotation: [0, 0, 0],
      });
    }
  }

  const verticalEdges = [
    { side: "west" as const, x: rect.minX },
    { side: "east" as const, x: rect.maxX },
  ];
  for (const edge of verticalEdges) {
    for (const span of splitSpanAroundDoor({
      start: rect.minZ,
      end: rect.maxZ,
      doorCenter: rect.centerZ,
      doorWidth: SECTION_DOOR_WIDTH_TILES,
    })) {
      const length = span.end - span.start;
      addWall({
        side: edge.side,
        orientation: "vertical",
        fixed: edge.x,
        start: span.start,
        end: span.end,
        position: [edge.x, 0, span.start + length / 2],
        rotation: [0, Math.PI / 2, 0],
      });
    }
  }

  return walls;
}

function buildWallsForEdge(input: {
  companyId: string;
  group: SectionWallGroup;
  edge: SectionDividerEdge;
  rootRect: OfficeAreaRect;
  seenEdges: Set<string>;
  segmentOffset: number;
}): OfficeObject[] {
  const walls: OfficeObject[] = [];
  let segmentIndex = input.segmentOffset;
  const spanCenter = (input.edge.start + input.edge.end) / 2;
  for (const span of splitSpanAroundDoor({
    start: input.edge.start,
    end: input.edge.end,
    doorCenter: spanCenter,
    doorWidth: SECTION_DOOR_WIDTH_TILES,
  })) {
    if (isOfficePerimeterEdge({
      orientation: input.edge.orientation,
      fixed: input.edge.fixed,
      rootRect: input.rootRect,
    })) {
      continue;
    }
    const edgeKey = wallKey({
      orientation: input.edge.orientation,
      fixed: input.edge.fixed,
      start: span.start,
      end: span.end,
    });
    if (input.seenEdges.has(edgeKey)) continue;
    input.seenEdges.add(edgeKey);
    const length = span.end - span.start;
    if (length < SECTION_MIN_WALL_SPAN) continue;
    const isHorizontal = input.edge.orientation === "horizontal";
    walls.push({
      _id: `generated-section-wall-${input.group.id}-${input.edge.id}-${segmentIndex}`,
      companyId: input.companyId,
      meshType: "office-divider",
      position: isHorizontal
        ? [span.start + length / 2, 0, input.edge.fixed]
        : [input.edge.fixed, 0, span.start + length / 2],
      rotation: isHorizontal ? [0, 0, 0] : [0, Math.PI / 2, 0],
      scale: [Math.max(0.2, length / 4), 1, 1],
      metadata: {
        generated: true,
        sectionBasis: "treemap",
        sectionId: input.group.id,
        sectionType: input.group.sectionType,
        sectionAreaId: input.edge.sourceAreaId,
        sectionEdgeId: input.edge.id,
        footprintWidth: length,
        footprintDepth: 0.32,
        footprintClearance: 0.05,
        dividerHeight: 2.4,
      },
    });
    segmentIndex += 1;
  }
  return walls;
}

function buildWallsForGroup(input: {
  companyId: string;
  group: SectionWallGroup;
  rootRect: OfficeAreaRect;
  seenEdges: Set<string>;
  segmentOffset: number;
}): OfficeObject[] {
  const edgeWalls = input.group.dividerEdges.flatMap((edge, index) =>
    buildWallsForEdge({
      companyId: input.companyId,
      group: input.group,
      edge,
      rootRect: input.rootRect,
      seenEdges: input.seenEdges,
      segmentOffset: input.segmentOffset + index * 100,
    }),
  );
  const areaWalls = input.group.areas.flatMap((area, index) =>
    buildWallsForArea({
      companyId: input.companyId,
      group: input.group,
      area,
      rootRect: input.rootRect,
      seenEdges: input.seenEdges,
      segmentOffset: input.segmentOffset + 500 + index * 100,
    }),
  );
  return [...edgeWalls, ...areaWalls];
}

function overlapSpan(
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
): { start: number; end: number } | null {
  const start = Math.max(Math.min(leftStart, leftEnd), Math.min(rightStart, rightEnd));
  const end = Math.min(Math.max(leftStart, leftEnd), Math.max(rightStart, rightEnd));
  return end - start >= SECTION_MIN_WALL_SPAN ? { start, end } : null;
}

function deriveSiblingBoundaryEdges(areas: OfficeAreaNode[]): SectionDividerEdge[] {
  const edges: SectionDividerEdge[] = [];
  const seen = new Set<string>();
  const addEdge = (edge: SectionDividerEdge) => {
    const key = wallKey({
      orientation: edge.orientation,
      fixed: edge.fixed,
      start: edge.start,
      end: edge.end,
    });
    if (seen.has(key)) return;
    seen.add(key);
    edges.push(edge);
  };

  for (let leftIndex = 0; leftIndex < areas.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < areas.length; rightIndex += 1) {
      const left = areas[leftIndex];
      const right = areas[rightIndex];
      if (sameEdge(left.rect.maxX, right.rect.minX) || sameEdge(right.rect.maxX, left.rect.minX)) {
        const fixed = sameEdge(left.rect.maxX, right.rect.minX) ? left.rect.maxX : right.rect.maxX;
        const overlap = overlapSpan(left.rect.minZ, left.rect.maxZ, right.rect.minZ, right.rect.maxZ);
        if (overlap) {
          addEdge({
            id: `split-x-${fixed.toFixed(2)}-${overlap.start.toFixed(2)}-${overlap.end.toFixed(2)}`,
            orientation: "vertical",
            fixed,
            start: overlap.start,
            end: overlap.end,
            sourceAreaId: left.parentId ?? left.id,
          });
        }
      }
      if (sameEdge(left.rect.maxZ, right.rect.minZ) || sameEdge(right.rect.maxZ, left.rect.minZ)) {
        const fixed = sameEdge(left.rect.maxZ, right.rect.minZ) ? left.rect.maxZ : right.rect.maxZ;
        const overlap = overlapSpan(left.rect.minX, left.rect.maxX, right.rect.minX, right.rect.maxX);
        if (overlap) {
          addEdge({
            id: `split-z-${fixed.toFixed(2)}-${overlap.start.toFixed(2)}-${overlap.end.toFixed(2)}`,
            orientation: "horizontal",
            fixed,
            start: overlap.start,
            end: overlap.end,
            sourceAreaId: left.parentId ?? left.id,
          });
        }
      }
    }
  }
  return edges;
}

function deriveProjectSubprojectGroups(input: {
  projects: ProjectModel[];
  officeAreas: OfficeAreaNode[];
}): SectionWallGroup[] {
  const activeProjects = input.projects.filter((project) => project.status !== "archived");
  const areaByProjectId = new Map(
    input.officeAreas.flatMap((area) => (area.projectId ? [[area.projectId, area] as const] : [])),
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
    const childAreas = children.flatMap((child) => {
      const area = areaByProjectId.get(child.id);
      return area ? [area] : [];
    });
    const parentArea = areaByProjectId.get(parentProjectId);
    const dividerEdges = deriveSiblingBoundaryEdges(childAreas);
    const areas = parentArea ? [parentArea] : [];
    if (areas.length > 0 || dividerEdges.length > 0) {
      groups.push({
        id: `project-${parentProjectId}`,
        sectionType: "project-subprojects",
        areas,
        dividerEdges,
      });
    }
  }
  return groups;
}

function deriveLargeTeamGroups(input: {
  clusterObjects: OfficeObject[];
  officeAreas: OfficeAreaNode[];
}): SectionWallGroup[] {
  const areaByProjectId = new Map(
    input.officeAreas.flatMap((area) => (area.projectId ? [[area.projectId, area] as const] : [])),
  );
  return input.clusterObjects.flatMap((object) => {
    const teamId = getClusterTeamId(object);
    if (!teamId || getClusterDeskCount(object) < TEAM_SECTION_MIN_DESKS) return [];
    const area = areaByProjectId.get(projectIdFromTeamId(teamId));
    if (!area) return [];
    return [
      {
        id: `team-${teamId}`,
        sectionType: "large-team" as const,
        areas: [area],
        dividerEdges: [],
      },
    ];
  });
}

export function buildOfficeSectionWallObjects(input: {
  companyId: string;
  projects: ProjectModel[];
  clusterObjects: OfficeObject[];
  officeAreas: OfficeAreaNode[];
  officeLayout: OfficeLayoutModel;
}): OfficeObject[] {
  const rootRect = getOfficeAreaRootRect(input.officeLayout);
  const seenEdges = new Set<string>();
  const groups = [
    ...deriveProjectSubprojectGroups({
      projects: input.projects,
      officeAreas: input.officeAreas,
    }),
    ...deriveLargeTeamGroups({
      clusterObjects: input.clusterObjects,
      officeAreas: input.officeAreas,
    }),
  ];
  return groups.flatMap((group, index) =>
    buildWallsForGroup({
      companyId: input.companyId,
      group,
      rootRect,
      seenEdges,
      segmentOffset: index * 1000,
    }),
  );
}
