"use client";

import { select, type ZoomBehavior, type ZoomTransform, zoom, zoomIdentity } from "d3";
import { Search, ZoomIn, ZoomOut } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
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
  kindForegrounds,
  node,
  onClose,
  onSelectNode,
  renderNodeActions,
}: {
  edges: GraphWorkbenchEdge[];
  kindColors: Map<string, string>;
  kindForegrounds: Map<string, string>;
  node: GraphWorkbenchNode;
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
  renderNodeActions?: (node: GraphWorkbenchNode) => ReactNode;
}): ReactElement {
  const outgoing = edges.filter((edge) => edge.source === node.id);
  const incoming = edges.filter((edge) => edge.target === node.id);

  return (
    <div className="absolute inset-x-3 top-16 z-30 grid h-[72%] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-md border bg-background/96 shadow-2xl md:inset-x-auto md:right-4 md:w-[min(38rem,48%)]">
      <div className="flex min-w-0 items-start justify-between gap-3 border-b bg-muted/25 px-4 py-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words text-lg font-semibold">{node.label}</h3>
            <Badge
              style={{
                backgroundColor: kindColors.get(node.kind),
                color: kindForegrounds.get(node.kind),
              }}
            >
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

          {renderNodeActions?.(node)}

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
  searchPlaceholder = "Search harness",
  telemetryLabel,
  renderNodeActions,
}: {
  edges: GraphWorkbenchEdge[];
  kinds: GraphWorkbenchKind[];
  nodes: GraphWorkbenchNode[];
  searchPlaceholder?: string;
  telemetryLabel: string;
  renderNodeActions?: (node: GraphWorkbenchNode) => ReactNode;
}): ReactElement {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const arrowMarkerId = `graph-arrow-${useId().replaceAll(":", "")}`;
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [activeKinds, setActiveKinds] = useState<Set<string>>(
    () => new Set(kinds.map((kind) => kind.id)),
  );
  const [query, setQuery] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [reduceMotion, setReduceMotion] = useState(false);
  const kindColors = useMemo(
    () => new Map(kinds.map((kind) => [kind.id, kind.color] as const)),
    [kinds],
  );
  const kindForegrounds = useMemo(
    () => new Map(kinds.map((kind) => [kind.id, kind.foreground ?? "white"] as const)),
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

  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map((node) => node.id)),
    [visibleNodes],
  );
  const visibleEdges = useMemo(
    () =>
      edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)),
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
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

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
    const fit = () => {
      const box = svg.getBoundingClientRect();
      select(svg).call(behavior.transform, getFitTransform(layout.nodes, box.width, box.height));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [layout.nodes, selectedNode]);

  useEffect(() => {
    const svg = svgRef.current;
    const behavior = zoomBehaviorRef.current;
    const selectedPosition = layout.nodes.find((node) => node.id === selectedNodeId);
    if (!svg || !behavior || !selectedPosition) return;
    const box = svg.getBoundingClientRect();
    const next = zoomIdentity
      .translate(
        box.width / 2 - selectedPosition.x * 1.08,
        box.height / 2 - selectedPosition.y * 1.08,
      )
      .scale(1.08);
    const selection = select(svg);
    if (reduceMotion) selection.call(behavior.transform, next);
    else selection.transition().duration(340).call(behavior.transform, next);
  }, [layout.nodes, reduceMotion, selectedNodeId]);

  function zoomBy(factor: number): void {
    const svg = svgRef.current;
    const behavior = zoomBehaviorRef.current;
    if (!svg || !behavior) return;
    const selection = select(svg);
    if (reduceMotion) selection.call(behavior.scaleBy, factor);
    else selection.transition().duration(180).call(behavior.scaleBy, factor);
  }

  function resetZoom(): void {
    const svg = svgRef.current;
    const behavior = zoomBehaviorRef.current;
    if (!svg || !behavior) return;
    const box = svg.getBoundingClientRect();
    const next = getFitTransform(layout.nodes, box.width, box.height);
    const selection = select(svg);
    if (reduceMotion) selection.call(behavior.transform, next);
    else selection.transition().duration(260).call(behavior.transform, next);
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
    <div className="grid h-full min-h-0 grid-rows-[12rem_minmax(0,1fr)] overflow-hidden rounded-md border bg-background md:grid-cols-[16rem_minmax(0,1fr)] md:grid-rows-1">
      <aside className="flex min-h-0 flex-col border-b bg-muted/15 md:border-b-0 md:border-r">
        <div className="space-y-3 border-b p-4">
          <div className="flex items-center gap-2">
            <Search aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
            <input
              aria-label="Search graph nodes"
              autoComplete="off"
              className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 font-mono text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
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
                <span className="truncate text-xs text-muted-foreground">
                  {node.path ?? node.kind}
                </span>
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
          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400 motion-reduce:animate-none" />
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
          <desc>
            {visibleEdges
              .filter((edge) => edge.directed)
              .slice(0, 20)
              .map(
                (edge) =>
                  `${edge.source} to ${edge.target}, ${edge.label ?? edge.type ?? "handoff"}`,
              )
              .join("; ") || "No directed handoffs in the current view."}
          </desc>
          <defs>
            <marker
              id={arrowMarkerId}
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M 0 0 L 7 3.5 L 0 7 z" fill="context-stroke" />
            </marker>
          </defs>
          <g transform={transformToSvg(transform)}>
            <g>
              {layout.edges.map((edge) => {
                const source = layout.points.get(edge.source);
                const target = layout.points.get(edge.target);
                if (!source || !target) return null;
                const sourceNode = layout.nodes.find((node) => node.id === edge.source);
                const targetNode = layout.nodes.find((node) => node.id === edge.target);
                const dx = target.x - source.x;
                const dy = target.y - source.y;
                const distance = Math.hypot(dx, dy) || 1;
                const sourceOffset = edge.directed ? (sourceNode?.radius ?? 0) + 3 : 0;
                const targetOffset = edge.directed ? (targetNode?.radius ?? 0) + 7 : 0;
                const active = edge.source === selectedNodeId || edge.target === selectedNodeId;
                return (
                  <line
                    key={edge.renderKey}
                    x1={source.x + (dx / distance) * sourceOffset}
                    y1={source.y + (dy / distance) * sourceOffset}
                    x2={target.x - (dx / distance) * targetOffset}
                    y2={target.y - (dy / distance) * targetOffset}
                    markerEnd={edge.directed ? `url(#${arrowMarkerId})` : undefined}
                    stroke={edge.color ?? (edge.type === "feature-surface" ? "#B45309" : "#64748B")}
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
                  // biome-ignore lint/a11y/useSemanticElements: SVG graph nodes cannot render HTML buttons inside the SVG tree.
                  <g
                    key={node.id}
                    role="button"
                    aria-label={`Inspect ${node.label}, ${node.kind}`}
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
          <Button size="icon" variant="outline" aria-label="Zoom in" onClick={() => zoomBy(1.25)}>
            <ZoomIn aria-hidden="true" className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" aria-label="Zoom out" onClick={() => zoomBy(0.8)}>
            <ZoomOut aria-hidden="true" className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={resetZoom}>
            Fit
          </Button>
        </div>

        {selectedNode ? (
          <DetailPanel
            edges={visibleEdges}
            kindColors={kindColors}
            kindForegrounds={kindForegrounds}
            node={selectedNode}
            onClose={() => setSelectedNodeId("")}
            onSelectNode={setSelectedNodeId}
            renderNodeActions={renderNodeActions}
          />
        ) : null}
      </main>
    </div>
  );
}
