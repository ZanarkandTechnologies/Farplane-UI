"use client";

import { Network } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GraphWorkbench, type GraphWorkbenchEdge, type GraphWorkbenchNode } from "@/modules/graph-workbench";
import { buildHarnessOsModel, HARNESS_GRAPH_KINDS } from "./harness-os-model";
import { HarnessRolloutPanel } from "./harness-rollout-panel";
import type { HarnessFeatureSummary } from "./harness-os-types";
import { TemplateTrackingPanel } from "./template-tracking-panel";
import { useHarnessOsData } from "./use-harness-os-data";

type HarnessOsView = "map" | "features" | "templates" | "projects";
type FeatureFilter = "all" | "implemented" | "partial" | "proposed" | "needs-spec";
type MapLayerDepth = 1 | 2 | 3 | "all";
type FeatureSummaryWithSpec = HarnessFeatureSummary & {
  category?: string;
  spec_refs?: string[];
};

const DEFAULT_FRAMEWORK_ROOT_ID = "workflow:lifecycle";

function shortPathLabel(node: GraphWorkbenchNode): string {
  if (node.kind === "workflow") return node.label;
  const value = node.path ?? node.label ?? node.id;
  const parts = value.split("/");
  return parts.length > 2 ? `${parts.slice(0, -1).join("/")}/${parts[parts.length - 1]}` : value;
}

function scopedFrameworkGraph({
  depth,
  edges,
  rootId,
  nodes,
}: {
  depth: MapLayerDepth;
  edges: GraphWorkbenchEdge[];
  rootId: string;
  nodes: GraphWorkbenchNode[];
}): {
  edges: GraphWorkbenchEdge[];
  nodes: GraphWorkbenchNode[];
} {
  if (depth === "all" || !rootId) return { edges, nodes };
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (!nodeIds.has(rootId)) return { edges, nodes };

  const neighbors = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    if (!neighbors.has(edge.source)) neighbors.set(edge.source, new Set());
    neighbors.get(edge.source)?.add(edge.target);
  }

  const visibleIds = new Set<string>([rootId]);
  let frontier = new Set<string>([rootId]);
  for (let layer = 0; layer < depth; layer += 1) {
    const next = new Set<string>();
    for (const nodeId of frontier) {
      for (const neighborId of neighbors.get(nodeId) ?? []) {
        if (visibleIds.has(neighborId)) continue;
        visibleIds.add(neighborId);
        next.add(neighborId);
      }
    }
    frontier = next;
    if (frontier.size === 0) break;
  }

  return {
    edges: edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)),
    nodes: nodes.filter((node) => visibleIds.has(node.id)),
  };
}

function SummaryStrip({
  generatedAt,
  summary,
}: {
  generatedAt: string;
  summary: ReturnType<typeof buildHarnessOsModel>["summary"];
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-0 rounded-md border bg-card text-sm">
      {[
        ["workflows", summary.workflows],
        ["skills", summary.skills],
        ["docs", summary.docs],
        ["features", summary.features],
        ["other", summary.frameworkRoles.other ?? 0],
        ["nodes", summary.nodes],
        ["edges", summary.edges],
      ].map(([label, value]) => (
        <div key={label} className="flex items-center gap-2 border-r px-3 py-2 last:border-r-0">
          <span className="text-xs uppercase text-muted-foreground">{label}</span>
          <span className="font-semibold tabular-nums">{value}</span>
        </div>
      ))}
      <span className="px-3 text-xs text-muted-foreground">generated {generatedAt}</span>
    </div>
  );
}

function featureNeedsSpec(feature: FeatureSummaryWithSpec): boolean {
  return (feature.spec_refs ?? []).length === 0 && ["designed", "proposed"].includes(feature.status ?? "");
}

function featureMatches(feature: FeatureSummaryWithSpec, filter: FeatureFilter): boolean {
  if (filter === "all") return true;
  if (filter === "needs-spec") return featureNeedsSpec(feature);
  if (filter === "implemented") return ["impl", "implemented", "done"].includes(feature.status ?? "");
  return feature.status === filter;
}

