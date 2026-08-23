import { describe, expect, it } from "vitest";
import { capabilityEdgePath } from "./capability-edge-routing";

describe("capability edge routing", () => {
  it("keeps the explicit source and target as the only semantic endpoints", () => {
    const path = capabilityEdgePath({ x: 600, y: 620 }, { x: 292, y: 420 }, "social-carousel");

    expect(path).toMatch(/^M 600 620/);
    expect(path).toMatch(/Q /);
    expect(path).toMatch(/292 420$/);
    expect(path).not.toContain(" L ");
  });

  it("keeps short edges direct", () => {
    expect(capabilityEdgePath({ x: 1, y: 2 }, { x: 20, y: 20 }, "short")).toBe("M 1 2 L 20 20");
  });
});
