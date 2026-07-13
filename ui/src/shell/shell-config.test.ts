import { describe, expect, it } from "vitest";

import { getRegisteredModuleIds, moduleRegistry } from "./module-registry";
import { DEFAULT_FARPLANE_UI_CONFIG, normalizeFarplaneUiConfig } from "./shell-config";

describe("Farplane shell config", () => {
  it("uses office3d local defaults with registered modules", () => {
    expect(DEFAULT_FARPLANE_UI_CONFIG).toEqual({
      accessMode: "operator",
      renderer: "office3d",
      persistence: "local",
      modules: getRegisteredModuleIds(),
    });
  });

  it("exposes World through office-object entry surfaces", () => {
    expect(moduleRegistry.world.surfaces).toContain("office-object");
  });

  it("keeps valid renderer, persistence, and registered module ids", () => {
    expect(
      normalizeFarplaneUiConfig({
        accessMode: "public",
        renderer: "standard",
        persistence: "cloud",
        modules: ["runtime", "chat"],
      }),
    ).toEqual({
      accessMode: "public",
      renderer: "standard",
      persistence: "cloud",
      modules: ["runtime", "chat"],
    });
  });

  it("falls back when config contains unknown renderer, persistence, or modules", () => {
    expect(
      normalizeFarplaneUiConfig({
        accessMode: "guest",
        renderer: "console",
        persistence: "jsonl",
        modules: ["console", "shop"],
      }),
    ).toEqual(DEFAULT_FARPLANE_UI_CONFIG);
  });
});
