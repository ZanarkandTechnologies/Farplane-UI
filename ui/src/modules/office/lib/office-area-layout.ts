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
const COMMAND_HUB_WIDTH_RATIO = 0.34;
const COMMAND_HUB_DEPTH_RATIO = 0.36;
const COMMAND_HUB_MIN_WIDTH = 6;
const COMMAND_HUB_MIN_DEPTH = 5;
const COMMAND_MIN_RING_WIDTH = 3;
const COMMAND_MIN_RING_DEPTH = 3;
const NEIGHBORHOOD_CORE_WIDTH_RATIO = 0.24;
const NEIGHBORHOOD_CORE_DEPTH_RATIO = 0.24;
const NEIGHBORHOOD_CORE_MIN_WIDTH = 7;
const NEIGHBORHOOD_CORE_MIN_DEPTH = 5;
const NEIGHBORHOOD_MIN_RING_WIDTH = 4;
const NEIGHBORHOOD_MIN_RING_DEPTH = 4;
const NEIGHBORHOOD_SHARED_AREA_COLOR = "#fbbf24";

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

function projectWeight(input: {
  project: ProjectModel;
  agents: CompanyAgentModel[];
  workload?: ProjectWorkloadSummary;
  activity?: ProjectActivitySummary;
}): number {
  const agentCount = input.agents.filter(
    (agent) => agent.projectId === input.project.id,
  ).length;
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
  return Math.max(
    1,
    1 + agentCount + Math.min(openTickets, 6) + pressure + recentActivity,
  );
}

