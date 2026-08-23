"use client";

import { useEffect, useMemo, useState } from "react";
import { TICKET_SPECIALIST_REGISTRY } from "@/lib/ticket-routing/specialist-registry";
import {
  projectOfficeCapabilityBindings,
  type GeneratedCapabilityGraph,
  type OfficeCapabilityBindings,
} from "../lib/office-capability-projection";
import { SYSTEM_FACILITY_REGISTRY } from "../lib/system-facility-registry";

function isGeneratedCapabilityGraph(value: unknown): value is GeneratedCapabilityGraph {
  return Boolean(
    value && typeof value === "object" && Array.isArray((value as { nodes?: unknown }).nodes),
  );
}

/** Loads the same generated static capability graph used by Skills Studio. */
export function useOfficeCapabilityBindings(): {
  bindings: OfficeCapabilityBindings | null;
  error: string | null;
} {
  const [graph, setGraph] = useState<GeneratedCapabilityGraph | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/farplane/framework-graph/skill-capability-graph.json")
      .then(async (response) => {
        if (!response.ok) throw new Error("office_capability_graph_unavailable");
        const payload = (await response.json()) as unknown;
        if (!isGeneratedCapabilityGraph(payload))
          throw new Error("office_capability_graph_invalid");
        if (!cancelled) setGraph(payload);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "office_capability_graph_failed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const bindings = useMemo(
    () =>
      graph
        ? projectOfficeCapabilityBindings({
            graph,
            systemFacilities: SYSTEM_FACILITY_REGISTRY,
            workstations: TICKET_SPECIALIST_REGISTRY,
          })
        : null,
    [graph],
  );

  return { bindings, error };
}
