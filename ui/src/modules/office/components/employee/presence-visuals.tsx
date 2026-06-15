"use client";

/**
 * Employee presence visuals.
 *
 * Ownership: office employee presentation only.
 * Inputs: runtime presence classification and heartbeat state.
 * Outputs: a normalized visual treatment plus optional lightweight R3F markers.
 * Side effects: none; this file does not mutate agent/runtime state.
 */

import { TEAM_PLUMBOB_COLORS } from "@/constants";
import type { EmployeeActivityState } from "@/modules/office/lib/types";
import type { AgentState } from "@/modules/runtime";

export type EmployeePresenceVisualKind = "standard" | "persistent" | "ephemeral";

export type EmployeePresenceVisual = {
  kind: EmployeePresenceVisualKind;
  bodyOpacity: number;
  auraColor: string;
  auraOpacity: number;
};

const STANDARD_PRESENCE_VISUAL: EmployeePresenceVisual = {
  kind: "standard",
  bodyOpacity: 1,
  auraColor: "#ffffff",
  auraOpacity: 0,
};

const HEARTBEAT_AURA_COLORS: Partial<Record<AgentState, string>> = {
  running: "#22d3ee",
  planning: "#a78bfa",
  executing: "#38bdf8",
  blocked: "#f59e0b",
  error: "#ef4444",
  done: "#34d399",
  ok: "#34d399",
  idle: "#60a5fa",
  no_work: "#60a5fa",
};

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getEmployeeActivityIndicatorColor(activityState?: EmployeeActivityState): string | null {
  switch (activityState) {
    case "running":
      return "#38BDF8";
    case "waiting":
      return "#FBBF24";
    case "failed":
      return "#FB7185";
    case "review":
      return "#A78BFA";
    case "done":
      return "#34D399";
    default:
      return null;
  }
}

export function getEmployeeIndicatorColor(input: {
  teamId?: string;
  activityState?: EmployeeActivityState;
}): string {
  const activityColor = getEmployeeActivityIndicatorColor(input.activityState);
  if (activityColor) return activityColor;
  if (!input.teamId) return "#00E676";
  return TEAM_PLUMBOB_COLORS[hashString(input.teamId) % TEAM_PLUMBOB_COLORS.length];
}

export function resolveEmployeePresenceVisual(input: {
  presencePersistent?: boolean;
  heartbeatState?: AgentState;
}): EmployeePresenceVisual {
  if (input.presencePersistent === false) {
    return {
      kind: "ephemeral",
      bodyOpacity: 0.5,
      auraColor: "#67e8f9",
      auraOpacity: 0.16,
    };
  }

  if (input.presencePersistent === true || typeof input.heartbeatState === "string") {
    return {
      kind: "persistent",
      bodyOpacity: 1,
      auraColor: HEARTBEAT_AURA_COLORS[input.heartbeatState ?? "idle"] ?? "#22d3ee",
      auraOpacity: input.heartbeatState === "idle" || input.heartbeatState === "no_work" ? 0.22 : 0.36,
    };
  }

  return STANDARD_PRESENCE_VISUAL;
}

export function EmployeePresenceAura({
  visual,
}: {
  visual: EmployeePresenceVisual;
}) {
  if (visual.kind !== "ephemeral") return null;

  return (
    <group name={`employee-presence-${visual.kind}`}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.97, 0]}>
        <ringGeometry args={[0.42, 0.76, 40]} />
        <meshBasicMaterial
          color={visual.auraColor}
          transparent
          opacity={visual.auraOpacity}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
