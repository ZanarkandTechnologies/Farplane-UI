/**
 * Mapbox GL World renderer.
 * Inputs: normalized project GeoJSON plus a browser-safe public Mapbox token.
 * Outputs: an interactive vector map; side effects are Mapbox network/GPU work and selection events.
 * Invariant: readiness is reported only after the style and requested tiles reach an idle painted state.
 */

import mapboxgl, { type GeoJSONSource, type Map as MapboxMap } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useMemo, useRef } from "react";
import { worldGeoJson } from "../lib/world-projection";
import type { WorldEdge, WorldNode, WorldSelection } from "../types";
import "../world-map.css";

const POINTS_SOURCE_ID = "farplane-world-points";
const LINES_SOURCE_ID = "farplane-world-lines";
const EDGE_BACKGROUND_LAYER_ID = "farplane-world-edge-background";
const EDGE_FLOW_LAYER_ID = "farplane-world-edge-flow";
const NODE_LAYER_ID = "farplane-world-nodes";
const NODE_LABEL_LAYER_ID = "farplane-world-node-labels";
const MAPBOX_READY_TIMEOUT_MS = 15_000;

const DASH_ARRAY_SEQUENCE: number[][] = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0],
  [0, 0.5, 3, 3.5],
  [0, 1, 3, 3],
  [0, 1.5, 3, 2.5],
  [0, 2, 3, 2],
  [0, 2.5, 3, 1.5],
  [0, 3, 3, 1],
  [0, 3.5, 3, 0.5],
];

type WorldGeoJson = ReturnType<typeof worldGeoJson>;

function fitProjection(map: MapboxMap, geoJson: WorldGeoJson): void {
  if (geoJson.points.features.length === 0) {
    map.fitBounds(
      [
        [-175, -58],
        [175, 78],
      ],
      { duration: 0, padding: 24 },
    );
    return;
  }

  const bounds = new mapboxgl.LngLatBounds();
  for (const feature of geoJson.points.features) bounds.extend(feature.geometry.coordinates);
  map.fitBounds(bounds, {
    duration: 0,
    maxZoom: 4,
    padding: 56,
  });
}

function syncProjection(map: MapboxMap, geoJson: WorldGeoJson): void {
  const points = map.getSource(POINTS_SOURCE_ID) as GeoJSONSource | undefined;
  const lines = map.getSource(LINES_SOURCE_ID) as GeoJSONSource | undefined;
  points?.setData(geoJson.points);
  lines?.setData(geoJson.lines);
  if (map.getLayer(NODE_LABEL_LAYER_ID)) {
    map.setLayoutProperty(
      NODE_LABEL_LAYER_ID,
      "visibility",
      geoJson.points.features.length <= 20 ? "visible" : "none",
    );
  }
  fitProjection(map, geoJson);
}

function featureKey(feature: mapboxgl.MapboxGeoJSONFeature | undefined): string {
  const key = feature?.properties?.key;
  return typeof key === "string" ? key : "";
}

