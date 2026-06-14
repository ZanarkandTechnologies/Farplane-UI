"use client";

/**
 * SKILL STUDIO PANEL
 * ==================
 * Dedicated viewer/workbench for repo-local skills, demos, metadata, and files.
 *
 * KEY CONCEPTS:
 * - Global catalog lives on the left; selected skill details render on the right.
 * - Per-agent runtime context is optional and merged from `skills.status` when available.
 * - Metadata edits are limited to `skill.config.yaml`; `SKILL.md` remains read-only.
 *
 * MEMORY REFERENCES:
 * - MEM-0160
 * - MEM-0166
 * - MEM-0188
 * - MEM-0203
 * - MEM-0205
 */

import { Network, TestTube2, Workflow } from "lucide-react";
import { type ReactElement, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UI_Z } from "@/lib/z-index";
import { SkillsPanelControlsTab } from "@/modules/office/components/skills-panel-controls-tab";
import { SkillsPanelDemosTab } from "@/modules/office/components/skills-panel-demos-tab";
import { SkillsPanelDiagramTab } from "@/modules/office/components/skills-panel-diagram-tab";
import { SkillsPanelFilesTab } from "@/modules/office/components/skills-panel-files-tab";
import { SkillsPanelOverviewTab } from "@/modules/office/components/skills-panel-overview-tab";
import { SkillsPanelSidebar } from "@/modules/office/components/skills-panel-sidebar";
import { useSkillsPanelController } from "@/modules/office/components/use-skills-panel-controller";
import type { SkillStudioCatalogEntry } from "@/modules/runtime";
import { useOfficeAccessMode } from "@/providers/office-access-mode-provider";

const SKILL_STUDIO_SIDEBAR_WIDTH = 380;

type SkillGraphNode = {
  id: string;
  label: string;
  tier?: number;
  group?: string;
  source?: string;
  description?: string;
};

type SkillGraphEdge = {
  renderKey?: string;
  source: string;
  target: string;
  type?: string;
};

type SkillGraphPayload = {
  counts?: { nodes?: number; edges?: number };
  edges: SkillGraphEdge[];
  nodes: SkillGraphNode[];
};

function panelTitle(
  surface: "skill-os" | "evals" | "harness",
  focusAgentId: string | null,
): string {
  if (focusAgentId) return "Agent Skills";
  if (surface === "evals") return "Evals";
  if (surface === "harness") return "Harness";
  return "Skill OS";
}

function panelDescription(
  surface: "skill-os" | "evals" | "harness",
  focusAgentId: string | null,
): string {
  if (focusAgentId) {
    return "Codex adapter mode hides per-agent skill equip controls; this panel stays available as a read-first adapter surface.";
  }
  if (surface === "evals") {
    return "Global eval runs and skill-local eval files, separated from the Skill OS rollout control plane.";
  }
  if (surface === "harness") {
    return "Harness map entrypoint for skills, docs, agents, templates, validators, and policies.";
  }
  return "Global Skill OS: registry, template rollout, audits, file viewer, and skill-to-skill routing graph.";
}

