import type { RefObject } from "react";

type PositionProbeTarget = {
  position: {
    x: number;
    y: number;
    z: number;
  };
};

declare global {
  interface Window {
    __farplaneOfficeLiveEmployeePositions?: Record<string, [number, number, number]>;
  }
}

export function recordDevEmployeePosition(
  id: unknown,
  groupRef: RefObject<PositionProbeTarget | null>,
): void {
  if (!import.meta.env.DEV || typeof window === "undefined" || !groupRef.current) return;
  window.__farplaneOfficeLiveEmployeePositions ??= {};
  window.__farplaneOfficeLiveEmployeePositions[String(id)] = [
    groupRef.current.position.x,
    groupRef.current.position.y,
    groupRef.current.position.z,
  ];
}
