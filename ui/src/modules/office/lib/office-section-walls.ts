/**
 * OFFICE SECTION WALLS
 * ====================
 * Derives generated inner divider walls between meaningful treemap areas.
 *
 * Inputs are already-derived office area rectangles and project metadata.
 * Output is ordinary `office-divider` office objects so renderer, occupancy,
 * and auto-fit logic consume the same object contract as user-placed dividers.
 * Project dividers are extracted from shared treemap edges; team tables stay
 * furniture-first instead of spawning ad hoc rooms.
 */

import type {
  OfficeAreaLayout,
  OfficeAreaNode,
  OfficeAreaRect,
} from "@/modules/office/lib/office-area-layout";
import type { OfficeLayoutModel } from "@/modules/office/lib/office-layout";
import type { OfficeObject } from "@/modules/office/lib/types";
import { getObjectFootprintCells } from "@/modules/office/systems/occupancy-system";
import type { OfficeLayoutStrategyId, ProjectModel } from "@/modules/runtime";

export const PROJECT_SECTION_MIN_SUBPROJECTS = 4;

const SECTION_MIN_WALL_SPAN = 0.75;
const SECTION_DOOR_WIDTH = 2.25;
const SECTION_WALL_REUSE_DISTANCE = 1.25;
const SECTION_WALL_REUSE_MIN_COVERAGE = 0.25;

interface TileBounds {
  minTileX: number;
  maxTileX: number;
  minTileZ: number;
  maxTileZ: number;
}

