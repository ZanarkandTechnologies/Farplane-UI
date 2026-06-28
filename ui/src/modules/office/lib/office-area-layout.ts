/**
 * OFFICE AREA LAYOUT
 * ==================
 * Pure hierarchy and treemap-style area allocation for office districts.
 *
 * KEY CONCEPTS:
 * - Area ownership is derived scene state, not persisted furniture.
 * - Project paths become nested organization areas when available.
 * - Allocation is deterministic and feeds preferred team anchors only.
 */

import type {
  CompanyAgentModel,
  CompanyModel,
  OfficeLayoutStrategyId,
  ProjectModel,
  ProjectWorkloadSummary,
} from "@/modules/runtime";
import { getOfficeLayoutBounds, type OfficeLayoutModel } from "./office-layout";
import { getClusterOccupancyFootprint } from "../utils/layout";

export interface OfficeAreaRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
}

export interface OfficeAreaNode {
  id: string;
  label: string;
  kind: "district" | "project" | "project-tables" | "shared";
  depth: number;
  parentId?: string;
  projectId?: string;
  departmentId?: string;
  path?: string;
  weight: number;
  rect: OfficeAreaRect;
  color: string;
}

export interface OfficeAreaLayout {
  areas: OfficeAreaNode[];
  projectAreaByProjectId: Record<string, OfficeAreaNode>;
}

export interface ProjectActivitySummary {
  projectId: string;
  recentActivityScore: number;
}

interface AreaTreeNode {
  id: string;
  label: string;
  depth: number;
  parentId?: string;
  projectId?: string;
  departmentId?: string;
  path?: string;
  isSelfArea?: boolean;
  ownWeight: number;
  desiredWidth: number;
  desiredDepth: number;
  weight: number;
  children: AreaTreeNode[];
}

interface AreaBuildInput {
  company: CompanyModel;
  officeLayout: OfficeLayoutModel;
  layoutStrategy?: OfficeLayoutStrategyId;
  workload?: ProjectWorkloadSummary[];
  activity?: ProjectActivitySummary[];
}

const AREA_COLORS = [
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#a78bfa",
  "#fb7185",
  "#22c55e",
  "#f97316",
  "#60a5fa",
];
export const OFFICE_AREA_MIN_LANE_SIZE = 1;
const CENTER_PACK_GAP = 0.75;
const CENTER_PACK_PADDING = 0.6;
const CENTER_PACK_MIN_SIDE = 5;
const CENTER_PACK_COMPACTION_PASSES = 4;
const CENTER_PACK_COMPACTION_STEP = 0.5;
const CENTER_PACK_SCORE_EPSILON = 0.001;
const PROJECT_AREA_TABLE_PADDING = 4;

type AreaPackingMode = "root-cardinal" | "compact-ring";
type CardinalSide =
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "top-right"
  | "bottom-right"
  | "bottom-left"
  | "top-left";

interface PackedAreaNode {
  node: AreaTreeNode;
  width: number;
  depth: number;
  children: Array<{
    pack: PackedAreaNode;
    rect: OfficeAreaRect;
  }>;
}

const CARDINAL_FIRST_SIDES: CardinalSide[] = [
  "top",
  "right",
  "bottom",
  "left",
  "top-right",
  "bottom-right",
  "bottom-left",
  "top-left",
];
const COMPACT_RING_ANGLES = [
  0,
  Math.PI / 2,
  Math.PI,
  (3 * Math.PI) / 2,
  Math.PI / 4,
  (3 * Math.PI) / 4,
  (5 * Math.PI) / 4,
  (7 * Math.PI) / 4,
];

function isProjectAreaStrategy(
  layoutStrategy?: OfficeLayoutStrategyId,
): boolean {
  return (
    layoutStrategy === "team_neighborhoods" ||
    layoutStrategy === "activity_treemap" ||
    layoutStrategy === "hierarchical_treemap" ||
    layoutStrategy === "command_districts"
  );
}

function emptyRect(): OfficeAreaRect {
  return {
    minX: 0,
    maxX: 0,
    minZ: 0,
    maxZ: 0,
    centerX: 0,
    centerZ: 0,
    width: 0,
    depth: 0,
  };
}

function toRect(input: {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}): OfficeAreaRect {
  const width = Math.max(0, input.maxX - input.minX);
  const depth = Math.max(0, input.maxZ - input.minZ);
  return {
    ...input,
    width,
    depth,
    centerX: input.minX + width / 2,
    centerZ: input.minZ + depth / 2,
  };
}

function slugSegment(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "area"
  );
}

