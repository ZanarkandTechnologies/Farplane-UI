/**
 * OFFICE SECTION WALLS
 * ====================
 * Derives generated inner divider walls between meaningful treemap areas.
 *
 * Inputs are already-derived office area rectangles, placed team clusters, and
 * project metadata. Output is ordinary `office-divider` office objects so
 * renderer, occupancy, and auto-fit logic consume the same object contract as
 * user-placed dividers. Generated walls are extracted from shared treemap edges:
 * they separate neighboring regions instead of enclosing clusters with boxes.
 */

import type {
  OfficeAreaLayout,
  OfficeAreaNode,
  OfficeAreaRect,
} from "@/modules/office/lib/office-area-layout";
import type { OfficeObject } from "@/modules/office/lib/types";
import { getObjectFootprintCells } from "@/modules/office/systems/occupancy-system";
import type { ProjectModel } from "@/modules/runtime";

export const PROJECT_SECTION_MIN_SUBPROJECTS = 4;
export const TEAM_SECTION_MIN_DESKS = 6;

const SECTION_MIN_WALL_SPAN = 0.75;

interface TileBounds {
  minTileX: number;
  maxTileX: number;
  minTileZ: number;
  maxTileZ: number;
}

interface SectionAreaGroup {
  id: string;
  sectionType: "project-subprojects" | "large-team";
  area: OfficeAreaNode;
}

