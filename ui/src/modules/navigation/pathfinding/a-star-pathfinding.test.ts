import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { officeLayoutTileKey, type OfficeLayoutModel } from "@/modules/office/lib/office-layout";

function createLayout(tiles: Array<[number, number]>): OfficeLayoutModel {
  return {
    version: 1,
    tileSize: 1,
    tiles: tiles.map(([x, z]) => officeLayoutTileKey(x, z)),
  };
}

describe("a-star pathfinding initialization", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports grid readiness after initialization", async () => {
    const pathfinding = await import("./a-star-pathfinding");

    expect(pathfinding.isGridInitialized()).toBe(false);

    pathfinding.initializeGrid(10, []);

    expect(pathfinding.isGridInitialized()).toBe(true);
  });

  it("supports rectangular footprints", async () => {
    const pathfinding = await import("./a-star-pathfinding");

    pathfinding.initializeGrid({ width: 12, depth: 8 }, []);
    const grid = pathfinding.getGridData();

    expect(grid.floorWidth).toBe(12);
    expect(grid.floorDepth).toBe(8);
    expect(grid.gridWidth).toBe(24);
    expect(grid.gridDepth).toBe(16);
  });

  it("treats positions outside the layout bounds as invalid instead of clamping to an edge", async () => {
    const pathfinding = await import("./a-star-pathfinding");

    pathfinding.initializeGrid(createLayout([[0, 0]]), []);

    expect(pathfinding.isWorldPositionWalkable(new THREE.Vector3(0, 0, 0))).toBe(true);
    expect(pathfinding.isWorldPositionWalkable(new THREE.Vector3(4, 0, 0))).toBe(false);
  });

  it("does not bridge separated layout islands", async () => {
    const pathfinding = await import("./a-star-pathfinding");

    pathfinding.initializeGrid(
      createLayout([
        [0, 0],
        [4, 0],
      ]),
      [],
    );

    const path = pathfinding.findPathAStar(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(4, 0, 0),
      { silent: true },
    );

    expect(path).toBeNull();
  });

  it("keeps layout-backed paths away from outer wall edge cells when scene padding is requested", async () => {
    const pathfinding = await import("./a-star-pathfinding");

    pathfinding.initializeGrid(
      createLayout([
        [0, 0],
        [1, 0],
        [2, 0],
        [0, 1],
        [1, 1],
        [2, 1],
        [0, 2],
        [1, 2],
        [2, 2],
      ]),
      [],
      2,
    );

    expect(pathfinding.isWorldPositionWalkable(new THREE.Vector3(1, 0, 1))).toBe(true);
    expect(pathfinding.isWorldPositionWalkable(new THREE.Vector3(0, 0, 1))).toBe(false);
  });

  it("keeps pre-initialization path requests quiet by default", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pathfinding = await import("./a-star-pathfinding");
    const start = new THREE.Vector3(0, 0, 0);
    const end = new THREE.Vector3(1, 0, 1);

    expect(pathfinding.findPathAStar(start, end)).toBeNull();
    expect(pathfinding.findPathAStar(start, end)).toBeNull();

    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("warns only once before the grid is initialized when diagnostics are enabled", async () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => (key === "farplane.debug.pathfinding" ? "1" : null),
      },
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pathfinding = await import("./a-star-pathfinding");
    const start = new THREE.Vector3(0, 0, 0);
    const end = new THREE.Vector3(1, 0, 1);

    expect(pathfinding.findPathAStar(start, end)).toBeNull();
    expect(pathfinding.findPathAStar(start, end)).toBeNull();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain("A* grid not initialized yet");

    warnSpy.mockRestore();
  });
});
