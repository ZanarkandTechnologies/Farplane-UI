/**
 * OBSERVED SKILL FLOW EFFECTS
 * ===========================
 * Scene-only rendering for the real hook events selected by the pure
 * projection. It deliberately has no route planner, owner fallback, or state
 * writes: the Office may show what happened, never what it assumes will happen.
 */

"use client";

import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { EmployeeData } from "@/modules/office/lib/types";
import type { SkillInvocationEvent } from "../../skill-invocations/skill-invocations-types";
import {
  OFFICE_SKILL_FLOW_FRESHNESS_MS,
  type OfficeSkillFlowFurniture,
  projectObservedSkillFlows,
} from "../lib/observed-skill-flow-projection";
import type { ProjectCouncilLayout } from "../lib/project-council-layout";
import { updateOfficeQaState } from "../qa/office-qa-state";

const FLOW_ARC_POINT_COUNT = 28;
const FLOW_PACKET_OFFSETS = [0.24, 0.66] as const;
const FLOW_PACKET_SPEED = 0.19;

function normalizeSessionKey(value: string): string {
  return value.trim().replace(/^codex-thread:/, "");
}

export function resolveObservedSkillFlowEmployee(
  employees: readonly Pick<EmployeeData, "_id" | "initialPosition" | "observedRuntime">[],
  sessionId: string,
): Pick<EmployeeData, "_id" | "initialPosition" | "observedRuntime"> | undefined {
  const normalizedSessionId = normalizeSessionKey(sessionId);
  return employees.find((employee) => {
    const observed = employee.observedRuntime;
    return [observed?.sessionKey, observed?.threadId]
      .filter((candidate): candidate is string => Boolean(candidate))
      .some((candidate) => normalizeSessionKey(candidate) === normalizedSessionId);
  });
}

export function buildOfficeSkillFlowFurniture(
  layout: ProjectCouncilLayout,
): OfficeSkillFlowFurniture[] {
  return [
    ...layout.specialistStations.flatMap((station) =>
      station.skillId
        ? [
            {
              id: `workstation:${station.specialistId}`,
              skillId: station.skillId,
              kind: "workstation" as const,
              departmentId: station.departmentId,
              position: station.position,
            },
          ]
        : [],
    ),
    ...layout.systemFacilities.map((facility) => ({
      id: `system-facility:${facility.facilityId}`,
      skillId: facility.skillId,
      kind: "system-facility" as const,
      departmentId: facility.departmentId,
      position: facility.position,
    })),
  ];
}

function furnitureAnchor(furniture: OfficeSkillFlowFurniture): [number, number, number] {
  return [
    furniture.position[0],
    furniture.position[1] + (furniture.kind === "system-facility" ? 0.92 : 0.7),
    furniture.position[2],
  ];
}

function accentForDepartment(departmentId: string): string {
  const accents: Record<string, string> = {
    "back-office": "#a8ad76",
    sales: "#bf8aa8",
    deals: "#c9826b",
    marketing: "#c8ad72",
    operations: "#9b8bc5",
    intelligence: "#7fa9c0",
    customer: "#79b8a2",
  };
  return accents[departmentId] ?? "#a7d4f6";
}

function isLocalObservedFlowQaRoute(): boolean {
  return (
    typeof window !== "undefined" &&
    ["127.0.0.1", "localhost"].includes(window.location.hostname) &&
    new URLSearchParams(window.location.search).get("officeQa") === "observed-skill-flow"
  );
}

function arcCurve(
  from: [number, number, number],
  to: [number, number, number],
): THREE.QuadraticBezierCurve3 {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const distance = start.distanceTo(end);
  const control = start.clone().lerp(end, 0.5);
  control.y += Math.min(4.6, 1.25 + distance * 0.12);
  return new THREE.QuadraticBezierCurve3(start, control, end);
}

function ObservedFlowArc({
  id,
  from,
  to,
  color,
  occurredAt,
  reducedMotion,
}: {
  id: string;
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  occurredAt: number;
  reducedMotion: boolean;
}): React.JSX.Element {
  const curve = useMemo(() => arcCurve(from, to), [from, to]);
  const points = useMemo(
    () =>
      curve
        .getPoints(FLOW_ARC_POINT_COUNT - 1)
        .map((point) => [point.x, point.y, point.z] as [number, number, number]),
    [curve],
  );
  const lineRef = useRef<THREE.Object3D | null>(null);
  const packetRefs = useRef<Array<THREE.Mesh | null>>([]);
  const packetMaterialRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);

  useFrame((state) => {
    const ageMs = Date.now() - occurredAt;
    const opacity = Math.max(0, Math.min(1, (OFFICE_SKILL_FLOW_FRESHNESS_MS - ageMs) / 1_400));
    const material = (
      lineRef.current as unknown as { material?: { opacity?: number; dashOffset?: number } }
    )?.material;
    if (material) {
      material.opacity = opacity * 0.72;
      if (!reducedMotion && typeof material.dashOffset === "number") {
        material.dashOffset = -state.clock.getElapsedTime() * 0.48;
      }
    }
    for (let index = 0; index < FLOW_PACKET_OFFSETS.length; index += 1) {
      const packet = packetRefs.current[index];
      const packetMaterial = packetMaterialRefs.current[index];
      if (!packet || !packetMaterial) continue;
      const offset = FLOW_PACKET_OFFSETS[index] ?? 0;
      const t = reducedMotion
        ? offset
        : (offset + state.clock.getElapsedTime() * FLOW_PACKET_SPEED) % 1;
      packet.position.copy(curve.getPoint(t));
      packet.scale.setScalar(0.78 + t * 0.42);
      packetMaterial.opacity = opacity * 0.94;
    }
  });

  return (
    <group name={id}>
      <Line
        ref={(line) => {
          lineRef.current = line as unknown as THREE.Object3D;
        }}
        points={points}
        color={color}
        transparent
        opacity={0}
        lineWidth={1.15}
        dashed
        dashSize={0.38}
        gapSize={0.26}
        raycast={() => null}
      />
      {FLOW_PACKET_OFFSETS.map((offset, index) => (
        <mesh
          key={offset}
          ref={(mesh: THREE.Mesh | null) => {
            packetRefs.current[index] = mesh;
          }}
          position={curve.getPoint(offset)}
          raycast={() => null}
        >
          <sphereGeometry args={[0.075, 10, 8]} />
          <meshStandardMaterial
            ref={(material: THREE.MeshStandardMaterial | null) => {
              packetMaterialRefs.current[index] = material;
            }}
            color={color}
            emissive={color}
            emissiveIntensity={0.72}
            transparent
            opacity={0}
            roughness={0.4}
          />
        </mesh>
      ))}
    </group>
  );
}

