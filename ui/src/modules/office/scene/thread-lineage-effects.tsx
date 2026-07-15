/**
 * THREAD LINEAGE EFFECTS
 * ======================
 * Ownership: converts genuinely new thread lineage telemetry into short scene-local pulses.
 * Inputs/outputs: Convex lineage edges + rendered employees -> transient blue links.
 * Side effects: subscribes read-only and keeps a mount-local seen set; no telemetry writes.
 * Invariant: initial/backfilled edges never animate, and events older than the freshness window are ignored.
 */

"use client";

import { useFrame } from "@react-three/fiber";
import { useQuery } from "convex/react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useOfficeRuntimeAdapter } from "@/modules/runtime";
import type { EmployeeData } from "@/modules/office/lib/types";
import { getOfficeQaState, updateOfficeQaState } from "@/modules/office/qa/office-qa-state";
import { isConvexEnabled } from "@/providers/convex-provider";
import { api } from "../../../../../convex/_generated/api";
import { getLiveEmployeePosition } from "./employee-position-registry";

export type OfficeLineageEdge = {
  id: string;
  source: string;
  target: string;
  kind: "created" | "forked";
  eventAt: number;
};

export const OFFICE_LINEAGE_FRESHNESS_MS = 10_000;
export const OFFICE_LINEAGE_EFFECT_DURATION_MS = 2_200;
export const OFFICE_LINEAGE_FADE_MS = 500;
const LINEAGE_PROJECTION_DISTANCE = 1.25;
const LINEAGE_CLEARANCE = 0.9;

export function selectFreshUnseenLineageEdges(input: {
  edges: OfficeLineageEdge[];
  seen: Set<string>;
  now: number;
}): OfficeLineageEdge[] {
  return input.edges.filter(
    (edge) =>
      !input.seen.has(edge.id) &&
      edge.eventAt <= input.now &&
      input.now - edge.eventAt <= OFFICE_LINEAGE_FRESHNESS_MS,
  );
}

function threadIdMatches(employee: EmployeeData, threadId: string): boolean {
  const normalized = threadId.replace(/^codex-thread:/, "");
  const candidates = [
    employee.observedRuntime?.threadId,
    employee.observedRuntime?.sessionKey,
    String(employee._id).replace(/^employee-(?:codex-thread:)?/, ""),
  ];
  return candidates.some((candidate) => candidate?.replace(/^codex-thread:/, "") === normalized);
}

export function getOfficeLineageEffectOpacity(ageMs: number): number {
  if (ageMs < 0 || ageMs >= OFFICE_LINEAGE_EFFECT_DURATION_MS) return 0;
  const fadeStart = OFFICE_LINEAGE_EFFECT_DURATION_MS - OFFICE_LINEAGE_FADE_MS;
  if (ageMs <= fadeStart) return Math.min(1, ageMs / 160);
  return (OFFICE_LINEAGE_EFFECT_DURATION_MS - ageMs) / OFFICE_LINEAGE_FADE_MS;
}

export function resolveOfficeLineageEndpoints(input: {
  edge: OfficeLineageEdge;
  employees: EmployeeData[];
}): { source: EmployeeData; target: EmployeeData; targetProjected: boolean } | null {
  const exactSource = input.employees.find((employee) =>
    threadIdMatches(employee, input.edge.source),
  );
  const source =
    exactSource ??
    input.employees.find((employee) => employee.projectPulse) ??
    input.employees.find((employee) => employee.isCEO);
  if (!source) return null;
  const exactTarget = input.employees.find((employee) =>
    threadIdMatches(employee, input.edge.target),
  );
  if (exactTarget) return { source, target: exactTarget, targetProjected: false };
  const [sourceX, sourceY, sourceZ] = source.initialPosition;
  const towardCommons = new THREE.Vector2(-sourceX, -sourceZ);
  if (towardCommons.lengthSq() < 0.001) towardCommons.set(1, 0);
  towardCommons.normalize();
  const directions = Array.from({ length: 8 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 8;
    return new THREE.Vector2(Math.cos(angle), Math.sin(angle));
  }).sort((left, right) => right.dot(towardCommons) - left.dot(towardCommons));
  const occupied = input.employees
    .filter((employee) => employee._id !== source._id)
    .map((employee) => new THREE.Vector2(employee.initialPosition[0], employee.initialPosition[2]));
  const direction =
    directions.find((candidate) => {
      const point = new THREE.Vector2(sourceX, sourceZ).addScaledVector(
        candidate,
        LINEAGE_PROJECTION_DISTANCE,
      );
      return occupied.every((position) => position.distanceTo(point) >= LINEAGE_CLEARANCE);
    }) ?? directions[0];
  return {
    source,
    target: {
      ...source,
      _id: `lineage-projection:${input.edge.id}`,
      initialPosition: [
        sourceX + direction.x * LINEAGE_PROJECTION_DISTANCE,
        sourceY,
        sourceZ + direction.y * LINEAGE_PROJECTION_DISTANCE,
      ],
    },
    targetProjected: true,
  };
}

