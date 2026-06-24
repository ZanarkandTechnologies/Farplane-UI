"use client";

/**
 * THREAD LINEAGE TAB
 * ==================
 * Ownership: team-workspace module.
 * Inputs: active project id/name plus Convex hook telemetry projection.
 * Outputs: project-scoped Codex thread branch graph and lineage edge table.
 * Side effects: none; read-only Convex query.
 */

import { useMemo, type ReactElement } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  GraphWorkbench,
  type GraphWorkbenchEdge,
  type GraphWorkbenchNode,
} from "@/modules/graph-workbench";
import { isConvexEnabled } from "@/providers/convex-provider";

type ThreadLineageGraph = {
  nodes: Array<{
    id: string;
    kind: "thread" | "pending" | "unknown-parent";
    label: string;
    projectPath?: string;
    lastSeenAt: number;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    kind: "created" | "forked";
    eventAt: number;
    sourceTool: string;
    title?: string;
  }>;
  stats: {
    nodeCount: number;
    edgeCount: number;
    forkCount: number;
    createCount: number;
    orphanCount: number;
  };
};

type ThreadLineageTabProps = {
  isActive: boolean;
  projectId: string | null;
  projectName: string;
};

export function ThreadLineageTab({
  isActive,
  projectId,
  projectName,
}: ThreadLineageTabProps): ReactElement {
  const convexEnabled = isConvexEnabled();
  const canQuery = convexEnabled && isActive && Boolean(projectId);
  const graph = useQuery(
    api.modules.hookTelemetry.queries.getThreadLineageGraph,
    canQuery ? { projectId: projectId ?? undefined, rangeDays: 90, limit: 1_000 } : "skip",
  ) as ThreadLineageGraph | undefined;

  if (!projectId) {
    return (
      <StateCard
        detail="Select a project to inspect its Codex thread graph."
        title="No project selected"
      />
    );
  }

  if (!convexEnabled) {
    return (
      <StateCard
        detail="Project thread lineage is stored in Convex hook telemetry."
        title="Telemetry unavailable"
      />
    );
  }

  if (!graph) {
    return (
      <StateCard
        detail="Reading project thread lineage from hook telemetry."
        title="Loading threads"
      />
    );
  }

  if (graph.nodes.length === 0) {
    return (
      <StateCard
        detail="No fork or create relationships have been captured for this project yet."
        title="No thread lineage yet"
      />
    );
  }

  return <ThreadLineageGraphView graph={graph} projectName={projectName} />;
}

function ThreadLineageGraphView({
  graph,
  projectName,
}: {
  graph: ThreadLineageGraph;
  projectName: string;
}): ReactElement {
  const nodes = useMemo<GraphWorkbenchNode[]>(
    () =>
      graph.nodes.map((node) => ({
        id: node.id,
        kind: node.kind,
        label: node.label,
        path: node.projectPath ?? node.id,
        description: `${node.kind} observed ${formatDate(node.lastSeenAt)}`,
        weight: node.kind === "unknown-parent" ? 0 : 1,
      })),
    [graph.nodes],
  );
  const edges = useMemo<GraphWorkbenchEdge[]>(
    () =>
      graph.edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
        type: edge.kind,
        label: edge.title ?? edge.kind,
      })),
    [graph.edges],
  );

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3">
      <div className="grid gap-2 md:grid-cols-5">
        <LineageMetric label="nodes" value={graph.stats.nodeCount} />
        <LineageMetric label="edges" value={graph.stats.edgeCount} />
        <LineageMetric label="created" value={graph.stats.createCount} />
        <LineageMetric label="forked" value={graph.stats.forkCount} />
        <LineageMetric label="orphans" value={graph.stats.orphanCount} />
      </div>
      <GraphWorkbench
        telemetryLabel={`${projectName} thread lineage`}
        searchPlaceholder="Search project threads"
        kinds={[
          { id: "thread", label: "Thread", color: "#2563eb" },
          { id: "pending", label: "Pending", color: "#b45309" },
          { id: "unknown-parent", label: "Unknown", color: "#64748b" },
        ]}
        nodes={nodes}
        edges={edges}
      />
      <ThreadLineageEdges rows={graph.edges} />
    </div>
  );
}

function LineageMetric({ label, value }: { label: string; value: number }): ReactElement {
  return (
    <div className="rounded-md border bg-background/70 px-3 py-2">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="font-mono text-lg font-semibold">{value}</p>
    </div>
  );
}

function ThreadLineageEdges({ rows }: { rows: ThreadLineageGraph["edges"] }): ReactElement {
  return (
    <div className="max-h-[160px] overflow-hidden rounded-md border">
      <ScrollArea className="h-[160px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Child</TableHead>
              <TableHead>Title</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 80).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap text-xs">
                  {formatDate(row.eventAt)}
                </TableCell>
                <TableCell>
                  <Badge variant={row.kind === "forked" ? "secondary" : "outline"}>
                    {row.kind}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[220px] truncate font-mono text-xs">
                  {row.source}
                </TableCell>
                <TableCell className="max-w-[220px] truncate font-mono text-xs">
                  {row.target}
                </TableCell>
                <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">
                  {row.title ?? row.sourceTool}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

function StateCard({ detail, title }: { detail: string; title: string }): ReactElement {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function formatDate(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "unknown";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
