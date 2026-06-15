"use client";

/**
 * Ownership: Skill OS Standards / Rollout data adapter.
 * Inputs: generated Farplane template-intelligence artifact plus skill graph/doc fallbacks.
 * Outputs: view rows and summary values for the read-only Skill OS workbench.
 * Side effects: none.
 */

import type {
  SkillDocsPayload,
  SkillFeatureSummary,
  SkillGraphNode,
  SkillTemplateEvalSummary,
  SkillTemplateIntelligencePayload,
  SkillTemplateRolloutRow,
} from "./skill-os-types";

export type StandardsViewModel = {
  caveats: string[];
  currentTemplateVersion: string;
  evals: SkillTemplateEvalSummary[];
  features: SkillFeatureSummary[];
  generatedAt: string;
  hasGeneratedArtifact: boolean;
  history: NonNullable<SkillTemplateIntelligencePayload["epochs"]>;
  rolloutRows: SkillTemplateRolloutRow[];
  summary: {
    current: number;
    external: number;
    features: number;
    missing: number;
    pass: number;
    stale: number;
    templates: number;
    total: number;
  };
  templateVersions: NonNullable<SkillTemplateIntelligencePayload["template_versions"]>;
};

function normalizeVersion(value: unknown): string {
  if (value === null || value === undefined || value === "") return "missing";
  return String(value);
}

function fallbackRows(
  docs: SkillDocsPayload | null,
  nodes: SkillGraphNode[],
): SkillTemplateRolloutRow[] {
  return nodes
    .map((node) => {
      const frontmatter = docs?.skills[node.id]?.frontmatter ?? {};
      const templateVersion = normalizeVersion(frontmatter.skill_template_version);
      return {
        feature_refs: Array.isArray(frontmatter.feature_refs)
          ? frontmatter.feature_refs.map(String)
          : [],
        has_checklist: Boolean(node.has_checklist),
        path: node.path,
        skill_id: node.id,
        source: node.source ?? "local",
        status:
          node.source === "external"
            ? "external"
            : templateVersion === "missing"
              ? "missing"
              : "unknown",
        template_version: templateVersion,
        tier: node.tier ?? 3,
      };
    })
    .sort((left, right) => left.skill_id.localeCompare(right.skill_id));
}

export function buildStandardsViewModel({
  docs,
  nodes,
  templateIntelligence,
}: {
  docs: SkillDocsPayload | null;
  nodes: SkillGraphNode[];
  templateIntelligence: SkillTemplateIntelligencePayload | null;
}): StandardsViewModel {
  const hasGeneratedArtifact = Boolean(templateIntelligence);
  const rolloutRows = templateIntelligence?.rollout?.length
    ? templateIntelligence.rollout
    : fallbackRows(docs, nodes);
  const statusCounts = rolloutRows.reduce<Record<string, number>>((counts, row) => {
    const key = row.status ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const templateVersionSet = new Set(rolloutRows.map((row) => row.template_version));
  const pass = (templateIntelligence?.evals ?? []).filter((row) => row.verdict === "pass").length;
  const templateVersions =
    templateIntelligence?.template_versions ??
    [...templateVersionSet].sort().map((version) => ({
      version,
      release_count: rolloutRows.filter((row) => row.template_version === version).length,
    }));

  return {
    caveats:
      templateIntelligence?.caveats ??
      ["Generated template intelligence artifact is unavailable; showing current frontmatter fallback."],
    currentTemplateVersion: templateIntelligence?.current_template_version ?? "unknown",
    evals: templateIntelligence?.evals ?? [],
    features: templateIntelligence?.features ?? [],
    generatedAt: templateIntelligence?.generated_at ?? "fallback",
    hasGeneratedArtifact,
    history: templateIntelligence?.epochs ?? [],
    rolloutRows,
    summary: {
      current: statusCounts.current ?? 0,
      external: statusCounts.external ?? 0,
      features: templateIntelligence?.features?.length ?? 0,
      missing: statusCounts.missing ?? 0,
      pass,
      stale: statusCounts.stale ?? 0,
      templates: templateVersionSet.size,
      total: rolloutRows.length,
    },
    templateVersions,
  };
}
