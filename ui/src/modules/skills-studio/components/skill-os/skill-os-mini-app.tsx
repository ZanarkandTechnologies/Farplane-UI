"use client";

/**
 * SKILL OS MINI APP
 * =================
 * Graph-first Skill OS surface adapted from the Skill Maintenance graph viewer.
 *
 * Inputs: skill graph/doc JSON endpoints from the Codex skill-maintenance graph package.
 * Outputs: a standalone Farplane panel with sidebar/node selection sync and graph overlay detail.
 * Side effects: fetches static graph assets; no writes.
 * Invariants: Skill OS renders skill-to-skill graph data only, not eval/harness-wide nodes.
 */

import { CheckCircle2, FileCheck2, ShieldCheck } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkillDetailOverlay } from "./skill-detail-overlay";
import { SkillGraphCanvas } from "./skill-graph-canvas";
import { buildForceGraphLayout } from "./skill-graph-layout";
import { SkillOsInvocationsTab } from "./skill-os-invocations-tab";
import { buildStandardsViewModel } from "./skill-os-standards-model";
import { SkillOsStandardsTab } from "./skill-os-standards-tab";
import type { SkillDocsPayload, SkillGraphNode, SkillTemplateIntelligencePayload } from "./skill-os-types";
import { SkillSidebar } from "./skill-sidebar";
import { SkillWorkbench } from "./skill-workbench";
import { useSkillGraphData } from "./use-skill-graph-data";
import { useSkillInvocationCounts } from "./use-skill-invocation-counts";

