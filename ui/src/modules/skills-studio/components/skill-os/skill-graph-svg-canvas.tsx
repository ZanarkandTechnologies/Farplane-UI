"use client";

import { select, type ZoomBehavior, type ZoomTransform, zoom, zoomIdentity } from "d3";
import { ZoomIn, ZoomOut } from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { capabilityEdgePath } from "./capability-edge-routing";
import {
  capabilityClusterColor,
  capabilityDepartmentColor,
  capabilityNodeCaption,
  capabilityNodeLabel,
} from "./capability-map-model";
import {
  CAPABILITY_NEXUS_CENTER,
  CAPABILITY_NEXUS_COLORS,
  CAPABILITY_NEXUS_FLOW_IDS,
  createCapabilityNexusParticles,
} from "./capability-nexus-particles";
import { CapabilityNodeGlyph, splitCapabilityLabel } from "./capability-node-glyph";
import { shortLabel, TIER_LABELS, tierColor } from "./skill-os-constants";
import type { PositionedSkillNode, SkillGraphLayout } from "./skill-os-types";

const MAP_CENTER_X = CAPABILITY_NEXUS_CENTER.x;
const MAP_CENTER_Y = CAPABILITY_NEXUS_CENTER.y;

const AMBIENT_DUST = Array.from({ length: 62 }, (_, index) => {
  const angle = index * 2.399963229728653;
  const radius = 12 + ((index * 37) % 128);
  return {
    id: `dust-${index}`,
    opacity: 0.13 + ((index * 19) % 42) / 100,
    r: index % 9 === 0 ? 2 : index % 3 === 0 ? 1.2 : 0.65,
    x: MAP_CENTER_X + Math.cos(angle) * radius,
    y: MAP_CENTER_Y + Math.sin(angle) * radius * 0.64,
  };
});

const CAPABILITY_NEXUS_PARTICLES = createCapabilityNexusParticles();

function transformToSvg(transform: ZoomTransform): string {
  return `translate(${transform.x} ${transform.y}) scale(${transform.k})`;
}

