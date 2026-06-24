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

import { createRef, useCallback, useEffect, useRef } from "react";
import type { OrbitControls } from "@react-three/drei";
import type * as THREE from "three";
import { initializeGrid } from "@/modules/navigation/pathfinding/a-star-pathfinding";
import type { OfficeLayoutModel } from "@/modules/office/lib/office-layout";
import { useObjectRegistrationStore } from "@/modules/office/store/object-registration-store";

export function useOfficeSceneBootstrap(params: {
  officeLayout: OfficeLayoutModel;
  officeObjectCount: number;
  officeObjectSignature: string;
  onNavigationReady?: () => void;
  onNavigationReset?: () => void;
}): {
  orbitControlsRef: React.RefObject<React.ElementRef<
    typeof OrbitControls
  > | null>;
  floorRef: React.RefObject<THREE.Mesh | null>;
  createRegisteredObjectRef: (
    objectId: string,
    objectRef: React.MutableRefObject<THREE.Group | null>,
  ) => (element: THREE.Group | null) => void;
  getObjectRef: (objectId: string) => React.RefObject<THREE.Group | null>;
} {
  const {
    officeLayout,
    officeObjectCount,
    officeObjectSignature,
    onNavigationReady,
    onNavigationReset,
  } = params;
  const orbitControlsRef = useRef<React.ElementRef<typeof OrbitControls>>(null);
  const floorRef = useRef<THREE.Mesh>(null);
  const officeObjectRefs = useRef<
    Map<string, React.RefObject<THREE.Group | null>>
  >(new Map());
  const registeredRefCallbacks = useRef<
    Map<string, (element: THREE.Group | null) => void>
  >(new Map());

  const registerObject = useObjectRegistrationStore(
    (state) => state.registerObject,
  );
  const unregisterObject = useObjectRegistrationStore(
    (state) => state.unregisterObject,
  );
  const getObjects = useObjectRegistrationStore((state) => state.getObjects);
  const registeredObjectCount = useObjectRegistrationStore(
    (state) => state.registeredObjects.size,
  );

  const getObjectRef = useCallback((objectId: string) => {
    if (!officeObjectRefs.current.has(objectId)) {
      officeObjectRefs.current.set(objectId, createRef<THREE.Group>());
    }
    return officeObjectRefs.current.get(objectId)!;
  }, []);

  const createRegisteredObjectRef = useCallback(
    (
      objectId: string,
      objectRef: React.MutableRefObject<THREE.Group | null>,
    ) => {
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
    onNavigationReset?.();
    const timer = setTimeout(() => {
      const objects = getObjects();
      const expectedCount = officeObjectCount;

      if (expectedCount > 0 && objects.length >= expectedCount) {
        initializeGrid(officeLayout, objects, 2, 3);
        onNavigationReady?.();
      } else if (expectedCount === 0) {
        initializeGrid(officeLayout, [], 2, 3);
        onNavigationReady?.();
      } else {
        // Architecture seam:
        // registration can trail initial render by a tick. This effect intentionally
        // re-runs on registration-count changes so future scene bootstrap phases can
        // compose through the same readiness model instead of adding bespoke retry loops.
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [
    getObjects,
    officeLayout,
    officeObjectCount,
    officeObjectSignature,
    onNavigationReady,
    onNavigationReset,
    registeredObjectCount,
  ]);

  return {
    orbitControlsRef,
    floorRef,
    createRegisteredObjectRef,
    getObjectRef,
  };
}
