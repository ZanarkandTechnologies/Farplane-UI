import { describe, expect, it } from "vitest";
import { worldProjectionQuery } from "./use-world-projection";

describe("world projection query", () => {
  it("keeps the canonical cache, staleness, and retry contract", () => {
    const query = worldProjectionQuery("/workspace/acme");
    expect(query.queryKey).toEqual(["farplane-world", "/workspace/acme"]);
    expect(query.staleTime).toBe(15_000);
    expect(query.retry).toBe(false);
  });
});
