/** World map provider boundary: normalizes bridge input and reports vector-map readiness. */

export type WorldMapProviderConfig = {
  accessToken: string;
  configured: boolean;
  style: string;
};

export type WorldMapAvailability = "mapbox_unconfigured" | "ready" | "webgl2_unavailable";

const DEFAULT_MAPBOX_STYLE = "mapbox://styles/mapbox/standard";

export function parseWorldMapProviderConfig(input: unknown): WorldMapProviderConfig {
  const row =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const accessToken = typeof row.accessToken === "string" ? row.accessToken.trim() : "";
  const style =
    typeof row.style === "string" && row.style.trim() ? row.style.trim() : DEFAULT_MAPBOX_STYLE;
  return {
    accessToken,
    configured: row.configured === true && Boolean(accessToken),
    style,
  };
}

export function getWorldMapAvailability(input: {
  config: WorldMapProviderConfig | null | undefined;
  webgl2Supported: boolean;
}): WorldMapAvailability {
  if (!input.config?.configured) return "mapbox_unconfigured";
  return input.webgl2Supported ? "ready" : "webgl2_unavailable";
}

export function supportsWebGL2(): boolean {
  if (typeof document === "undefined" || typeof WebGL2RenderingContext === "undefined")
    return false;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl2", {
    failIfMajorPerformanceCaveat: true,
  });
  const supported = Boolean(context);
  context?.getExtension("WEBGL_lose_context")?.loseContext();
  return supported;
}
