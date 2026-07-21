"use client";

/**
 * Ownership: read-only Skill OS access to one discovered skill-local file.
 * Inputs: selected skill id and a path returned by the Skill Studio inventory.
 * Outputs: text content plus loading/error state.
 * Side effects: fetches through the existing safe skill-file endpoint.
 */

import { useEffect, useState } from "react";
import type { SkillStudioFileContent } from "@/modules/runtime";

export type SkillFileContentState = {
  content: string;
  error: string;
  status: "idle" | "loading" | "ready" | "error";
};

const EMPTY_STATE: SkillFileContentState = { content: "", error: "", status: "idle" };

export async function readSkillFile(skillId: string, filePath: string): Promise<string> {
  const response = await fetch(
    `/openclaw/skills/${encodeURIComponent(skillId)}/file?path=${encodeURIComponent(filePath)}`,
  );
  if (!response.ok) throw new Error(`Unable to read ${filePath}`);
  const payload = (await response.json()) as { file?: SkillStudioFileContent };
  if (!payload.file?.isText) throw new Error(`${filePath} is not a text file`);
  return payload.file.content ?? "";
}

export function useSkillFileContent(skillId: string, filePath: string): SkillFileContentState {
  const [state, setState] = useState<SkillFileContentState>(EMPTY_STATE);

  useEffect(() => {
    let cancelled = false;
    if (!skillId || !filePath) {
      setState(EMPTY_STATE);
      return () => {
        cancelled = true;
      };
    }

    setState({ content: "", error: "", status: "loading" });
    readSkillFile(skillId, filePath)
      .then((content) => {
        if (!cancelled) setState({ content, error: "", status: "ready" });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          content: "",
          error: error instanceof Error ? error.message : "Skill file unavailable.",
          status: "error",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [filePath, skillId]);

  return state;
}
