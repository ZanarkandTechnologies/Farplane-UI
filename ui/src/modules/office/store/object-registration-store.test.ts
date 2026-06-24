import { describe, expect, it } from "vitest";
import type * as THREE from "three";

import { useObjectRegistrationStore } from "./object-registration-store";

describe("object registration store", () => {
  it("skips no-op registration writes for the same object reference", () => {
    const store = useObjectRegistrationStore.getState();
    store.reset();
    const object = { name: "desk-1" } as THREE.Object3D;

    store.registerObject("desk-1", object);
    const firstMap = useObjectRegistrationStore.getState().registeredObjects;
    store.registerObject("desk-1", object);

    expect(useObjectRegistrationStore.getState().registeredObjects).toBe(
      firstMap,
    );
    expect(useObjectRegistrationStore.getState().registeredObjects.size).toBe(
      1,
    );
  });

  it("skips no-op unregister writes for missing ids", () => {
    const store = useObjectRegistrationStore.getState();
    store.reset();
    const firstMap = useObjectRegistrationStore.getState().registeredObjects;

    store.unregisterObject("missing");

    expect(useObjectRegistrationStore.getState().registeredObjects).toBe(
      firstMap,
    );
  });
});
