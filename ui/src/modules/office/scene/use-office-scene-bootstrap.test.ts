import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createRectangularOfficeLayout } from "@/modules/office/lib/office-layout";
import {
  buildOfficeNavigationEpoch,
  selectRegisteredNavigationObjects,
} from "./use-office-scene-bootstrap";

describe("office scene navigation readiness", () => {
  it("changes epochs for layout, object geometry, or expected identity changes", () => {
    const layout = createRectangularOfficeLayout({ width: 3, depth: 3 });
    const baseline = buildOfficeNavigationEpoch({
      officeLayout: layout,
      officeObjectSignature: "objects-v1",
      expectedObjectIdSignature: "a|b",
    });

    expect(
      buildOfficeNavigationEpoch({
        officeLayout: { ...layout, tiles: layout.tiles.slice(1) },
        officeObjectSignature: "objects-v1",
        expectedObjectIdSignature: "a|b",
      }),
    ).not.toBe(baseline);
    expect(
      buildOfficeNavigationEpoch({
        officeLayout: layout,
        officeObjectSignature: "objects-v2",
        expectedObjectIdSignature: "a|b",
      }),
    ).not.toBe(baseline);
    expect(
      buildOfficeNavigationEpoch({
        officeLayout: layout,
        officeObjectSignature: "objects-v1",
        expectedObjectIdSignature: "a|c",
      }),
    ).not.toBe(baseline);
  });

  it("requires every exact expected id and ignores stale extra registrations", () => {
    const a = new THREE.Group();
    const b = new THREE.Group();
    const stale = new THREE.Group();
    const registered = new Map<string, THREE.Object3D>([
      ["a", a],
      ["b", b],
      ["stale", stale],
    ]);

    expect(selectRegisteredNavigationObjects(["a", "b"], registered)).toEqual([a, b]);
    expect(selectRegisteredNavigationObjects(["a", "replacement"], registered)).toBeNull();
    expect(selectRegisteredNavigationObjects([], registered)).toEqual([]);
  });
});