export function WorldMapMapboxCanvas(props: {
  accessToken: string;
  edges: WorldEdge[];
  nodes: WorldNode[];
  onReady: () => void;
  onSelect: (selection: WorldSelection) => void;
  onUnavailable: (reason: string) => void;
  styleUrl: string;
  visible: boolean;
}): React.JSX.Element {
  const containerRef = useRef<HTMLElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const styleReadyRef = useRef(false);
  const latestGeoJson = useRef<WorldGeoJson>(worldGeoJson(props.nodes, props.edges));
  const latestReady = useRef(props.onReady);
  const latestSelect = useRef(props.onSelect);
  const latestUnavailable = useRef(props.onUnavailable);
  latestReady.current = props.onReady;
  latestSelect.current = props.onSelect;
  latestUnavailable.current = props.onUnavailable;
  const geoJson = useMemo(() => worldGeoJson(props.nodes, props.edges), [props.edges, props.nodes]);
  latestGeoJson.current = geoJson;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    let map: MapboxMap;
    let ready = false;
    let animationFrame: number | null = null;
    let resizeFrame: number | null = null;
    let step = -1;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const fail = (reason: string): void => {
      if (!ready) latestUnavailable.current(reason);
    };

    try {
      map = new mapboxgl.Map({
        accessToken: props.accessToken,
        attributionControl: false,
        center: [0, 18],
        config: {
          basemap: {
            lightPreset: "night",
            show3dObjects: false,
            showIndoor: false,
            showLandmarkIcons: false,
            showPedestrianRoads: false,
            showPointOfInterestLabels: false,
            showTransitLabels: false,
            theme: "monochrome",
          },
        },
        container,
        failIfMajorPerformanceCaveat: true,
        maxBounds: [
          [-180, -85],
          [180, 85],
        ],
        maxPitch: 60,
        pitch: 0,
        projection: "mercator",
        renderWorldCopies: false,
        style: props.styleUrl,
        zoom: 1.5,
      });
    } catch (error) {
      latestUnavailable.current(
        error instanceof Error ? error.message : "mapbox_initialization_failed",
      );
      return;
    }

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "bottom-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");

    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: "world-map-mapbox-popup",
      offset: 12,
    });

    const animateFlow = (timestamp: number): void => {
      if (!map.getLayer(EDGE_FLOW_LAYER_ID)) return;
      const nextStep = Math.floor(timestamp / 70) % DASH_ARRAY_SEQUENCE.length;
      if (nextStep !== step) {
        map.setPaintProperty(EDGE_FLOW_LAYER_ID, "line-dasharray", DASH_ARRAY_SEQUENCE[nextStep]);
        step = nextStep;
      }
      animationFrame = requestAnimationFrame(animateFlow);
    };

    const handleLoad = (): void => {
      try {
        const current = latestGeoJson.current;
        map.addSource(POINTS_SOURCE_ID, { type: "geojson", data: current.points });
        map.addSource(LINES_SOURCE_ID, { type: "geojson", data: current.lines });
        map.addLayer({
          id: EDGE_BACKGROUND_LAYER_ID,
          type: "line",
          source: LINES_SOURCE_ID,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#0891b2",
            "line-emissive-strength": 1,
            "line-opacity": 0.28,
            "line-width": 5,
          },
        });
        map.addLayer({
          id: EDGE_FLOW_LAYER_ID,
          type: "line",
          source: LINES_SOURCE_ID,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#67e8f9",
            "line-dasharray": reducedMotion ? [2, 3] : DASH_ARRAY_SEQUENCE[0],
            "line-emissive-strength": 1,
            "line-opacity": 0.95,
            "line-width": 3,
          },
        });
        map.addLayer({
          id: NODE_LAYER_ID,
          type: "circle",
          source: POINTS_SOURCE_ID,
          paint: {
            "circle-color": [
              "match",
              ["downcase", ["get", "kind"]],
              "company",
              "#f59e0b",
              "facility",
              "#22c55e",
              "person",
              "#a78bfa",
              "product",
              "#fb7185",
              "#38bdf8",
            ],
            "circle-emissive-strength": 1,
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 6, 6, 9],
            "circle-stroke-color": "#f8fafc",
            "circle-stroke-opacity": 0.95,
            "circle-stroke-width": 2,
          },
        });
        map.addLayer({
          id: NODE_LABEL_LAYER_ID,
          type: "symbol",
          source: POINTS_SOURCE_ID,
          layout: {
            "text-anchor": "left",
            "text-field": ["get", "name"],
            "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
            "text-offset": [1.1, 0],
            "text-size": 12,
            visibility: current.points.features.length <= 20 ? "visible" : "none",
          },
          paint: {
            "text-color": "#f8fafc",
            "text-halo-color": "#020617",
            "text-halo-width": 1.5,
          },
        });
        styleReadyRef.current = true;
        syncProjection(map, current);

        map.on("click", (event) => {
          const features = map.queryRenderedFeatures(event.point, {
            layers: [NODE_LAYER_ID, EDGE_FLOW_LAYER_ID],
          });
          const node = features.find((feature) => feature.layer.id === NODE_LAYER_ID);
          const nodeKey = featureKey(node);
          if (nodeKey) {
            latestSelect.current({ type: "node", key: nodeKey });
            return;
          }
          const edgeKey = featureKey(
            features.find((feature) => feature.layer.id === EDGE_FLOW_LAYER_ID),
          );
          if (edgeKey) latestSelect.current({ type: "edge", key: edgeKey });
        });
        map.on("mouseenter", NODE_LAYER_ID, (event) => {
          map.getCanvas().style.cursor = "pointer";
          const feature = event.features?.[0];
          const coordinates =
            feature?.geometry.type === "Point" ? feature.geometry.coordinates : null;
          const name = feature?.properties?.name;
          if (coordinates && typeof name === "string") {
            popup.setLngLat([coordinates[0], coordinates[1]]).setText(name).addTo(map);
          }
        });
        map.on("mouseleave", NODE_LAYER_ID, () => {
          map.getCanvas().style.cursor = "";
          popup.remove();
        });
        map.on("mouseenter", EDGE_FLOW_LAYER_ID, (event) => {
          map.getCanvas().style.cursor = "pointer";
          const properties = event.features?.[0]?.properties;
          const text = properties
            ? `Mention: ${properties.sourceName} → ${properties.targetName} · ${properties.context}`
            : "Association mention";
          popup.setLngLat(event.lngLat).setText(text).addTo(map);
        });
        map.on("mouseleave", EDGE_FLOW_LAYER_ID, () => {
          map.getCanvas().style.cursor = "";
          popup.remove();
        });

        map.once("idle", () => {
          ready = true;
          latestReady.current();
          if (!reducedMotion) animationFrame = requestAnimationFrame(animateFlow);
        });
      } catch (error) {
        fail(error instanceof Error ? error.message : "mapbox_layer_setup_failed");
      }
    };

    const handleError = (): void => fail("mapbox_prepaint_error");
    const handleContextLost = (event: Event): void => {
      event.preventDefault();
      latestUnavailable.current("webgl_context_lost");
    };
    const readyTimeout = window.setTimeout(
      () => fail("mapbox_first_paint_timeout"),
      MAPBOX_READY_TIMEOUT_MS,
    );
    map.on("load", handleLoad);
    map.on("error", handleError);
    map.getCanvas().addEventListener("webglcontextlost", handleContextLost);
    map.getCanvas().setAttribute("data-world-map-engine", "mapbox-gl");

    const resizeObserver = new ResizeObserver(() => {
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        map.resize();
        if (styleReadyRef.current) fitProjection(map, latestGeoJson.current);
        resizeFrame = null;
      });
    });
    resizeObserver.observe(container);

    return () => {
      window.clearTimeout(readyTimeout);
      resizeObserver.disconnect();
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      popup.remove();
      map.getCanvas().removeEventListener("webglcontextlost", handleContextLost);
      map.remove();
      styleReadyRef.current = false;
      mapRef.current = null;
    };
  }, [props.accessToken, props.styleUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    syncProjection(map, geoJson);
  }, [geoJson]);

  return (
    <section
      ref={containerRef}
      className={`absolute inset-0 transition-opacity duration-300 ${props.visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
      data-testid="world-map-mapbox-canvas"
      aria-label="Enterprise and supply-chain entity vector map"
    />
  );
}
