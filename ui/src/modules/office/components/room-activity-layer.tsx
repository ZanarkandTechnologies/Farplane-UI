"use client";

/** Renders bounded, presentation-only project work inside persisted operating-room transforms. */

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type * as THREE from "three";
import { OFFICE_LANDMARK_THEME } from "@/config/office-theme";
import { OFFICE_HTML_Z } from "@/lib/z-index";
import { getOperatingRoomId } from "../lib/operating-room-catalog";
import type { RoomActivityGroup } from "../lib/room-activity-projection";
import type { OfficeObject } from "../lib/types";

const M = OFFICE_LANDMARK_THEME.materials;

function RoomPulse(): React.JSX.Element {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = (): void => setReduceMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useFrame(({ clock }) => {
    if (!materialRef.current) return;
    materialRef.current.opacity = reduceMotion
      ? 0.16
      : 0.11 + (Math.sin(clock.elapsedTime * 2.2) + 1) * 0.055;
  });

  return (
    <mesh position={[0, 0.073, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[2.08, 2.25, 32]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#8fb9ad"
        transparent
        opacity={0.16}
        depthWrite={false}
      />
    </mesh>
  );
}

function OverflowBadge({ count }: { count: number }): React.JSX.Element | null {
  if (count <= 0) return null;
  return (
    <group position={[1.85, 0.08, 1.72]}>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.09, 18]} />
        <meshStandardMaterial color={M.darkMetal} roughness={0.48} />
      </mesh>
      <Html
        transform
        sprite
        center
        distanceFactor={5.5}
        position={[0, 0.34, 0]}
        zIndexRange={OFFICE_HTML_Z.status}
        style={{ pointerEvents: "none" }}
      >
        <span className="whitespace-nowrap rounded-full border border-white/15 bg-stone-950/85 px-1.5 py-0.5 text-[8px] font-semibold text-stone-100">
          +{count} active
        </span>
      </Html>
    </group>
  );
}

export function RoomActivityLayer({
  groups,
  officeObjects,
}: {
  groups: readonly RoomActivityGroup[];
  officeObjects: readonly OfficeObject[];
}): React.JSX.Element | null {
  const roomObjectById = useMemo(() => {
    const next = new Map<string, OfficeObject>();
    for (const object of officeObjects) {
      const roomId = getOperatingRoomId(object);
      if (roomId && !next.has(roomId)) next.set(roomId, object);
    }
    return next;
  }, [officeObjects]);

  if (groups.length === 0) return null;
  return (
    <group name="room-activity-layer">
      {groups.map((group) => {
        const roomObject = roomObjectById.get(group.roomId);
        if (!roomObject) return null;
        return (
          <group
            key={group.roomId}
            name={`room-activity-group-${group.roomId}`}
            position={roomObject.position}
            rotation={roomObject.rotation}
            scale={roomObject.scale ?? [1, 1, 1]}
          >
            <RoomPulse />
            <OverflowBadge count={group.overflowCount} />
          </group>
        );
      })}
    </group>
  );
}
