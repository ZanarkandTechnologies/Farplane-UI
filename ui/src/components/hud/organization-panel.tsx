"use client";

import {
  Briefcase,
  Building2,
  Crown,
  FolderTree,
  MapPin,
  Search,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { CreateTeamForm } from "@/components/hud/create-team-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OfficeWorkspaceDialog } from "@/components/office-workspace-dialog";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Id } from "@/lib/entity-types";
import { cn } from "@/lib/utils";
import { UI_Z } from "@/lib/z-index";
import type { EmployeeData } from "@/modules/office/lib/types";
import { CodexAppServerClient, getGatewayUiConfig, type ProjectModel } from "@/modules/runtime";
import { useCodexOfficeVisibilitySettings } from "@/modules/settings/use-codex-office-visibility-settings";
import { useOfficeAccessMode } from "@/providers/office-access-mode-provider";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useAppStore } from "@/store";

interface OrganizationPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  canOpenTeamManager: boolean;
  canOpenAgentManager: boolean;
}

function CreateTeamTabContent({ onDone }: { onDone?: () => void }): React.JSX.Element {
  return <CreateTeamForm onDone={onDone} />;
}

function RecruitAgentTabContent({ canOpen }: { canOpen: boolean }): React.JSX.Element {
  if (!canOpen) {
    return (
      <p className="text-sm text-muted-foreground">
        Recruit Agent is unavailable in the current backend mode.
      </p>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      Recruit Agent is temporarily unavailable in WS-only mode.
    </p>
  );
}

function ManageTeamsTabContent({ canOpen }: { canOpen: boolean }): React.JSX.Element {
  if (!canOpen) {
    return (
      <p className="text-sm text-muted-foreground">
        Manage Teams is unavailable in the current backend mode.
      </p>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      Manage Teams is temporarily unavailable in WS-only mode.
    </p>
  );
}

function agentIdFromEmployee(employee: EmployeeData): string {
  return String(employee._id).replace(/^employee-/, "");
}

function threadIdFromAgentId(agentId: string): string {
  return agentId.startsWith("codex-thread:") ? agentId.slice("codex-thread:".length) : "";
}

type ThreadCandidate = {
  employee: EmployeeData;
  agentId: string;
  threadId: string;
  projectId: string;
};

type OrgPathNode = {
  id: string;
  label: string;
  depth: number;
  parentId?: string;
  projectId?: string;
  projectPath?: string;
  rootId: string;
  color: string;
};

const ORG_NODE_COLORS = [
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#a78bfa",
  "#fb7185",
  "#22c55e",
  "#f97316",
  "#60a5fa",
];

const CODEX_MISC_PROJECT_PATH = "farplane://codex/misc";

function slugSegment(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "node"
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

function semanticProjectSegments(project: ProjectModel): string[] {
  const normalized = normalizeProjectPath(project.trackingContext);
  if (normalized === CODEX_MISC_PROJECT_PATH) return [project.name || "Misc"];
  const parts = pathParts(normalized);
  if (parts.length === 0) return [project.name];
  const usersIndex = parts.indexOf("Users");
  const localParts = usersIndex >= 0 ? parts.slice(usersIndex + 2) : parts;
  const semanticParts = localParts.filter(
    (segment) => !/^(projects|repos|repositories|workspaces|workspace|src)$/i.test(segment),
  );
  return semanticParts.length > 0 ? semanticParts : [project.name];
}

function buildOrgPathTree(projects: ProjectModel[]): {
  nodes: OrgPathNode[];
  childrenByParentId: Map<string, OrgPathNode[]>;
  rootNodes: OrgPathNode[];
  nodeByProjectId: Map<string, OrgPathNode>;
} {
  const nodeById = new Map<string, OrgPathNode>();
  const nodeByProjectId = new Map<string, OrgPathNode>();
  const childrenByParentId = new Map<string, OrgPathNode[]>();

  for (const project of projects.filter((entry) => entry.status !== "archived")) {
    const segments = semanticProjectSegments(project);
    let parentId = "org";
    for (const [index, segment] of segments.entries()) {
      const id = `${parentId}/${slugSegment(segment)}`;
      const depth = index;
      const isLeaf = index === segments.length - 1;
      const existing = nodeById.get(id);
      const node =
        existing ??
        ({
          id,
          label: displaySegment(segment),
          depth,
          parentId: parentId === "org" ? undefined : parentId,
          rootId: depth === 0 ? id : "",
          color: ORG_NODE_COLORS[nodeById.size % ORG_NODE_COLORS.length],
        } satisfies OrgPathNode);
      if (!node.rootId) {
        let rootId = id;
        let currentParentId = node.parentId;
        while (currentParentId) {
          rootId = currentParentId;
          currentParentId = nodeById.get(currentParentId)?.parentId;
        }
        node.rootId = rootId;
      }
      if (isLeaf) {
        node.projectId = project.id;
        node.projectPath = normalizeProjectPath(project.trackingContext);
        nodeByProjectId.set(project.id, node);
      }
      if (!existing) {
        nodeById.set(id, node);
        const childrenKey = node.parentId ?? "org";
        childrenByParentId.set(childrenKey, [...(childrenByParentId.get(childrenKey) ?? []), node]);
      }
      parentId = id;
    }
  }

  for (const [parentId, children] of childrenByParentId) {
    childrenByParentId.set(
      parentId,
      [...children].sort((left, right) => left.label.localeCompare(right.label)),
    );
  }

  return {
    nodes: Array.from(nodeById.values()),
    childrenByParentId,
    rootNodes: childrenByParentId.get("org") ?? [],
    nodeByProjectId,
  };
}

interface OrgTreeCardProps {
  orgNode: OrgPathNode;
  employeeCount: number;
  isRoot: boolean;
  isCeoRoot: boolean;
  isProject: boolean;
  isPublic: boolean;
  pmThreadId: string;
  ceoThreadName?: string;
  pmThreadName?: string;
  isSelected: boolean;
  statusLabel?: string;
  onSelect: (nodeId: string) => void;
}

function OrgTreeCard(props: OrgTreeCardProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => props.onSelect(props.orgNode.id)}
      className={cn(
        "w-[260px] rounded-md border bg-card/95 p-3 text-left shadow-md transition-colors hover:bg-muted/50",
        props.isSelected ? "border-primary ring-1 ring-primary/40" : "border-border",
        props.isCeoRoot ? "border-amber-400 ring-1 ring-amber-400/40" : undefined,
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-1.5 size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: props.orgNode.color }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {props.isProject ? (
              <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <FolderTree className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <p className="truncate text-sm font-semibold">{props.orgNode.label}</p>
          </div>
          {props.orgNode.projectPath && !props.isPublic ? (
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              {props.orgNode.projectPath}
            </p>
          ) : null}
        </div>
        {props.isCeoRoot ? (
          <Badge className="shrink-0 bg-amber-500 text-black hover:bg-amber-500">
            <Crown className="mr-1 h-3 w-3" />
            CEO
          </Badge>
        ) : props.pmThreadId ? (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            PM
          </Badge>
        ) : props.isRoot ? (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            root
          </Badge>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>
          {props.employeeCount} thread{props.employeeCount === 1 ? "" : "s"}
        </span>
        <span>depth {props.orgNode.depth}</span>
      </div>

      {props.ceoThreadName ? (
        <p className="mt-2 flex items-center gap-1 truncate text-[11px] text-amber-300">
          <Crown className="h-3 w-3 shrink-0" />
          <span className="truncate">{props.ceoThreadName}</span>
        </p>
      ) : null}

      {props.pmThreadName ? (
        <p className="mt-2 flex items-center gap-1 truncate text-[11px] text-primary">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">{props.pmThreadName}</span>
        </p>
      ) : null}

      {props.statusLabel ? (
        <p className="mt-2 truncate text-[11px] text-muted-foreground">{props.statusLabel}</p>
      ) : null}
    </button>
  );
}

function OrgTreeNodeView({
  node,
  childrenByParentId,
  projectEmployeeCount,
  rootCandidatesByAreaId,
  projectManagerByProjectId,
  threadNameByThreadId,
  selectedCeoThreadId,
  selectedCeoRootId,
  selectedNodeId,
  isSaving,
  isPublic,
  onSelectNode,
}: {
  node: OrgPathNode;
  childrenByParentId: Map<string, OrgPathNode[]>;
  projectEmployeeCount: Map<string, number>;
  rootCandidatesByAreaId: Map<string, ThreadCandidate[]>;
  projectManagerByProjectId: Map<string, string>;
  threadNameByThreadId: Map<string, string>;
  selectedCeoThreadId: string;
  selectedCeoRootId: string;
  selectedNodeId: string;
  isSaving: boolean;
  isPublic: boolean;
  onSelectNode: (nodeId: string) => void;
}): React.JSX.Element {
  const children = childrenByParentId.get(node.id) ?? [];
  const projectId = node.projectId ?? "";
  const rootCandidateCount = rootCandidatesByAreaId.get(node.id)?.length ?? 0;
  const pmThreadId = projectId ? (projectManagerByProjectId.get(projectId) ?? "") : "";

  return (
    <div className="flex flex-col items-center">
      <OrgTreeCard
        orgNode={node}
        employeeCount={projectId ? (projectEmployeeCount.get(projectId) ?? 0) : rootCandidateCount}
        isRoot={!node.parentId}
        isCeoRoot={node.id === selectedCeoRootId}
        isProject={Boolean(projectId)}
        isPublic={isPublic}
        pmThreadId={pmThreadId}
        ceoThreadName={
          node.id === selectedCeoRootId && selectedCeoThreadId
            ? (threadNameByThreadId.get(selectedCeoThreadId) ?? selectedCeoThreadId)
            : undefined
        }
        pmThreadName={pmThreadId ? (threadNameByThreadId.get(pmThreadId) ?? pmThreadId) : undefined}
        isSelected={node.id === selectedNodeId}
        statusLabel={isSaving ? "Saving..." : undefined}
        onSelect={onSelectNode}
      />

      {children.length > 0 ? (
        <>
          <div className="h-8 border-l border-border" aria-hidden="true" />
          <div className="relative flex items-start gap-8 px-4 pt-8">
            <div
              className="absolute left-[calc(130px+1rem)] right-[calc(130px+1rem)] top-0 border-t border-border"
              aria-hidden="true"
            />
            {children.map((child) => (
              <div key={child.id} className="relative flex flex-col items-center">
                <div
                  className="absolute top-[-2rem] h-8 border-l border-border"
                  aria-hidden="true"
                />
                <OrgTreeNodeView
                  node={child}
                  childrenByParentId={childrenByParentId}
                  projectEmployeeCount={projectEmployeeCount}
                  rootCandidatesByAreaId={rootCandidatesByAreaId}
                  projectManagerByProjectId={projectManagerByProjectId}
                  threadNameByThreadId={threadNameByThreadId}
                  selectedCeoThreadId={selectedCeoThreadId}
                  selectedCeoRootId={selectedCeoRootId}
                  selectedNodeId={selectedNodeId}
                  isSaving={isSaving}
                  isPublic={isPublic}
                  onSelectNode={onSelectNode}
                />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function selectedProjectManagerPins(
  projectManagers: { projectId?: string; projectPath?: string; threadId: string; label?: string }[],
  projectId: string,
  threadId: string,
): { projectId?: string; projectPath?: string; threadId: string; label?: string }[] {
  const next = projectManagers.filter((pin) => pin.projectId !== projectId);
  if (!threadId) return next;
  return [...next, { projectId, threadId }];
}

function projectManagerThreadTitle(projectName: string): string {
  return `[${projectName.trim() || "Project"}] PM Agent`;
}

function projectManagerInitializationPrompt(projectName: string, projectPath?: string): string {
  const title = projectManagerThreadTitle(projectName);
  return [
    `Thread title: ${title}`,
    "",
    `You are the persistent project manager agent for ${projectName}.`,
    projectPath ? `Project directory: ${projectPath}` : "",
    "",
    "Initialize yourself as the long-running PM thread for this project. Keep the reply brief.",
  ]
    .filter(Boolean)
    .join("\n");
}

function OrgChartInspector({
  selectedNode,
  selectedCeoThreadId,
  selectedCeoRootId,
  selectedCeoName,
  selectedCeoRootLabel,
  rootCandidates,
  projectCandidates,
  pmThreadId,
  isCreatingProjectManager,
  isSaving,
  isPublic,
  statusText,
  onAssignCeo,
  onAssignProjectManager,
  onCreateProjectManager,
}: {
  selectedNode?: OrgPathNode;
  selectedCeoThreadId: string;
  selectedCeoRootId: string;
  selectedCeoName?: string;
  selectedCeoRootLabel?: string;
  rootCandidates: ThreadCandidate[];
  projectCandidates: ThreadCandidate[];
  pmThreadId: string;
  isCreatingProjectManager: boolean;
  isSaving: boolean;
  isPublic: boolean;
  statusText: string;
  onAssignCeo: (threadId: string) => Promise<void>;
  onAssignProjectManager: (projectId: string, threadId: string) => Promise<void>;
  onCreateProjectManager: (node: OrgPathNode) => Promise<void>;
}): React.JSX.Element {
  const isRoot = Boolean(selectedNode && !selectedNode.parentId);
  const isProject = Boolean(selectedNode?.projectId);
  const ceoValue = selectedNode?.id === selectedCeoRootId ? selectedCeoThreadId : "";

  return (
    <aside className="w-[320px] shrink-0 border-l bg-card/40 p-4">
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Inspector</p>
          <h3 className="truncate text-base font-semibold">
            {selectedNode?.label ?? "No node selected"}
          </h3>
          {selectedNode?.projectPath && !isPublic ? (
            <p className="truncate text-xs text-muted-foreground">{selectedNode.projectPath}</p>
          ) : null}
        </div>

        <div className="rounded-md border bg-background/70 p-3">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-400" />
            <p className="min-w-0 flex-1 truncate text-sm font-medium">
              {selectedCeoName ?? "No CEO assigned"}
            </p>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {selectedCeoRootLabel ? `Controls ${selectedCeoRootLabel}` : "Global CEO"}
          </p>
        </div>

        {isRoot && !isPublic ? (
          <label className="block space-y-2">
            <span className="flex items-center gap-1 text-xs font-medium text-amber-300">
              <Crown className="h-3.5 w-3.5" />
              CEO Thread
            </span>
            <select
              value={ceoValue}
              onChange={(event) => void onAssignCeo(event.target.value)}
              disabled={isSaving}
              className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
            >
              <option value="">No CEO assigned to this root</option>
              {rootCandidates.map((candidate) => (
                <option key={candidate.threadId} value={candidate.threadId}>
                  {candidate.employee.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {isProject && selectedNode?.projectId && !isPublic ? (
          <div className="space-y-2">
            <label className="block space-y-2">
              <span className="flex items-center gap-1 text-xs font-medium text-primary">
                <User className="h-3.5 w-3.5" />
                Project Manager
              </span>
              <select
                value={pmThreadId}
                onChange={(event) =>
                  void onAssignProjectManager(selectedNode.projectId ?? "", event.target.value)
                }
                disabled={isSaving || isCreatingProjectManager}
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
              >
                <option value="">No PM assigned</option>
                {projectCandidates.map((candidate) => (
                  <option key={candidate.threadId} value={candidate.threadId}>
                    {candidate.employee.name}
                  </option>
                ))}
              </select>
            </label>
            {!pmThreadId && projectCandidates.length === 0 ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full justify-start gap-2"
                disabled={isSaving || isCreatingProjectManager}
                onClick={() => void onCreateProjectManager(selectedNode)}
              >
                <UserPlus className="h-4 w-4" />
                {isCreatingProjectManager ? "Creating PM Agent..." : "Create PM Agent"}
              </Button>
            ) : null}
          </div>
        ) : null}

        {isPublic ? (
          <p className="text-sm text-muted-foreground">
            Public view shows organization status without assignment controls.
          </p>
        ) : !isRoot && !isProject ? (
          <p className="text-sm text-muted-foreground">
            Folder nodes show structure. Select a root for CEO or a project for PM.
          </p>
        ) : null}

        {statusText ? <p className="text-xs text-muted-foreground">{statusText}</p> : null}
      </div>
    </aside>
  );
}

function OrgChartTabContent({ isOpen }: { isOpen: boolean }): React.JSX.Element {
  const { employees, companyModel, refresh } = useOfficeDataContext();
  const { isPublic, isReadOnly } = useOfficeAccessMode();
  const gatewayConfig = useMemo(() => getGatewayUiConfig(), []);
  const codexSettings = useCodexOfficeVisibilitySettings({
    dialogOpen: isOpen,
    stateBaseInput: gatewayConfig.stateBase,
    refreshOfficeData: refresh,
  });
  const [localStatusText, setLocalStatusText] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [creatingProjectManagerProjectId, setCreatingProjectManagerProjectId] = useState("");

  const orgTree = useMemo(
    () => buildOrgPathTree(companyModel?.projects ?? []),
    [companyModel?.projects],
  );
  const projectRootByProjectId = useMemo(() => {
    const rows = new Map<string, string>();
    for (const [projectId, node] of orgTree.nodeByProjectId) {
      rows.set(projectId, node.rootId);
    }
    return rows;
  }, [orgTree.nodeByProjectId]);
  const projectEmployeeCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const agent of companyModel?.agents ?? []) {
      if (!agent.projectId) continue;
      counts.set(agent.projectId, (counts.get(agent.projectId) ?? 0) + 1);
    }
    return counts;
  }, [companyModel?.agents]);
  const companyAgentById = useMemo(
    () => new Map((companyModel?.agents ?? []).map((agent) => [agent.agentId, agent])),
    [companyModel?.agents],
  );

  const codexThreadEmployees = useMemo(
    () =>
      employees
        .map((employee) => {
          const agentId = agentIdFromEmployee(employee);
          return {
            employee,
            agentId,
            threadId: threadIdFromAgentId(agentId),
            projectId: companyAgentById.get(agentId)?.projectId ?? "",
          };
        })
        .filter((entry): entry is ThreadCandidate =>
          Boolean(entry.threadId && entry.projectId && projectRootByProjectId.has(entry.projectId)),
        )
        .sort((left, right) => {
          if (left.employee.isCEO !== right.employee.isCEO) return left.employee.isCEO ? -1 : 1;
          return left.employee.name.localeCompare(right.employee.name);
        }),
    [companyAgentById, employees, projectRootByProjectId],
  );

  const rootCandidatesByAreaId = useMemo(() => {
    const rows = new Map<string, ThreadCandidate[]>();
    for (const candidate of codexThreadEmployees) {
      const rootId = projectRootByProjectId.get(candidate.projectId);
      if (!rootId) continue;
      rows.set(rootId, [...(rows.get(rootId) ?? []), candidate]);
    }
    return rows;
  }, [codexThreadEmployees, projectRootByProjectId]);
  const projectCandidatesByProjectId = useMemo(() => {
    const rows = new Map<string, ThreadCandidate[]>();
    for (const candidate of codexThreadEmployees) {
      rows.set(candidate.projectId, [...(rows.get(candidate.projectId) ?? []), candidate]);
    }
    return rows;
  }, [codexThreadEmployees]);
  const threadNameByThreadId = useMemo(
    () =>
      new Map(
        codexThreadEmployees.map((candidate) => [candidate.threadId, candidate.employee.name]),
      ),
    [codexThreadEmployees],
  );
  const selectedCeoThreadId = codexSettings.form.ceoThreadId.trim();
  const selectedCeoRootId = useMemo(() => {
    const candidate = codexThreadEmployees.find((entry) => entry.threadId === selectedCeoThreadId);
    return candidate ? (projectRootByProjectId.get(candidate.projectId) ?? "") : "";
  }, [codexThreadEmployees, projectRootByProjectId, selectedCeoThreadId]);
  const projectManagerByProjectId = useMemo(() => {
    const rows = new Map<string, string>();
    for (const agent of companyModel?.agents ?? []) {
      if (agent.role !== "pm" || !agent.projectId) continue;
      const threadId = threadIdFromAgentId(agent.agentId);
      if (threadId) rows.set(agent.projectId, threadId);
    }
    for (const pin of codexSettings.form.projectManagers) {
      if (pin.projectId && pin.threadId) rows.set(pin.projectId, pin.threadId);
    }
    return rows;
  }, [codexSettings.form.projectManagers, companyModel?.agents]);

  const handleAssignCeo = useCallback(
    async (threadId: string): Promise<void> => {
      if (isReadOnly) {
        setLocalStatusText("Read-only mode blocks CEO assignment changes.");
        return;
      }
      setLocalStatusText("");
      const nextForm = { ...codexSettings.form, ceoThreadId: threadId };
      codexSettings.setForm(nextForm);
      await codexSettings.save(nextForm);
      setLocalStatusText(threadId ? "CEO thread saved." : "CEO thread cleared.");
    },
    [codexSettings, isReadOnly],
  );

  const handleAssignProjectManager = useCallback(
    async (projectId: string, threadId: string): Promise<void> => {
      if (isReadOnly) {
        setLocalStatusText("Read-only mode blocks project manager changes.");
        return;
      }
      if (!projectId) return;
      setLocalStatusText("");
      const nextForm = {
        ...codexSettings.form,
        projectManagers: selectedProjectManagerPins(
          codexSettings.form.projectManagers,
          projectId,
          threadId,
        ),
      };
      codexSettings.setForm(nextForm);
      await codexSettings.save(nextForm);
      setLocalStatusText(threadId ? "Project manager saved." : "Project manager cleared.");
    },
    [codexSettings, isReadOnly],
  );

  const handleCreateProjectManager = useCallback(
    async (node: OrgPathNode): Promise<void> => {
      if (isReadOnly) {
        setLocalStatusText("Read-only mode blocks project manager creation.");
        return;
      }
      const projectId = node.projectId ?? "";
      const projectPath = node.projectPath?.trim() ?? "";
      if (!projectId || !projectPath) return;
      setCreatingProjectManagerProjectId(projectId);
      setLocalStatusText("Creating project manager thread...");
      try {
        const client = new CodexAppServerClient({ stateUrl: gatewayConfig.stateBase });
        const started = await client.startProjectThread(projectPath);
        const threadId = started.thread?.id ?? "";
        if (!threadId) {
          throw new Error("codex_pm_thread_missing");
        }
        const prompt = projectManagerInitializationPrompt(node.label, projectPath);
        let initializationWarning = "";
        try {
          await client.startTurn(threadId, prompt);
        } catch (error) {
          initializationWarning =
            error instanceof Error ? ` Initialization failed: ${error.message}` : "";
        }
        const nextForm = {
          ...codexSettings.form,
          projectManagers: selectedProjectManagerPins(
            codexSettings.form.projectManagers,
            projectId,
            threadId,
          ),
        };
        codexSettings.setForm(nextForm);
        await codexSettings.save(nextForm);
        setLocalStatusText(
          `${projectManagerThreadTitle(node.label)} created and pinned.${initializationWarning}`,
        );
      } catch (error) {
        setLocalStatusText(
          error instanceof Error ? error.message : "Failed to create project manager thread.",
        );
      } finally {
        setCreatingProjectManagerProjectId("");
      }
    },
    [codexSettings, gatewayConfig.stateBase, isReadOnly],
  );

  const selectedCeo = codexThreadEmployees.find((entry) => entry.threadId === selectedCeoThreadId);
  const selectedCeoRoot = selectedCeoRootId
    ? orgTree.nodes.find((node) => node.id === selectedCeoRootId)
    : undefined;
  const effectiveSelectedNodeId =
    selectedNodeId && orgTree.nodes.some((node) => node.id === selectedNodeId)
      ? selectedNodeId
      : selectedCeoRootId || orgTree.rootNodes[0]?.id || "";
  const selectedNode = orgTree.nodes.find((node) => node.id === effectiveSelectedNodeId);
  const selectedNodeProjectId = selectedNode?.projectId ?? "";
  const statusText = codexSettings.statusText || localStatusText;
  const displayedTree = useMemo(() => {
    const childrenByParentId = new Map<string, OrgPathNode[]>();
    for (const [parentId, children] of orgTree.childrenByParentId) {
      childrenByParentId.set(parentId, [...children]);
    }
    const selectedRoot = orgTree.rootNodes.find((node) => node.id === selectedCeoRootId);
    if (!selectedRoot) {
      return { rootNodes: orgTree.rootNodes, childrenByParentId };
    }
    const otherRoots = orgTree.rootNodes.filter((node) => node.id !== selectedRoot.id);
    childrenByParentId.set(selectedRoot.id, [
      ...(childrenByParentId.get(selectedRoot.id) ?? []),
      ...otherRoots,
    ]);
    return { rootNodes: [selectedRoot], childrenByParentId };
  }, [orgTree.childrenByParentId, orgTree.rootNodes, selectedCeoRootId]);

  return (
    <div className="h-full min-h-0 overflow-hidden rounded-md border bg-background">
      {orgTree.rootNodes.length > 0 ? (
        <div className="flex h-full min-w-0">
          <div className="min-w-0 flex-1 overflow-auto p-8">
            <div className="min-w-max">
              <div className="mb-6 inline-flex items-start gap-2 rounded-md border bg-card/95 p-3 shadow-md">
                <Crown className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold">Folder Organization Tree</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    CEO: {selectedCeo?.employee.name ?? "not assigned"}
                    {selectedCeoRoot ? ` -> ${selectedCeoRoot.label}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-start justify-center gap-14">
                {displayedTree.rootNodes.map((rootNode) => (
                  <OrgTreeNodeView
                    key={rootNode.id}
                    node={rootNode}
                    childrenByParentId={displayedTree.childrenByParentId}
                    projectEmployeeCount={projectEmployeeCount}
                    rootCandidatesByAreaId={rootCandidatesByAreaId}
                    projectManagerByProjectId={projectManagerByProjectId}
                    threadNameByThreadId={threadNameByThreadId}
                    selectedCeoThreadId={selectedCeoThreadId}
                    selectedCeoRootId={selectedCeoRootId}
                    selectedNodeId={effectiveSelectedNodeId}
                    isSaving={codexSettings.isSaving}
                    isPublic={isPublic}
                    onSelectNode={setSelectedNodeId}
                  />
                ))}
              </div>
            </div>
          </div>

          <OrgChartInspector
            selectedNode={selectedNode}
            selectedCeoThreadId={selectedCeoThreadId}
            selectedCeoRootId={selectedCeoRootId}
            selectedCeoName={selectedCeo?.employee.name}
            selectedCeoRootLabel={selectedCeoRoot?.label}
            rootCandidates={selectedNode ? (rootCandidatesByAreaId.get(selectedNode.id) ?? []) : []}
            projectCandidates={
              selectedNodeProjectId
                ? (projectCandidatesByProjectId.get(selectedNodeProjectId) ?? [])
                : []
            }
            pmThreadId={
              selectedNodeProjectId
                ? (projectManagerByProjectId.get(selectedNodeProjectId) ?? "")
                : ""
            }
            isCreatingProjectManager={creatingProjectManagerProjectId === selectedNodeProjectId}
            isSaving={codexSettings.isSaving}
            isPublic={isPublic}
            statusText={statusText}
            onAssignCeo={handleAssignCeo}
            onAssignProjectManager={handleAssignProjectManager}
            onCreateProjectManager={handleCreateProjectManager}
          />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          No project hierarchy loaded.
        </div>
      )}
    </div>
  );
}

function DirectoryTabContent(): React.JSX.Element {
  const { employees } = useOfficeDataContext();
  const [searchQuery, setSearchQuery] = useState("");
  const highlightedEmployeeIds = useAppStore((state) => state.highlightedEmployeeIds);
  const setHighlightedEmployeeIds = useAppStore((state) => state.setHighlightedEmployeeIds);

  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const query = searchQuery.toLowerCase();
    return employees.filter((employee) => {
      const nameMatch = employee.name.toLowerCase().includes(query);
      const jobTitleMatch = employee.jobTitle?.toLowerCase().includes(query);
      const teamMatch = employee.team?.toLowerCase().includes(query);
      return nameMatch || jobTitleMatch || teamMatch;
    });
  }, [employees, searchQuery]);

  const employeesByTeam = useMemo(() => {
    const grouped = new Map<string, typeof employees>();
    for (const employee of filteredEmployees) {
      const teamName = employee.team || "Unassigned";
      if (!grouped.has(teamName)) grouped.set(teamName, []);
      grouped.get(teamName)?.push(employee);
    }
    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredEmployees]);

  const handleLocate = (employeeId: Id<"employees">): void => {
    setHighlightedEmployeeIds([employeeId]);
    setTimeout(() => {
      setHighlightedEmployeeIds(null);
    }, 30000);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, job title, or team..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="pl-10"
        />
      </div>
      {highlightedEmployeeIds.size > 0 ? (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setHighlightedEmployeeIds(null)}>
            Clear Highlight
          </Button>
        </div>
      ) : null}
      <div className="max-h-[48vh] space-y-3 overflow-y-auto pr-1">
        {employeesByTeam.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <User className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p>No employees found</p>
          </div>
        ) : (
          employeesByTeam.map(([teamName, teamEmployees]) => (
            <div key={teamName} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-muted-foreground">{teamName}</h3>
                <Badge variant="secondary" className="ml-auto">
                  {teamEmployees.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {teamEmployees.map((employee) => (
                  <Card
                    key={employee._id}
                    className={cn(
                      highlightedEmployeeIds.has(employee._id) ? "ring-2 ring-primary" : undefined,
                    )}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {employee.name}
                        {employee.isCEO ? (
                          <Badge variant="default" className="text-xs">
                            CEO
                          </Badge>
                        ) : null}
                      </CardTitle>
                      {employee.jobTitle ? (
                        <CardDescription className="flex items-center gap-2">
                          <Briefcase className="h-3 w-3" />
                          {employee.jobTitle}
                        </CardDescription>
                      ) : null}
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{employee.team}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLocate(employee._id)}
                      >
                        <MapPin className="mr-1 h-3 w-3" />
                        {highlightedEmployeeIds.has(employee._id) ? "Locating..." : "Locate"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="flex items-center justify-between border-t pt-3 text-sm text-muted-foreground">
        <span>
          Showing {filteredEmployees.length} of {employees.length} employees
        </span>
        {highlightedEmployeeIds.size > 0 ? (
          <span className="text-primary">Employee highlighted in scene</span>
        ) : null}
      </div>
    </div>
  );
}

export function OrganizationPanel({
  isOpen,
  onOpenChange,
  canOpenTeamManager,
  canOpenAgentManager,
}: OrganizationPanelProps): React.JSX.Element {
  const { isReadOnly } = useOfficeAccessMode();
  const gridCols = isReadOnly ? "grid-cols-2" : "grid-cols-5";

  return (
    <OfficeWorkspaceDialog
      className="p-6"
      open={isOpen}
      onOpenChange={onOpenChange}
      style={{ zIndex: UI_Z.panelBase }}
    >
      <DialogHeader className="shrink-0">
        <DialogTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Organization
        </DialogTitle>
        <DialogDescription>Team and people operations in one panel.</DialogDescription>
      </DialogHeader>

      <Tabs defaultValue="org-chart" className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
          <TabsList className={`grid w-full min-w-0 shrink-0 overflow-hidden ${gridCols}`}>
            <TabsTrigger value="org-chart">Org Chart</TabsTrigger>
            {!isReadOnly ? <TabsTrigger value="create-team">Create Team</TabsTrigger> : null}
            {!isReadOnly ? <TabsTrigger value="manage-teams">Manage Teams</TabsTrigger> : null}
            {!isReadOnly ? <TabsTrigger value="recruit-agent">Recruit Agent</TabsTrigger> : null}
            <TabsTrigger value="directory">Directory</TabsTrigger>
          </TabsList>

          <TabsContent value="org-chart" className="mt-4 min-h-0 flex-1">
            <OrgChartTabContent isOpen={isOpen} />
          </TabsContent>

          {!isReadOnly ? (
            <TabsContent value="create-team" className="mt-4 min-h-0 flex-1 overflow-auto">
              <CreateTeamTabContent />
            </TabsContent>
          ) : null}

          {!isReadOnly ? (
            <TabsContent value="manage-teams" className="mt-4 min-h-0 flex-1 overflow-auto">
              <ManageTeamsTabContent canOpen={canOpenTeamManager} />
            </TabsContent>
          ) : null}

          {!isReadOnly ? (
            <TabsContent value="recruit-agent" className="mt-4 min-h-0 flex-1 overflow-auto">
              <RecruitAgentTabContent canOpen={canOpenAgentManager} />
            </TabsContent>
          ) : null}

          <TabsContent value="directory" className="mt-4 min-h-0 flex-1 overflow-auto">
            <DirectoryTabContent />
          </TabsContent>
      </Tabs>
    </OfficeWorkspaceDialog>
  );
}