function FeatureRegistry({ features }: { features: FeatureSummaryWithSpec[] }): ReactElement {
  const [filter, setFilter] = useState<FeatureFilter>("all");
  const [query, setQuery] = useState("");
  const filteredFeatures = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    return features.filter((feature) => {
      if (!featureMatches(feature, filter)) return false;
      if (!lowerQuery) return true;
      return [feature.id, feature.name, feature.status, feature.category, feature.surfaces?.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(lowerQuery);
    });
  }, [features, filter, query]);
  const [selectedId, setSelectedId] = useState("");
  const selectedFeature =
    filteredFeatures.find((feature) => feature.id === selectedId) ?? filteredFeatures[0] ?? null;
  const selectedFeatureId = selectedFeature?.id ?? "";

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-3 py-2">
        <div className="flex flex-wrap gap-2">
          {[
            ["all", "All"],
            ["implemented", "Implemented"],
            ["partial", "Partial"],
            ["proposed", "Proposed"],
            ["needs-spec", "Needs spec"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id as FeatureFilter)}
              className={`rounded-md border px-2.5 py-1 text-xs transition ${
                filter === id ? "border-primary bg-primary text-primary-foreground" : "bg-background"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          className="min-w-[14rem] rounded-md border bg-background px-2 py-1 text-sm outline-none"
          placeholder="Search features"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
        <div className="min-h-0 rounded-md border bg-card">
          <div className="grid grid-cols-[8rem_minmax(13rem,1fr)_8rem_5rem] gap-3 border-b px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
            <span>ID</span>
            <span>Name</span>
            <span>Status</span>
            <span>Spec</span>
          </div>
          <ScrollArea className="h-[62vh]">
            {filteredFeatures.map((feature) => (
              <button
                key={feature.id}
                type="button"
                onClick={() => setSelectedId(feature.id)}
                className={`grid w-full grid-cols-[8rem_minmax(13rem,1fr)_8rem_5rem] gap-3 border-b px-4 py-2 text-left text-sm transition last:border-b-0 hover:bg-muted/30 ${
                  selectedFeatureId === feature.id ? "bg-muted/40" : ""
                }`}
              >
                <span className="font-mono text-xs text-muted-foreground">{feature.id}</span>
                <span className="truncate font-medium">{feature.name}</span>
                <Badge variant="outline" className="w-fit">
                  {feature.status ?? "unknown"}
                </Badge>
                <span className="text-muted-foreground">
                  {(feature.spec_refs ?? []).length ? "yes" : "no"}
                </span>
              </button>
            ))}
          </ScrollArea>
        </div>
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-md border bg-card">
          <div className="border-b p-4">
            <p className="font-mono text-sm text-muted-foreground">
              {selectedFeature?.id ?? "No feature"}
            </p>
            <p className="mt-1 text-xl font-semibold">{selectedFeature?.name ?? "Select a feature"}</p>
          </div>
          <ScrollArea className="min-h-0">
            <div className="space-y-4 p-4">
              <section>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">Summary</h4>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {selectedFeature?.known_limits ?? "No description recorded."}
                </p>
              </section>
              <section>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">Surfaces</h4>
                <div className="mt-2 space-y-2">
                  {(selectedFeature?.surfaces ?? []).length ? (
                    selectedFeature?.surfaces?.slice(0, 12).map((surface) => (
                      <div key={surface} className="rounded-md border px-3 py-2 font-mono text-xs text-muted-foreground">
                        {surface}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">none</p>
                  )}
                </div>
              </section>
              <section>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">Evidence</h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(selectedFeature?.evidence_refs ?? []).length ? (
                    selectedFeature?.evidence_refs?.map((ref) => (
                      <Badge key={ref} variant="outline">
                        {ref}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">none</span>
                  )}
                </div>
              </section>
              <section>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">Spec refs</h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  {(selectedFeature?.spec_refs ?? []).join(", ") || "none"}
                </p>
              </section>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

function FrameworkCoreMap({
  model,
}: {
  model: ReturnType<typeof buildHarnessOsModel>;
}): ReactElement {
  const roles = model.summary.frameworkRoles;
  const rootNodes = useMemo(
    () =>
      model.nodes
        .filter((node) => node.kind === "workflow" || node.frameworkRole === "source")
        .sort((a, b) => (a.path ?? a.label).localeCompare(b.path ?? b.label)),
    [model.nodes],
  );
  const defaultRootId =
    rootNodes.find((node) => node.id === DEFAULT_FRAMEWORK_ROOT_ID)?.id ?? rootNodes[0]?.id ?? "";
  const [rootId, setRootId] = useState(defaultRootId);
  const [layerDepth, setLayerDepth] = useState<MapLayerDepth>(2);
  const activeRootId = rootNodes.some((node) => node.id === rootId) ? rootId : defaultRootId;
  const scopedGraph = useMemo(
    () =>
      scopedFrameworkGraph({
        depth: layerDepth,
        edges: model.edges,
        rootId: activeRootId,
        nodes: model.nodes,
      }),
    [activeRootId, layerDepth, model.edges, model.nodes],
  );
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="grid gap-2 rounded-md border bg-card px-3 py-2 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant="secondary">Manifest Framework Core</Badge>
          {[
            ["source", roles.source ?? 0],
            ["workflow", roles.workflow ?? 0],
            ["linked", roles.linked ?? 0],
            ["isolated", roles.isolated ?? 0],
            ["other", roles.other ?? 0],
          ].map(([label, value]) => (
            <Badge key={label} variant="outline" className="gap-1">
              <span>{label}</span>
              <span className="font-mono">{value}</span>
            </Badge>
          ))}
          <Badge variant="outline" className="gap-1">
            <span>visible</span>
            <span className="font-mono">
              {scopedGraph.nodes.length}/{scopedGraph.edges.length}
            </span>
          </Badge>
          <span className="text-xs text-muted-foreground">
            Default lens starts at the lifecycle workflow. Switch roots or choose All for the full workflow map.
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <select
            className="h-8 max-w-[24rem] rounded-md border bg-background px-2 font-mono text-xs outline-none"
            value={activeRootId}
            onChange={(event) => setRootId(event.target.value)}
          >
            {rootNodes.map((node) => (
              <option key={node.id} value={node.id}>
                {shortPathLabel(node)}
              </option>
            ))}
          </select>
          <div className="flex rounded-md border">
            {[
              [1, "1"],
              [2, "2"],
              [3, "3"],
              ["all", "All"],
            ].map(([depth, label]) => (
              <button
                key={String(depth)}
                type="button"
                onClick={() => setLayerDepth(depth as MapLayerDepth)}
                className={`h-8 border-r px-2.5 text-xs last:border-r-0 ${
                  layerDepth === depth ? "bg-primary text-primary-foreground" : "bg-background"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <GraphWorkbench
        edges={scopedGraph.edges}
        kinds={HARNESS_GRAPH_KINDS}
        nodes={scopedGraph.nodes}
        telemetryLabel="HARNESS_MAP_OS"
      />
    </div>
  );
}

export function HarnessOsPanel({
  initialView = "map",
}: {
  initialView?: HarnessOsView | "rollout";
}): ReactElement {
  const {
    adoption,
    adoptionError,
    error,
    graph,
    templateIntelligence,
    templateTracking,
    templateTrackingError,
  } = useHarnessOsData();
  const initialHarnessView: HarnessOsView = initialView === "rollout" ? "projects" : initialView;
  const [activeView, setActiveView] = useState<HarnessOsView>(initialHarnessView);
  const model = useMemo(() => {
    if (!graph) return null;
    return buildHarnessOsModel({ graph, templateIntelligence });
  }, [graph, templateIntelligence]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!model) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Loading Harness OS graph...
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            ["map", "Map"],
            ["features", "Features"],
            ["templates", "Templates"],
            ["projects", "Projects"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveView(id as typeof activeView)}
              className={`rounded-md border px-3 py-1.5 text-sm transition ${
                activeView === id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Network className="h-4 w-4 text-primary" />
          Farplane harness contract
        </div>
      </div>

      <SummaryStrip generatedAt={model.generatedAt} summary={model.summary} />

      <div className="mt-3 min-h-0 flex-1">
        {activeView === "map" ? (
          <FrameworkCoreMap model={model} />
        ) : null}
        {activeView === "features" ? <FeatureRegistry features={model.features} /> : null}
        {activeView === "projects" ? (
          <HarnessRolloutPanel adoption={adoption} adoptionError={adoptionError} />
        ) : null}
        {activeView === "templates" ? (
          <TemplateTrackingPanel
            adoption={adoption}
            error={templateTrackingError}
            templateTracking={templateTracking}
          />
        ) : null}
      </div>
    </div>
  );
}

export function HarnessGraphPanel(): ReactElement {
  return <HarnessOsPanel initialView="map" />;
}

export function RolloutSurface(): ReactElement {
  return <HarnessOsPanel initialView="projects" />;
}

export function HarnessRolloutSurface(): ReactElement {
  return <RolloutSurface />;
}

export function TemplateTrackingSurface(): ReactElement {
  return <HarnessOsPanel initialView="templates" />;
}

export function TemplateRolloutSurface(): ReactElement {
  return <TemplateTrackingSurface />;
}
