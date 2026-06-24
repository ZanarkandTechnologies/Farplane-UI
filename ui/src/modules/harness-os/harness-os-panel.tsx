"use client";

import { Network } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GraphWorkbench } from "@/modules/graph-workbench";
import { HarnessLifecycleCockpit } from "./harness-lifecycle-cockpit";
import {
  buildHarnessLifecycleModel,
  buildHarnessOsModel,
  HARNESS_GRAPH_KINDS,
} from "./harness-os-model";
import { HarnessRolloutPanel } from "./harness-rollout-panel";
import type { HarnessFeatureSummary } from "./harness-os-types";
import { TemplateTrackingPanel } from "./template-tracking-panel";
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
  initialView = "map",
}: {
  initialView?: "map" | "lifecycle" | "features";
}): ReactElement {
  const {
    error,
    graph,
    lifecycle,
    templateIntelligence,
  } = useHarnessOsData();
  const [activeView, setActiveView] = useState<"map" | "lifecycle" | "features">(initialView);
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            ["map", "Map"],
            ["lifecycle", "Lifecycle"],
            ["features", "Feature Registry"],
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
          <GraphWorkbench
            edges={model.edges}
            kinds={HARNESS_GRAPH_KINDS}
            nodes={model.nodes}
            telemetryLabel="HARNESS_MAP_OS"
          />
        ) : null}
        {activeView === "lifecycle" ? <HarnessLifecycleCockpit model={lifecycleModel} /> : null}
        {activeView === "features" ? <FeatureRegistry features={model.features} /> : null}
      </div>
    </div>
  );
}

export function HarnessGraphPanel(): ReactElement {
  return <HarnessOsPanel initialView="map" />;
}

export function RolloutSurface(): ReactElement {
  const { adoption, adoptionError } = useHarnessOsData();
  return (
    <HarnessRolloutPanel
      adoption={adoption}
      adoptionError={adoptionError}
    />
  );
}

export function HarnessRolloutSurface(): ReactElement {
  return <RolloutSurface />;
}

export function TemplateTrackingSurface(): ReactElement {
  const {
    adoption,
    graph,
    skillRollout,
    templateTracking,
    templateTrackingError,
  } = useHarnessOsData();
  return (
    <TemplateTrackingPanel
      adoption={adoption}
      graph={graph}
      skillRollout={skillRollout}
      templateTracking={templateTracking}
      error={templateTrackingError}
    />
  );
}

export function TemplateRolloutSurface(): ReactElement {
  return <TemplateTrackingSurface />;
}
