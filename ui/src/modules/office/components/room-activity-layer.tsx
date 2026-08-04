"use client";

/** Renders bounded, presentation-only project work inside persisted operating-room transforms. */

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type * as THREE from "three";
import { OFFICE_LANDMARK_THEME } from "@/config/office-theme";
import { getOperatingRoomId } from "../lib/operating-room-catalog";
import type {
  RoomActivity,
  RoomActivityCallerTarget,
  RoomActivityGroup,
} from "../lib/room-activity-projection";
import type { OfficeObject } from "../lib/types";

const WORKBENCH_X = [-1.25, 0, 1.25] as const;
const M = OFFICE_LANDMARK_THEME.materials;

function skillLabel(skillId: string): string {
  return skillId
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

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

function ActivityWorkbench({
  activity,
  index,
  onOpenCallerTarget,
}: {
  activity: RoomActivity;
  index: number;
  onOpenCallerTarget?: (target: RoomActivityCallerTarget) => void;
}): React.JSX.Element {
  const target = activity.callerTarget;
  const label = `${activity.projectLabel} — ${skillLabel(activity.skillId)}`;
  return (
    <group name={`room-activity-${activity.id}`} position={[WORKBENCH_X[index] ?? 0, 0, 1.05]}>
      <mesh position={[0, 0.31, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.92, 0.08, 0.58]} />
        <meshStandardMaterial color={M.walnut} roughness={0.72} />
      </mesh>
      {[-0.34, 0.34].map((x) => (
        <mesh key={x} position={[x, 0.15, 0]} castShadow>
          <boxGeometry args={[0.07, 0.3, 0.44]} />
          <meshStandardMaterial color={M.darkMetal} metalness={0.42} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 0.48, -0.13]} rotation={[-0.18, 0, 0]}>
        <boxGeometry args={[0.7, 0.34, 0.035]} />
        <meshStandardMaterial
          color={M.inactiveScreen}
          emissive="#4d8d82"
          emissiveIntensity={0.28}
          roughness={0.46}
        />
      </mesh>
      <Html
        transform
        sprite
        center
        distanceFactor={5.5}
        position={[0, 0.76, 0]}
        style={{ pointerEvents: target ? "auto" : "none" }}
      >
        <button
          type="button"
          aria-label={target ? `Open ${label}` : label}
          disabled={!target}
          onClick={(event) => {
            event.stopPropagation();
            if (target) onOpenCallerTarget?.(target);
          }}
          className="w-28 rounded border border-white/15 bg-stone-950/85 px-2 py-1 text-center text-[9px] font-medium leading-tight text-stone-100 shadow-md disabled:cursor-default"
        >
          <span className="block truncate">{activity.projectLabel}</span>
          <span className="block truncate text-[8px] text-emerald-200/80">
            {skillLabel(activity.skillId)}
            {target ? " ↗" : ""}
          </span>
        </button>
      </Html>
    </group>
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
        style={{ pointerEvents: "none" }}
      >
        <span className="whitespace-nowrap rounded-full border border-white/15 bg-stone-950/85 px-1.5 py-0.5 text-[8px] font-semibold text-stone-100">
          +{count} active
        </span>
      </Html>
    </group>
  );
}

function ActivitySummary({ group }: { group: RoomActivityGroup }): React.JSX.Element {
  return (
    <Html
      center
      position={[0, 5.2, -4]}
      zIndexRange={[108, 0]}
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <div className="w-44 rounded-md border border-emerald-200/25 bg-stone-950/94 p-2 shadow-[0_8px_26px_rgba(0,0,0,0.55)] backdrop-blur-sm">
        <div className="mb-1.5 flex items-center justify-between text-[8px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
          <span>Active project work</span>
          <span>{group.activities.length + group.overflowCount}</span>
        </div>
        <div className="space-y-1">
          {group.activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center justify-between gap-2 rounded bg-white/5 px-1.5 py-1 text-[9px] leading-none"
            >
              <span className="shrink-0 font-semibold text-stone-50">{activity.projectLabel}</span>
              <span className="min-w-0 truncate text-[8px] text-emerald-200/85">
                {skillLabel(activity.skillId)}
              </span>
            </div>
          ))}
        </div>
        {group.overflowCount > 0 ? (
          <div className="mt-1.5 border-t border-white/10 pt-1 text-center text-[8px] font-medium text-stone-300">
            +{group.overflowCount} more active
          </div>
        ) : null}
      </div>
    </Html>
  );
}

export function RoomActivityLayer({
  groups,
  officeObjects,
  onOpenCallerTarget,
}: {
  groups: readonly RoomActivityGroup[];
  officeObjects: readonly OfficeObject[];
  onOpenCallerTarget?: (target: RoomActivityCallerTarget) => void;
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
            <ActivitySummary group={group} />
            {group.activities.map((activity, index) => (
              <ActivityWorkbench
                key={activity.id}
                activity={activity}
                index={index}
                onOpenCallerTarget={onOpenCallerTarget}
              />
            ))}
            <OverflowBadge count={group.overflowCount} />
          </group>
        );
      })}
    </group>
  );
}