function getFitTransform(layout: SkillGraphLayout, width: number, height: number): ZoomTransform {
  if (layout.nodes.length === 0 || width <= 0 || height <= 0) return zoomIdentity;
  const padding = 56;
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

function overviewLabelPosition(node: PositionedSkillNode): {
  anchor: "end" | "middle" | "start";
  x: number;
  y: number;
} {
  const angle = Math.atan2(node.y - MAP_CENTER_Y, node.x - MAP_CENTER_X);
  // Department branches travel radially outward; reserve the tangential side
  // of each core for its name so labels stay legible at atlas scale.
  const x = -Math.sin(angle) * (node.radius + 42);
  const y = Math.cos(angle) * (node.radius + 42);
  return {
    anchor: Math.abs(x) < 8 ? "middle" : x > 0 ? "start" : "end",
    x,
    y,
  };
}

function capabilityGraphArcId(renderKey: string): string {
  return `capability-graph-${renderKey.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function CapabilityGraphArc({
  active,
  color,
  d,
  dimmed,
  directed,
  reducedMotion,
  renderKey,
  semanticLabel,
  showPackets,
}: {
  active: boolean;
  color: string;
  d: string;
  dimmed: boolean;
  directed: boolean;
  reducedMotion: boolean;
  renderKey: string;
  semanticLabel: string;
  showPackets: boolean;
}): ReactElement {
  const id = capabilityGraphArcId(renderKey);
  const opacity = dimmed ? 0.1 : active ? 0.95 : 0.58;
  const duration = 4.8 + (renderKey.length % 4) * 0.4;

  return (
    <g pointerEvents="none">
      <title>{semanticLabel}</title>
      <path
        d={d}
        fill="none"
        pathLength={1}
        stroke={color}
        strokeDasharray="0.045 0.03"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={opacity * 0.24}
        strokeWidth={active ? 4.6 : 3.3}
      />
      <path
        id={id}
        d={d}
        fill="none"
        pathLength={1}
        stroke={color}
        strokeDasharray="0.045 0.03"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={opacity}
        strokeWidth={active ? 1.9 : 1.35}
        markerEnd={directed ? "url(#capability-artifact-flow-arrow)" : undefined}
      >
        {!reducedMotion && !dimmed ? (
          <animate
            attributeName="stroke-dashoffset"
            dur={`${duration}s`}
            from="0.15"
            repeatCount="indefinite"
            to="0"
          />
        ) : null}
      </path>
      {showPackets && !reducedMotion && !dimmed
        ? [0, 1].map((packetIndex) => (
            <circle
              key={`${id}-packet-${packetIndex}`}
              fill={color}
              filter="url(#capability-membership-packet-glow)"
              opacity={packetIndex === 0 ? 0.94 : 0.62}
              r={packetIndex === 0 ? 3.1 : 2.05}
            >
              <animateMotion
                begin={`-${packetIndex * (duration / 2)}s`}
                dur={`${duration}s`}
                path={d}
                repeatCount="indefinite"
              />
            </circle>
          ))
        : null}
    </g>
  );
}

export function SkillGraphSvgCanvas({
  edgeCount,
  graphNodeCount,
  graphTitle = "SKILL_GRAPH_OS",
  layout,
  onSelectSkill,
  query,
  queryMatches,
  radialMode,
  selectedSkillId,
}: {
  edgeCount: number;
  graphNodeCount: number;
  graphTitle?: string;
  layout: SkillGraphLayout;
  onSelectSkill: (skillId: string) => void;
  query: string;
  queryMatches: Set<string>;
  radialMode?: "focus" | "overview";
  selectedSkillId: string;
}): ReactElement {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity.translate(0, 0).scale(1));
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const hasQuery = query.trim().length > 0;
  const isCapabilityMap = Boolean(radialMode);
  const selectedNode = useMemo(
    () => layout.nodes.find((node) => node.id === selectedSkillId) ?? null,
    [layout.nodes, selectedSkillId],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.35, 3.8])
      .filter((event) => {
        // Nodes own clicks and keyboard selection. Let D3 handle only canvas
        // gestures, so zoom never suppresses a genuine node click as a pan.
        if (event.target instanceof Element && event.target.closest("[data-graph-node-id]")) {
          return false;
        }
        return (!event.ctrlKey || event.type === "wheel") && !event.button;
      })
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
    select(svg)
      .interrupt()
      .transition()
      .duration(480)
      .call(behavior.transform, getFitTransform(layout, box.width, box.height));
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

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

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

  function handleNodeKeyDown(event: KeyboardEvent<SVGElement>, skillId: string): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectSkill(skillId);
    }
  }

  return (
    <>
      {!isCapabilityMap ? (
        <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-md border bg-background/90 px-3 py-2 font-mono text-xs shadow">
          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400 motion-reduce:animate-none" />
          <span>{graphTitle}</span>
          <span className="text-muted-foreground">|</span>
          <span>{graphNodeCount} nodes</span>
          <span className="text-muted-foreground">|</span>
          <span>{edgeCount} vectors</span>
        </div>
      ) : null}

      <svg
        ref={svgRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        role="img"
        aria-label={
          radialMode ? "Capability department map" : "Skill OS force-directed skill graph"
        }
        data-testid="skill-os-graph-canvas"
      >
        <title>{radialMode ? "Capability department map" : graphTitle}</title>
        <g transform={transformToSvg(transform)}>
          <defs>
            <filter id="capability-nexus-glow" x="-120%" y="-120%" width="340%" height="340%">
              <feGaussianBlur stdDeviation="14" />
            </filter>
            <filter
              id="capability-membership-packet-glow"
              x="-300%"
              y="-300%"
              width="700%"
              height="700%"
            >
              <feGaussianBlur stdDeviation="2.1" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <marker
              id="capability-artifact-flow-arrow"
              markerHeight="7"
              markerUnits="strokeWidth"
              markerWidth="7"
              orient="auto"
              refX="6"
              refY="3.5"
              viewBox="0 0 7 7"
            >
              <path d="M 0 0 L 7 3.5 L 0 7 z" fill="context-stroke" />
            </marker>
          </defs>
          {radialMode === "overview" ? (
            <g pointerEvents="none">
              <circle
                cx={MAP_CENTER_X}
                cy={MAP_CENTER_Y}
                r={310}
                fill="none"
                opacity={0.08}
                stroke="#d8cfaa"
                strokeWidth={1}
              />
              <circle
                cx={MAP_CENTER_X}
                cy={MAP_CENTER_Y}
                r={166}
                fill="none"
                opacity={0.07}
                stroke="#d8cfaa"
                strokeDasharray="3 13"
                strokeWidth={1}
              />
              <g className="capability-nexus">
                <circle
                  cx={MAP_CENTER_X}
                  cy={MAP_CENTER_Y}
                  fill={CAPABILITY_NEXUS_COLORS.core}
                  filter="url(#capability-nexus-glow)"
                  opacity={0.12}
                  r={64}
                />
                {CAPABILITY_NEXUS_FLOW_IDS.map((flowId, path) => (
                  <g
                    key={flowId}
                    className="capability-nexus__flow"
                    style={{
                      animationDelay: `-${path * 1.8}s`,
                      animationDuration: `${19 + path * 1.9}s`,
                      transformOrigin: `${MAP_CENTER_X}px ${MAP_CENTER_Y}px`,
                    }}
                  >
                    {CAPABILITY_NEXUS_PARTICLES.filter((particle) => particle.path === path).map(
                      (particle) => (
                        <circle
                          key={particle.id}
                          className="capability-nexus__particle"
                          cx={particle.x}
                          cy={particle.y}
                          fill={particle.color}
                          r={particle.r}
                          style={
                            {
                              "--capability-nexus-opacity": particle.opacity,
                              animationDelay: `-${(particle.path * 0.37 + particle.r * 1.5).toFixed(2)}s`,
                            } as CSSProperties
                          }
                        />
                      ),
                    )}
                  </g>
                ))}
                <circle
                  cx={MAP_CENTER_X}
                  cy={MAP_CENTER_Y}
                  fill={CAPABILITY_NEXUS_COLORS.ivory}
                  opacity={0.55}
                  r={3}
                />
              </g>
              {AMBIENT_DUST.map((particle) => (
                <circle
                  key={particle.id}
                  cx={particle.x}
                  cy={particle.y}
                  fill="#f6eec7"
                  opacity={particle.opacity}
                  r={particle.r}
                />
              ))}
            </g>
          ) : null}
          {radialMode === "focus" ? (
            <g fill="none" pointerEvents="none" stroke="#d8cfaa">
              <path d="M172 620H1028" opacity={0.12} strokeDasharray="4 10" />
              <path d="M268 432C390 138 810 138 932 432" opacity={0.1} />
            </g>
          ) : null}
          <g>
            {layout.edges.map((edge) => {
              const source = layout.points.get(edge.source);
              const target = layout.points.get(edge.target);
              if (!source || !target) return null;
              const active = edge.source === selectedSkillId || edge.target === selectedSkillId;
              const searchDimmed =
                hasQuery && !queryMatches.has(edge.source) && !queryMatches.has(edge.target);
              const sourceNode = layout.nodes.find((node) => node.id === edge.source);
              const targetNode = layout.nodes.find((node) => node.id === edge.target);
              const isArtifact = targetNode?.kind === "artifact";
              const edgeColor = isCapabilityMap
                ? sourceNode?.kind === "department"
                  ? capabilityDepartmentColor(sourceNode)
                  : capabilityClusterColor(sourceNode ?? targetNode ?? { id: edge.source })
                : isArtifact
                  ? "#D8B86A"
                  : "#64748B";
              const stroke = edge.type === "common-chain" ? "#B45309" : edgeColor;
              const strokeOpacity = searchDimmed
                ? 0.1
                : active
                  ? 0.95
                  : isCapabilityMap
                    ? 0.52
                    : 0.42;
              return isCapabilityMap ? (
                <CapabilityGraphArc
                  key={edge.renderKey}
                  active={active}
                  color={stroke}
                  d={capabilityEdgePath(
                    source,
                    target,
                    edge.renderKey ?? `${edge.source}-${edge.target}`,
                  )}
                  dimmed={searchDimmed}
                  directed={edge.type === "artifact-flow"}
                  reducedMotion={reducedMotion}
                  renderKey={edge.renderKey ?? `${edge.source}-${edge.target}`}
                  semanticLabel={
                    edge.type === "artifact-flow"
                      ? `Declared artifact flow: ${edge.label ?? "artifact handoff"}`
                      : "Declared department membership"
                  }
                  showPackets={radialMode === "focus" && edge.type === "artifact-flow"}
                />
              ) : (
                <line
                  key={edge.renderKey}
                  stroke={stroke}
                  strokeDasharray={edge.type === "common-chain" ? "8 6" : undefined}
                  strokeOpacity={strokeOpacity}
                  strokeWidth={active ? 3 : 1.6}
                  x1={source.x}
                  x2={target.x}
                  y1={source.y}
                  y2={target.y}
                />
              );
            })}
          </g>
          <g>
            {layout.nodes.map((node) => {
              const selected = node.id === selectedSkillId;
              const searchDimmed = hasQuery && !queryMatches.has(node.id);
              const isArtifact = node.kind === "artifact";
              const isCapabilityDepartment = node.kind === "department";
              const isCapabilityNode = node.kind === "workstation" || node.kind === "facility";
              const nodeColor = isCapabilityMap
                ? isCapabilityDepartment
                  ? capabilityDepartmentColor(node)
                  : isCapabilityNode
                    ? capabilityClusterColor(node)
                    : "#d8cfaa"
                : isArtifact
                  ? "#D8B86A"
                  : tierColor(node.tier);
              const nodeLabel = isCapabilityMap
                ? capabilityNodeLabel(node).toUpperCase()
                : isCapabilityNode
                  ? (node.label ?? node.id)
                      .replace(/^skill:/, "")
                      .replaceAll("-", " ")
                      .toUpperCase()
                  : shortLabel(node.label ?? node.id);
              const labelLines = isCapabilityMap ? splitCapabilityLabel(nodeLabel) : [nodeLabel];
              const showOverviewRootLabel =
                isCapabilityMap && radialMode === "overview" && isCapabilityDepartment;
              const showNodeLabel =
                !isCapabilityMap ||
                showOverviewRootLabel ||
                (radialMode === "focus" && (isCapabilityDepartment || isCapabilityNode));
              const showCaption =
                !isCapabilityMap ||
                (radialMode === "focus" && (isCapabilityDepartment || isCapabilityNode));
              const overviewLabel = showOverviewRootLabel ? overviewLabelPosition(node) : null;
              const labelX = overviewLabel?.x ?? 0;
              const labelY = overviewLabel?.y ?? -node.radius - 12 - (labelLines.length - 1) * 6;
              const nodeType = isCapabilityMap
                ? capabilityNodeCaption(node)
                : (TIER_LABELS[node.tier ?? 3] ?? "SKILL");
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x} ${node.y})`}
                  data-graph-node-id={node.id}
                >
                  {isCapabilityMap ? <title>{nodeLabel}</title> : null}
                  {/* biome-ignore lint/a11y/useSemanticElements: SVG circles provide the correctly shaped, focusable target for graph nodes. */}
                  <circle
                    aria-label={`${nodeLabel}, ${nodeType}`}
                    className="cursor-pointer focus-visible:outline-none"
                    fill="rgba(0,0,0,0.001)"
                    r={node.radius + 16}
                    role="button"
                    tabIndex={0}
                    onBlur={() => setFocusedNodeId(null)}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onSelectSkill(node.id);
                    }}
                    onFocus={() => setFocusedNodeId(node.id)}
                    onKeyDown={(event) => handleNodeKeyDown(event, node.id)}
                  />
                  <g pointerEvents="none">
                    {focusedNodeId === node.id && !isCapabilityMap ? (
                      <circle
                        r={node.radius + 7}
                        fill="none"
                        stroke="#f6eec7"
                        strokeDasharray="3 2"
                        strokeWidth={1.5}
                      />
                    ) : null}
                    {focusedNodeId === node.id && isCapabilityMap ? (
                      <rect
                        fill="none"
                        height={(node.radius + 6) * 2}
                        rx={5}
                        stroke="#f6eec7"
                        strokeDasharray="3 2"
                        strokeWidth={1.5}
                        width={(node.radius + 6) * 2}
                        x={-node.radius - 6}
                        y={-node.radius - 6}
                      />
                    ) : null}
                    {isCapabilityMap ? (
                      <CapabilityNodeGlyph
                        node={node}
                        opacity={searchDimmed ? 0.26 : 1}
                        selected={selected}
                        stroke={nodeColor}
                      />
                    ) : (
                      <>
                        <circle
                          r={node.radius}
                          fill="hsl(var(--background))"
                          stroke={nodeColor}
                          opacity={searchDimmed ? 0.26 : 1}
                          strokeWidth={selected ? 6 : 1.7}
                          filter={
                            selected ? "drop-shadow(0 0 14px rgba(255,255,255,0.38))" : undefined
                          }
                        />
                        <circle
                          r={Math.max(6, node.radius * 0.38)}
                          fill={node.source === "external" ? "#020617" : nodeColor}
                          opacity={searchDimmed ? 0.32 : 1}
                        />
                      </>
                    )}
                    {showNodeLabel ? (
                      <text
                        x={labelX}
                        y={labelY}
                        textAnchor={overviewLabel?.anchor ?? "middle"}
                        className={
                          isCapabilityMap
                            ? "select-none fill-foreground font-mono text-[10px] font-semibold tracking-[0.15em]"
                            : "select-none fill-foreground font-mono text-[11px] font-bold"
                        }
                        opacity={searchDimmed ? 0.22 : 1}
                      >
                        {labelLines.map((line, index) => (
                          <tspan key={line} x={labelX} dy={index === 0 ? 0 : 11}>
                            {line}
                          </tspan>
                        ))}
                      </text>
                    ) : null}
                    {showCaption ? (
                      <text
                        y={node.radius + 17}
                        textAnchor="middle"
                        className={
                          isCapabilityMap
                            ? "select-none fill-muted-foreground font-mono text-[8px] font-semibold tracking-[0.14em]"
                            : "select-none fill-muted-foreground font-mono text-[9px] font-semibold"
                        }
                        opacity={searchDimmed ? 0.22 : 1}
                      >
                        {nodeType}
                      </text>
                    ) : null}
                  </g>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      <div
        className={
          isCapabilityMap
            ? "absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-1 rounded-md border bg-background/90 p-1 shadow-sm"
            : "absolute bottom-4 left-4 z-20 flex gap-2"
        }
      >
        <Button
          aria-label="Zoom in"
          className={isCapabilityMap ? "h-7 w-7 border-0 bg-transparent" : undefined}
          size="icon"
          variant="outline"
          onClick={() => zoomBy(1.25)}
        >
          <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          aria-label="Zoom out"
          className={isCapabilityMap ? "h-7 w-7 border-0 bg-transparent" : undefined}
          size="icon"
          variant="outline"
          onClick={() => zoomBy(0.8)}
        >
          <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          className={
            isCapabilityMap
              ? "h-7 border-0 bg-transparent px-2 font-mono text-[9px] tracking-[0.12em]"
              : undefined
          }
          size="sm"
          variant="outline"
          onClick={resetZoom}
        >
          {isCapabilityMap ? "FIT" : "Fit Map"}
        </Button>
      </div>

      {!isCapabilityMap ? (
        <div className="absolute bottom-4 right-4 z-20 hidden rounded-md border bg-background/90 px-3 py-2 font-mono text-xs text-muted-foreground sm:block">
          drag to pan / wheel to zoom
        </div>
      ) : null}
    </>
  );
}
