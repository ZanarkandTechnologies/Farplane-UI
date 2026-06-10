import { describe, expect, it } from "vitest";

import { isConvexEnabled } from "./convex-provider";

describe("FarplaneConvexProvider", () => {
  it("keeps Convex disabled when no deployment URL is configured", () => {
    expect(isConvexEnabled()).toBe(false);
  });
});