interface SectionDividerSegment {
  side: "north" | "south" | "west" | "east";
  line: number;
  start: number;
  end: number;
  length: number;
  position: [number, number, number];
  rotation: [number, number, number];
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

function getClusterProjectId(object: OfficeObject): string | null {
  const teamId = getClusterTeamId(object);
  if (!teamId?.startsWith("team-")) return null;
  const projectId = teamId.slice("team-".length);
  return projectId.length > 0 ? projectId : null;
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

function createDividerObject(input: {
  companyId: string;
  group: SectionAreaGroup;
  dividerArea: OfficeAreaNode;
  wallId: string;
  length: number;
  wallColor: string;
  position: [number, number, number];
  rotation: [number, number, number];
}): OfficeObject {
  return {
    _id: `generated-section-wall-${input.group.id}-${input.wallId}`,
    companyId: input.companyId,
    meshType: "office-divider",
    position: input.position,
    rotation: input.rotation,
    scale: [1, 1, 1],
    metadata: {
      generated: true,
      sectionBasis: "area-treemap",
      sectionId: input.group.id,
      sectionType: input.group.sectionType,
      areaId: input.group.area.id,
      dividerAreaId: input.dividerArea.id,
      footprintWidth: input.length,
      footprintDepth: 0.32,
      footprintClearance: 0.05,
      dividerHeight: 2.4,
      wallColor: input.wallColor,
      capColor: input.wallColor,
    },
  };
}

function rectsTouch(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.001;
}

function getOverlap(minA: number, maxA: number, minB: number, maxB: number): {
  start: number;
  end: number;
  length: number;
} | null {
  const start = Math.max(minA, minB);
  const end = Math.min(maxA, maxB);
  const length = end - start;
  return length >= SECTION_MIN_WALL_SPAN ? { start, end, length } : null;
}

function getSharedEdgeSegments(input: {
  target: OfficeAreaRect;
  neighbor: OfficeAreaRect;
}): SectionDividerSegment[] {
  const segments: SectionDividerSegment[] = [];
  const zOverlap = getOverlap(
    input.target.minZ,
    input.target.maxZ,
    input.neighbor.minZ,
    input.neighbor.maxZ,
  );
  if (zOverlap && rectsTouch(input.target.minX, input.neighbor.maxX)) {
    segments.push({
      side: "west",
      line: input.target.minX,
      start: zOverlap.start,
      end: zOverlap.end,
      length: zOverlap.length,
      position: [input.target.minX, 0, zOverlap.start + zOverlap.length / 2],
      rotation: [0, Math.PI / 2, 0],
    });
  }
  if (zOverlap && rectsTouch(input.target.maxX, input.neighbor.minX)) {
    segments.push({
      side: "east",
      line: input.target.maxX,
      start: zOverlap.start,
      end: zOverlap.end,
      length: zOverlap.length,
      position: [input.target.maxX, 0, zOverlap.start + zOverlap.length / 2],
      rotation: [0, Math.PI / 2, 0],
    });
  }

  const xOverlap = getOverlap(
    input.target.minX,
    input.target.maxX,
    input.neighbor.minX,
    input.neighbor.maxX,
  );
  if (xOverlap && rectsTouch(input.target.minZ, input.neighbor.maxZ)) {
    segments.push({
      side: "north",
      line: input.target.minZ,
      start: xOverlap.start,
      end: xOverlap.end,
      length: xOverlap.length,
      position: [xOverlap.start + xOverlap.length / 2, 0, input.target.minZ],
      rotation: [0, 0, 0],
    });
  }
  if (xOverlap && rectsTouch(input.target.maxZ, input.neighbor.minZ)) {
    segments.push({
      side: "south",
      line: input.target.maxZ,
      start: xOverlap.start,
      end: xOverlap.end,
      length: xOverlap.length,
      position: [xOverlap.start + xOverlap.length / 2, 0, input.target.maxZ],
      rotation: [0, 0, 0],
    });
  }
  return segments;
}

function mergeSegments(segments: SectionDividerSegment[]): SectionDividerSegment[] {
  const sorted = [...segments].sort((left, right) =>
    left.side === right.side && left.line === right.line
      ? left.start - right.start
      : `${left.side}:${left.line}`.localeCompare(`${right.side}:${right.line}`),
  );
  const merged: SectionDividerSegment[] = [];
  for (const segment of sorted) {
    const previous = merged.at(-1);
    if (
      previous &&
      previous.side === segment.side &&
      rectsTouch(previous.line, segment.line) &&
      segment.start <= previous.end + 0.001
    ) {
      previous.end = Math.max(previous.end, segment.end);
      previous.length = previous.end - previous.start;
      const center = previous.start + previous.length / 2;
      previous.position =
        previous.side === "west" || previous.side === "east"
          ? [previous.line, 0, center]
          : [center, 0, previous.line];
    } else {
      merged.push({ ...segment });
    }
  }
  return merged;
}

function selectMinimalDividerSide(segments: SectionDividerSegment[]): SectionDividerSegment[] {
  const merged = mergeSegments(segments);
  const totalsBySide = new Map<SectionDividerSegment["side"], number>();
  for (const segment of merged) {
    totalsBySide.set(segment.side, (totalsBySide.get(segment.side) ?? 0) + segment.length);
  }
  const bestSide = [...totalsBySide.entries()].sort((left, right) =>
    right[1] === left[1] ? left[0].localeCompare(right[0]) : right[1] - left[1],
  )[0]?.[0];
  return bestSide ? merged.filter((segment) => segment.side === bestSide) : [];
}

function getSiblingSharedSegments(input: {
  area: OfficeAreaNode;
  officeAreaLayout: OfficeAreaLayout;
}): SectionDividerSegment[] {
  const siblings = input.officeAreaLayout.areas.filter(
    (area) => area.parentId === input.area.parentId && area.id !== input.area.id,
  );
  return selectMinimalDividerSide(
    siblings.flatMap((sibling) =>
      getSharedEdgeSegments({
        target: input.area.rect,
        neighbor: sibling.rect,
      }),
    ),
  );
}

function findAreaById(officeAreaLayout: OfficeAreaLayout, areaId: string): OfficeAreaNode | null {
  return officeAreaLayout.areas.find((area) => area.id === areaId) ?? null;
}

function findDividerAreaAndSegments(input: {
  group: SectionAreaGroup;
  officeAreaLayout: OfficeAreaLayout;
}): { area: OfficeAreaNode; segments: SectionDividerSegment[] } | null {
  let area: OfficeAreaNode | null = input.group.area;
  while (area) {
    const segments = getSiblingSharedSegments({ area, officeAreaLayout: input.officeAreaLayout });
    if (segments.length > 0) return { area, segments };
    area = area.parentId ? findAreaById(input.officeAreaLayout, area.parentId) : null;
  }
  return null;
}

function buildWallsForAreaGroup(input: {
  companyId: string;
  group: SectionAreaGroup;
  officeAreaLayout: OfficeAreaLayout;
  wallColor: string;
}): OfficeObject[] {
  const divider = findDividerAreaAndSegments({
    group: input.group,
    officeAreaLayout: input.officeAreaLayout,
  });
  if (!divider) return [];

  return divider.segments.map((segment, index) =>
    createDividerObject({
      companyId: input.companyId,
      group: input.group,
      dividerArea: divider.area,
      wallId: `${segment.side}-${index}`,
      length: segment.length,
      wallColor: input.wallColor,
      position: segment.position,
      rotation: segment.rotation,
    }),
  );
}

function dedupeSectionAreaGroups(groups: SectionAreaGroup[]): SectionAreaGroup[] {
  const seen = new Set<string>();
  return groups.filter((group) => {
    const key = `${group.sectionType}:${group.id}:${group.area.id}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function deriveProjectSubprojectGroups(input: {
  projects: ProjectModel[];
  officeAreaLayout: OfficeAreaLayout;
}): SectionAreaGroup[] {
  const activeProjects = input.projects.filter((project) => project.status !== "archived");
  const childrenByParentId = new Map<string, ProjectModel[]>();
  for (const project of activeProjects) {
    const parent = findParentProject(project, activeProjects);
    if (!parent) continue;
    const children = childrenByParentId.get(parent.id) ?? [];
    children.push(project);
    childrenByParentId.set(parent.id, children);
  }

  const groups: SectionAreaGroup[] = [];
  for (const [parentProjectId, children] of childrenByParentId) {
    if (children.length < PROJECT_SECTION_MIN_SUBPROJECTS) continue;
    const area = input.officeAreaLayout.projectAreaByProjectId[parentProjectId];
    if (area) {
      groups.push({
        id: `project-${parentProjectId}`,
        sectionType: "project-subprojects",
        area,
      });
    }
  }
  return groups;
}

function deriveLargeTeamGroups(input: {
  clusterObjects: OfficeObject[];
  officeAreaLayout: OfficeAreaLayout;
}): SectionAreaGroup[] {
  return input.clusterObjects.flatMap((object) => {
    const teamId = getClusterTeamId(object);
    if (!teamId || getClusterDeskCount(object) < TEAM_SECTION_MIN_DESKS) return [];
    const projectId = getClusterProjectId(object);
    if (!projectId) return [];
    const area = input.officeAreaLayout.projectAreaByProjectId[projectId];
    if (!area) return [];
    return [
      {
        id: `team-${teamId}`,
        sectionType: "large-team" as const,
        area,
      },
    ];
  });
}

export function buildOfficeSectionWallObjects(input: {
  companyId: string;
  projects: ProjectModel[];
  clusterObjects: OfficeObject[];
  officeAreaLayout: OfficeAreaLayout;
  wallColor: string;
}): OfficeObject[] {
  const groups = dedupeSectionAreaGroups([
    ...deriveProjectSubprojectGroups({
      projects: input.projects,
      officeAreaLayout: input.officeAreaLayout,
    }),
    ...deriveLargeTeamGroups({
      clusterObjects: input.clusterObjects,
      officeAreaLayout: input.officeAreaLayout,
    }),
  ]);
  return groups.flatMap((group) =>
    buildWallsForAreaGroup({
      companyId: input.companyId,
      group,
      officeAreaLayout: input.officeAreaLayout,
      wallColor: input.wallColor,
    }),
  );
}
