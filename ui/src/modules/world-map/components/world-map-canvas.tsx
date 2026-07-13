/** Leaflet leaf: renders the filtered CRM world projection over a reliable raster basemap. */

import L, { type LatLngBounds, type LayerGroup, type Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef } from "react";
import { worldGeoJson } from "../lib/world-projection";
import type { WorldEdge, WorldNode, WorldSelection } from "../types";
import "../world-map.css";

const DARK_MATTER_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

const NODE_COLORS: Record<string, string> = {
  company: "#f59e0b",
  facility: "#22c55e",
  person: "#a78bfa",
  product: "#fb7185",
};

function nodeColor(kind: string): string {
  return NODE_COLORS[kind.toLowerCase()] ?? "#38bdf8";
}

function fitPointBounds(map: LeafletMap, bounds: LatLngBounds): void {
  map.fitBounds(bounds.pad(0.1), {
    animate: false,
    maxZoom: 4,
    padding: [48, 48],
  });
}

function enableKeyboardSelection(
  element: Element | null | undefined,
  label: string,
  select: () => void,
): void {
  if (!(element instanceof SVGElement)) return;
  element.setAttribute("aria-label", label);
  element.setAttribute("role", "button");
  element.setAttribute("tabindex", "0");
  element.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    select();
  });
}

export function WorldMapCanvas(props: {
  edges: WorldEdge[];
  nodes: WorldNode[];
  onSelect: (selection: WorldSelection) => void;
}): React.JSX.Element {
  const containerRef = useRef<HTMLElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const graphLayerRef = useRef<LayerGroup | null>(null);
  const pointBoundsRef = useRef<LatLngBounds | null>(null);
  const latestSelect = useRef(props.onSelect);
  latestSelect.current = props.onSelect;
  const geoJson = useMemo(() => worldGeoJson(props.nodes, props.edges), [props.edges, props.nodes]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      attributionControl: true,
      maxBounds: [
        [-85, -180],
        [85, 180],
      ],
      maxBoundsViscosity: 1,
      preferCanvas: false,
      worldCopyJump: false,
      zoomControl: false,
    });
    L.tileLayer(DARK_MATTER_TILES, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      bounds: [
        [-85, -180],
        [85, 180],
      ],
      crossOrigin: true,
      maxZoom: 20,
      noWrap: true,
      subdomains: "abcd",
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.fitBounds(
      [
        [-60, -170],
        [75, 170],
      ],
      { animate: false, padding: [18, 18] },
    );

    mapRef.current = map;
    graphLayerRef.current = L.layerGroup().addTo(map);

    let resizeFrame: number | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        map.invalidateSize({ animate: false, pan: false });
        if (pointBoundsRef.current) fitPointBounds(map, pointBoundsRef.current);
        resizeFrame = null;
      });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      map.remove();
      graphLayerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const graphLayer = graphLayerRef.current;
    if (!map || !graphLayer) return;

    graphLayer.clearLayers();
    pointBoundsRef.current = null;

    for (const feature of geoJson.lines.features) {
      const [[sourceLongitude, sourceLatitude], [targetLongitude, targetLatitude]] =
        feature.geometry.coordinates;
      const line = L.polyline(
        [
          [sourceLatitude, sourceLongitude],
          [targetLatitude, targetLongitude],
        ],
        {
          className: "world-map-edge",
          color: "#22d3ee",
          dashArray: "7 11",
          lineCap: "round",
          opacity: 0.9,
          weight: 3.5,
        },
      );
      line.on("click", () => latestSelect.current({ type: "edge", key: feature.properties.key }));
      const lineTooltip = document.createElement("span");
      lineTooltip.textContent = `Mention: ${feature.properties.sourceName} → ${feature.properties.targetName} · ${feature.properties.context}`;
      line.bindTooltip(lineTooltip, {
        className: "world-map-context-tooltip",
        direction: "top",
        opacity: 0.96,
        sticky: true,
      });
      line.addTo(graphLayer);
      const lineElement = line.getElement();
      lineElement?.setAttribute("data-world-edge-key", feature.properties.key);
      lineElement?.setAttribute("data-world-edge-source", feature.properties.sourceName);
      lineElement?.setAttribute("data-world-edge-target", feature.properties.targetName);
      lineElement?.setAttribute("data-world-edge-flow", "mention-source-to-link-target");
      enableKeyboardSelection(
        lineElement,
        `Select association mention from ${feature.properties.sourceName} to ${feature.properties.targetName}: ${feature.properties.context}`,
        () => latestSelect.current({ type: "edge", key: feature.properties.key }),
      );
    }

    const showPermanentLabels = geoJson.points.features.length <= 20;
    for (const feature of geoJson.points.features) {
      const [longitude, latitude] = feature.geometry.coordinates;
      const marker = L.circleMarker([latitude, longitude], {
        className: "world-map-node",
        color: "#f8fafc",
        fillColor: nodeColor(feature.properties.kind),
        fillOpacity: 1,
        radius: 7,
        weight: 2,
      });
      marker.on("click", () => latestSelect.current({ type: "node", key: feature.properties.key }));
      const markerTooltip = document.createElement("span");
      markerTooltip.textContent = feature.properties.name;
      marker.bindTooltip(markerTooltip, {
        className: "world-map-node-label",
        direction: "auto",
        offset: [9, 0],
        opacity: 0.96,
        permanent: showPermanentLabels,
      });
      marker.addTo(graphLayer);
      const markerElement = marker.getElement();
      markerElement?.setAttribute("data-world-node-key", feature.properties.key);
      enableKeyboardSelection(markerElement, `Select ${feature.properties.name}`, () =>
        latestSelect.current({ type: "node", key: feature.properties.key }),
      );
    }

    if (geoJson.points.features.length > 0) {
      const bounds = L.latLngBounds(
        geoJson.points.features.map((feature) => [
          feature.geometry.coordinates[1],
          feature.geometry.coordinates[0],
        ]),
      );
      pointBoundsRef.current = bounds;
      fitPointBounds(map, bounds);
    }
  }, [geoJson]);

  return (
    <div className="world-map-leaflet relative h-full min-h-0 overflow-hidden rounded-md border bg-slate-950 sm:min-h-[280px] lg:min-h-[360px]">
      <section
        ref={containerRef}
        className="absolute inset-0"
        data-testid="world-map-canvas"
        aria-label="Enterprise and supply-chain entity map"
      />
      {geoJson.points.features.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-background/65 backdrop-blur-[1px]">
          <div className="rounded-md border bg-card px-4 py-3 text-center shadow-lg">
            <div className="text-sm font-medium">No plotted entities</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Unlocated entities remain in the results list.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
