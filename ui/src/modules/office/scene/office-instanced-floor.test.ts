import { describe, expect, it } from "vitest";
import type { OfficeLayoutModel } from "@/modules/office/lib/office-layout";
import { buildOfficeFloorInstancePlan, resolveOfficeFloorTileKey } from "./office-instanced-floor";

function layout(tiles: string[]): OfficeLayoutModel {
  return { version: 1, tileSize: 1, tiles };
}

describe("buildOfficeFloorInstancePlan", () => {
  it("creates deterministic transforms and instance IDs from unsorted tiles", () => {
    const plan = buildOfficeFloorInstancePlan(
      layout(["2:1", "0:0", "-1:1", "invalid", "0:0"]),
      "sandstone_tiles",
      false,
    );

    expect(plan.tileKeys).toEqual(["0:0", "-1:1", "2:1"]);
    expect(plan.positions).toEqual([
      [0, -0.04, 0],
      [-1, -0.04, 1],
      [2, -0.04, 1],
    ]);
    expect(resolveOfficeFloorTileKey(plan, 0)).toBe("0:0");
    expect(resolveOfficeFloorTileKey(plan, 2)).toBe("2:1");
    expect(resolveOfficeFloorTileKey(plan, 3)).toBeNull();
    expect(resolveOfficeFloorTileKey(plan, -1)).toBeNull();
  });

  it("preserves each decor pattern's colors", () => {
    const tiles = layout(["0:0", "1:0", "1:1", "3:1"]);

    expect(buildOfficeFloorInstancePlan(tiles, "sandstone_tiles", false).colors).toEqual([
      "#efe2cc",
      "#d7c4a5",
      "#efe2cc",
      "#efe2cc",
    ]);
    expect(buildOfficeFloorInstancePlan(tiles, "graphite_grid", false).colors).toEqual([
      "#3d4953",
      "#3d4953",
      "#a9b6bf",
      "#3d4953",
    ]);
    expect(buildOfficeFloorInstancePlan(tiles, "walnut_parquet", false).colors).toEqual([
      "#c68e5b",
      "#c68e5b",
      "#8a5a3a",
      "#8a5a3a",
    ]);
  });

  it("uses the muted Builder color without changing instance order", () => {
    const officeLayout = layout(["1:0", "0:0"]);
    const normal = buildOfficeFloorInstancePlan(officeLayout, "sandstone_tiles", false);
    const builder = buildOfficeFloorInstancePlan(officeLayout, "sandstone_tiles", true);

    expect(builder.tileKeys).toEqual(normal.tileKeys);
    expect(builder.positions).toEqual(normal.positions);
    expect(builder.colors).toEqual(["#d9ddd8", "#d9ddd8"]);
  });
});