function SkillToSkillGraph({
  selectedSkillId,
  onSelectSkill,
}: {
  selectedSkillId: string | null;
  onSelectSkill: (skillId: string) => void;
}): ReactElement {
  const [graph, setGraph] = useState<SkillGraphPayload | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/codex/skill-maintenance-graph/skill-graph.json")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: SkillGraphPayload | null) => {
        if (!cancelled) setGraph(payload);
      })
      .catch(() => {
        if (!cancelled) setGraph(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const layout = useMemo(() => {
    const nodes = graph?.nodes ?? [];
    const edges = graph?.edges ?? [];
    const visibleNodes = nodes.slice(0, 96);
    const ids = new Set(visibleNodes.map((node) => node.id));
    const positions = new Map<string, { x: number; y: number }>();
    visibleNodes.forEach((node, index) => {
      const angle = (index / Math.max(visibleNodes.length, 1)) * Math.PI * 2;
      const tierOffset = node.tier === 1 ? 0 : node.tier === 2 ? 44 : 84;
      const radius = 250 + tierOffset;
      positions.set(node.id, {
        x: 450 + Math.cos(angle) * radius,
        y: 300 + Math.sin(angle) * radius * 0.7,
      });
    });
    return {
      edges: edges
        .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
        .map((edge, index) => ({
          ...edge,
          renderKey: `${edge.source}-${edge.target}-${edge.type ?? "edge"}-${index}`,
        })),
      nodes: visibleNodes,
      positions,
    };
  }, [graph]);

  if (!graph) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Loading skill-to-skill graph...
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border p-3">
          <p className="text-[11px] uppercase text-muted-foreground">Skills</p>
          <p className="text-xl font-semibold">{graph.counts?.nodes ?? graph.nodes.length}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-[11px] uppercase text-muted-foreground">Skill edges</p>
          <p className="text-xl font-semibold">{graph.counts?.edges ?? graph.edges.length}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-[11px] uppercase text-muted-foreground">Boundary</p>
          <p className="text-xl font-semibold">skill-only</p>
        </div>
      </div>
      <div className="relative min-h-0 overflow-hidden rounded-md border bg-muted/10">
        <svg className="h-full w-full" viewBox="0 0 900 600" role="img">
          <title>Skill-to-skill call graph</title>
          {layout.edges.map((edge) => {
            const source = layout.positions.get(edge.source);
            const target = layout.positions.get(edge.target);
            if (!source || !target) return null;
            const selected = selectedSkillId === edge.source || selectedSkillId === edge.target;
            return (
              <line
                key={edge.renderKey}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={selected ? "hsl(var(--primary))" : "hsl(var(--border))"}
                strokeOpacity={selected ? 0.8 : 0.28}
                strokeWidth={selected ? 2 : 1}
              />
            );
          })}
          {layout.nodes.map((node) => {
            const position = layout.positions.get(node.id);
            if (!position) return null;
            const selected = selectedSkillId === node.id;
            const fill =
              node.tier === 1
                ? "hsl(var(--destructive))"
                : node.tier === 2
                  ? "hsl(var(--primary))"
                  : "hsl(var(--muted))";
            return (
              <g key={node.id} transform={`translate(${position.x} ${position.y})`}>
                <circle
                  r={selected ? 18 : 13}
                  fill={fill}
                  stroke={selected ? "hsl(var(--foreground))" : "hsl(var(--border))"}
                  strokeWidth={selected ? 3 : 1}
                />
                <text
                  y={selected ? -24 : -19}
                  textAnchor="middle"
                  className="fill-foreground text-[10px] font-medium"
                >
                  {node.id.length > 18 ? `${node.id.slice(0, 16)}...` : node.id}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2 rounded-md border bg-background/90 p-2">
          {layout.nodes.slice(0, 8).map((node) => (
            <button
              key={node.id}
              type="button"
              className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
              onClick={() => onSelectSkill(node.id)}
            >
              {node.id}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EvalsSurface({
  skills,
  selectedSkillId,
}: {
  skills: SkillStudioCatalogEntry[];
  selectedSkillId: string | null;
}): ReactElement {
  const evalSkills = skills.filter((skill) => skill.hasTests || skill.skillId === selectedSkillId);
  return (
    <ScrollArea className="h-full rounded-md border p-4">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md border p-3">
            <p className="text-[11px] uppercase text-muted-foreground">Skill eval files</p>
            <p className="text-2xl font-semibold">{evalSkills.length}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-[11px] uppercase text-muted-foreground">Latest run</p>
            <p className="text-2xl font-semibold">pending</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-[11px] uppercase text-muted-foreground">Boundary</p>
            <p className="text-2xl font-semibold">global</p>
          </div>
        </div>
        <div className="rounded-md border">
          <div className="border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <TestTube2 className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Eval Runs And Skill Eval Files</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              This surface owns run history and suite status. Skill-local eval JSON can be opened
              from the selected skill file viewer.
            </p>
          </div>
          <div className="divide-y">
            {evalSkills.slice(0, 24).map((skill) => (
              <div
                key={skill.skillId}
                className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-3 text-sm"
              >
                <span className="font-medium">{skill.skillId}</span>
                <Badge variant={skill.hasTests ? "secondary" : "outline"}>
                  {skill.hasTests ? "eval file" : "selected"}
                </Badge>
                <span className="text-xs text-muted-foreground">last run unknown</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

function HarnessSurface(): ReactElement {
  const [graph, setGraph] = useState<SkillGraphPayload | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/codex/skill-maintenance-graph/harness-graph.json")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: SkillGraphPayload | null) => {
        if (!cancelled) setGraph(payload);
      })
      .catch(() => {
        if (!cancelled) setGraph(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const nodeKinds = Object.entries(
    (graph?.counts as { node_kinds?: Record<string, number> } | undefined)?.node_kinds ?? {},
  ).slice(0, 8);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border p-3">
          <p className="text-[11px] uppercase text-muted-foreground">Map</p>
          <p className="text-2xl font-semibold">Harness</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-[11px] uppercase text-muted-foreground">Nodes</p>
          <p className="text-2xl font-semibold">{graph?.counts?.nodes ?? "loading"}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-[11px] uppercase text-muted-foreground">Edges</p>
          <p className="text-2xl font-semibold">{graph?.counts?.edges ?? "loading"}</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border bg-muted/10 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Network className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Harness Graph</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Harness uses the same graph-rendering direction as Skill OS, but a different data source:
          skills, docs, agents, templates, validators, and policies.
        </p>
        <div className="grid grid-cols-4 gap-3">
          {nodeKinds.map(([kind, count]) => (
            <div key={kind} className="rounded-md border bg-background p-3">
              <p className="text-[11px] uppercase text-muted-foreground">{kind}</p>
              <p className="text-xl font-semibold">{count}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SkillOsSummary({
  skills,
  selectedSkillId,
}: {
  skills: SkillStudioCatalogEntry[];
  selectedSkillId: string | null;
}): ReactElement {
  const selected = skills.find((skill) => skill.skillId === selectedSkillId) ?? null;
  const skillsWithTests = skills.filter((skill) => skill.hasTests).length;
  const skillsWithDiagrams = skills.filter((skill) => skill.hasDiagram).length;
  return (
    <div className="grid grid-cols-4 gap-3">
      <div className="rounded-md border p-3">
        <div className="flex items-center gap-2">
          <Workflow className="h-3.5 w-3.5 text-primary" />
          <p className="text-[11px] uppercase text-muted-foreground">Registry</p>
        </div>
        <p className="text-xl font-semibold">{skills.length}</p>
        <p className="text-xs text-muted-foreground">cataloged skills</p>
      </div>
      <div className="rounded-md border p-3">
        <p className="text-[11px] uppercase text-muted-foreground">Templates</p>
        <p className="text-xl font-semibold">{skillsWithDiagrams}</p>
        <p className="text-xs text-muted-foreground">diagram-ready</p>
      </div>
      <div className="rounded-md border p-3">
        <p className="text-[11px] uppercase text-muted-foreground">Audits</p>
        <p className="text-xl font-semibold">{skillsWithTests}</p>
        <p className="text-xs text-muted-foreground">eval-backed</p>
      </div>
      <div className="rounded-md border p-3">
        <p className="text-[11px] uppercase text-muted-foreground">Selected</p>
        <p className="truncate text-xl font-semibold">{selected?.skillId ?? "none"}</p>
        <p className="text-xs text-muted-foreground">file viewer target</p>
      </div>
    </div>
  );
}

function EmptyState(): ReactElement {
  return (
    <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      Select a runtime skill to inspect its files, diagram, demos, and controls.
    </div>
  );
}

export function SkillsPanel(): ReactElement {
  const { isPublic, isReadOnly } = useOfficeAccessMode();
  const {
    isOpen,
    setIsOpen,
    surface,
    setSurface,
    focusAgentId,
    selectedSkillId,
    setSelectedSkillId,
    search,
    setSearch,
    flagFilter,
    setFlagFilter,
    errorText,
    activeTab,
    setActiveTab,
    selectOverlayStyle,
    runtimeStatusText,
    skills,
    filteredWorkspaceSkills,
    groupedInheritedRuntimeSkills,
    filteredGlobalSkillRows,
    isSavingGlobalConfig,
    isMutatingWorkspace,
    isAgentSkillEquipped,
    selection,
    fileState,
    demoState,
    manifestState,
    agentWorkspacePath,
    selectedDemoTitle,
    diagramDocument,
    splitLines,
    getDemoStepKey,
    refreshRuntimeView,
    handleToggleGlobalSkill,
    handleToggleAgentSkill,
    handleWorkspaceSkillToggle,
    handleSaveManifest,
    updateManifest,
    setEditorMode,
    setRawManifest,
    setSelectedFilePath,
    setFileDraft,
    handleSaveFile,
    setSelectedDemoId,
    handleRunDemo,
  } = useSkillsPanelController();
  const safeActiveTab =
    isPublic && (activeTab === "files" || activeTab === "demos" || activeTab === "controls")
      ? "overview"
      : activeTab;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        className="flex h-[92vh] min-w-[88vw] max-w-none flex-col gap-0 overflow-hidden p-0"
        style={{ zIndex: UI_Z.panelElevated }}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{panelTitle(surface, focusAgentId)}</DialogTitle>
          <p className="text-xs text-muted-foreground">{panelDescription(surface, focusAgentId)}</p>
          {focusAgentId ? (
            <p className="text-xs text-muted-foreground">Focused agent: {focusAgentId}</p>
          ) : null}
          {errorText ? <p className="text-xs text-destructive">{errorText}</p> : null}
        </DialogHeader>
        <div
          className="grid min-h-0 flex-1 overflow-hidden"
          style={{ gridTemplateColumns: `${SKILL_STUDIO_SIDEBAR_WIDTH}px minmax(0, 1fr)` }}
        >
          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r p-4">
            <div className="flex items-center gap-2">
              <Input
                className="min-w-0 flex-1"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search skills"
              />
              <Select value={flagFilter} onValueChange={setFlagFilter}>
                <SelectTrigger className="w-[104px] shrink-0">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent style={selectOverlayStyle}>
                  <SelectItem value="all">Filter</SelectItem>
                  <SelectItem value="has-tests">Tests</SelectItem>
                  <SelectItem value="has-diagram">Diagram</SelectItem>
                  <SelectItem value="skill-memory">Memory</SelectItem>
                  <SelectItem value="runtime-eligible">Eligible</SelectItem>
                  <SelectItem value="runtime-blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <SkillsPanelSidebar
              focusAgentId={focusAgentId}
              runtimeStatusText={runtimeStatusText}
              selectedSkillId={selectedSkillId}
              filteredWorkspaceSkills={filteredWorkspaceSkills}
              groupedInheritedRuntimeSkills={groupedInheritedRuntimeSkills}
              filteredGlobalSkillRows={filteredGlobalSkillRows}
              isSavingGlobalConfig={isSavingGlobalConfig}
              isMutatingWorkspace={isMutatingWorkspace}
              readOnly={isReadOnly}
              isAgentSkillEquipped={isAgentSkillEquipped}
              onRefresh={() => void refreshRuntimeView()}
              onSelectSkill={(skillId) => setSelectedSkillId(skillId)}
              onToggleGlobalSkill={(skillKey, enabled) =>
                void handleToggleGlobalSkill(skillKey, enabled)
              }
              onToggleAgentSkill={(skillId) => void handleToggleAgentSkill(skillId)}
              onToggleWorkspaceSkill={(skillId, install) =>
                void handleWorkspaceSkillToggle(skillId, install)
              }
            />
          </div>

          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden p-4">
            <Tabs
              value={surface}
              onValueChange={(value) => setSurface(value as typeof surface)}
              className="mb-4 shrink-0"
            >
              <TabsList>
                <TabsTrigger value="skill-os">Skill OS</TabsTrigger>
                <TabsTrigger value="evals">Evals</TabsTrigger>
                <TabsTrigger value="harness">Harness</TabsTrigger>
              </TabsList>
            </Tabs>
            {surface === "evals" ? (
              <EvalsSurface skills={skills} selectedSkillId={selectedSkillId} />
            ) : surface === "harness" ? (
              <HarnessSurface />
            ) : !selection.selectedDetail || !manifestState.manifestEditor ? (
              <EmptyState />
            ) : (
              <Tabs
                value={safeActiveTab}
                onValueChange={(value) => setActiveTab(value as typeof activeTab)}
                className="flex h-full min-h-0 flex-col"
              >
                <TabsList className="shrink-0">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="graph">Graph</TabsTrigger>
                  {!isPublic ? <TabsTrigger value="files">Files</TabsTrigger> : null}
                  <TabsTrigger value="diagram">Diagram</TabsTrigger>
                  {!isPublic ? <TabsTrigger value="demos">Demos</TabsTrigger> : null}
                  {!isPublic ? <TabsTrigger value="controls">Controls</TabsTrigger> : null}
                </TabsList>

                <TabsContent value="overview" className="min-h-0 flex-1 overflow-hidden">
                  <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
                    <SkillOsSummary skills={skills} selectedSkillId={selectedSkillId} />
                    <SkillsPanelOverviewTab
                      focusAgentId={focusAgentId}
                      selection={selection}
                      isSavingGlobalConfig={isSavingGlobalConfig}
                      isMutatingWorkspace={isMutatingWorkspace}
                      onToggleWorkspaceSkill={(skillId, install) =>
                        void handleWorkspaceSkillToggle(skillId, install)
                      }
                      onToggleAgentSkill={(skillId) => void handleToggleAgentSkill(skillId)}
                      onToggleGlobalSkill={(skillId, enabled) =>
                        void handleToggleGlobalSkill(skillId, enabled)
                      }
                      onOpenControls={() => setActiveTab("controls")}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="graph" className="min-h-0 flex-1 overflow-hidden">
                  <SkillToSkillGraph
                    selectedSkillId={selectedSkillId}
                    onSelectSkill={setSelectedSkillId}
                  />
                </TabsContent>

                {!isPublic ? (
                  <TabsContent value="controls" className="min-h-0 flex-1 overflow-hidden">
                    <SkillsPanelControlsTab
                      focusAgentId={focusAgentId}
                      agentWorkspacePath={agentWorkspacePath}
                      selection={selection}
                      manifestState={manifestState}
                      isSavingGlobalConfig={isSavingGlobalConfig}
                      isMutatingWorkspace={isMutatingWorkspace}
                      selectOverlayStyle={selectOverlayStyle}
                      onSetEditorMode={setEditorMode}
                      onSaveManifest={() => void handleSaveManifest()}
                      onUpdateManifest={updateManifest}
                      onChangeRawManifest={setRawManifest}
                      onToggleWorkspaceSkill={(skillId, install) =>
                        void handleWorkspaceSkillToggle(skillId, install)
                      }
                      onToggleAgentSkill={(skillId) => void handleToggleAgentSkill(skillId)}
                      onToggleGlobalSkill={(skillId, enabled) =>
                        void handleToggleGlobalSkill(skillId, enabled)
                      }
                      splitLines={splitLines}
                    />
                  </TabsContent>
                ) : null}

                {!isPublic ? (
                  <TabsContent value="files" className="min-h-0 flex-1 overflow-hidden">
                    <SkillsPanelFilesTab
                      selection={selection}
                      fileState={fileState}
                      onSelectFilePath={setSelectedFilePath}
                      onChangeFileDraft={setFileDraft}
                      onSaveFile={() => void handleSaveFile()}
                    />
                  </TabsContent>
                ) : null}

                <TabsContent value="diagram" className="min-h-0 flex-1 overflow-hidden">
                  <SkillsPanelDiagramTab selection={selection} diagramDocument={diagramDocument} />
                </TabsContent>

                {!isPublic ? (
                  <TabsContent value="demos" className="min-h-0 flex-1 overflow-hidden">
                    <SkillsPanelDemosTab
                      selection={selection}
                      demoState={demoState}
                      selectedDemoTitle={selectedDemoTitle}
                      getDemoStepKey={getDemoStepKey}
                      onSelectDemoId={(demoId) => setSelectedDemoId(demoId)}
                      onRunDemo={() => void handleRunDemo()}
                    />
                  </TabsContent>
                ) : null}
              </Tabs>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
