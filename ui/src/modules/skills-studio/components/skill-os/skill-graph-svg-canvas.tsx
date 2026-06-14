"use client";

import { select, type ZoomBehavior, type ZoomTransform, zoom, zoomIdentity } from "d3";
import { ZoomIn, ZoomOut } from "lucide-react";
import { type KeyboardEvent, type ReactElement, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { shortLabel, TIER_LABELS, tierColor } from "./skill-os-constants";
import type { SkillGraphLayout } from "./skill-os-types";

function transformToSvg(transform: ZoomTransform): string {
  return `translate(${transform.x} ${transform.y}) scale(${transform.k})`;
}

function getFitTransform(layout: SkillGraphLayout, width: number, height: number): ZoomTransform {
  if (layout.nodes.length === 0 || width <= 0 || height <= 0) return zoomIdentity;
  const padding = 72;
  const minX = Math.min(...layout.nodes.map((node) => node.x - node.radius));
  const maxX = Math.max(...layout.nodes.map((node) => node.x + node.radius));
  const minY = Math.min(...layout.nodes.map((node) => node.y - node.radius));
  const maxY = Math.max(...layout.nodes.map((node) => node.y + node.radius));
  const graphWidth = Math.max(1, maxX - minX);
  const graphHeight = Math.max(1, maxY - minY);
  const scale = Math.min(
    1.9,
    Math.max(
      0.35,
      Math.min((width - padding * 2) / graphWidth, (height - padding * 2) / graphHeight),
    ),
  );
  return zoomIdentity
    .translate(width / 2 - ((minX + maxX) / 2) * scale, height / 2 - ((minY + maxY) / 2) * scale)
    .scale(scale);
}

export function SkillGraphSvgCanvas({
  edgeCount,
  graphNodeCount,
  layout,
  onSelectSkill,
  query,
  queryMatches,
  selectedSkillId,
}: {
  edgeCount: number;
  graphNodeCount: number;
  layout: SkillGraphLayout;
  onSelectSkill: (skillId: string) => void;
  query: string;
  queryMatches: Set<string>;
  selectedSkillId: string;
}): ReactElement {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity.translate(0, 0).scale(1));

  const hasQuery = query.trim().length > 0;
  const selectedNode = useMemo(
    () => layout.nodes.find((node) => node.id === selectedSkillId) ?? null,
    [layout.nodes, selectedSkillId],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.35, 3.8])
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
    select(svg).call(behavior.transform, getFitTransform(layout, box.width, box.height));
  }, [layout, selectedNode]);

  useEffect(() => {
    const svg = svgRef.current;
    const behavior = zoomBehaviorRef.current;
    if (!svg || !behavior || !selectedNode) return;
    const box = svg.getBoundingClientRect();
    const next = zoomIdentity
      .translate(box.width / 2 - selectedNode.x * 1.12, box.height / 2 - selectedNode.y * 1.12)
      .scale(1.12);
    select(svg).transition().duration(420).call(behavior.transform, next);
  }, [selectedNode]);

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
    select(svg)
      .transition()
      .duration(260)
      .call(behavior.transform, getFitTransform(layout, box.width, box.height));
  }

  function handleNodeKeyDown(event: KeyboardEvent<SVGGElement>, skillId: string): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectSkill(skillId);
    }
  }

  return (
    <>
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-md border bg-background/90 px-3 py-2 font-mono text-xs shadow">
        <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
        <span>SKILL_GRAPH_OS</span>
        <span className="text-muted-foreground">|</span>
        <span>{graphNodeCount} nodes</span>
        <span className="text-muted-foreground">|</span>
        <span>{edgeCount} vectors</span>
      </div>

      <svg
        ref={svgRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        role="img"
        aria-label="Skill OS force-directed skill graph"
        data-testid="skill-os-graph-canvas"
      >
        <title>Skill OS force-directed skill graph</title>
        <g transform={transformToSvg(transform)}>
          <g>
            {layout.edges.map((edge) => {
              const source = layout.points.get(edge.source);
              const target = layout.points.get(edge.target);
              if (!source || !target) return null;
              const active = edge.source === selectedSkillId || edge.target === selectedSkillId;
              const searchDimmed =
                hasQuery && !queryMatches.has(edge.source) && !queryMatches.has(edge.target);
              return (
                <line
                  key={edge.renderKey}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={edge.type === "common-chain" ? "#B45309" : "#64748B"}
                  strokeDasharray={edge.type === "common-chain" ? "8 6" : undefined}
                  strokeOpacity={searchDimmed ? 0.1 : active ? 0.95 : 0.42}
                  strokeWidth={active ? 3 : 1.6}
                />
              );
            })}
          </g>
          <g>
            {layout.nodes.map((node) => {
              const selected = node.id === selectedSkillId;
              const searchDimmed = hasQuery && !queryMatches.has(node.id);
              return (
                // biome-ignore lint/a11y/useSemanticElements: SVG graph nodes need group-level pointer and keyboard handling inside the canvas.
                <g
                  key={node.id}
                  transform={`translate(${node.x} ${node.y})`}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectSkill(node.id);
                  }}
                  onKeyDown={(event) => handleNodeKeyDown(event, node.id)}
                >
                  <circle r={node.radius + 16} fill="transparent" />
                  <circle
                    r={node.radius}
                    fill="hsl(var(--background))"
                    stroke={tierColor(node.tier)}
                    opacity={searchDimmed ? 0.26 : 1}
                    strokeWidth={selected ? 6 : 3}
                    filter={selected ? "drop-shadow(0 0 14px rgba(255,255,255,0.38))" : undefined}
                  />
                  <circle
                    r={Math.max(6, node.radius * 0.38)}
                    fill={node.source === "external" ? "#020617" : tierColor(node.tier)}
                    opacity={searchDimmed ? 0.32 : 1}
                  />
                  <text
                    y={-node.radius - 10}
                    textAnchor="middle"
                    className="select-none fill-foreground font-mono text-[11px] font-bold"
                    opacity={searchDimmed ? 0.22 : 1}
                  >
                    {shortLabel(node.id)}
                  </text>
                  <text
                    y={node.radius + 17}
                    textAnchor="middle"
                    className="select-none fill-muted-foreground font-mono text-[9px] font-semibold"
                    opacity={searchDimmed ? 0.22 : 1}
                  >
                    {TIER_LABELS[node.tier ?? 3] ?? "SKILL"}
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
          Fit graph
        </Button>
      </div>

      <div className="absolute bottom-4 right-4 z-20 rounded-md border bg-background/90 px-3 py-2 font-mono text-xs text-muted-foreground">
        drag to pan / wheel to zoom
      </div>
    </>
  );
}