function StandardsOverview({
  docs,
  nodes,
  templateError,
  templateIntelligence,
}: {
  docs: SkillDocsPayload | null;
  nodes: SkillGraphNode[];
  templateError: string | null;
  templateIntelligence: SkillTemplateIntelligencePayload | null;
}): ReactElement {
  const viewModel = useMemo(
    () => buildStandardsViewModel({ docs, nodes, templateIntelligence }),
    [docs, nodes, templateIntelligence],
  );
  const rows = [
    ["Template contract", viewModel.currentTemplateVersion, `${viewModel.summary.current} current`],
    ["Eval task surface", "eval_task.json", `${viewModel.summary.pass} passing eval rows`],
    ["QA checklist surface", "qa_checklist.md", `${viewModel.summary.total} skills scanned`],
    ["Feature references", "feature_refs", `${viewModel.summary.features} registered features`],
  ];

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="rounded-md border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Standards</p>
            <h2 className="mt-1 text-xl font-semibold">Skill contract surface</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Standards stays focused on the package contract: template version, eval tasks, QA
              checklists, feature refs, and generated registry confidence.
            </p>
          </div>
          <Badge variant={viewModel.hasGeneratedArtifact ? "secondary" : "outline"}>
            {viewModel.hasGeneratedArtifact ? "generated" : (templateError ?? "fallback")}
          </Badge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-md border bg-background p-3">
            <ShieldCheck className="size-4 text-muted-foreground" />
            <p className="mt-2 text-2xl font-semibold">{viewModel.summary.current}</p>
            <p className="text-xs uppercase text-muted-foreground">current</p>
          </div>
          <div className="rounded-md border bg-background p-3">
            <FileCheck2 className="size-4 text-muted-foreground" />
            <p className="mt-2 text-2xl font-semibold">{viewModel.summary.total}</p>
            <p className="text-xs uppercase text-muted-foreground">skills</p>
          </div>
          <div className="rounded-md border bg-background p-3">
            <CheckCircle2 className="size-4 text-muted-foreground" />
            <p className="mt-2 text-2xl font-semibold">{viewModel.summary.pass}</p>
            <p className="text-xs uppercase text-muted-foreground">eval pass</p>
          </div>
          <div className="rounded-md border bg-background p-3">
            <ShieldCheck className="size-4 text-muted-foreground" />
            <p className="mt-2 text-2xl font-semibold">
              {viewModel.summary.missing + viewModel.summary.stale}
            </p>
            <p className="text-xs uppercase text-muted-foreground">drift</p>
          </div>
        </div>
      </div>
      <div className="min-h-0 rounded-md border bg-card">
        <div className="border-b px-3 py-2 text-sm font-semibold">Contract Checks</div>
        {rows.map(([label, contract, detail]) => (
          <div
            key={label}
            className="grid grid-cols-[minmax(10rem,0.7fr)_minmax(10rem,0.7fr)_minmax(12rem,1fr)] gap-3 border-b px-3 py-2 text-sm last:border-b-0"
          >
            <span className="font-medium">{label}</span>
            <span className="truncate font-mono text-xs text-muted-foreground">{contract}</span>
            <span className="truncate text-muted-foreground">{detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkillOsMiniApp(): ReactElement {
  const { docs, error, graph, templateIntelligence, templateIntelligenceError } =
    useSkillGraphData();
  const [activeOsTab, setActiveOsTab] = useState("workbench");
  const [query, setQuery] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [showChains, setShowChains] = useState(true);
  const [showRefs, setShowRefs] = useState(true);
  const [showExternal, setShowExternal] = useState(true);
  const [activeTiers, setActiveTiers] = useState<Set<number>>(() => new Set([1, 2, 3]));
  const [fullPage, setFullPage] = useState(false);
  const invocationState = useSkillInvocationCounts(
    activeOsTab === "workbench" || activeOsTab === "invocations",
  );

  function getInvocationCount(skillId: string): number {
    return invocationState.countBySkill.get(skillId) ?? 0;
  }

  const graphNodes = useMemo(() => {
    if (!graph) return [];
    return graph.nodes.filter((node) => {
      const tier = node.tier ?? 3;
      if (!activeTiers.has(tier)) return false;
      if (!showExternal && node.source === "external") return false;
      return true;
    });
  }, [activeTiers, graph, showExternal]);

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
        .sort((left, right) => left.id.localeCompare(right.id)),
    [graphNodes, queryMatches],
  );

  const baseLayout = useMemo(() => {
    if (!graph) return null;
    return buildForceGraphLayout(graph, graphNodes);
  }, [graphNodes, graph]);

  const layout = useMemo(() => {
    if (!baseLayout) return null;
    return {
      ...baseLayout,
      edges: baseLayout.edges.filter((edge) =>
        edge.type === "common-chain" ? showChains : showRefs,
      ),
    };
  }, [baseLayout, showChains, showRefs]);

  const selectedNode =
    layout?.nodes.find((node) => node.id === selectedSkillId) ??
    graph?.nodes.find((node) => node.id === selectedSkillId) ??
    null;
  const selectedDoc = selectedNode ? (docs?.skills[selectedNode.id] ?? null) : null;

  function selectSkill(skillId: string): void {
    setSelectedSkillId(skillId);
    setFullPage(false);
  }

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

  if (!graph || !layout) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Loading Skill OS graph...
      </div>
    );
  }

  return (
    <Tabs
      value={activeOsTab}
      onValueChange={setActiveOsTab}
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      <TabsList className="mb-3 w-fit max-w-full flex-wrap justify-start">
        <TabsTrigger value="workbench">Workbench</TabsTrigger>
        <TabsTrigger value="rollout">Rollout</TabsTrigger>
        <TabsTrigger value="invocations">Invocations</TabsTrigger>
        <TabsTrigger value="standards">Standards</TabsTrigger>
      </TabsList>

      <TabsContent value="workbench" className="m-0 min-h-0 flex-1">
        <div className="grid h-full min-h-0 grid-cols-[20rem_minmax(0,1fr)] overflow-hidden rounded-md border bg-background">
          <SkillSidebar
            activeTiers={activeTiers}
            edgeCount={layout.edges.length}
            getInvocationCount={getInvocationCount}
            graphNodeCount={graphNodes.length}
            nodes={sidebarNodes}
            onQueryChange={setQuery}
            onSelectSkill={selectSkill}
            onShowChainsChange={setShowChains}
            onShowExternalChange={setShowExternal}
            onShowRefsChange={setShowRefs}
            onToggleTier={toggleTier}
            query={query}
            selectedSkillId={selectedSkillId}
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
              selectedSkillId={selectedSkillId}
            />

            {selectedNode && fullPage ? (
              <SkillWorkbench
                doc={selectedDoc}
                edges={graph.edges}
                invocationCount={getInvocationCount(selectedNode.id)}
                node={selectedNode}
                onBack={() => setFullPage(false)}
                onSelectSkill={selectSkill}
              />
            ) : null}

            {selectedNode && !fullPage ? (
              <SkillDetailOverlay
                doc={selectedDoc}
                edges={graph.edges}
                fullPage={fullPage}
                invocationCount={getInvocationCount(selectedNode.id)}
                node={selectedNode}
                onClose={() => {
                  setSelectedSkillId("");
                  setFullPage(false);
                }}
                onOpenFullPage={() => setFullPage(true)}
                onSelectSkill={selectSkill}
              />
            ) : null}
          </main>
        </div>
      </TabsContent>

      <TabsContent value="rollout" className="m-0 min-h-0 flex-1">
        <SkillOsStandardsTab
          docs={docs}
          nodes={graph.nodes}
          templateError={templateIntelligenceError}
          templateIntelligence={templateIntelligence}
        />
      </TabsContent>

      <TabsContent value="invocations" className="m-0 min-h-0 flex-1">
        <SkillOsInvocationsTab invocationState={invocationState} />
      </TabsContent>

      <TabsContent value="standards" className="m-0 min-h-0 flex-1">
        <StandardsOverview
          docs={docs}
          nodes={graph.nodes}
          templateError={templateIntelligenceError}
          templateIntelligence={templateIntelligence}
        />
      </TabsContent>
    </Tabs>
  );
}
