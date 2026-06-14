"use client";

/**
 * SKILL OS INVOCATION COUNTS
 * ==========================
 * Ownership: Skill OS adapter for TKT-025 invocation telemetry.
 * Inputs: Convex skill invocation dashboard query when Convex is configured.
 * Outputs: skill-id keyed count lookup and compact dashboard state.
 * Side effects: subscribes to Convex only when enabled; no writes.
 * Invariants: this file never creates a second telemetry source.
 */

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { isConvexEnabled } from "@/providers/convex-provider";
import { api } from "../../../../../../convex/_generated/api";
import type { SkillInvocationDashboard } from "../../../skill-invocations/skill-invocations-types";

export type SkillInvocationCountState = {
  available: boolean;
  countBySkill: Map<string, number>;
  data?: SkillInvocationDashboard;
  loading: boolean;
};

export function useSkillInvocationCounts(open: boolean): SkillInvocationCountState {
  const available = isConvexEnabled();
  const data = useQuery(
    api.modules.skillInvocations.queries.getSkillInvocationDashboard,
    available && open ? { rangeDays: 30, limit: 80 } : "skip",
  ) as SkillInvocationDashboard | undefined;

  const countBySkill = useMemo(() => {
    const next = new Map<string, number>();
    for (const row of data?.bySkill ?? []) {
      next.set(row.key, row.count);
      next.set(row.displayName, row.count);
    }
    return next;
  }, [data]);

  return {
    available,
    countBySkill,
    data,
    loading: available && open && data === undefined,
  };
}
