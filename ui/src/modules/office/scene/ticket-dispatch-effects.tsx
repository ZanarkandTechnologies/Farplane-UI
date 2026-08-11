/**
 * TICKET DISPATCH EFFECTS
 * =======================
 * Renders ticket-owned travel from a Project Council seat to a fixed studio
 * station. Input is the pure ticket dispatch projection; this layer never
 * reads telemetry directly or writes office state.
 */

import { Html, Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type React from "react";
import { useState } from "react";
import * as THREE from "three";
import type { RoomActivityCallerTarget } from "../lib/room-activity-projection";
import type { TicketDispatch } from "../lib/ticket-dispatch-projection";

function dispatchPoints(dispatch: TicketDispatch): Array<[number, number, number]> {
  const source = new THREE.Vector3(...dispatch.sourceHead);
  const destination = new THREE.Vector3(...dispatch.destination).add(new THREE.Vector3(0, 0.88, 0));
  const midpoint = source.clone().lerp(destination, 0.5);
  midpoint.y += Math.min(5.2, 1.8 + source.distanceTo(destination) * 0.1);
  return new THREE.QuadraticBezierCurve3(source, midpoint, destination)
    .getPoints(28)
    .map((point) => [point.x, point.y, point.z] as [number, number, number]);
}

function DispatchClone({
  dispatch,
  onOpenCallerTarget,
}: {
  dispatch: TicketDispatch;
  onOpenCallerTarget?: (target: RoomActivityCallerTarget) => void;
}): React.JSX.Element {
  const [hovered, setHovered] = useState(false);
  const target = dispatch.callerTarget;
  const openCallerTarget = (event: ThreeEvent<MouseEvent | PointerEvent>): void => {
    event.stopPropagation();
    onOpenCallerTarget?.(target);
  };
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: This R3F clone preserves the ticket's existing caller target.
    <group
      name={`ticket-dispatch-clone-${dispatch.id}`}
      position={dispatch.destination}
      onClick={openCallerTarget}
      onPointerOver={(event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      <mesh position={[0, 0.055, 0]} receiveShadow>
        <cylinderGeometry args={[0.28, 0.33, 0.11, 16]} />
        <meshStandardMaterial color="#77766f" roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.32, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.2, 0.38, 12]} />
        <meshStandardMaterial color={dispatch.cloneAppearance.accentColor} roughness={0.66} />
      </mesh>
      <mesh position={[0, 0.61, 0]} castShadow>
        <sphereGeometry args={[0.135, 14, 12]} />
        <meshStandardMaterial color="#e0b99a" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.75, 0]} castShadow>
        <sphereGeometry args={[0.142, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#59473b" roughness={0.84} />
      </mesh>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Invisible R3F hit volume makes the visual ticket clone reliably selectable. */}
      <mesh position={[0, 0.48, 0]} onClick={openCallerTarget} onPointerDown={openCallerTarget}>
        <sphereGeometry args={[0.78, 16, 12]} />
        <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
      </mesh>
      {hovered ? (
        <Html
          center
          distanceFactor={7}
          position={[0, 1.08, 0]}
          sprite
          transform
          zIndexRange={[114, 0]}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <div className="w-32 rounded-md border border-stone-300/85 bg-stone-50/95 px-2 py-1 text-center text-[9px] font-medium text-stone-800 shadow-[0_6px_18px_rgba(74,67,55,0.18)] backdrop-blur-sm">
            <span className="block truncate">{dispatch.label}</span>
            <span className="block truncate text-[8px] text-emerald-800/75">Open ticket ↗</span>
          </div>
        </Html>
      ) : null}
    </group>
  );
}

export function TicketDispatchEffects({
  dispatches,
  onOpenCallerTarget,
}: {
  dispatches: readonly TicketDispatch[];
  onOpenCallerTarget?: (target: RoomActivityCallerTarget) => void;
}): React.JSX.Element | null {
  if (dispatches.length === 0) return null;
  return (
    <group name="ticket-dispatch-effects">
      {dispatches.map((dispatch) => (
        <group key={dispatch.id} name={dispatch.id}>
          <Line
            points={dispatchPoints(dispatch)}
            color={dispatch.cloneAppearance.accentColor}
            transparent
            opacity={0.76}
            lineWidth={1.35}
            dashed
            dashSize={0.3}
            gapSize={0.18}
            raycast={() => null}
          />
          <DispatchClone dispatch={dispatch} onOpenCallerTarget={onOpenCallerTarget} />
        </group>
      ))}
    </group>
  );
}
