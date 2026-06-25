"use client";

import { useEffect, useState } from "react";
import type {
  SkillDocsPayload,
  SkillFrameworkCoreGraphPayload,
  SkillGraphPayload,
  SkillTemplateIntelligencePayload,
} from "./skill-os-types";

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

function isSkillTemplateIntelligencePayload(
  value: unknown,
): value is SkillTemplateIntelligencePayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SkillTemplateIntelligencePayload>;
  return Array.isArray(candidate.rollout) || Array.isArray(candidate.epochs);
}

export function useSkillGraphData(): {
  docs: SkillDocsPayload | null;
  error: string | null;
  frameworkCoreGraph: SkillFrameworkCoreGraphPayload | null;
  graph: SkillGraphPayload | null;
  templateIntelligence: SkillTemplateIntelligencePayload | null;
  templateIntelligenceError: string | null;
} {
  const [graph, setGraph] = useState<SkillGraphPayload | null>(null);
  const [frameworkCoreGraph, setFrameworkCoreGraph] =
    useState<SkillFrameworkCoreGraphPayload | null>(null);
  const [docs, setDocs] = useState<SkillDocsPayload | null>(null);
  const [templateIntelligence, setTemplateIntelligence] =
    useState<SkillTemplateIntelligencePayload | null>(null);
  const [templateIntelligenceError, setTemplateIntelligenceError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const [graphResponse, docsResponse, templateResponse, frameworkCoreResponse] =
          await Promise.all([
            fetch("/farplane/framework-graph/skill-graph.json"),
            fetch("/farplane/framework-graph/skill-docs.json"),
            fetch("/farplane/framework-graph/skill-template-intelligence.json"),
            fetch("/farplane/framework-graph/farplane-framework-core-graph.json"),
          ]);
        const [graphPayload, docsPayload, frameworkCorePayload] = await Promise.all([
          graphResponse.json() as Promise<unknown>,
          docsResponse.json() as Promise<unknown>,
          frameworkCoreResponse.ok
            ? (frameworkCoreResponse.json() as Promise<unknown>)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        if (!isSkillGraphPayload(graphPayload) || !isSkillDocsPayload(docsPayload)) {
          setError("skill_graph_payload_invalid");
          return;
        }
        setGraph(graphPayload);
        setDocs(docsPayload);
        setFrameworkCoreGraph(
          isSkillGraphPayload(frameworkCorePayload)
            ? (frameworkCorePayload as SkillFrameworkCoreGraphPayload)
            : null,
        );
        if (templateResponse.ok) {
          const templatePayload = (await templateResponse.json()) as unknown;
          if (isSkillTemplateIntelligencePayload(templatePayload)) {
            setTemplateIntelligence(templatePayload);
            setTemplateIntelligenceError(null);
          } else {
            setTemplateIntelligence(null);
            setTemplateIntelligenceError("skill_template_intelligence_payload_invalid");
          }
        } else {
          setTemplateIntelligence(null);
          setTemplateIntelligenceError("skill_template_intelligence_not_available");
        }
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

  return { docs, error, frameworkCoreGraph, graph, templateIntelligence, templateIntelligenceError };
}