function ThreadLineagePulse({
  source,
  target,
  startedAt,
}: {
  source: EmployeeData;
  target: EmployeeData;
  startedAt: number;
}): React.JSX.Element {
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  const materialRef = useRef<THREE.LineBasicMaterial>(null);
  const pulseRef = useRef<THREE.Mesh>(null);
  const pulseMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const from = getLiveEmployeePosition(String(source._id)) ?? source.initialPosition;
    const to = getLiveEmployeePosition(String(target._id)) ?? target.initialPosition;
    const sourcePoint = new THREE.Vector3(from[0], from[1] + 1.05, from[2]);
    const targetPoint = new THREE.Vector3(to[0], to[1] + 1.05, to[2]);
    geometryRef.current?.setFromPoints([sourcePoint, targetPoint]);
    const ageMs = Date.now() - startedAt;
    const progress = Math.min(1, Math.max(0, ageMs / OFFICE_LINEAGE_EFFECT_DURATION_MS));
    const opacity = getOfficeLineageEffectOpacity(ageMs);
    if (materialRef.current) materialRef.current.opacity = opacity * 0.75;
    if (pulseMaterialRef.current) pulseMaterialRef.current.opacity = opacity * 0.9;
    pulseRef.current?.position.lerpVectors(sourcePoint, targetPoint, progress);
  });
  return (
    <group>
      <line>
        <bufferGeometry ref={geometryRef} />
        <lineBasicMaterial
          ref={materialRef}
          color="#7dd3fc"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </line>
      <mesh ref={pulseRef}>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshBasicMaterial
          ref={pulseMaterialRef}
          color="#bae6fd"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export function ThreadLineageEffects({ employees }: { employees: EmployeeData[] }): React.JSX.Element | null {
  const adapter = useOfficeRuntimeAdapter();
  const graph = useQuery(
    api.modules.hookTelemetry.queries.getThreadLineageGraph,
    isConvexEnabled() && adapter.runtimeKind === "codex" ? { rangeDays: 1, limit: 200 } : "skip",
  ) as { edges?: OfficeLineageEdge[] } | undefined;
  const seenRef = useRef<Set<string> | null>(null);
  const [active, setActive] = useState<Array<OfficeLineageEdge & { startedAt: number }>>([]);

  useEffect(() => {
    if (!graph?.edges) return;
    if (!seenRef.current) {
      seenRef.current = new Set(graph.edges.map((edge) => edge.id));
      return;
    }
    const now = Date.now();
    const fresh = selectFreshUnseenLineageEdges({ edges: graph.edges, seen: seenRef.current, now });
    graph.edges.forEach((edge) => seenRef.current?.add(edge.id));
    if (fresh.length === 0) return;
    setActive((current) => [...current, ...fresh.map((edge) => ({ ...edge, startedAt: now }))]);
  }, [graph?.edges]);

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    const seedLineage = (edge: OfficeLineageEdge) => {
      const now = Date.now();
      updateOfficeQaState({
        effects: [
          ...(getOfficeQaState().effects ?? []),
          { id: edge.id, kind: edge.kind, startedAt: now },
        ],
      });
      setActive((current) => [
        ...current,
        { ...edge, eventAt: edge.eventAt ?? now, startedAt: now },
      ]);
    };
    updateOfficeQaState({
      seedLineage,
      effects: active.map(({ id, kind, startedAt }) => ({ id, kind, startedAt })),
    });
    return () => updateOfficeQaState({ seedLineage: undefined, effects: [] });
  }, [active]);

  useEffect(() => {
    if (active.length === 0) return;
    const timer = window.setTimeout(() => {
      const now = Date.now();
      setActive((current) =>
        current.filter((edge) => now - edge.startedAt < OFFICE_LINEAGE_EFFECT_DURATION_MS),
      );
    }, OFFICE_LINEAGE_EFFECT_DURATION_MS + 50);
    return () => window.clearTimeout(timer);
  }, [active]);

  const resolved = useMemo(
    () =>
      active.flatMap((edge) => {
        const endpoints = resolveOfficeLineageEndpoints({ edge, employees });
        return endpoints ? [{ edge, ...endpoints }] : [];
      }),
    [active, employees],
  );
  if (resolved.length === 0) return null;
  return (
    <group>
      {resolved.map(({ edge, source, target }) => (
        <ThreadLineagePulse key={edge.id} source={source} target={target} startedAt={edge.startedAt} />
      ))}
    </group>
  );
}
