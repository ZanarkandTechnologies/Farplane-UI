/**
 * OFFICE SCENE BOOTSTRAP
 * ======================
 * Ref and initialization wiring for office objects and nav-grid startup.
 *
 * KEY CONCEPTS:
 * - Scene bootstrap is coordinated once here instead of being scattered through render branches.
 * - New startup phases should expose one readiness signal rather than introducing local loaders.
 *
 * USAGE:
 * - Call from `scene-contents.tsx`.
 * - Pass `createRegisteredObjectRef` into object renderer components.
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 * - MEM-0150
 */

import type { OrbitControls } from "@react-three/drei";
import { createRef, useCallback, useEffect, useMemo, useRef } from "react";
import type * as THREE from "three";
import { initializeGrid } from "@/modules/navigation/pathfinding/a-star-pathfinding";
import type { OfficeLayoutModel } from "@/modules/office/lib/office-layout";
import { useObjectRegistrationStore } from "@/modules/office/store/object-registration-store";

export function useOfficeSceneBootstrap(params: {
  officeLayout: OfficeLayoutModel;
  officeObjectIds: string[];
  officeObjectSignature: string;
  onNavigationReady?: () => void;
  onNavigationReset?: () => void;
}): {
  orbitControlsRef: React.RefObject<React.ElementRef<typeof OrbitControls> | null>;
  floorRef: React.RefObject<THREE.Mesh | null>;
  createRegisteredObjectRef: (
    objectId: string,
    objectRef: React.MutableRefObject<THREE.Group | null>,
  ) => (element: THREE.Group | null) => void;
  getObjectRef: (objectId: string) => React.RefObject<THREE.Group | null>;
} {
  const {
    officeLayout,
    officeObjectIds,
    officeObjectSignature,
    onNavigationReady,
    onNavigationReset,
  } = params;
  const orbitControlsRef = useRef<React.ElementRef<typeof OrbitControls>>(null);
  const floorRef = useRef<THREE.Mesh>(null);
  const officeObjectRefs = useRef<Map<string, React.RefObject<THREE.Group | null>>>(new Map());
  const registeredRefCallbacks = useRef<Map<string, (element: THREE.Group | null) => void>>(
    new Map(),
  );

  const registerObject = useObjectRegistrationStore((state) => state.registerObject);
  const unregisterObject = useObjectRegistrationStore((state) => state.unregisterObject);
  const expectedObjectIdSignature = useMemo(
    () => [...officeObjectIds].sort().join("|"),
    [officeObjectIds],
  );
  const navigationEpoch = useMemo(
    () =>
      buildOfficeNavigationEpoch({
        officeLayout,
        officeObjectSignature,
        expectedObjectIdSignature,
      }),
    [expectedObjectIdSignature, officeLayout, officeObjectSignature],
  );
  const expectedObjectsRegistered = useObjectRegistrationStore((state) =>
    officeObjectIds.every((objectId) => state.registeredObjects.has(objectId)),
  );
  const resetEpochRef = useRef<string | null>(null);
  const initializedEpochRef = useRef<string | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    const registered = useObjectRegistrationStore.getState().registeredObjects;
    const probe = window as Window & {
      __FARPLANE_OFFICE_NAVIGATION__?: Record<string, unknown>;
    };
    probe.__FARPLANE_OFFICE_NAVIGATION__ = {
      epoch: navigationEpoch,
      expectedIds: officeObjectIds,
      registeredIds: [...registered.keys()],
      missingIds: officeObjectIds.filter((objectId) => !registered.has(objectId)),
      ready: initializedEpochRef.current === navigationEpoch,
    };
    return () => {
      delete probe.__FARPLANE_OFFICE_NAVIGATION__;
    };
  }, [expectedObjectsRegistered, navigationEpoch, officeObjectIds]);

  const getObjectRef = useCallback((objectId: string) => {
    const existing = officeObjectRefs.current.get(objectId);
    if (existing) return existing;
    const created = createRef<THREE.Group>();
    officeObjectRefs.current.set(objectId, created);
    return created;
  }, []);

  const createRegisteredObjectRef = useCallback(
    (objectId: string, objectRef: React.MutableRefObject<THREE.Group | null>) => {
      const cached = registeredRefCallbacks.current.get(objectId);
      if (cached) return cached;
      const callback = (element: THREE.Group | null) => {
        objectRef.current = element;
        if (element) {
          registerObject(objectId, element);
        } else {
          unregisterObject(objectId);
        }
      };
      registeredRefCallbacks.current.set(objectId, callback);
      return callback;
    },
    [registerObject, unregisterObject],
  );

  useEffect(() => {
    if (resetEpochRef.current !== navigationEpoch) {
      resetEpochRef.current = navigationEpoch;
      initializedEpochRef.current = null;
      onNavigationReset?.();
    }
    if (!expectedObjectsRegistered || initializedEpochRef.current === navigationEpoch) return;

    const objects = selectRegisteredNavigationObjects(
      officeObjectIds,
      useObjectRegistrationStore.getState().registeredObjects,
    );
    if (!objects) return;

    initializeGrid(officeLayout, objects, 2, 3);
    initializedEpochRef.current = navigationEpoch;
    onNavigationReady?.();
  }, [
    expectedObjectsRegistered,
    navigationEpoch,
    officeLayout,
    officeObjectIds,
    onNavigationReady,
    onNavigationReset,
  ]);

  return {
    orbitControlsRef,
    floorRef,
    createRegisteredObjectRef,
    getObjectRef,
  };
}

export function buildOfficeNavigationEpoch(input: {
  officeLayout: OfficeLayoutModel;
  officeObjectSignature: string;
  expectedObjectIdSignature: string;
}): string {
  return [
    input.officeLayout.tiles.join(","),
    input.officeObjectSignature,
    input.expectedObjectIdSignature,
  ].join("::");
}

export function selectRegisteredNavigationObjects(
  expectedObjectIds: string[],
  registeredObjects: ReadonlyMap<string, THREE.Object3D>,
): THREE.Object3D[] | null {
  const objects: THREE.Object3D[] = [];
  for (const objectId of expectedObjectIds) {
    const object = registeredObjects.get(objectId);
    if (!object) return null;
    objects.push(object);
  }
  return objects;
}
