"use client";

import { HeartPulse, Network, RadioTower } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraphWorkbench } from "@/modules/graph-workbench";
import { HarnessHealthPanel } from "./harness-health-panel";
import { HarnessLifecycleCockpit } from "./harness-lifecycle-cockpit";
import {
  buildHarnessLifecycleModel,
  buildHarnessOsModel,
  HARNESS_GRAPH_KINDS,
} from "./harness-os-model";
import { HarnessRolloutPanel } from "./harness-rollout-panel";
import type { HarnessFeatureSummary } from "./harness-os-types";
import { useHarnessOsData } from "./use-harness-os-data";

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
        ["skills", summary.skills],
        ["docs", summary.docs],
        ["features", summary.features],
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

function FeatureRegistry({ features }: { features: HarnessFeatureSummary[] }): ReactElement {
  return (
    <div className="min-h-0 rounded-md border bg-card">
      <div className="grid grid-cols-[8rem_minmax(14rem,0.8fr)_8rem_minmax(18rem,1.2fr)_minmax(14rem,0.8fr)] gap-3 border-b px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
        <span>Feature</span>
        <span>Name</span>
        <span>Status</span>
        <span>What It Does</span>
        <span>Surfaces</span>
      </div>
      <ScrollArea className="h-[62vh]">
        {features.map((feature) => (
          <div
            key={feature.id}
            className="grid grid-cols-[8rem_minmax(14rem,0.8fr)_8rem_minmax(18rem,1.2fr)_minmax(14rem,0.8fr)] gap-3 border-b px-4 py-2 text-sm last:border-b-0"
          >
            <span className="font-mono text-xs text-muted-foreground">{feature.id}</span>
            <span className="truncate font-medium">{feature.name}</span>
            <Badge variant="outline" className="w-fit">
              {feature.status ?? "unknown"}
            </Badge>
            <span className="line-clamp-2 text-muted-foreground">
              {feature.known_limits ?? "No description recorded."}
            </span>
            <span className="truncate font-mono text-xs text-muted-foreground">
              {(feature.surfaces ?? []).slice(0, 4).join(", ") || "--"}
            </span>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}

export function HarnessOsPanel({
  initialTab = "health",
}: {
  initialTab?: "health" | "map" | "rollout";
}): ReactElement {
  const {
    adoption,
    adoptionError,
    error,
    graph,
    lifecycle,
    skillRollout,
    skillRolloutError,
    templateIntelligence,
  } = useHarnessOsData();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [activeMapView, setActiveMapView] = useState<"lifecycle" | "graph" | "features">(
    "lifecycle",
  );
  const model = useMemo(() => {
    if (!graph) return null;
    return buildHarnessOsModel({ graph, templateIntelligence });
  }, [graph, templateIntelligence]);
  const lifecycleModel = useMemo(() => buildHarnessLifecycleModel(lifecycle), [lifecycle]);

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
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <TabsList className="w-fit max-w-full flex-wrap justify-start">
          <TabsTrigger value="health">
            <HeartPulse className="size-4" />
            Health
          </TabsTrigger>
          <TabsTrigger value="map">
            <Network className="size-4" />
            Map
          </TabsTrigger>
          <TabsTrigger value="rollout">
            <RadioTower className="size-4" />
            Rollout
          </TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Network className="h-4 w-4 text-primary" />
          Farplane-wide harness map
        </div>
      </div>

      <SummaryStrip generatedAt={model.generatedAt} summary={model.summary} />

      <TabsContent value="health" className="mt-3 min-h-0 flex-1">
        <HarnessHealthPanel
          adoption={adoption}
          adoptionError={adoptionError}
          lifecycleModel={lifecycleModel}
          model={model}
          onOpenMap={() => setActiveTab("map")}
          onOpenRollout={() => setActiveTab("rollout")}
          skillRollout={skillRollout}
          skillRolloutError={skillRolloutError}
        />
      </TabsContent>
      <TabsContent value="map" className="mt-3 min-h-0 flex-1">
        <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
          <div className="flex flex-wrap gap-2">
            {[
              ["lifecycle", "Lifecycle"],
              ["graph", "Graph"],
              ["features", "Feature Registry"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveMapView(id as typeof activeMapView)}
                className={`rounded-md border px-3 py-1.5 text-sm transition ${
                  activeMapView === id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="min-h-0">
            {activeMapView === "lifecycle" ? <HarnessLifecycleCockpit model={lifecycleModel} /> : null}
            {activeMapView === "graph" ? (
              <GraphWorkbench
                edges={model.edges}
                kinds={HARNESS_GRAPH_KINDS}
                nodes={model.nodes}
                telemetryLabel="HARNESS_GRAPH_OS"
              />
            ) : null}
            {activeMapView === "features" ? <FeatureRegistry features={model.features} /> : null}
          </div>
        </div>
      </TabsContent>
      <TabsContent value="rollout" className="mt-3 min-h-0 flex-1">
        <HarnessRolloutPanel
          adoption={adoption}
          adoptionError={adoptionError}
          skillRollout={skillRollout}
          skillRolloutError={skillRolloutError}
        />
      </TabsContent>
    </Tabs>
  );
}
