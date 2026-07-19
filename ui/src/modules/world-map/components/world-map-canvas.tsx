/** Coordinates Mapbox configuration, first-paint loading, retry, and operator-facing errors. */

import { AlertTriangle, RotateCw } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/ui/button";
import { useWorldMapProvider } from "../hooks/use-world-map-provider";
import { getWorldMapAvailability, supportsWebGL2 } from "../lib/map-renderer";
import { worldGeoJson } from "../lib/world-projection";
import type { WorldEdge, WorldNode, WorldSelection } from "../types";
import "../world-map.css";

const LazyWorldMapMapboxCanvas = lazy(() =>
  import("./world-map-mapbox-canvas").then((module) => ({
    default: module.WorldMapMapboxCanvas,
  })),
);

type RendererState = "error" | "loading" | "ready";

function errorCopy(reason: string): string {
  if (reason === "mapbox_unconfigured") return "Add a Mapbox public token in Settings.";
  if (reason === "webgl2_unavailable")
    return "Turn on browser hardware acceleration, then reload the map.";
  if (reason === "provider_config_failed")
    return "Farplane could not read the map provider settings.";
  return "The vector map could not start. Check the provider connection and try again.";
}

export function WorldMapCanvas(props: {
  edges: WorldEdge[];
  nodes: WorldNode[];
  onSelect: (selection: WorldSelection) => void;
}): React.JSX.Element {
  const provider = useWorldMapProvider();
  const webgl2Supported = useMemo(() => supportsWebGL2(), []);
  const availability = getWorldMapAvailability({
    config: provider.data,
    webgl2Supported,
  });
  const [rendererState, setRendererState] = useState<RendererState>("loading");
  const [errorReason, setErrorReason] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const plottedCount = useMemo(
    () => worldGeoJson(props.nodes, props.edges).points.features.length,
    [props.edges, props.nodes],
  );

  useEffect(() => {
    if (provider.isError) {
      setErrorReason("provider_config_failed");
      setRendererState("error");
      return;
    }
    if (!provider.data) {
      setRendererState("loading");
      return;
    }
    if (availability !== "ready") {
      setErrorReason(availability);
      setRendererState("error");
      return;
    }
    if (
      errorReason === "mapbox_unconfigured" ||
      errorReason === "provider_config_failed" ||
      errorReason === "webgl2_unavailable"
    ) {
      setErrorReason("");
      setRendererState("loading");
    }
  }, [availability, errorReason, provider.data, provider.isError]);

  const mapboxActive = Boolean(
    provider.data &&
      !provider.isError &&
      availability === "ready" &&
      rendererState !== "error" &&
      !retrying,
  );

  const retry = async (): Promise<void> => {
    setErrorReason("");
    setRendererState("loading");
    setRetrying(true);
    await provider.refetch();
    setAttempt((value) => value + 1);
    setRetrying(false);
  };

  return (
    <div
      className="world-map-shell relative h-full min-h-0 overflow-hidden rounded-md border bg-slate-950 sm:min-h-[280px] lg:min-h-[360px]"
      data-testid="world-map-canvas"
      data-world-map-renderer={rendererState === "ready" ? "mapbox" : rendererState}
      data-world-map-status={errorReason || rendererState}
      data-world-map-attempt={attempt}
    >
      {mapboxActive && provider.data ? (
        <Suspense fallback={null}>
          <LazyWorldMapMapboxCanvas
            key={attempt}
            accessToken={provider.data.accessToken}
            styleUrl={provider.data.style}
            nodes={props.nodes}
            edges={props.edges}
            onSelect={props.onSelect}
            visible={rendererState === "ready"}
            onReady={() => setRendererState("ready")}
            onUnavailable={(reason) => {
              console.warn("[world-map] Vector renderer unavailable.", reason);
              setErrorReason(reason);
              setRendererState("error");
            }}
          />
        </Suspense>
      ) : null}

      {rendererState === "loading" ? (
        <div
          className="world-map-status absolute inset-0 z-20 flex items-center justify-center"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="world-map-loader__ring" aria-hidden="true" />
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-100">
                Loading vector map…
              </div>
              <div className="mt-1 text-[11px] text-slate-400">Preparing geographic layers…</div>
            </div>
          </div>
        </div>
      ) : null}

      {rendererState === "error" ? (
        <div className="world-map-status absolute inset-0 z-20 flex items-center justify-center p-6">
          <div
            className="max-w-sm rounded-md border border-slate-700/80 bg-slate-950/92 px-5 py-4 text-center shadow-2xl backdrop-blur-md"
            role="alert"
          >
            <AlertTriangle className="mx-auto size-5 text-amber-400" aria-hidden="true" />
            <div className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-100">
              Map unavailable
            </div>
            <p className="mt-1.5 text-xs leading-5 text-slate-400">{errorCopy(errorReason)}</p>
            <Button
              className="mt-4 h-8 gap-2"
              size="sm"
              variant="outline"
              onClick={() => void retry()}
            >
              <RotateCw className="size-3.5" aria-hidden="true" />
              Try Again
            </Button>
          </div>
        </div>
      ) : null}

      {rendererState === "ready" && plottedCount === 0 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 z-10 flex justify-center px-4">
          <div className="rounded-md border border-border/80 bg-card/92 px-4 py-2.5 text-center shadow-xl backdrop-blur-md">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
              No plotted entities
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Unlocated entities remain available in results.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
