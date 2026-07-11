import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  messageWindowPathForSource,
  normalizeStoredMiningSource,
} from "./mining-sources";

describe("mining sources", () => {
  it("resolves safe Farplane message-window paths", () => {
    expect(
      messageWindowPathForSource({
        cwd: "/tmp/project",
        id: "thread-1",
        name: "Thread",
        preview: "Preview",
        sourceKind: "farplane-message-window",
      }),
    ).toBe(path.join("/tmp/project", ".farplane", "state", "message-windows", "thread-1.json"));
  });

  it("rejects unsafe message-window ids before building filesystem paths", () => {
    expect(() =>
      messageWindowPathForSource({
        cwd: "/tmp/project",
        id: "../thread-1",
        name: "Thread",
        preview: "Preview",
        sourceKind: "farplane-message-window",
      }),
    ).toThrow("unsafe_source_id");
  });

  it("normalizes stored message-window sources from mining artifacts", () => {
    expect(
      normalizeStoredMiningSource({
        sourceId: "thread-1",
        sourceKind: "message_window",
        name: "Thread",
        preview: "Preview",
      }),
    ).toEqual(
      expect.objectContaining({
        id: "thread-1",
        safeFileId: "thread-1",
        sourceKind: "farplane-message-window",
      }),
    );
  });

});
