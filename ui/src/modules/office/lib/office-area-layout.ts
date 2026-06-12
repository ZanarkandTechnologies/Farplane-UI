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
  workload?: ProjectWorkloadSummary[];
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
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "area";
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
  return value.split("/").map((segment) => segment.trim()).filter(Boolean);
}

function pathBasename(value: string): string {
  return pathParts(value).at(-1) ?? value;
}

function isPathChildOf(childPath: string, parentPath: string): boolean {
  return childPath !== parentPath && childPath.startsWith(`${parentPath}/`);
}

function findParentProject(project: ProjectModel, activeProjects: ProjectModel[]): ProjectModel | null {
  const projectPath = normalizeProjectPath(project.trackingContext);
  return activeProjects
    .filter((candidate) => {
      if (candidate.id === project.id) return false;
      const candidatePath = normalizeProjectPath(candidate.trackingContext);
      return candidatePath && isPathChildOf(projectPath, candidatePath);
    })
    .sort(
      (left, right) =>
        normalizeProjectPath(right.trackingContext).length -
        normalizeProjectPath(left.trackingContext).length,
    )[0] ?? null;
}

function semanticSegmentsForRelativePath(relativePath: string): string[] {
  return pathParts(relativePath)
    .filter((segment) => !/^(projects|repos|workspaces|src)$/i.test(segment))
    .flatMap((segment) => {
      if (/^farplane[-_\s]+ui$/i.test(segment)) return ["Farplane", "Farplane UI"];
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
    ...projectPathSegments({ project: parentProject, activeProjects: input.activeProjects }),
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

function getOrCreateChild(parent: AreaTreeNode, segment: string, metadata?: {
  projectId?: string;
  departmentId?: string;
  path?: string;
}): AreaTreeNode {
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
}): number {
  const agentCount = input.agents.filter((agent) => agent.projectId === input.project.id).length;
  const openTickets = input.workload?.openTickets ?? 0;
  const pressure = input.workload?.queuePressure === "high" ? 2 : input.workload?.queuePressure === "medium" ? 1 : 0;
  return Math.max(1, 1 + agentCount + Math.min(openTickets, 6) + pressure);
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
  const fallbackDepartment = input.departmentsById.get(input.project.departmentId);
  const segments = pathParts.length > 0
    ? pathParts
    : [fallbackDepartment?.name ?? "Projects", input.project.name];

  segments.forEach((segment, index) => {
    const isLeaf = index === segments.length - 1;
    parent = getOrCreateChild(parent, segment, {
      projectId: isLeaf ? input.project.id : undefined,
      departmentId: isLeaf ? input.project.departmentId : fallbackDepartment?.id,
      path: isLeaf ? input.project.trackingContext : undefined,
    });
  });
  parent.projectId = input.project.id;
  parent.departmentId = input.project.departmentId;
  parent.path = input.project.trackingContext;
  parent.weight += input.weight;
}

function finalizeWeights(node: AreaTreeNode): number {
  const childWeight = node.children.reduce((sum, child) => sum + finalizeWeights(child), 0);
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
}): AreaTreeNode {
  const root = createNode({ id: "office", label: "Office", depth: 0 });
  const departmentsById = new Map(
    input.company.departments.map((department) => [
      department.id,
      { id: department.id, name: department.name },
    ]),
  );
  const workloadByProjectId = new Map((input.workload ?? []).map((item) => [item.projectId, item]));
  const activeProjects = input.company.projects.filter((entry) => entry.status !== "archived");
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
      }),
    });
  }
  finalizeWeights(root);
  return root;
}

function insetRect(rect: OfficeAreaRect, amount: number): OfficeAreaRect {
  const safeInset = Math.max(0, Math.min(amount, rect.width / 3, rect.depth / 3));
  return toRect({
    minX: rect.minX + safeInset,
    maxX: rect.maxX - safeInset,
    minZ: rect.minZ + safeInset,
    maxZ: rect.maxZ - safeInset,
  });
}

function splitChildren(children: AreaTreeNode[], rect: OfficeAreaRect): Array<{
  node: AreaTreeNode;
  rect: OfficeAreaRect;
}> {
  const totalWeight = children.reduce((sum, child) => sum + child.weight, 0) || children.length || 1;
  const splitAlongX = rect.width >= rect.depth;
  let cursor = splitAlongX ? rect.minX : rect.minZ;

  return children.map((child, index) => {
    const isLast = index === children.length - 1;
    const ratio = child.weight / totalWeight;
    if (splitAlongX) {
      const next = isLast ? rect.maxX : cursor + rect.width * ratio;
      const childRect = toRect({ minX: cursor, maxX: next, minZ: rect.minZ, maxZ: rect.maxZ });
      cursor = next;
      return { node: child, rect: childRect };
    }
    const next = isLast ? rect.maxZ : cursor + rect.depth * ratio;
    const childRect = toRect({ minX: rect.minX, maxX: rect.maxX, minZ: cursor, maxZ: next });
    cursor = next;
    return { node: child, rect: childRect };
  });
}

function flattenTree(input: {
  node: AreaTreeNode;
  rect: OfficeAreaRect;
  output: OfficeAreaNode[];
  projectAreaByProjectId: Record<string, OfficeAreaNode>;
  colorIndex: number;
}): void {
  if (input.node.id !== "office") {
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

  if (input.node.children.length === 0) return;
  const childBaseRect = input.node.id === "office"
    ? input.rect
    : insetRect(input.rect, input.node.depth <= 1 ? 0.9 : 0.55);
  for (const [index, entry] of splitChildren(input.node.children, childBaseRect).entries()) {
    flattenTree({
      node: entry.node,
      rect: entry.rect,
      output: input.output,
      projectAreaByProjectId: input.projectAreaByProjectId,
      colorIndex: input.colorIndex + index + 1,
    });
  }
}

export function buildOfficeAreaLayout(input: AreaBuildInput): OfficeAreaLayout {
  const root = buildAreaTree({ company: input.company, workload: input.workload });
  const bounds = getOfficeLayoutBounds(input.officeLayout);
  const rootRect = toRect({
    minX: bounds.minWorldX + 1,
    maxX: bounds.maxWorldX - 1,
    minZ: bounds.minWorldZ + 1,
    maxZ: bounds.maxWorldZ - 1,
  });
  const areas: OfficeAreaNode[] = [];
  const projectAreaByProjectId: Record<string, OfficeAreaNode> = {};
  flattenTree({
    node: root,
    rect: rootRect.width > 0 && rootRect.depth > 0 ? rootRect : emptyRect(),
    output: areas,
    projectAreaByProjectId,
    colorIndex: 0,
  });
  return { areas, projectAreaByProjectId };
}

export function getOfficeAreaAnchor(area: OfficeAreaNode): [number, number, number] {
  return [Math.round(area.rect.centerX), 0, Math.round(area.rect.centerZ)];
}