function addProjectToTree(input: {
  root: AreaTreeNode;
  project: ProjectModel;
  departmentsById: Map<string, { id: string; name: string }>;
  activeProjects: ProjectModel[];
  weight: number;
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
  parent.weight += input.weight;
}

function finalizeWeights(node: AreaTreeNode): number {
  const childWeight = node.children.reduce(
    (sum, child) => sum + finalizeWeights(child),
    0,
  );
  node.weight = Math.max(1, node.weight + childWeight);
  node.children.sort((left, right) => {
    if (right.weight !== left.weight) return right.weight - left.weight;
    return left.label.localeCompare(right.label);
  });
  return node.weight;
}

function buildAreaTree(input: {
  company: CompanyModel;
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
      weight: projectWeight({
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

function getCommandHubRect(rect: OfficeAreaRect): OfficeAreaRect {
  const width = Math.min(
    rect.width,
    Math.max(COMMAND_HUB_MIN_WIDTH, rect.width * COMMAND_HUB_WIDTH_RATIO),
  );
  const depth = Math.min(
    rect.depth,
    Math.max(COMMAND_HUB_MIN_DEPTH, rect.depth * COMMAND_HUB_DEPTH_RATIO),
  );
  return toRect({
    minX: rect.centerX - width / 2,
    maxX: rect.centerX + width / 2,
    minZ: rect.centerZ - depth / 2,
    maxZ: rect.centerZ + depth / 2,
  });
}

function commandRingRects(
  outer: OfficeAreaRect,
  hub: OfficeAreaRect,
): OfficeAreaRect[] {
  return [
    toRect({
      minX: outer.minX,
      maxX: outer.maxX,
      minZ: outer.minZ,
      maxZ: hub.minZ,
    }),
    toRect({
      minX: outer.minX,
      maxX: hub.minX,
      minZ: hub.minZ,
      maxZ: hub.maxZ,
    }),
    toRect({
      minX: hub.maxX,
      maxX: outer.maxX,
      minZ: hub.minZ,
      maxZ: hub.maxZ,
    }),
    toRect({
      minX: outer.minX,
      maxX: outer.maxX,
      minZ: hub.maxZ,
      maxZ: outer.maxZ,
    }),
  ]
    .filter(
      (rect) =>
        rect.width >= COMMAND_MIN_RING_WIDTH &&
        rect.depth >= COMMAND_MIN_RING_DEPTH,
    )
    .sort((left, right) => right.width * right.depth - left.width * left.depth);
}

function commandHubScore(node: AreaTreeNode): number {
  return node.weight + node.children.length * 4 + (node.projectId ? 2 : 0);
}

function selectCommandHubChild(
  children: AreaTreeNode[],
): AreaTreeNode | undefined {
  return [...children].sort((left, right) => {
    const scoreDelta = commandHubScore(right) - commandHubScore(left);
    if (scoreDelta !== 0) return scoreDelta;
    if (left.depth !== right.depth) return left.depth - right.depth;
    return left.label.localeCompare(right.label);
  })[0];
}

function splitCommandRingChildren(
  children: AreaTreeNode[],
  outer: OfficeAreaRect,
  hub: OfficeAreaRect,
): Array<{ node: AreaTreeNode; rect: OfficeAreaRect }> {
  if (children.length === 0) return [];
  const regions = commandRingRects(outer, hub);
  if (regions.length === 0) return splitChildren(children, outer);

  const buckets = regions.map((rect) => ({
    rect,
    children: [] as AreaTreeNode[],
    weight: 0,
  }));
  for (const child of children) {
    const bucket = buckets.slice().sort((left, right) => {
      const leftLoad =
        left.weight / Math.max(1, left.rect.width * left.rect.depth);
      const rightLoad =
        right.weight / Math.max(1, right.rect.width * right.rect.depth);
      return leftLoad === rightLoad
        ? right.rect.width * right.rect.depth -
            left.rect.width * left.rect.depth
        : leftLoad - rightLoad;
    })[0];
    bucket.children.push(child);
    bucket.weight += child.weight;
  }

  return buckets.flatMap((bucket) =>
    splitChildren(bucket.children, bucket.rect),
  );
}

function flattenCommandTree(input: {
  node: AreaTreeNode;
  rect: OfficeAreaRect;
  output: OfficeAreaNode[];
  projectAreaByProjectId: Record<string, OfficeAreaNode>;
  colorIndex: number;
}): void {
  if (input.node.children.length === 0) {
    addAreaForNode(input);
    return;
  }

  const hubNode =
    input.node.id === "office" || !input.node.projectId
      ? selectCommandHubChild(input.node.children)
      : input.node;
  if (!hubNode) return;

  const hubRect = getCommandHubRect(input.rect);
  addAreaForNode({
    ...input,
    node: hubNode,
    rect: hubRect,
  });

  const surroundingChildren =
    hubNode === input.node
      ? input.node.children
      : [
          ...hubNode.children,
          ...input.node.children.filter((child) => child.id !== hubNode.id),
        ];

  for (const [index, entry] of splitCommandRingChildren(
    surroundingChildren,
    input.rect,
    hubRect,
  ).entries()) {
    flattenCommandTree({
      node: entry.node,
      rect: entry.rect,
      output: input.output,
      projectAreaByProjectId: input.projectAreaByProjectId,
      colorIndex: input.colorIndex + index + 1,
    });
  }
}

function getNeighborhoodCoreRect(rect: OfficeAreaRect): OfficeAreaRect | null {
  if (
    rect.width <
      NEIGHBORHOOD_CORE_MIN_WIDTH + NEIGHBORHOOD_MIN_RING_WIDTH * 2 ||
    rect.depth < NEIGHBORHOOD_CORE_MIN_DEPTH + NEIGHBORHOOD_MIN_RING_DEPTH * 2
  ) {
    return null;
  }
  const width = Math.min(
    rect.width - NEIGHBORHOOD_MIN_RING_WIDTH * 2,
    Math.max(
      NEIGHBORHOOD_CORE_MIN_WIDTH,
      rect.width * NEIGHBORHOOD_CORE_WIDTH_RATIO,
    ),
  );
  const depth = Math.min(
    rect.depth - NEIGHBORHOOD_MIN_RING_DEPTH * 2,
    Math.max(
      NEIGHBORHOOD_CORE_MIN_DEPTH,
      rect.depth * NEIGHBORHOOD_CORE_DEPTH_RATIO,
    ),
  );
  return toRect({
    minX: rect.centerX - width / 2,
    maxX: rect.centerX + width / 2,
    minZ: rect.centerZ - depth / 2,
    maxZ: rect.centerZ + depth / 2,
  });
}

function neighborhoodRingRects(
  outer: OfficeAreaRect,
  core: OfficeAreaRect,
): OfficeAreaRect[] {
  return [
    toRect({
      minX: outer.minX,
      maxX: outer.maxX,
      minZ: outer.minZ,
      maxZ: core.minZ,
    }),
    toRect({
      minX: outer.minX,
      maxX: core.minX,
      minZ: core.minZ,
      maxZ: core.maxZ,
    }),
    toRect({
      minX: core.maxX,
      maxX: outer.maxX,
      minZ: core.minZ,
      maxZ: core.maxZ,
    }),
    toRect({
      minX: outer.minX,
      maxX: outer.maxX,
      minZ: core.maxZ,
      maxZ: outer.maxZ,
    }),
  ]
    .filter(
      (rect) =>
        rect.width >= NEIGHBORHOOD_MIN_RING_WIDTH &&
        rect.depth >= NEIGHBORHOOD_MIN_RING_DEPTH,
    )
    .sort((left, right) => right.width * right.depth - left.width * left.depth);
}

function splitNeighborhoodChildren(
  children: AreaTreeNode[],
  outer: OfficeAreaRect,
  core: OfficeAreaRect,
): Array<{ node: AreaTreeNode; rect: OfficeAreaRect }> {
  const regions = neighborhoodRingRects(outer, core);
  if (regions.length === 0) return splitChildren(children, outer);

  const buckets = regions.map((rect) => ({
    rect,
    children: [] as AreaTreeNode[],
    weight: 0,
  }));
  for (const child of children) {
    const bucket = buckets.slice().sort((left, right) => {
      const leftLoad =
        left.weight / Math.max(1, left.rect.width * left.rect.depth);
      const rightLoad =
        right.weight / Math.max(1, right.rect.width * right.rect.depth);
      return leftLoad === rightLoad
        ? right.rect.width * right.rect.depth -
            left.rect.width * left.rect.depth
        : leftLoad - rightLoad;
    })[0];
    bucket.children.push(child);
    bucket.weight += child.weight;
  }

  return buckets.flatMap((bucket) =>
    splitChildren(bucket.children, bucket.rect),
  );
}

function addSharedNeighborhoodArea(input: {
  rect: OfficeAreaRect;
  output: OfficeAreaNode[];
}): void {
  input.output.push({
    id: "office/shared-plaza",
    label: "Shared Plaza",
    depth: 1,
    parentId: "office",
    weight: 1,
    rect: input.rect,
    color: NEIGHBORHOOD_SHARED_AREA_COLOR,
  });
}

function flattenNeighborhoodTree(input: {
  node: AreaTreeNode;
  rect: OfficeAreaRect;
  output: OfficeAreaNode[];
  projectAreaByProjectId: Record<string, OfficeAreaNode>;
  colorIndex: number;
}): void {
  if (input.node.id === "office") {
    const coreRect = getNeighborhoodCoreRect(input.rect);
    if (coreRect && input.node.children.length > 1) {
      addSharedNeighborhoodArea({
        rect: coreRect,
        output: input.output,
      });
      for (const [index, entry] of splitNeighborhoodChildren(
        input.node.children,
        input.rect,
        coreRect,
      ).entries()) {
        flattenNeighborhoodTree({
          node: entry.node,
          rect: entry.rect,
          output: input.output,
          projectAreaByProjectId: input.projectAreaByProjectId,
          colorIndex: input.colorIndex + index + 1,
        });
      }
      return;
    }
  }

  addAreaForNode(input);
  if (input.node.children.length === 0) return;

  const childBaseRect =
    input.node.id === "office"
      ? input.rect
      : insetRect(input.rect, input.node.depth <= 1 ? 1.1 : 0.65);
  for (const [index, entry] of splitChildren(
    input.node.children,
    childBaseRect,
  ).entries()) {
    flattenNeighborhoodTree({
      node: entry.node,
      rect: entry.rect,
      output: input.output,
      projectAreaByProjectId: input.projectAreaByProjectId,
      colorIndex: input.colorIndex + index + 1,
    });
  }
}

export function buildOfficeAreaLayout(input: AreaBuildInput): OfficeAreaLayout {
  const root = buildAreaTree({
    company: input.company,
    workload: input.workload,
    activity: input.activity,
  });
  const bounds = getOfficeLayoutBounds(input.officeLayout);
  const rootRect = toRect({
    minX: bounds.minWorldX + 1,
    maxX: bounds.maxWorldX - 1,
    minZ: bounds.minWorldZ + 1,
    maxZ: bounds.maxWorldZ - 1,
  });
  const areas: OfficeAreaNode[] = [];
  const projectAreaByProjectId: Record<string, OfficeAreaNode> = {};
  const flatten =
    input.layoutStrategy === "command_districts"
      ? flattenCommandTree
      : input.layoutStrategy === "team_neighborhoods"
        ? flattenNeighborhoodTree
        : flattenTree;
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
