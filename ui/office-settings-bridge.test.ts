import { describe, expect, it } from "vitest";

import { normalizeBridgeOfficeSettings } from "./office-settings-bridge";

describe("office settings bridge normalization", () => {
  it("preserves irregular officeLayout tiles instead of rebuilding from the bounding rectangle", () => {
    const normalized = normalizeBridgeOfficeSettings(
      {
        officeFootprint: { width: 35, depth: 35 },
        officeLayout: {
          version: 1,
          tileSize: 1,
          tiles: ["0:0", "1:0", "0:1"],
        },
        decor: {},
      },
      "/tmp/meshes",
    );

    expect(normalized.officeLayout.tiles).toEqual(["0:0", "1:0", "0:1"]);
    expect(normalized.officeFootprint).toEqual({ width: 2, depth: 2 });
  });

  it("preserves supported layout strategies", () => {
    expect(
      normalizeBridgeOfficeSettings(
        { layoutStrategy: "team_neighborhoods" },
        "/tmp/meshes",
      ).layoutStrategy,
    ).toBe("team_neighborhoods");
    expect(
      normalizeBridgeOfficeSettings(
        { layoutStrategy: "activity_treemap" },
        "/tmp/meshes",
      ).layoutStrategy,
    ).toBe("activity_treemap");
    expect(
      normalizeBridgeOfficeSettings(
        { layoutStrategy: "hierarchical_treemap" },
        "/tmp/meshes",
      ).layoutStrategy,
    ).toBe("hierarchical_treemap");
    expect(
      normalizeBridgeOfficeSettings(
        { layoutStrategy: "area_sorted_pack" },
        "/tmp/meshes",
      ).layoutStrategy,
    ).toBe("area_sorted_pack");
    expect(
      normalizeBridgeOfficeSettings({ layoutStrategy: "manual" }, "/tmp/meshes")
        .layoutStrategy,
    ).toBe("manual");
    expect(
      normalizeBridgeOfficeSettings(
        { layoutStrategy: "command_districts" },
        "/tmp/meshes",
      ).layoutStrategy,
    ).toBe("command_districts");
    expect(
      normalizeBridgeOfficeSettings(
        { layoutStrategy: "unknown" },
        "/tmp/meshes",
      ).layoutStrategy,
    ).toBe("team_neighborhoods");
  });
});