export function ObservedSkillFlowEffects({
  events,
  employees,
  layout,
}: {
  events: readonly SkillInvocationEvent[];
  employees: EmployeeData[];
  layout: ProjectCouncilLayout;
}): React.JSX.Element | null {
  const [now, setNow] = useState(() => Date.now());
  const [reducedMotion, setReducedMotion] = useState(false);
  const furniture = useMemo(() => buildOfficeSkillFlowFurniture(layout), [layout]);
  const flows = useMemo(
    () => projectObservedSkillFlows({ events, furniture, now }),
    [events, furniture, now],
  );
  const resolved = useMemo(
    () =>
      flows.map((flow) => ({
        flow,
        employee: resolveObservedSkillFlowEmployee(employees, flow.sessionId),
      })),
    [employees, flows],
  );
  const isQaRoute = isLocalObservedFlowQaRoute();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    updateOfficeQaState({
      observedSkillFlow: {
        visibleCount: resolved.length,
        headLinkCount: resolved.filter((item) => item.employee).length,
        furnitureLinkCount: resolved.filter((item) => item.flow.previous).length,
        sessions: resolved.map((item) => item.flow.sessionId),
      },
    });
    return () => updateOfficeQaState({ observedSkillFlow: undefined });
  }, [resolved]);
  useEffect(() => {
    if (!isQaRoute) {
      return;
    }
    const host = window as Window & {
      __FARPLANE_OBSERVED_SKILL_FLOW_QA__?: Record<string, unknown>;
    };
    host.__FARPLANE_OBSERVED_SKILL_FLOW_QA__ = {
      visibleCount: resolved.length,
      headLinkCount: resolved.filter((item) => item.employee).length,
      furnitureLinkCount: resolved.filter((item) => item.flow.previous).length,
      links: resolved.map((item) => ({
        current: item.flow.current.id,
        previous: item.flow.previous?.id ?? null,
      })),
    };
    return () => {
      delete host.__FARPLANE_OBSERVED_SKILL_FLOW_QA__;
    };
  }, [isQaRoute, resolved]);

  if (resolved.length === 0 && !isQaRoute) return null;
  return (
    <group name="observed-skill-flow-effects">
      {isQaRoute ? (
        <Html position={[0, 4.4, 0]} center sprite transform>
          <span
            data-testid="observed-skill-flow-qa"
            className="rounded border border-sky-300/70 bg-slate-950/90 px-1.5 py-0.5 font-mono text-[7px] text-sky-100"
          >
            observed flow: {resolved.length} · head{" "}
            {resolved.filter((item) => item.employee).length} · chain{" "}
            {resolved.filter((item) => item.flow.previous).length} ·{" "}
            {resolved
              .map((item) => `${item.flow.previous?.id ?? "start"}→${item.flow.current.id}`)
              .join(", ")}
          </span>
        </Html>
      ) : null}
      {resolved.flatMap(({ flow, employee }) => {
        const color = accentForDepartment(flow.current.departmentId);
        const currentAnchor = furnitureAnchor(flow.current);
        const arcs: React.JSX.Element[] = [];
        if (employee) {
          arcs.push(
            <ObservedFlowArc
              key={`${flow.id}:head`}
              id={`observed-skill-flow-head-${flow.id}`}
              from={[
                employee.initialPosition[0],
                employee.initialPosition[1] + 1.1,
                employee.initialPosition[2],
              ]}
              to={currentAnchor}
              color={color}
              occurredAt={flow.occurredAt}
              reducedMotion={reducedMotion}
            />,
          );
        }
        if (flow.previous) {
          arcs.push(
            <ObservedFlowArc
              key={`${flow.id}:sequence`}
              id={`observed-skill-flow-sequence-${flow.id}`}
              from={furnitureAnchor(flow.previous)}
              to={currentAnchor}
              color={color}
              occurredAt={flow.occurredAt}
              reducedMotion={reducedMotion}
            />,
          );
        }
        return arcs;
      })}
    </group>
  );
}
