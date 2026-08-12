"use client";

/**
 * Skills Studio's two intentional homes: a department capability constellation
 * and the technical Skill Library. URL state preserves real graph drill-down
 * without inventing process edges.
 */

import { type ReactElement, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CapabilityInspector } from "./capability-inspector";
import { capabilityFocusContains, capabilityFocusId } from "./capability-map-model";
import { buildCapabilityGraphLayout } from "./skill-capability-layout";
import { SkillGraphCanvas } from "./skill-graph-canvas";
import { buildForceGraphLayout } from "./skill-graph-layout";
import { SkillOsNavigation } from "./skill-os-navigation";
import { resolveSkillStudioSurface, type SkillStudioSurface } from "./skill-os-navigation-state";
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
  const { capabilityGraph, docs, error, graph, templateIntelligence } = useSkillGraphData();
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
  const activeSurface = resolveSkillStudioSurface({
    initialFilter,
    surface: searchParams.get("surface"),
  });
  const capabilityFocusParam = searchParams.get("capability");
  const capabilityNodeParam = searchParams.get("capabilityNode");
  const viewParam = searchParams.get("view");
  const workspaceView: SkillWorkspaceView =
    viewParam === "runbook" || viewParam === "experiments" || viewParam === "files"
      ? viewParam
      : "overview";
  const isCapabilityMap = activeSurface === "capabilities";

  function updateSearchParams(update: (next: URLSearchParams) => void, replace = true): void {
    const next = new URLSearchParams(searchParams);
    update(next);
    setSearchParams(next, { replace });
  }

  function changeSurface(surface: SkillStudioSurface): void {
    updateSearchParams((next) => {
      next.set("surface", surface);
      next.delete("skill");
      next.delete("view");
      next.delete("capabilityNode");
      next.delete("returnSurface");
      next.delete("returnCapability");
      if (surface === "library") next.delete("capability");
    }, false);
  }

  function selectLibrarySkill(skillId: string): void {
    updateSearchParams((next) => {
      next.set("surface", "library");
      next.set("skill", skillId);
      next.set("view", "overview");
      next.delete("returnSurface");
      next.delete("returnCapability");
    }, false);
  }

  function openOwnerSkill(skillId: string): void {
    updateSearchParams((next) => {
      next.set("surface", "library");
      next.set("skill", skillId);
      next.set("view", "overview");
      next.set("returnSurface", "capabilities");
      if (focusedCapabilityId) next.set("returnCapability", focusedCapabilityId);
      next.delete("capabilityNode");
    }, false);
  }

  function selectGraphNode(nodeId: string): void {
    const node = activeGraph?.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    if (!isCapabilityMap) {
      selectLibrarySkill(node.id);
      return;
    }
    if (node.kind === "department") {
      if (focusedCapabilityId === node.id) return;
      updateSearchParams((next) => {
        next.set("capability", node.id);
        next.delete("capabilityNode");
        next.delete("skill");
        next.delete("view");
      }, false);
      return;
    }
    if (node.kind === "workflow") {
      const owningSkill = node.skill_id ?? node.id.replace(/^skill:/, "");
      if (focusedCapabilityId !== node.id) {
        updateSearchParams((next) => {
          next.set("capability", node.id);
          next.delete("capabilityNode");
          next.delete("skill");
          next.delete("view");
        }, false);
        return;
      }
      openOwnerSkill(owningSkill);
      return;
    }
    const owningSkill = node.skill_id ?? node.parent_skill;
    if (!owningSkill) return;
    const workflowNodeId = `skill:${owningSkill}`;
    if (focusedCapabilityId !== workflowNodeId) {
      updateSearchParams((next) => {
        next.set("capability", workflowNodeId);
        next.delete("capabilityNode");
        next.delete("skill");
        next.delete("view");
      }, false);
      return;
    }
    updateSearchParams((next) => next.set("capabilityNode", node.id), false);
  }

  function clearCapabilityFocus(): void {
    updateSearchParams((next) => {
      next.delete("capability");
      next.delete("capabilityNode");
    }, false);
  }

  function closeCapabilityInspector(): void {
    updateSearchParams((next) => next.delete("capabilityNode"));
  }

  function closeSkill(): void {
    updateSearchParams((next) => {
      const returnsToCapability = next.get("returnSurface") === "capabilities";
      const returnCapability = next.get("returnCapability");
      next.delete("skill");
      next.delete("view");
      next.delete("returnSurface");
      next.delete("returnCapability");
      if (returnsToCapability) {
        next.set("surface", "capabilities");
        if (returnCapability) next.set("capability", returnCapability);
      }
    });
  }

  function getInvocationCount(skillId: string): number {
    return invocationState.countBySkill.get(skillId) ?? 0;
  }

  const rolloutBySkill = useMemo(
    () => new Map((templateIntelligence?.rollout ?? []).map((row) => [row.skill_id, row])),
    [templateIntelligence],
  );
  const capabilityMap = capabilityGraph;
  const activeGraph = isCapabilityMap ? capabilityMap : graph;
  const focusedCapabilityId = isCapabilityMap
    ? capabilityFocusId(capabilityMap ?? { edges: [], nodes: [] }, capabilityFocusParam)
    : null;
  const focusedCapabilityNode = focusedCapabilityId
    ? capabilityMap?.nodes.find((node) => node.id === focusedCapabilityId)
    : null;
  const inspectedCapabilityNode =
    isCapabilityMap &&
    capabilityMap &&
    focusedCapabilityId &&
    focusedCapabilityNode?.kind === "workflow"
      ? (capabilityMap.nodes.find(
          (node) =>
            node.id === capabilityNodeParam &&
            capabilityFocusContains(capabilityMap, focusedCapabilityId, node.id) &&
            node.kind === "artifact",
        ) ?? null)
      : null;

  const graphNodes = useMemo(() => {
    if (!activeGraph) return [];
    if (isCapabilityMap) return activeGraph.nodes;
    return activeGraph.nodes.filter((node) => {
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
  }, [
    activeGraph,
    activeTiers,
    docs,
    isCapabilityMap,
    maintenanceFilter,
    rolloutBySkill,
    showExternal,
  ]);

  const queryMatches = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    if (!lowerQuery) return new Set(graphNodes.map((node) => node.id));
    return new Set(
      graphNodes
        .filter((node) =>
          [
            node.id,
            node.label,
            node.group,
            node.path,
            node.description,
            node.method_id,
            node.output,
            node.parent_skill,
            node.skill_id,
            ...(node.methods ?? []).flatMap((method) => [method.id, method.class, method.output]),
          ]
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
        .sort((left, right) => left.id.localeCompare(right.id)),
    [graphNodes, queryMatches],
  );
  const baseLayout = useMemo(() => {
    if (!activeGraph) return null;
    return isCapabilityMap
      ? buildCapabilityGraphLayout(activeGraph, focusedCapabilityId)
      : buildForceGraphLayout(activeGraph, graphNodes);
  }, [activeGraph, focusedCapabilityId, graphNodes, isCapabilityMap]);
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

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-destructive">
        {error}
      </div>
    );
  }
  if (!activeGraph || !layout) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Loading Skills Studio…
      </div>
    );
  }

  const navigation = (
    <SkillOsNavigation
      activeSurface={activeSurface}
      mapMode={isCapabilityMap}
      onSurfaceChange={changeSurface}
    />
  );
  if (selectedNode) {
    return (
      <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border bg-background">
        {navigation}
        <div className="min-h-0 flex-1 overflow-hidden">
          <SkillWorkbench
            doc={selectedDoc}
            edges={graph?.edges ?? []}
            invocationCount={getInvocationCount(selectedNode.id)}
            node={selectedNode}
            activeView={workspaceView}
            onBack={closeSkill}
            onSelectSkill={selectLibrarySkill}
            onViewChange={(view) => updateSearchParams((next) => next.set("view", view))}
            templateIntelligence={templateIntelligence}
            evalPath={selectedDetail?.evalPath ?? selectedNode.eval}
            evalSuite={selectedDetail?.evalSuite}
            fileEntries={selectedDetail?.fileEntries}
          />
        </div>
      </section>
    );
  }

  return (
    <section
      className={
        isCapabilityMap
          ? "relative flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground"
          : "flex h-full min-h-0 flex-col overflow-hidden rounded-md border bg-background"
      }
    >
      {isCapabilityMap ? null : navigation}
      {isCapabilityMap ? (
        <main
          className="relative min-h-0 flex-1 overflow-hidden"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at center, hsl(var(--muted) / 0.42), transparent 39%), linear-gradient(145deg, hsl(var(--background)), hsl(var(--sidebar)) 58%, hsl(var(--background)))",
            backgroundSize: "auto, auto",
          }}
        >
          {navigation}
          {focusedCapabilityId ? (
            <button
              type="button"
              className="absolute left-5 top-5 z-20 rounded-md border bg-background/90 px-3 py-2 font-mono text-[10px] tracking-[0.14em] text-muted-foreground shadow-sm transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              onClick={clearCapabilityFocus}
            >
              ← ALL DEPARTMENTS
            </button>
          ) : null}
          <SkillGraphCanvas
            edgeCount={activeGraph.counts?.edges ?? activeGraph.edges.length}
            graphNodeCount={activeGraph.counts?.nodes ?? activeGraph.nodes.length}
            graphTitle="CAPABILITY_MAP"
            layout={layout}
            onSelectSkill={selectGraphNode}
            query={query}
            queryMatches={queryMatches}
            radialMode={focusedCapabilityId ? "focus" : "overview"}
            selectedSkillId=""
          />
          {inspectedCapabilityNode ? (
            <CapabilityInspector
              node={inspectedCapabilityNode}
              onClose={closeCapabilityInspector}
              onOpenOwnerSkill={openOwnerSkill}
            />
          ) : null}
        </main>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[19rem_minmax(0,1fr)] overflow-hidden">
          <SkillSidebar
            activeFilter={maintenanceFilter}
            activeTiers={activeTiers}
            edgeCount={layout.edges.length}
            getInvocationCount={getInvocationCount}
            graphNodeCount={graphNodes.length}
            totalNodeCount={activeGraph.nodes.length}
            nodes={sidebarNodes}
            onFilterChange={(filter) =>
              updateSearchParams((next) => {
                if (filter === initialFilter) next.delete("filter");
                else next.set("filter", filter);
              })
            }
            onQueryChange={setQuery}
            onSelectSkill={selectLibrarySkill}
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
          <main className="relative min-h-0 overflow-hidden bg-background">
            <SkillGraphCanvas
              edgeCount={activeGraph.counts?.edges ?? activeGraph.edges.length}
              graphNodeCount={activeGraph.counts?.nodes ?? activeGraph.nodes.length}
              graphTitle="SKILL_LIBRARY"
              layout={layout}
              onSelectSkill={selectGraphNode}
              query={query}
              queryMatches={queryMatches}
              selectedSkillId=""
            />
          </main>
        </div>
      )}
    </section>
  );
}
