"use client";

import { useEffect, useState } from "react";
import {
  isHarnessGraphPayload,
  isHarnessTemplateIntelligencePayload,
} from "./harness-os-model";
import type { HarnessGraphPayload, HarnessTemplateIntelligencePayload } from "./harness-os-types";

export function useHarnessOsData(): {
  error: string | null;
  graph: HarnessGraphPayload | null;
  templateIntelligence: HarnessTemplateIntelligencePayload | null;
} {
  const [graph, setGraph] = useState<HarnessGraphPayload | null>(null);
  const [templateIntelligence, setTemplateIntelligence] =
    useState<HarnessTemplateIntelligencePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const [graphResponse, templateResponse] = await Promise.all([
          fetch("/codex/skill-maintenance-graph/harness-graph.json"),
          fetch("/codex/skill-maintenance-graph/skill-template-intelligence.json"),
        ]);
        const graphPayload = (await graphResponse.json()) as unknown;
        if (cancelled) return;
        if (!isHarnessGraphPayload(graphPayload)) {
          setError("harness_graph_payload_invalid");
          return;
        }
        setGraph(graphPayload);
        if (templateResponse.ok) {
          const templatePayload = (await templateResponse.json()) as unknown;
          setTemplateIntelligence(
            isHarnessTemplateIntelligencePayload(templatePayload) ? templatePayload : null,
          );
        } else {
          setTemplateIntelligence(null);
        }
        setError(null);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "harness_os_load_failed");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { error, graph, templateIntelligence };
}
