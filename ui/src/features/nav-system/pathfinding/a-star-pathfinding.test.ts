import { beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

describe("a-star pathfinding initialization", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("reports grid readiness after initialization", async () => {
    const pathfinding = await import("./a-star-pathfinding");

    expect(pathfinding.isGridInitialized()).toBe(false);

    pathfinding.initializeGrid(10, []);

    expect(pathfinding.isGridInitialized()).toBe(true);
  });

  it("warns only once before the grid is initialized", async () => {
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