interface SectionAreaGroup {
  id: string;
  sectionType: "project-subprojects" | "project-room";
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

function findParentProject(
  project: ProjectModel,
  projects: ProjectModel[],
): ProjectModel | null {
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

export function getOfficeObjectFootprintTileBounds(
  objects: OfficeObject[],
): TileBounds | null {
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

function splitSegmentAroundDoor(
  segment: SectionDividerSegment,
): SectionDividerSegment[] {
  if (segment.length < SECTION_DOOR_WIDTH + SECTION_MIN_WALL_SPAN * 2)
    return [segment];
  const center = segment.start + segment.length / 2;
  const firstEnd = center - SECTION_DOOR_WIDTH / 2;
  const secondStart = center + SECTION_DOOR_WIDTH / 2;
  const buildSegment = (
    start: number,
    end: number,
  ): SectionDividerSegment | null => {
    const length = end - start;
    if (length < SECTION_MIN_WALL_SPAN) return null;
    const nextCenter = start + length / 2;
    return {
      ...segment,
      start,
      end,
      length,
      position:
        segment.side === "west" || segment.side === "east"
          ? [segment.line, 0, nextCenter]
          : [nextCenter, 0, segment.line],
      side: segment.side,
      rotation: segment.rotation,
    };
  };
  return [
    buildSegment(segment.start, firstEnd),
    buildSegment(secondStart, segment.end),
  ].filter((entry): entry is SectionDividerSegment => Boolean(entry));
}

function rectsTouch(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.001;
}

function getNearEdgeLine(leftEdge: number, rightEdge: number): number | null {
  const gap = rightEdge - leftEdge;
  if (gap < -0.001 || gap > 0.001) return null;
  return leftEdge + Math.max(0, gap) / 2;
}

function getOverlap(
  minA: number,
  maxA: number,
  minB: number,
  maxB: number,
): {
  start: number;
  end: number;
  length: number;
} | null {
  const start = Math.max(minA, minB);
  const end = Math.min(maxA, maxB);
  const length = end - start;
  return length >= SECTION_MIN_WALL_SPAN ? { start, end, length } : null;
}

function getDividerSpan(wall: OfficeObject): {
  vertical: boolean;
  line: number;
  start: number;
  end: number;
} | null {
  if (wall.meshType !== "office-divider" && wall.meshType !== "glass-wall")
    return null;
  const rawLength = wall.metadata?.footprintWidth;
  const length =
    typeof rawLength === "number" && Number.isFinite(rawLength) ? rawLength : 0;
  if (length <= 0) return null;
  const vertical = Math.abs(wall.rotation?.[1] ?? 0) > Math.PI / 4;
  const center = vertical ? wall.position[2] : wall.position[0];
  return {
    vertical,
    line: vertical ? wall.position[0] : wall.position[2],
    start: center - length / 2,
    end: center + length / 2,
  };
}

function getSegmentOverlapLength(
  left: { start: number; end: number },
  right: { start: number; end: number },
): number {
  return Math.max(
    0,
    Math.min(left.end, right.end) - Math.max(left.start, right.start),
  );
}

function isDividerCoveredByExistingWall(
  candidate: OfficeObject,
  existingWalls: OfficeObject[],
): boolean {
  const candidateSpan = getDividerSpan(candidate);
  if (!candidateSpan) return false;
  const candidateLength = candidateSpan.end - candidateSpan.start;
  if (candidateLength <= 0) return false;
  let coveredLength = 0;
  for (const wall of existingWalls) {
    const wallSpan = getDividerSpan(wall);
    if (!wallSpan || wallSpan.vertical !== candidateSpan.vertical) continue;
    if (
      Math.abs(wallSpan.line - candidateSpan.line) > SECTION_WALL_REUSE_DISTANCE
    )
      continue;
    coveredLength += getSegmentOverlapLength(candidateSpan, wallSpan);
  }
  return coveredLength / candidateLength >= SECTION_WALL_REUSE_MIN_COVERAGE;
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
  const westLine = getNearEdgeLine(input.neighbor.maxX, input.target.minX);
  if (zOverlap && westLine !== null) {
    segments.push({
      side: "west",
      line: westLine,
      start: zOverlap.start,
      end: zOverlap.end,
      length: zOverlap.length,
      position: [westLine, 0, zOverlap.start + zOverlap.length / 2],
      rotation: [0, Math.PI / 2, 0],
    });
  }
  const eastLine = getNearEdgeLine(input.target.maxX, input.neighbor.minX);
  if (zOverlap && eastLine !== null) {
    segments.push({
      side: "east",
      line: eastLine,
      start: zOverlap.start,
      end: zOverlap.end,
      length: zOverlap.length,
      position: [eastLine, 0, zOverlap.start + zOverlap.length / 2],
      rotation: [0, Math.PI / 2, 0],
    });
  }

  const xOverlap = getOverlap(
    input.target.minX,
    input.target.maxX,
    input.neighbor.minX,
    input.neighbor.maxX,
  );
  const northLine = getNearEdgeLine(input.neighbor.maxZ, input.target.minZ);
  if (xOverlap && northLine !== null) {
    segments.push({
      side: "north",
      line: northLine,
      start: xOverlap.start,
      end: xOverlap.end,
      length: xOverlap.length,
      position: [xOverlap.start + xOverlap.length / 2, 0, northLine],
      rotation: [0, 0, 0],
    });
  }
  const southLine = getNearEdgeLine(input.target.maxZ, input.neighbor.minZ);
  if (xOverlap && southLine !== null) {
    segments.push({
      side: "south",
      line: southLine,
      start: xOverlap.start,
      end: xOverlap.end,
      length: xOverlap.length,
      position: [xOverlap.start + xOverlap.length / 2, 0, southLine],
      rotation: [0, 0, 0],
    });
  }
  return segments;
}

function mergeSegments(
  segments: SectionDividerSegment[],
): SectionDividerSegment[] {
  const sorted = [...segments].sort((left, right) =>
    left.side === right.side && left.line === right.line
      ? left.start - right.start
      : `${left.side}:${left.line}`.localeCompare(
          `${right.side}:${right.line}`,
        ),
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

function selectMinimalDividerSide(
  segments: SectionDividerSegment[],
): SectionDividerSegment[] {
  const merged = mergeSegments(segments);
  const totalsBySide = new Map<SectionDividerSegment["side"], number>();
  for (const segment of merged) {
    totalsBySide.set(
      segment.side,
      (totalsBySide.get(segment.side) ?? 0) + segment.length,
    );
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
    (area) =>
      area.parentId === input.area.parentId && area.id !== input.area.id,
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

function findAreaById(
  officeAreaLayout: OfficeAreaLayout,
  areaId: string,
): OfficeAreaNode | null {
  return officeAreaLayout.areas.find((area) => area.id === areaId) ?? null;
}

function findDividerAreaAndSegments(input: {
  group: SectionAreaGroup;
  officeAreaLayout: OfficeAreaLayout;
}): { area: OfficeAreaNode; segments: SectionDividerSegment[] } | null {
  let area: OfficeAreaNode | null = input.group.area;
  while (area) {
    const segments = getSiblingSharedSegments({
      area,
      officeAreaLayout: input.officeAreaLayout,
    });
    if (segments.length > 0) return { area, segments };
    area = area.parentId
      ? findAreaById(input.officeAreaLayout, area.parentId)
      : null;
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

function createDividerObjectsForSegments(input: {
  companyId: string;
  group: SectionAreaGroup;
  dividerArea: OfficeAreaNode;
  segments: SectionDividerSegment[];
  wallColor: string;
  doorGaps: boolean;
}): OfficeObject[] {
  return input.segments.flatMap((segment, segmentIndex) => {
    const wallSegments = input.doorGaps
      ? splitSegmentAroundDoor(segment)
      : [segment];
    return wallSegments.map((wallSegment, wallIndex) =>
      createDividerObject({
        companyId: input.companyId,
        group: input.group,
        dividerArea: input.dividerArea,
        wallId: `${wallSegment.side}-${segmentIndex}-${wallIndex}`,
        length: wallSegment.length,
        wallColor: input.wallColor,
        position: wallSegment.position,
        rotation: wallSegment.rotation,
      }),
    );
  });
}

function dedupeSectionAreaGroups(
  groups: SectionAreaGroup[],
): SectionAreaGroup[] {
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
  const activeProjects = input.projects.filter(
    (project) => project.status !== "archived",
  );
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

function buildActivityTreemapWallObjects(input: {
  companyId: string;
  projects: ProjectModel[];
  officeAreaLayout: OfficeAreaLayout;
  wallColor: string;
}): OfficeObject[] {
  const activeProjectIds = new Set(
    input.projects
      .filter((project) => project.status !== "archived")
      .map((project) => project.id),
  );
  const projectAreas = Object.values(
    input.officeAreaLayout.projectAreaByProjectId,
  )
    .filter((area) => area.projectId && activeProjectIds.has(area.projectId))
    .sort((left, right) => left.id.localeCompare(right.id));
  const walls: OfficeObject[] = [];
  for (let leftIndex = 0; leftIndex < projectAreas.length; leftIndex += 1) {
    const leftArea = projectAreas[leftIndex];
    if (!leftArea) continue;
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < projectAreas.length;
      rightIndex += 1
    ) {
      const rightArea = projectAreas[rightIndex];
      if (!rightArea) continue;
      const segments = mergeSegments(
        getSharedEdgeSegments({
          target: leftArea.rect,
          neighbor: rightArea.rect,
        }),
      );
      if (segments.length === 0) continue;
      walls.push(
        ...createDividerObjectsForSegments({
          companyId: input.companyId,
          group: {
            id: `project-edge-${leftArea.projectId}-to-${rightArea.projectId}`,
            sectionType: "project-room",
            area: leftArea,
          },
          dividerArea: rightArea,
          segments,
          wallColor: input.wallColor,
          doorGaps: true,
        }),
      );
    }
  }
  return walls;
}

export function buildOfficeSectionWallObjects(input: {
  companyId: string;
  projects: ProjectModel[];
  clusterObjects: OfficeObject[];
  officeAreaLayout: OfficeAreaLayout;
  officeLayout: OfficeLayoutModel;
  existingWalls?: OfficeObject[];
  layoutStrategy?: OfficeLayoutStrategyId;
  wallColor: string;
}): OfficeObject[] {
  const strategy = input.layoutStrategy ?? "legacy";
  const projectDividerWalls =
    strategy === "activity_treemap" || strategy === "command_districts"
      ? buildActivityTreemapWallObjects({
          companyId: input.companyId,
          projects: input.projects,
          officeAreaLayout: input.officeAreaLayout,
          wallColor: input.wallColor,
        })
      : dedupeSectionAreaGroups([
          ...deriveProjectSubprojectGroups({
            projects: input.projects,
            officeAreaLayout: input.officeAreaLayout,
          }),
        ]).flatMap((group) =>
          buildWallsForAreaGroup({
            companyId: input.companyId,
            group,
            officeAreaLayout: input.officeAreaLayout,
            wallColor: input.wallColor,
          }),
        );
  const existingWalls = input.existingWalls ?? [];
  const reusableProjectDividerWalls = projectDividerWalls.filter(
    (wall) => !isDividerCoveredByExistingWall(wall, existingWalls),
  );
  return reusableProjectDividerWalls;
}
