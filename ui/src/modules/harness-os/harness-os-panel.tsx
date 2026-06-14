"use client";

import { Network } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraphWorkbench } from "@/modules/graph-workbench";
import { buildHarnessOsModel, HARNESS_GRAPH_KINDS } from "./harness-os-model";
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

export function HarnessOsPanel(): ReactElement {
  const { error, graph, templateIntelligence } = useHarnessOsData();
  const [activeTab, setActiveTab] = useState("graph");
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
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <TabsList className="w-fit max-w-full flex-wrap justify-start">
          <TabsTrigger value="graph">Graph</TabsTrigger>
          <TabsTrigger value="features">Feature Registry</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Network className="h-4 w-4 text-primary" />
          Farplane-wide harness map
        </div>
      </div>

      <SummaryStrip generatedAt={model.generatedAt} summary={model.summary} />

      <TabsContent value="graph" className="mt-3 min-h-0 flex-1">
        <GraphWorkbench
          edges={model.edges}
          kinds={HARNESS_GRAPH_KINDS}
          nodes={model.nodes}
          telemetryLabel="HARNESS_GRAPH_OS"
        />
      </TabsContent>
      <TabsContent value="features" className="mt-3 min-h-0 flex-1">
        <FeatureRegistry features={model.features} />
      </TabsContent>
    </Tabs>
  );
}
