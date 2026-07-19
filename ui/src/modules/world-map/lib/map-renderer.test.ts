import { describe, expect, it } from "vitest";
import { getWorldMapAvailability, parseWorldMapProviderConfig } from "./map-renderer";

describe("world map renderer selection", () => {
  it("normalizes a configured Mapbox provider", () => {
    const config = parseWorldMapProviderConfig({
      configured: true,
      accessToken: " pk.example ",
      style: " mapbox://styles/example/operations ",
    });

    expect(config).toEqual({
      configured: true,
      accessToken: "pk.example",
      style: "mapbox://styles/example/operations",
    });
    expect(getWorldMapAvailability({ config, webgl2Supported: true })).toBe("ready");
  });

  it("does not trust a configured flag without a token", () => {
    const config = parseWorldMapProviderConfig({ configured: true });

    expect(config.configured).toBe(false);
    expect(config.style).toBe("mapbox://styles/mapbox/standard");
    expect(getWorldMapAvailability({ config, webgl2Supported: true })).toBe("mapbox_unconfigured");
  });

  it("reports unavailable WebGL2 instead of selecting another renderer", () => {
    const config = parseWorldMapProviderConfig({
      configured: true,
      accessToken: "pk.example",
    });

    expect(getWorldMapAvailability({ config, webgl2Supported: false })).toBe("webgl2_unavailable");
  });

  it("treats malformed bridge input as an unconfigured provider", () => {
    expect(parseWorldMapProviderConfig(null)).toEqual({
      configured: false,
      accessToken: "",
      style: "mapbox://styles/mapbox/standard",
    });
  });
});
