import { describe, expect, it } from "vitest";
import { canCreateWebGlContext } from "./office-webgl-support";

describe("canCreateWebGlContext", () => {
  it("returns false without a document", () => {
    expect(canCreateWebGlContext(undefined)).toBe(false);
  });

  it("returns true when a browser can create a WebGL context", () => {
    const documentRef = {
      createElement: () => ({
        getContext: (kind: string) => (kind === "webgl" ? {} : null),
      }),
    } as unknown as Document;

    expect(canCreateWebGlContext(documentRef)).toBe(true);
  });

  it("returns false when context creation throws", () => {
    const documentRef = {
      createElement: () => ({
        getContext: () => {
          throw new Error("webgl_unavailable");
        },
      }),
    } as unknown as Document;

    expect(canCreateWebGlContext(documentRef)).toBe(false);
  });
});
