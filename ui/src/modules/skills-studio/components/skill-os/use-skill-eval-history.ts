"use client";

/**
 * Ownership: Skill OS bridge to Eval OS run artifacts.
 * Inputs: selected skill id and the read-only /farplane/evals Vite bridge.
 * Outputs: compact eval run rows for scorecard previews.
 * Side effects: browser fetches only; no eval artifact mutation.
 */

import { useEffect, useState } from "react";
import type { EvalTaskSummary } from "@/modules/evals/lib/eval-types";

export type SkillEvalHistoryRow = {
  failedTasks: number;
  jobId: string;
  label: string;
  passRate: number | null;
  passedTasks: number;
  runDate: string | undefined;
  tasks: EvalTaskSummary[];
  totalTasks: number;
};

export type SkillEvalHistoryState = {
  error: string | null;
  rows: SkillEvalHistoryRow[];
  status: "idle" | "loading" | "ready" | "error";
};

type SkillEvalRunsResponse = {
  ok: boolean;
  rows?: SkillEvalHistoryRow[];
  error?: string;
};

export function useSkillEvalHistory(skillId: string, enabled = true): SkillEvalHistoryState {
  const [state, setState] = useState<SkillEvalHistoryState>({
    error: null,
    rows: [],
    status: "idle",
  });

  useEffect(() => {
    if (!enabled || !skillId) {
      setState({ error: null, rows: [], status: "idle" });
      return;
    }

    let cancelled = false;
    async function load(): Promise<void> {
      setState((current) => ({ ...current, error: null, status: "loading" }));
      try {
        const response = await fetch(
          `/farplane/evals/skill-runs?skill=${encodeURIComponent(skillId)}`,
        );
        const payload = (await response.json()) as SkillEvalRunsResponse;
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "skill_eval_runs_load_failed");
        }
        if (!cancelled) setState({ error: null, rows: payload.rows ?? [], status: "ready" });
      } catch (error) {
        if (!cancelled) {
          setState({
            error: error instanceof Error ? error.message : "skill_eval_history_failed",
            rows: [],
            status: "error",
          });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, skillId]);

  return state;
}
