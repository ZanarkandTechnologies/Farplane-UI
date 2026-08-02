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

  it("registers Farplane Radio as shared HUD chrome", () => {
    expect(moduleRegistry.soundtrack.surfaces).toEqual(["hud"]);
    expect(DEFAULT_FARPLANE_UI_CONFIG.modules).toContain("soundtrack");
  });

  it("registers Finance as shared panel and HUD chrome", () => {
    expect(moduleRegistry.finance.surfaces).toEqual(["nav", "panel", "hud"]);
    expect(DEFAULT_FARPLANE_UI_CONFIG.modules).toContain("finance");
  });

  it("registers Video Intelligence for panel, HUD, and office-object launch", () => {
    expect(moduleRegistry["video-intelligence"].surfaces).toEqual([
      "panel",
      "hud",
      "office-object",
    ]);
    expect(DEFAULT_FARPLANE_UI_CONFIG.modules).toContain("video-intelligence");
  });

  it("registers Realtime Call for its roster HUD and employee actions", () => {
    expect(moduleRegistry["realtime-call"].surfaces).toEqual(["hud", "office-object"]);
    expect(DEFAULT_FARPLANE_UI_CONFIG.modules).toContain("realtime-call");
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
