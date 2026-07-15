import { describe, expect, it } from "vitest";

// The browser proof runs directly in Node, so its helper remains native ESM.
// @ts-expect-error The root TypeScript program does not emit declarations for .mjs proof helpers.
import { canonicalSidecarSnapshot } from "./canonical-sidecar-snapshot.mjs";

describe("canonical sidecar snapshot", () => {
  const settings = {
    officeKit: { revision: 3, status: "equipped" },
    decor: { wallColorId: "command_charcoal" },
  };
  const object = {
    id: "room",
    identifier: "room",
    meshType: "activity-landmark",
    position: [1, 0, 2],
    rotation: [0, 1, 0],
    scale: [1, 1, 1],
    metadata: { uiBinding: { panelId: "world", kind: "internalPanel" } },
  };

  it("ignores object-key and office-object collection order", () => {
    const first = canonicalSidecarSnapshot({ settings, objects: [object, { ...object, id: "a" }] });
    const second = canonicalSidecarSnapshot({
      settings: {
        decor: { wallColorId: "command_charcoal" },
        officeKit: { status: "equipped", revision: 3 },
      },
      objects: [{ ...object, id: "a" }, object],
    });

    expect(second).toBe(first);
  });

  it.each([
    ["rotation", { ...object, rotation: [0, 2, 0] }],
    ["scale", { ...object, scale: [2, 1, 1] }],
    ["metadata", { ...object, metadata: { uiBinding: { panelId: "evals" } } }],
  ])("detects hidden %s mutations", (_label, mutatedObject) => {
    expect(canonicalSidecarSnapshot({ settings, objects: [mutatedObject] })).not.toBe(
      canonicalSidecarSnapshot({ settings, objects: [object] }),
    );
  });

  it("detects nested settings mutations", () => {
    expect(
      canonicalSidecarSnapshot({
        settings: { ...settings, officeKit: { revision: 4, status: "equipped" } },
        objects: [object],
      }),
    ).not.toBe(canonicalSidecarSnapshot({ settings, objects: [object] }));
  });
});
