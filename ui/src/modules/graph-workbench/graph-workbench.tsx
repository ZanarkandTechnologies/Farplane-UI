"use client";

import { select, type ZoomBehavior, type ZoomTransform, zoom, zoomIdentity } from "d3";
import { Search, ZoomIn, ZoomOut } from "lucide-react";
import { type KeyboardEvent, type ReactElement, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { buildGraphWorkbenchLayout } from "./layout";
import type { GraphWorkbenchEdge, GraphWorkbenchKind, GraphWorkbenchNode } from "./types";

function transformToSvg(transform: ZoomTransform): string {
  return `translate(${transform.x} ${transform.y}) scale(${transform.k})`;
}

function shortLabel(value: string): string {
  const trimmed = value.replace(/^file:/, "").replace(/^skill:/, "");
  const parts = trimmed.split("/");
  const last = parts[parts.length - 1] ?? trimmed;
  return last.length > 20 ? `${last.slice(0, 17)}...` : last;
}

function getFitTransform(
  nodes: Array<{ radius: number; x: number; y: number }>,
  width: number,
  height: number,
): ZoomTransform {
  if (nodes.length === 0 || width <= 0 || height <= 0) return zoomIdentity;
  const padding = 80;
  const minX = Math.min(...nodes.map((node) => node.x - node.radius));
  const maxX = Math.max(...nodes.map((node) => node.x + node.radius));
  const minY = Math.min(...nodes.map((node) => node.y - node.radius));
  const maxY = Math.max(...nodes.map((node) => node.y + node.radius));
  const graphWidth = Math.max(1, maxX - minX);
  const graphHeight = Math.max(1, maxY - minY);
  const scale = Math.min(
    1.85,
    Math.max(
      0.34,
      Math.min((width - padding * 2) / graphWidth, (height - padding * 2) / graphHeight),
    ),
  );
  return zoomIdentity
    .translate(width / 2 - ((minX + maxX) / 2) * scale, height / 2 - ((minY + maxY) / 2) * scale)
    .scale(scale);
}

function DetailPanel({
  edges,
  kindColors,
  node,
  onClose,
  onSelectNode,
}: {
  edges: GraphWorkbenchEdge[];
  kindColors: Map<string, string>;
  node: GraphWorkbenchNode;
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
}): ReactElement {
  const outgoing = edges.filter((edge) => edge.source === node.id);
  const incoming = edges.filter((edge) => edge.target === node.id);

  return (
    <div className="absolute right-4 top-16 z-30 grid h-[72%] w-[min(38rem,48%)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-md border bg-background/96 shadow-2xl">
      <div className="flex min-w-0 items-start justify-between gap-3 border-b bg-muted/25 px-4 py-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words text-lg font-semibold">{node.label}</h3>
            <Badge style={{ backgroundColor: kindColors.get(node.kind), color: "white" }}>
              {node.kind}
            </Badge>
          </div>
          <p className="mt-1 break-all text-xs text-muted-foreground">{node.path ?? node.id}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
      <ScrollArea className="min-h-0">
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md border p-3">
              <p className="text-[10px] uppercase text-muted-foreground">Kind</p>
              <p className="truncate text-lg font-semibold">{node.kind}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-[10px] uppercase text-muted-foreground">Outgoing</p>
              <p className="text-2xl font-semibold">{outgoing.length}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-[10px] uppercase text-muted-foreground">Incoming</p>
              <p className="text-2xl font-semibold">{incoming.length}</p>
            </div>
          </div>

          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Summary</h4>
            <p className="text-sm leading-6 text-muted-foreground">
              {node.description ?? "No embedded summary is available for this graph node yet."}
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Links</h4>
            <div className="space-y-2">
              {[...outgoing.slice(0, 10), ...incoming.slice(0, 10)].map((edge) => {
                const target = edge.source === node.id ? edge.target : edge.source;
                return (
                  <button
                    key={`${edge.source}:${edge.target}:${edge.type}:${edge.label}`}
                    type="button"
                    className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/30"
                    onClick={() => onSelectNode(target)}
                  >
                    <span className="truncate">{target}</span>
                    <Badge variant="outline">{edge.type ?? "edge"}</Badge>
                  </button>
                );
              })}
              {outgoing.length + incoming.length === 0 ? (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  No graph links for this node in the current filter.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

export function GraphWorkbench({
  edges,
  kinds,
  nodes,
  telemetryLabel,
}: {
  edges: GraphWorkbenchEdge[];
  kinds: GraphWorkbenchKind[];
  nodes: GraphWorkbenchNode[];
  telemetryLabel: string;
}): ReactElement {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [activeKinds, setActiveKinds] = useState<Set<string>>(
    () => new Set(kinds.map((kind) => kind.id)),
  );
  const [query, setQuery] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const kindColors = useMemo(
    () => new Map(kinds.map((kind) => [kind.id, kind.color] as const)),
    [kinds],
  );

  const visibleNodes = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    return nodes.filter((node) => {
      if (!activeKinds.has(node.kind)) return false;
      if (!lowerQuery) return true;
      return [node.id, node.label, node.path, node.description, node.kind]
        .join(" ")
        .toLowerCase()
        .includes(lowerQuery);
    });
  }, [activeKinds, nodes, query]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(
    () => edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)),
    [edges, visibleNodeIds],
  );
  const layout = useMemo(
    () => buildGraphWorkbenchLayout(visibleNodes, visibleEdges),
    [visibleEdges, visibleNodes],
  );
  const selectedNode =
    layout.nodes.find((node) => node.id === selectedNodeId) ??
    nodes.find((node) => node.id === selectedNodeId) ??
    null;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.32, 4])
      .on("zoom", (event) => setTransform(event.transform));
    zoomBehaviorRef.current = behavior;
    select(svg).call(behavior);
    return () => {
      select(svg).on(".zoom", null);
    };
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    const behavior = zoomBehaviorRef.current;
    if (!svg || !behavior || selectedNode) return;
    const box = svg.getBoundingClientRect();
    select(svg).call(behavior.transform, getFitTransform(layout.nodes, box.width, box.height));
  }, [layout.nodes, selectedNode]);

  useEffect(() => {
    const svg = svgRef.current;
    const behavior = zoomBehaviorRef.current;
    const selectedPosition = layout.nodes.find((node) => node.id === selectedNodeId);
    if (!svg || !behavior || !selectedPosition) return;
    const box = svg.getBoundingClientRect();
    const next = zoomIdentity
      .translate(box.width / 2 - selectedPosition.x * 1.08, box.height / 2 - selectedPosition.y * 1.08)
      .scale(1.08);
    select(svg).transition().duration(340).call(behavior.transform, next);
  }, [layout.nodes, selectedNodeId]);

  function zoomBy(factor: number): void {
    const svg = svgRef.current;
    const behavior = zoomBehaviorRef.current;
    if (!svg || !behavior) return;
    select(svg).transition().duration(180).call(behavior.scaleBy, factor);
  }

  function resetZoom(): void {
    const svg = svgRef.current;
    const behavior = zoomBehaviorRef.current;
    if (!svg || !behavior) return;
    const box = svg.getBoundingClientRect();
    select(svg).transition().duration(260).call(behavior.transform, getFitTransform(layout.nodes, box.width, box.height));
  }

  function toggleKind(kind: string): void {
    setActiveKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  function handleNodeKeyDown(event: KeyboardEvent<SVGGElement>, nodeId: string): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedNodeId(nodeId);
    }
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[20rem_minmax(0,1fr)] overflow-hidden rounded-md border bg-background">
      <aside className="flex min-h-0 flex-col border-r bg-muted/15">
        <div className="space-y-3 border-b p-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 font-mono text-sm outline-none focus:border-primary"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search harness"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {kinds.map((kind) => (
              <button
                key={kind.id}
                type="button"
                className={`rounded-md border px-2 py-1 text-xs ${activeKinds.has(kind.id) ? "bg-primary/10" : "opacity-45"}`}
                onClick={() => toggleKind(kind.id)}
              >
                <span
                  className="mr-1 inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: kind.color }}
                />
                {kind.label}
              </button>
            ))}
          </div>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-2 p-2">
            {visibleNodes.slice(0, 160).map((node) => (
              <button
                key={node.id}
                type="button"
                className={`grid w-full min-w-0 gap-1 rounded-md border px-3 py-2.5 text-left text-sm hover:bg-muted/40 ${
                  selectedNodeId === node.id ? "border-primary bg-primary/10" : "border-transparent"
                }`}
                onClick={() => setSelectedNodeId(node.id)}
              >
                <span className="flex min-w-0 items-start justify-between gap-2">
                  <span className="truncate font-medium leading-5">{node.label}</span>
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: kindColors.get(node.kind) }}
                  />
                </span>
                <span className="truncate text-xs text-muted-foreground">{node.path ?? node.kind}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
        <div className="grid grid-cols-2 gap-2 border-t p-3 text-xs">
          <div className="rounded-md border p-2">
            <p className="uppercase text-muted-foreground">nodes</p>
            <p className="text-lg font-semibold">{visibleNodes.length}</p>
          </div>
          <div className="rounded-md border p-2">
            <p className="uppercase text-muted-foreground">edges</p>
            <p className="text-lg font-semibold">{visibleEdges.length}</p>
          </div>
        </div>
      </aside>

      <main className="relative min-h-0 overflow-hidden bg-[radial-gradient(circle_at_center,hsl(var(--muted))_1px,transparent_1px)] [background-size:18px_18px]">
        <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-md border bg-background/90 px-3 py-2 font-mono text-xs shadow">
          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
          <span>{telemetryLabel}</span>
          <span className="text-muted-foreground">|</span>
          <span>{visibleNodes.length} nodes</span>
          <span className="text-muted-foreground">|</span>
          <span>{visibleEdges.length} vectors</span>
        </div>

        <svg
          ref={svgRef}
          className="h-full w-full cursor-grab active:cursor-grabbing"
          role="img"
          aria-label={`${telemetryLabel} force-directed graph`}
          data-testid="graph-workbench-canvas"
        >
          <title>{telemetryLabel} force-directed graph</title>
          <g transform={transformToSvg(transform)}>
            <g>
              {layout.edges.map((edge) => {
                const source = layout.points.get(edge.source);
                const target = layout.points.get(edge.target);
                if (!source || !target) return null;
                const active = edge.source === selectedNodeId || edge.target === selectedNodeId;
                return (
                  <line
                    key={edge.renderKey}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={edge.type === "feature-surface" ? "#B45309" : "#64748B"}
                    strokeDasharray={edge.type === "directory-contains" ? "6 6" : undefined}
                    strokeOpacity={active ? 0.95 : 0.36}
                    strokeWidth={active ? 3 : 1.45}
                  />
                );
              })}
            </g>
            <g>
              {layout.nodes.map((node) => {
                const selected = node.id === selectedNodeId;
                return (
                  <g
                    key={node.id}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer"
                    transform={`translate(${node.x} ${node.y})`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedNodeId(node.id);
                    }}
                    onKeyDown={(event) => handleNodeKeyDown(event, node.id)}
                  >
                    <circle r={node.radius + 15} fill="transparent" />
                    <circle
                      r={node.radius}
                      fill="hsl(var(--background))"
                      stroke={kindColors.get(node.kind) ?? "#94A3B8"}
                      strokeWidth={selected ? 6 : 3}
                    />
                    <circle
                      r={Math.max(5, node.radius * 0.34)}
                      fill={kindColors.get(node.kind) ?? "#94A3B8"}
                    />
                    <text
                      y={-node.radius - 10}
                      textAnchor="middle"
                      className="select-none fill-foreground font-mono text-[10px] font-bold"
                    >
                      {shortLabel(node.label)}
                    </text>
                    <text
                      y={node.radius + 17}
                      textAnchor="middle"
                      className="select-none fill-muted-foreground font-mono text-[9px] font-semibold"
                    >
                      {node.kind.toUpperCase()}
                    </text>
                  </g>
                );
              })}
            </g>
          </g>
        </svg>

        <div className="absolute bottom-4 left-4 z-20 flex gap-2">
          <Button size="icon" variant="outline" onClick={() => zoomBy(1.25)}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={() => zoomBy(0.8)}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={resetZoom}>
            Fit
          </Button>
        </div>

        {selectedNode ? (
          <DetailPanel
            edges={visibleEdges}
            kindColors={kindColors}
            node={selectedNode}
            onClose={() => setSelectedNodeId("")}
            onSelectNode={setSelectedNodeId}
          />
        ) : null}
      </main>
    </div>
  );
}