function displaySegment(value: string): string {
  return value
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeProjectPath(value: string | undefined): string {
  return (value ?? "").replace(/\\/g, "/").replace(/\/+$/g, "").trim();
}

function pathParts(value: string): string[] {
  return value
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function pathBasename(value: string): string {
  return pathParts(value).at(-1) ?? value;
}

function isPathChildOf(childPath: string, parentPath: string): boolean {
  return childPath !== parentPath && childPath.startsWith(`${parentPath}/`);
}

function findParentProject(
  project: ProjectModel,
  activeProjects: ProjectModel[],
): ProjectModel | null {
  const projectPath = normalizeProjectPath(project.trackingContext);
  return (
    activeProjects
      .filter((candidate) => {
        if (candidate.id === project.id) return false;
        const candidatePath = normalizeProjectPath(candidate.trackingContext);
        return candidatePath && isPathChildOf(projectPath, candidatePath);
      })
      .sort(
        (left, right) =>
          normalizeProjectPath(right.trackingContext).length -
          normalizeProjectPath(left.trackingContext).length,
      )[0] ?? null
  );
}

function semanticSegmentsForRelativePath(relativePath: string): string[] {
  return pathParts(relativePath)
    .filter((segment) => !/^(projects|repos|workspaces|src)$/i.test(segment))
    .flatMap((segment) => {
      if (/^farplane[-_\s]+ui$/i.test(segment))
        return ["Farplane", "Farplane UI"];
      return [segment];
    });
}

function projectPathSegments(input: {
  project: ProjectModel;
  activeProjects: ProjectModel[];
}): string[] {
  const projectPath = normalizeProjectPath(input.project.trackingContext);
  if (!projectPath) return [];
  const parentProject = findParentProject(input.project, input.activeProjects);
  if (!parentProject) return [pathBasename(projectPath)];
  const parentPath = normalizeProjectPath(parentProject.trackingContext);
  const relativePath = projectPath.slice(parentPath.length).replace(/^\/+/, "");
  return [
    ...projectPathSegments({
      project: parentProject,
      activeProjects: input.activeProjects,
    }),
    ...semanticSegmentsForRelativePath(relativePath),
  ];
}

function createNode(input: {
  id: string;
  label: string;
  depth: number;
  parentId?: string;
  projectId?: string;
  departmentId?: string;
  path?: string;
}): AreaTreeNode {
  return {
    ...input,
    ownWeight: 0,
    desiredWidth: 0,
    desiredDepth: 0,
    weight: 0,
    children: [],
  };
}

function getOrCreateChild(
  parent: AreaTreeNode,
  segment: string,
  metadata?: {
    projectId?: string;
    departmentId?: string;
    path?: string;
  },
): AreaTreeNode {
  const slug = slugSegment(segment);
  const id = `${parent.id}/${slug}`;
  const existing = parent.children.find((child) => child.id === id);
  if (existing) {
    if (metadata?.projectId) existing.projectId = metadata.projectId;
    if (metadata?.departmentId) existing.departmentId = metadata.departmentId;
    if (metadata?.path) existing.path = metadata.path;
    return existing;
  }
  const child = createNode({
    id,
    label: displaySegment(segment),
    depth: parent.depth + 1,
    parentId: parent.id,
    projectId: metadata?.projectId,
    departmentId: metadata?.departmentId,
    path: metadata?.path,
  });
  parent.children.push(child);
  return child;
}

function projectDemand(input: {
  layoutStrategy?: OfficeLayoutStrategyId;
  project: ProjectModel;
  agents: CompanyAgentModel[];
  workload?: ProjectWorkloadSummary;
  activity?: ProjectActivitySummary;
}): { weight: number; width: number; depth: number } {
  const agentCount = input.agents.filter(
    (agent) => agent.projectId === input.project.id,
  ).length;
  if (isProjectAreaStrategy(input.layoutStrategy)) {
    const footprint = getClusterOccupancyFootprint(Math.max(agentCount, 1));
    const width = footprint.width + footprint.clearance * 2;
    const depth = footprint.depth + footprint.clearance * 2;
    return {
      weight: Math.max(4, Math.ceil(width * depth)),
      width: Math.ceil(width + PROJECT_AREA_TABLE_PADDING),
      depth: Math.ceil(depth + PROJECT_AREA_TABLE_PADDING),
    };
  }

  const openTickets = input.workload?.openTickets ?? 0;
  const pressure =
    input.workload?.queuePressure === "high"
      ? 2
      : input.workload?.queuePressure === "medium"
        ? 1
        : 0;
  const recentActivity = Math.min(
    8,
    Math.max(0, input.activity?.recentActivityScore ?? 0),
  );
  const weight = Math.max(
    1,
    1 + agentCount + Math.min(openTickets, 6) + pressure + recentActivity,
  );
  return { weight, width: 0, depth: 0 };
}

function addProjectToTree(input: {
  root: AreaTreeNode;
  project: ProjectModel;
  departmentsById: Map<string, { id: string; name: string }>;
  activeProjects: ProjectModel[];
  demand: { weight: number; width: number; depth: number };
}): void {
  const pathParts = projectPathSegments({
    project: input.project,
    activeProjects: input.activeProjects,
  });
  let parent = input.root;
  const fallbackDepartment = input.departmentsById.get(
    input.project.departmentId,
  );
  const segments =
    pathParts.length > 0
      ? pathParts
      : [fallbackDepartment?.name ?? "Projects", input.project.name];

  segments.forEach((segment, index) => {
    const isLeaf = index === segments.length - 1;
    parent = getOrCreateChild(parent, segment, {
      projectId: isLeaf ? input.project.id : undefined,
      departmentId: isLeaf
        ? input.project.departmentId
        : fallbackDepartment?.id,
      path: isLeaf ? input.project.trackingContext : undefined,
    });
  });
  parent.projectId = input.project.id;
  parent.departmentId = input.project.departmentId;
  parent.path = input.project.trackingContext;
  parent.ownWeight += input.demand.weight;
  parent.desiredWidth = Math.max(parent.desiredWidth, input.demand.width);
  parent.desiredDepth = Math.max(parent.desiredDepth, input.demand.depth);
}

function finalizeWeights(node: AreaTreeNode): number {
  const childWeight = node.children.reduce(
    (sum, child) => sum + finalizeWeights(child),
    0,
  );
  node.weight = Math.max(1, node.ownWeight + childWeight);
  node.children.sort((left, right) => {
    if (left.isSelfArea !== right.isSelfArea) return left.isSelfArea ? -1 : 1;
    if (right.weight !== left.weight) return right.weight - left.weight;
    return left.label.localeCompare(right.label);
  });
  return node.weight;
}

function cloneNodeForSelfAwareTreemap(node: AreaTreeNode): AreaTreeNode {
  const children = node.children.map(cloneNodeForSelfAwareTreemap);
  const selfChild =
    node.projectId && children.length > 0 && node.ownWeight > 0
      ? [
          {
            id: `${node.id}/self`,
            label: `${node.label} Tables`,
            depth: node.depth + 1,
            parentId: node.id,
            projectId: node.projectId,
            departmentId: node.departmentId,
            path: node.path,
            isSelfArea: true,
            ownWeight: node.ownWeight,
            desiredWidth: node.desiredWidth,
            desiredDepth: node.desiredDepth,
            weight: Math.max(1, node.ownWeight),
            children: [],
          },
        ]
      : [];
  const clone: AreaTreeNode = {
    ...node,
    projectId: selfChild.length > 0 ? undefined : node.projectId,
    ownWeight: selfChild.length > 0 ? 0 : node.ownWeight,
    desiredWidth: selfChild.length > 0 ? 0 : node.desiredWidth,
    desiredDepth: selfChild.length > 0 ? 0 : node.desiredDepth,
    children: [...selfChild, ...children],
  };
  finalizeWeights(clone);
  return clone;
}

function buildAreaTree(input: {
  company: CompanyModel;
  layoutStrategy?: OfficeLayoutStrategyId;
  workload?: ProjectWorkloadSummary[];
  activity?: ProjectActivitySummary[];
}): AreaTreeNode {
  const root = createNode({ id: "office", label: "Office", depth: 0 });
  const departmentsById = new Map(
    input.company.departments.map((department) => [
      department.id,
      { id: department.id, name: department.name },
    ]),
  );
  const workloadByProjectId = new Map(
    (input.workload ?? []).map((item) => [item.projectId, item]),
  );
  const activityByProjectId = new Map(
    (input.activity ?? []).map((item) => [item.projectId, item]),
  );
  const activeProjects = input.company.projects.filter(
    (entry) => entry.status !== "archived",
  );
  for (const project of activeProjects) {
    addProjectToTree({
      root,
      project,
      departmentsById,
      activeProjects,
      demand: projectDemand({
        layoutStrategy: input.layoutStrategy,
        project,
        agents: input.company.agents,
        workload: workloadByProjectId.get(project.id),
        activity: activityByProjectId.get(project.id),
      }),
    });
  }
  finalizeWeights(root);
  return root;
}

function insetRect(rect: OfficeAreaRect, amount: number): OfficeAreaRect {
  const safeInset = Math.max(
    0,
    Math.min(amount, rect.width / 3, rect.depth / 3),
  );
  return toRect({
    minX: rect.minX + safeInset,
    maxX: rect.maxX - safeInset,
    minZ: rect.minZ + safeInset,
    maxZ: rect.maxZ - safeInset,
  });
}

function splitChildren(
  children: AreaTreeNode[],
  rect: OfficeAreaRect,
): Array<{
  node: AreaTreeNode;
  rect: OfficeAreaRect;
}> {
  if (children.length <= 1) {
    return children.map((node) => ({ node, rect }));
  }

  const totalWeight =
    children.reduce((sum, child) => sum + child.weight, 0) ||
    children.length ||
    1;
  let splitIndex = 1;
  let runningWeight = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let index = 1; index < children.length; index += 1) {
    runningWeight += children[index - 1]?.weight ?? 0;
    const delta = Math.abs(totalWeight / 2 - runningWeight);
    if (delta < bestDelta) {
      bestDelta = delta;
      splitIndex = index;
    }
  }

  const firstChildren = children.slice(0, splitIndex);
  const secondChildren = children.slice(splitIndex);
  const firstWeight =
    firstChildren.reduce((sum, child) => sum + child.weight, 0) || 1;
  const firstRatio = Math.max(0.15, Math.min(0.85, firstWeight / totalWeight));
  const splitAlongX = rect.width >= rect.depth;

  if (splitAlongX) {
    const laneSize =
      rect.width > OFFICE_AREA_MIN_LANE_SIZE * 2
        ? OFFICE_AREA_MIN_LANE_SIZE
        : 0;
    const splitX = rect.minX + (rect.width - laneSize) * firstRatio;
    return [
      ...splitChildren(
        firstChildren,
        toRect({
          minX: rect.minX,
          maxX: splitX,
          minZ: rect.minZ,
          maxZ: rect.maxZ,
        }),
      ),
      ...splitChildren(
        secondChildren,
        toRect({
          minX: splitX + laneSize,
          maxX: rect.maxX,
          minZ: rect.minZ,
          maxZ: rect.maxZ,
        }),
      ),
    ];
  }

  const laneSize =
    rect.depth > OFFICE_AREA_MIN_LANE_SIZE * 2 ? OFFICE_AREA_MIN_LANE_SIZE : 0;
  const splitZ = rect.minZ + (rect.depth - laneSize) * firstRatio;
  return [
    ...splitChildren(
      firstChildren,
      toRect({
        minX: rect.minX,
        maxX: rect.maxX,
        minZ: rect.minZ,
        maxZ: splitZ,
      }),
    ),
    ...splitChildren(
      secondChildren,
      toRect({
        minX: rect.minX,
        maxX: rect.maxX,
        minZ: splitZ + laneSize,
        maxZ: rect.maxZ,
      }),
    ),
  ];
}

function addAreaForNode(input: {
  node: AreaTreeNode;
  rect: OfficeAreaRect;
  output: OfficeAreaNode[];
  projectAreaByProjectId: Record<string, OfficeAreaNode>;
  colorIndex: number;
}): void {
  if (input.node.id === "office") return;
  const area: OfficeAreaNode = {
    id: input.node.id,
    label: input.node.label,
    kind: input.node.isSelfArea
      ? "project-tables"
      : input.node.projectId
        ? "project"
        : "district",
    depth: input.node.depth,
    parentId: input.node.parentId,
    projectId: input.node.projectId,
    departmentId: input.node.departmentId,
    path: input.node.path,
    weight: input.node.weight,
    rect: input.rect,
    color: AREA_COLORS[input.colorIndex % AREA_COLORS.length],
  };
  input.output.push(area);
  if (area.projectId) input.projectAreaByProjectId[area.projectId] = area;
}

function flattenTree(input: {
  node: AreaTreeNode;
  rect: OfficeAreaRect;
  output: OfficeAreaNode[];
  projectAreaByProjectId: Record<string, OfficeAreaNode>;
  colorIndex: number;
}): void {
  addAreaForNode(input);

  if (input.node.children.length === 0) return;
  const childBaseRect =
    input.node.id === "office"
      ? input.rect
      : insetRect(input.rect, input.node.depth <= 1 ? 0.9 : 0.55);
  for (const [index, entry] of splitChildren(
    input.node.children,
    childBaseRect,
  ).entries()) {
    flattenTree({
      node: entry.node,
      rect: entry.rect,
      output: input.output,
      projectAreaByProjectId: input.projectAreaByProjectId,
      colorIndex: input.colorIndex + index + 1,
    });
  }
}

function packingSizeForNode(node: AreaTreeNode): { width: number; depth: number } {
  const fallbackSide = Math.sqrt(Math.max(1, node.weight)) + 5;
  return {
    width: Math.max(CENTER_PACK_MIN_SIDE, node.desiredWidth, fallbackSide),
    depth: Math.max(CENTER_PACK_MIN_SIDE, node.desiredDepth, fallbackSide),
  };
}

function rectsOverlap(left: OfficeAreaRect, right: OfficeAreaRect): boolean {
  return (
    left.minX < right.maxX &&
    left.maxX > right.minX &&
    left.minZ < right.maxZ &&
    left.maxZ > right.minZ
  );
}

function rectsOverlapWithGap(
  left: OfficeAreaRect,
  right: OfficeAreaRect,
  gap: number,
): boolean {
  return (
    left.minX < right.maxX + gap &&
    left.maxX > right.minX - gap &&
    left.minZ < right.maxZ + gap &&
    left.maxZ > right.minZ - gap
  );
}

function unionRects(rects: OfficeAreaRect[]): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
  return rects.reduce(
    (acc, rect) => ({
      minX: Math.min(acc.minX, rect.minX),
      maxX: Math.max(acc.maxX, rect.maxX),
      minZ: Math.min(acc.minZ, rect.minZ),
      maxZ: Math.max(acc.maxZ, rect.maxZ),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minZ: Number.POSITIVE_INFINITY,
      maxZ: Number.NEGATIVE_INFINITY,
    },
  );
}

function centeredPackingRect(width: number, depth: number): OfficeAreaRect {
  return toRect({
    minX: -width / 2,
    maxX: width / 2,
    minZ: -depth / 2,
    maxZ: depth / 2,
  });
}

function translatePackingRect(
  rect: OfficeAreaRect,
  dx: number,
  dz: number,
): OfficeAreaRect {
  return toRect({
    minX: rect.minX + dx,
    maxX: rect.maxX + dx,
    minZ: rect.minZ + dz,
    maxZ: rect.maxZ + dz,
  });
}

function normalizePackedChildren(
  children: PackedAreaNode["children"],
): PackedAreaNode["children"] {
  const bounds = unionRects(children.map((child) => child.rect));
  const dx = -bounds.minX + CENTER_PACK_PADDING;
  const dz = -bounds.minZ + CENTER_PACK_PADDING;
  return children.map((child) => ({
    pack: child.pack,
    rect: translatePackingRect(child.rect, dx, dz),
  }));
}

function sidePackingRect(input: {
  anchor: OfficeAreaRect;
  child: PackedAreaNode;
  side: CardinalSide;
  ring: number;
  lateralStep: number;
}): OfficeAreaRect {
  const distance =
    CENTER_PACK_GAP +
    input.ring *
      (Math.max(input.child.width, input.child.depth) + CENTER_PACK_GAP);
  let centerX = input.anchor.centerX;
  let centerZ = input.anchor.centerZ;
  if (input.side.includes("left")) {
    centerX = input.anchor.minX - distance - input.child.width / 2;
  } else if (input.side.includes("right")) {
    centerX = input.anchor.maxX + distance + input.child.width / 2;
  } else {
    centerX += input.lateralStep;
  }
  if (input.side.includes("top")) {
    centerZ = input.anchor.minZ - distance - input.child.depth / 2;
  } else if (input.side.includes("bottom")) {
    centerZ = input.anchor.maxZ + distance + input.child.depth / 2;
  } else {
    centerZ += input.lateralStep;
  }
  return toRect({
    minX: centerX - input.child.width / 2,
    maxX: centerX + input.child.width / 2,
    minZ: centerZ - input.child.depth / 2,
    maxZ: centerZ + input.child.depth / 2,
  });
}

function chooseCardinalPackingRect(input: {
  anchor: OfficeAreaRect;
  placed: OfficeAreaRect[];
  child: PackedAreaNode;
  orderIndex: number;
}): OfficeAreaRect {
  const side =
    CARDINAL_FIRST_SIDES[
      (input.orderIndex - 1) % CARDINAL_FIRST_SIDES.length
    ] ?? "top";
  const step = Math.max(input.child.width, input.child.depth) + CENTER_PACK_GAP;
  const lateralOffsets = [0, -1, 1, -2, 2];
  const candidates: OfficeAreaRect[] = [];
  for (let ring = 0; ring < 5; ring += 1) {
    for (const offset of lateralOffsets) {
      candidates.push(
        sidePackingRect({
          anchor: input.anchor,
          child: input.child,
          side,
          ring,
          lateralStep: offset * step,
        }),
      );
    }
  }

  let best =
    candidates.find(
      (candidate) =>
        !input.placed.some((placed) => rectsOverlap(candidate, placed)),
    ) ?? candidates[0] ?? centeredPackingRect(input.child.width, input.child.depth);
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    if (input.placed.some((placed) => rectsOverlap(candidate, placed))) {
      continue;
    }
    const bounds = unionRects([...input.placed, candidate]);
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxZ - bounds.minZ;
    const area = width * depth;
    const aspectPenalty = Math.abs(width - depth) * 10;
    const anchorDistance = Math.hypot(
      candidate.centerX - input.anchor.centerX,
      candidate.centerZ - input.anchor.centerZ,
    );
    const score = area + aspectPenalty + anchorDistance * 18;
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function compactRingCandidates(input: {
  anchor: OfficeAreaRect;
  placed: OfficeAreaRect[];
  child: PackedAreaNode;
}): OfficeAreaRect[] {
  const candidates: OfficeAreaRect[] = [];
  const anchorRadius =
    Math.hypot(input.anchor.width, input.anchor.depth) / 2 +
    Math.hypot(input.child.width, input.child.depth) / 2 +
    CENTER_PACK_GAP;
  const step = Math.max(input.child.width, input.child.depth) + CENTER_PACK_GAP;
  for (let ring = 0; ring < 6; ring += 1) {
    const radius = anchorRadius + ring * step * 0.72;
    for (const angle of COMPACT_RING_ANGLES) {
      const centerX = input.anchor.centerX + Math.cos(angle) * radius;
      const centerZ = input.anchor.centerZ + Math.sin(angle) * radius;
      candidates.push(
        toRect({
          minX: centerX - input.child.width / 2,
          maxX: centerX + input.child.width / 2,
          minZ: centerZ - input.child.depth / 2,
          maxZ: centerZ + input.child.depth / 2,
        }),
      );
    }
  }
  for (const placed of input.placed) {
    candidates.push(
      toRect({
        minX: placed.maxX + CENTER_PACK_GAP,
        maxX: placed.maxX + CENTER_PACK_GAP + input.child.width,
        minZ: placed.centerZ - input.child.depth / 2,
        maxZ: placed.centerZ + input.child.depth / 2,
      }),
      toRect({
        minX: placed.minX - CENTER_PACK_GAP - input.child.width,
        maxX: placed.minX - CENTER_PACK_GAP,
        minZ: placed.centerZ - input.child.depth / 2,
        maxZ: placed.centerZ + input.child.depth / 2,
      }),
      toRect({
        minX: placed.centerX - input.child.width / 2,
        maxX: placed.centerX + input.child.width / 2,
        minZ: placed.maxZ + CENTER_PACK_GAP,
        maxZ: placed.maxZ + CENTER_PACK_GAP + input.child.depth,
      }),
      toRect({
        minX: placed.centerX - input.child.width / 2,
        maxX: placed.centerX + input.child.width / 2,
        minZ: placed.minZ - CENTER_PACK_GAP - input.child.depth,
        maxZ: placed.minZ - CENTER_PACK_GAP,
      }),
    );
  }
  return candidates;
}

function chooseCompactPackingRect(input: {
  anchor: OfficeAreaRect;
  placed: OfficeAreaRect[];
  child: PackedAreaNode;
  orderIndex: number;
}): OfficeAreaRect {
  const candidates = compactRingCandidates(input).filter(
    (candidate) =>
      !input.placed.some((placed) => rectsOverlap(candidate, placed)),
  );
  let best =
    candidates[0] ?? centeredPackingRect(input.child.width, input.child.depth);
  let bestScore = Number.POSITIVE_INFINITY;
  const idealAngle =
    COMPACT_RING_ANGLES[(input.orderIndex - 1) % COMPACT_RING_ANGLES.length] ??
    0;
  for (const candidate of candidates) {
    const bounds = unionRects([...input.placed, candidate]);
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxZ - bounds.minZ;
    const area = width * depth;
    const aspectPenalty = Math.abs(width - depth) * 20;
    const anchorDistance = Math.hypot(
      candidate.centerX - input.anchor.centerX,
      candidate.centerZ - input.anchor.centerZ,
    );
    const angle = Math.atan2(
      candidate.centerZ - input.anchor.centerZ,
      candidate.centerX - input.anchor.centerX,
    );
    const angleDelta = Math.abs(
      Math.atan2(Math.sin(angle - idealAngle), Math.cos(angle - idealAngle)),
    );
    const score = area + aspectPenalty + anchorDistance * 12 + angleDelta * 16;
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function scorePackedChildren(children: PackedAreaNode["children"]): number {
  const bounds = unionRects(children.map((child) => child.rect));
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const area = width * depth;
  const aspectPenalty = Math.abs(width - depth) * 8;
  const anchor = children[0]?.rect ?? centeredPackingRect(1, 1);
  const distancePenalty = children.reduce(
    (sum, child) =>
      sum +
      Math.hypot(
        child.rect.centerX - anchor.centerX,
        child.rect.centerZ - anchor.centerZ,
      ),
    0,
  );
  return area * 10 + aspectPenalty + distancePenalty;
}

function canCompactChildToRect(input: {
  children: PackedAreaNode["children"];
  childIndex: number;
  rect: OfficeAreaRect;
}): boolean {
  return input.children.every((child, index) => {
    if (index === input.childIndex) return true;
    return !rectsOverlapWithGap(input.rect, child.rect, CENTER_PACK_GAP);
  });
}

function compactMoveCandidates(input: {
  rect: OfficeAreaRect;
  anchor: OfficeAreaRect;
}): OfficeAreaRect[] {
  const directionX = Math.sign(input.anchor.centerX - input.rect.centerX);
  const directionZ = Math.sign(input.anchor.centerZ - input.rect.centerZ);
  const maxX = Math.abs(input.anchor.centerX - input.rect.centerX);
  const maxZ = Math.abs(input.anchor.centerZ - input.rect.centerZ);
  const candidateByKey = new Map<string, OfficeAreaRect>();
  const addCandidate = (dx: number, dz: number) => {
    if (
      Math.abs(dx) < CENTER_PACK_SCORE_EPSILON &&
      Math.abs(dz) < CENTER_PACK_SCORE_EPSILON
    ) {
      return;
    }
    const candidate = translatePackingRect(input.rect, dx, dz);
    candidateByKey.set(
      `${candidate.minX.toFixed(3)}:${candidate.minZ.toFixed(3)}`,
      candidate,
    );
  };

  const xSteps = Math.ceil(maxX / CENTER_PACK_COMPACTION_STEP);
  const zSteps = Math.ceil(maxZ / CENTER_PACK_COMPACTION_STEP);
  for (let step = 1; step <= Math.max(xSteps, zSteps); step += 1) {
    const dx =
      directionX *
      Math.min(maxX, step * CENTER_PACK_COMPACTION_STEP);
    const dz =
      directionZ *
      Math.min(maxZ, step * CENTER_PACK_COMPACTION_STEP);
    if (directionX !== 0) addCandidate(dx, 0);
    if (directionZ !== 0) addCandidate(0, dz);
    if (directionX !== 0 && directionZ !== 0) addCandidate(dx, dz);
  }

  return [...candidateByKey.values()];
}

function compactPackedChildren(
  children: PackedAreaNode["children"],
): PackedAreaNode["children"] {
  if (children.length <= 1) return children;
  let compacted = children;

  for (let pass = 0; pass < CENTER_PACK_COMPACTION_PASSES; pass += 1) {
    let changed = false;
    for (let childIndex = 1; childIndex < compacted.length; childIndex += 1) {
      const child = compacted[childIndex];
      const anchor = compacted[0]?.rect;
      if (!child || !anchor) continue;

      let bestRect = child.rect;
      let bestScore = scorePackedChildren(compacted);
      for (const candidate of compactMoveCandidates({
        rect: child.rect,
        anchor,
      })) {
        if (
          !canCompactChildToRect({
            children: compacted,
            childIndex,
            rect: candidate,
          })
        ) {
          continue;
        }
        const candidateChildren = compacted.map((entry, index) =>
          index === childIndex ? { ...entry, rect: candidate } : entry,
        );
        const candidateScore = scorePackedChildren(candidateChildren);
        if (candidateScore + CENTER_PACK_SCORE_EPSILON < bestScore) {
          bestRect = candidate;
          bestScore = candidateScore;
        }
      }

      if (bestRect !== child.rect) {
        compacted = compacted.map((entry, index) =>
          index === childIndex ? { ...entry, rect: bestRect } : entry,
        );
        changed = true;
      }
    }
    if (!changed) break;
  }

  return compacted;
}

function shelfPackedChildren(
  children: PackedAreaNode["children"],
  side: "right" | "left" | "bottom" | "top",
): PackedAreaNode["children"] {
  const anchor = children[0];
  const siblings = children.slice(1);
  if (!anchor || siblings.length === 0) return children;

  if (side === "right" || side === "left") {
    const totalDepth =
      siblings.reduce((sum, child) => sum + child.rect.depth, 0) +
      CENTER_PACK_GAP * Math.max(0, siblings.length - 1);
    let cursorZ = anchor.rect.centerZ - totalDepth / 2;
    return [
      anchor,
      ...siblings.map((child) => {
        const minZ = cursorZ;
        const maxZ = minZ + child.rect.depth;
        cursorZ = maxZ + CENTER_PACK_GAP;
        const minX =
          side === "right"
            ? anchor.rect.maxX + CENTER_PACK_GAP
            : anchor.rect.minX - CENTER_PACK_GAP - child.rect.width;
        return {
          pack: child.pack,
          rect: toRect({
            minX,
            maxX: minX + child.rect.width,
            minZ,
            maxZ,
          }),
        };
      }),
    ];
  }

  const totalWidth =
    siblings.reduce((sum, child) => sum + child.rect.width, 0) +
    CENTER_PACK_GAP * Math.max(0, siblings.length - 1);
  let cursorX = anchor.rect.centerX - totalWidth / 2;
  return [
    anchor,
    ...siblings.map((child) => {
      const minX = cursorX;
      const maxX = minX + child.rect.width;
      cursorX = maxX + CENTER_PACK_GAP;
      const minZ =
        side === "bottom"
          ? anchor.rect.maxZ + CENTER_PACK_GAP
          : anchor.rect.minZ - CENTER_PACK_GAP - child.rect.depth;
      return {
        pack: child.pack,
        rect: toRect({
          minX,
          maxX,
          minZ,
          maxZ: minZ + child.rect.depth,
        }),
      };
    }),
  ];
}

function chooseShelvedPackedChildren(
  children: PackedAreaNode["children"],
): PackedAreaNode["children"] {
  if (children.length <= 2) return children;
  let best = children;
  let bestScore = scorePackedChildren(children);
  for (const side of ["right", "left", "bottom", "top"] as const) {
    const candidate = shelfPackedChildren(children, side);
    const candidateScore = scorePackedChildren(candidate);
    if (candidateScore + CENTER_PACK_SCORE_EPSILON < bestScore) {
      best = candidate;
      bestScore = candidateScore;
    }
  }
  return best;
}

function packAreaNode(
  node: AreaTreeNode,
  mode: AreaPackingMode,
): PackedAreaNode {
  const childMode: AreaPackingMode =
    mode === "root-cardinal" ? "compact-ring" : mode;
  const childPacks = node.children.map((child) =>
    packAreaNode(child, childMode),
  );
  if (childPacks.length === 0) {
    const size = packingSizeForNode(node);
    return { node, width: size.width, depth: size.depth, children: [] };
  }

  const ordered = [...childPacks].sort((left, right) => {
    const areaDelta =
      right.width * right.depth - left.width * left.depth ||
      right.node.weight - left.node.weight;
    if (areaDelta !== 0) return areaDelta;
    if (left.node.isSelfArea !== right.node.isSelfArea) {
      return left.node.isSelfArea ? -1 : 1;
    }
    return left.node.label.localeCompare(right.node.label);
  });
  const anchor = ordered[0];
  if (!anchor) {
    const size = packingSizeForNode(node);
    return { node, width: size.width, depth: size.depth, children: [] };
  }

  const placed: PackedAreaNode["children"] = [
    {
      pack: anchor,
      rect: centeredPackingRect(anchor.width, anchor.depth),
    },
  ];
  for (let index = 1; index < ordered.length; index += 1) {
    const child = ordered[index];
    if (!child) continue;
    const anchorRect = placed[0]?.rect ?? centeredPackingRect(1, 1);
    const rect =
      mode === "root-cardinal"
        ? chooseCardinalPackingRect({
            anchor: anchorRect,
            placed: placed.map((entry) => entry.rect),
            child,
            orderIndex: index,
          })
        : chooseCompactPackingRect({
            anchor: anchorRect,
            placed: placed.map((entry) => entry.rect),
            child,
            orderIndex: index,
          });
    placed.push({ pack: child, rect });
  }

  const shelved =
    mode === "compact-ring" ? chooseShelvedPackedChildren(placed) : placed;
  const compacted = compactPackedChildren(shelved);
  const normalized = normalizePackedChildren(compacted);
  const bounds = unionRects(normalized.map((child) => child.rect));
  return {
    node,
    width: bounds.maxX + CENTER_PACK_PADDING,
    depth: bounds.maxZ + CENTER_PACK_PADDING,
    children: normalized,
  };
}

function flattenPackedAreaTree(input: {
  pack: PackedAreaNode;
  originX: number;
  originZ: number;
  scale: number;
  output: OfficeAreaNode[];
  projectAreaByProjectId: Record<string, OfficeAreaNode>;
  colorIndex: number;
}): void {
  const rect = toRect({
    minX: input.originX,
    maxX: input.originX + input.pack.width * input.scale,
    minZ: input.originZ,
    maxZ: input.originZ + input.pack.depth * input.scale,
  });
  addAreaForNode({
    node: input.pack.node,
    rect,
    output: input.output,
    projectAreaByProjectId: input.projectAreaByProjectId,
    colorIndex: input.colorIndex,
  });
  for (const [index, child] of input.pack.children.entries()) {
    flattenPackedAreaTree({
      pack: child.pack,
      originX: input.originX + child.rect.minX * input.scale,
      originZ: input.originZ + child.rect.minZ * input.scale,
      scale: input.scale,
      output: input.output,
      projectAreaByProjectId: input.projectAreaByProjectId,
      colorIndex: input.colorIndex + index + 1,
    });
  }
}

function flattenCenteredAreaTree(input: {
  node: AreaTreeNode;
  rect: OfficeAreaRect;
  output: OfficeAreaNode[];
  projectAreaByProjectId: Record<string, OfficeAreaNode>;
  colorIndex: number;
}): void {
  const pack = packAreaNode(input.node, "root-cardinal");
  const scale = Math.min(
    1,
    input.rect.width / Math.max(1, pack.width),
    input.rect.depth / Math.max(1, pack.depth),
  );
  const width = pack.width * scale;
  const depth = pack.depth * scale;
  flattenPackedAreaTree({
    pack,
    originX: input.rect.centerX - width / 2,
    originZ: input.rect.centerZ - depth / 2,
    scale,
    output: input.output,
    projectAreaByProjectId: input.projectAreaByProjectId,
    colorIndex: input.colorIndex,
  });
}

export function buildOfficeAreaLayout(input: AreaBuildInput): OfficeAreaLayout {
  const sourceRoot = buildAreaTree({
    company: input.company,
    layoutStrategy: input.layoutStrategy,
    workload: input.workload,
    activity: input.activity,
  });
  const usesProjectAreas = isProjectAreaStrategy(input.layoutStrategy);
  const root = usesProjectAreas
    ? cloneNodeForSelfAwareTreemap(sourceRoot)
    : sourceRoot;
  const bounds = getOfficeLayoutBounds(input.officeLayout);
  const rootRect = toRect({
    minX: bounds.minWorldX + 1,
    maxX: bounds.maxWorldX - 1,
    minZ: bounds.minWorldZ + 1,
    maxZ: bounds.maxWorldZ - 1,
  });
  const areas: OfficeAreaNode[] = [];
  const projectAreaByProjectId: Record<string, OfficeAreaNode> = {};
  const flatten = usesProjectAreas ? flattenCenteredAreaTree : flattenTree;
  flatten({
    node: root,
    rect: rootRect.width > 0 && rootRect.depth > 0 ? rootRect : emptyRect(),
    output: areas,
    projectAreaByProjectId,
    colorIndex: 0,
  });
  return { areas, projectAreaByProjectId };
}

export function getOfficeAreaAnchor(
  area: OfficeAreaNode,
): [number, number, number] {
  return [Math.round(area.rect.centerX), 0, Math.round(area.rect.centerZ)];
}
