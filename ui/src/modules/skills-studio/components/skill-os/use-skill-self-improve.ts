"use client";

/**
 * Ownership: Skill OS bridge reader for skill-local self-improvement files.
 * Inputs: selected skill id and discovered program/progress paths.
 * Outputs: a read-only parsed projection plus loading/error state.
 * Side effects: parallel browser fetches through the existing safe skill-file endpoint.
 */

import { useEffect, useState } from "react";
import { buildSelfImproveProjection, type SelfImproveProjection } from "./skill-self-improve-model";
import { readSkillFile } from "./use-skill-file-content";

export type SkillSelfImproveState = {
  status: "idle" | "loading" | "ready" | "error";
  projection: SelfImproveProjection | null;
  error: string;
};

const EMPTY_STATE: SkillSelfImproveState = {
  status: "idle",
  projection: null,
  error: "",
};

async function readOptionalSkillFile(
  skillId: string,
  filePath: string | undefined,
): Promise<string> {
  if (!filePath) return "";
  return readSkillFile(skillId, filePath);
}

export function useSkillSelfImprove(
  skillId: string,
  programPath: string | undefined,
  progressPath: string | undefined,
): SkillSelfImproveState {
  const [state, setState] = useState<SkillSelfImproveState>(EMPTY_STATE);

  useEffect(() => {
    let cancelled = false;
    if (!skillId || (!programPath && !progressPath)) {
      setState(EMPTY_STATE);
      return () => {
        cancelled = true;
      };
    }

    setState({ status: "loading", projection: null, error: "" });
    Promise.all([
      readOptionalSkillFile(skillId, programPath),
      readOptionalSkillFile(skillId, progressPath),
    ])
      .then(([programMarkdown, progressMarkdown]) => {
        if (cancelled) return;
        setState({
          status: "ready",
          projection: buildSelfImproveProjection(programMarkdown, progressMarkdown),
          error: "",
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          projection: null,
          error: error instanceof Error ? error.message : "Self-improvement history unavailable.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [programPath, progressPath, skillId]);

  return state;
}
