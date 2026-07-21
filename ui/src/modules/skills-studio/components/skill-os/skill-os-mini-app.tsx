"use client";

/**
 * SKILL OS MINI APP
 * =================
 * Graph-first Skill OS with a focused, mutually exclusive selected-skill workspace.
 * The graph owns discovery; skill details own maintenance, experiments, and files.
 */

import { type ReactElement, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SkillGraphCanvas } from "./skill-graph-canvas";
import { buildForceGraphLayout } from "./skill-graph-layout";
import type { SkillGraphFilter } from "./skill-sidebar";
import { SkillSidebar } from "./skill-sidebar";
import { SkillWorkbench, type SkillWorkspaceView } from "./skill-workbench";
import { useSkillGraphData } from "./use-skill-graph-data";
import { useSkillInvocationCounts } from "./use-skill-invocation-counts";
import { useSkillStudioDetail } from "./use-skill-studio-detail";

export function SkillOsMiniApp({
  initialFilter = "all",
}: {
  initialFilter?: SkillGraphFilter;
}): ReactElement {
  const { docs, error, graph, templateIntelligence } = useSkillGraphData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [showChains, setShowChains] = useState(true);
  const [showRefs, setShowRefs] = useState(true);
  const [showExternal, setShowExternal] = useState(true);
  const [activeTiers, setActiveTiers] = useState<Set<number>>(() => new Set([1, 2, 3]));
  const invocationState = useSkillInvocationCounts(true);
  const selectedSkillId = searchParams.get("skill") ?? "";
  const filterParam = searchParams.get("filter");
  const maintenanceFilter: SkillGraphFilter =
    filterParam === "needs-care" || filterParam === "evaluated" || filterParam === "all"
      ? filterParam
      : initialFilter;
  const viewParam = searchParams.get("view");
  const workspaceView: SkillWorkspaceView =
    viewParam === "runbook" || viewParam === "experiments" || viewParam === "files"
      ? viewParam
      : "overview";

  function updateSearchParams(update: (next: URLSearchParams) => void, replace = true): void {
    const next = new URLSearchParams(searchParams);
    update(next);
    setSearchParams(next, { replace });
  }

  function selectSkill(skillId: string): void {
    updateSearchParams((next) => {
      next.set("skill", skillId);
      next.set("view", "overview");
    }, false);
  }

  function closeSkill(): void {
    updateSearchParams((next) => {
      next.delete("skill");
      next.delete("view");
    });
  }

  function getInvocationCount(skillId: string): number {
    return invocationState.countBySkill.get(skillId) ?? 0;
  }

  const rolloutBySkill = useMemo(
    () => new Map((templateIntelligence?.rollout ?? []).map((row) => [row.skill_id, row])),
    [templateIntelligence],
  );

  const graphNodes = useMemo(() => {
    if (!graph) return [];
    return graph.nodes.filter((node) => {
      const tier = node.tier ?? 3;
      if (!activeTiers.has(tier)) return false;
      if (!showExternal && node.source === "external") return false;
      if (maintenanceFilter === "evaluated") return Boolean(node.eval);
      if (maintenanceFilter === "needs-care") {
        if (node.source === "external") return false;
        const status = rolloutBySkill.get(node.id)?.status;
        const qaChecklist = docs?.skills[node.id]?.frontmatter?.qa_checklist;
        const hasQa = typeof qaChecklist === "string" && qaChecklist.trim().length > 0;
        return !node.eval || !hasQa || status === "missing" || status === "stale";
      }
      return true;
    });
  }, [activeTiers, docs, graph, maintenanceFilter, rolloutBySkill, showExternal]);

  const queryMatches = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    if (!lowerQuery) return new Set(graphNodes.map((node) => node.id));
    return new Set(
      graphNodes
        .filter((node) =>
          [node.id, node.label, node.group, node.path, node.description, ...(node.methods ?? [])]
            .join(" ")
            .toLowerCase()
            .includes(lowerQuery),
        )
        .map((node) => node.id),
    );
  }, [graphNodes, query]);

  const sidebarNodes = useMemo(
    () =>
      graphNodes
        .filter((node) => queryMatches.has(node.id))
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id)),
    [graphNodes, queryMatches],
  );
  const baseLayout = useMemo(
    () => (graph ? buildForceGraphLayout(graph, graphNodes) : null),
    [graph, graphNodes],
  );
  const layout = useMemo(
    () =>
      baseLayout
        ? {
            ...baseLayout,
            edges: baseLayout.edges.filter((edge) =>
              edge.type === "common-chain" ? showChains : showRefs,
            ),
          }
        : null,
    [baseLayout, showChains, showRefs],
  );
  const selectedNode = graph?.nodes.find((node) => node.id === selectedSkillId) ?? null;
  const selectedDoc = selectedNode ? (docs?.skills[selectedNode.id] ?? null) : null;
  const selectedDetail = useSkillStudioDetail(selectedNode?.id ?? "");

  function toggleTier(tier: number): void {
    setActiveTiers((current) => {
      const next = new Set(current);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  }

  if (error)
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-destructive">
        {error}
      </div>
    );
  if (!graph)
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Loading Skill OS graph…
      </div>
    );

  if (selectedNode) {
    return (
      <SkillWorkbench
        doc={selectedDoc}
        edges={graph.edges}
        invocationCount={getInvocationCount(selectedNode.id)}
        node={selectedNode}
        activeView={workspaceView}
        onBack={closeSkill}
        onSelectSkill={selectSkill}
        onViewChange={(view) => updateSearchParams((next) => next.set("view", view))}
        templateIntelligence={templateIntelligence}
        evalPath={selectedDetail?.evalPath ?? selectedNode.eval}
        evalSuite={selectedDetail?.evalSuite}
        fileEntries={selectedDetail?.fileEntries}
      />
    );
  }

  if (!layout)
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Preparing graph…
      </div>
    );

  return (
    <div className="grid h-full min-h-0 grid-cols-[19rem_minmax(0,1fr)] overflow-hidden rounded-md border bg-background">
      <SkillSidebar
        activeFilter={maintenanceFilter}
        activeTiers={activeTiers}
        edgeCount={layout.edges.length}
        getInvocationCount={getInvocationCount}
        graphNodeCount={graphNodes.length}
        totalNodeCount={graph.nodes.length}
        nodes={sidebarNodes}
        onFilterChange={(filter) =>
          updateSearchParams((next) => {
            if (filter === initialFilter) next.delete("filter");
            else next.set("filter", filter);
          })
        }
        onQueryChange={setQuery}
        onSelectSkill={selectSkill}
        onShowChainsChange={setShowChains}
        onShowExternalChange={setShowExternal}
        onShowRefsChange={setShowRefs}
        onToggleTier={toggleTier}
        query={query}
        selectedSkillId=""
        showChains={showChains}
        showExternal={showExternal}
        showRefs={showRefs}
      />
      <main className="relative min-h-0 overflow-hidden bg-[radial-gradient(circle_at_center,hsl(var(--muted))_1px,transparent_1px)] [background-size:18px_18px]">
        <SkillGraphCanvas
          edgeCount={graph.counts?.edges ?? graph.edges.length}
          graphNodeCount={graph.counts?.nodes ?? graph.nodes.length}
          layout={layout}
          onSelectSkill={selectSkill}
          query={query}
          queryMatches={queryMatches}
          selectedSkillId=""
        />
      </main>
    </div>
  );
}
