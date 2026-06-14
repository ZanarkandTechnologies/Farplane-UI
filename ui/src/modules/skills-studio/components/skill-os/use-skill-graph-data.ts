"use client";

import { useEffect, useState } from "react";
import type { SkillDocsPayload, SkillGraphPayload } from "./skill-os-types";

function isSkillGraphPayload(value: unknown): value is SkillGraphPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SkillGraphPayload>;
  return Array.isArray(candidate.nodes) && Array.isArray(candidate.edges);
}

function isSkillDocsPayload(value: unknown): value is SkillDocsPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SkillDocsPayload>;
  return Boolean(candidate.skills && typeof candidate.skills === "object");
}

export function useSkillGraphData(): {
  docs: SkillDocsPayload | null;
  error: string | null;
  graph: SkillGraphPayload | null;
} {
  const [graph, setGraph] = useState<SkillGraphPayload | null>(null);
  const [docs, setDocs] = useState<SkillDocsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const [graphResponse, docsResponse] = await Promise.all([
          fetch("/codex/skill-maintenance-graph/skill-graph.json"),
          fetch("/codex/skill-maintenance-graph/skill-docs.json"),
        ]);
        const [graphPayload, docsPayload] = await Promise.all([
          graphResponse.json() as Promise<unknown>,
          docsResponse.json() as Promise<unknown>,
        ]);
        if (cancelled) return;
        if (!isSkillGraphPayload(graphPayload) || !isSkillDocsPayload(docsPayload)) {
          setError("skill_graph_payload_invalid");
          return;
        }
        setGraph(graphPayload);
        setDocs(docsPayload);
        setError(null);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "skill_graph_load_failed");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { docs, error, graph };
}
