"use client";

/**
 * Ownership: Skill OS selected-skill maintenance scoring.
 * Inputs: skill docs, graph edges, rollout metadata, extracted workbench sections, and eval coverage.
 * Outputs: transparent scorecard rows, gap rows, and a recommended maintenance action.
 * Side effects: none; scoring is read-only UI triage, not a source-of-truth policy engine.
 */

import type {
  SkillDoc,
  SkillGraphEdge,
  SkillGraphNode,
  SkillTemplateIntelligencePayload,
  SkillTemplateRolloutRow,
} from "./skill-os-types";
import type { SkillWorkbenchModel } from "./skill-workbench-model";

export type SkillScoreSignal = {
  detail: string;
  id: "direct_heat" | "composition_heat" | "maintainability" | "uniqueness";
  label: string;
  score: number;
};

export type SkillMaintenanceGap = {
  label: string;
  status: "good" | "risk" | "missing" | "unknown";
  value: string;
};

export type SkillDetailScorecard = {
  action: string;
  gaps: SkillMaintenanceGap[];
  score: number;
  signals: SkillScoreSignal[];
};

const EXPECTED_EVAL_COUNT = 5;

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeSignalValue(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value <= 1) return value * 100;
  if (value <= 10) return value * 10;
  return value;
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function getRolloutRow(
  skillId: string,
  templateIntelligence: SkillTemplateIntelligencePayload | null,
): SkillTemplateRolloutRow | null {
  return templateIntelligence?.rollout?.find((row) => row.skill_id === skillId) ?? null;
}

function buildDirectHeatScore(node: SkillGraphNode, invocationCount: number): SkillScoreSignal {
  const heat = node.heat;
  const heatScore = normalizeSignalValue(heat?.heat_score ?? 0);
  const recentCount = heat?.invocation_count_7d ?? heat?.invocation_count_recent ?? 0;
  const windowCount = Math.max(
    heat?.invocation_count_30d ?? 0,
    heat?.invocation_count_window ?? 0,
    invocationCount,
  );
  const breadth =
    (heat?.distinct_threads_30d ?? heat?.distinct_threads_window ?? 0) +
    (heat?.distinct_tickets_30d ?? heat?.distinct_tickets_window ?? 0);
  const score = clampScore(Math.max(heatScore, recentCount * 18, windowCount * 10) + breadth * 6);
  return {
    detail: `${windowCount || invocationCount} invokes / ${breadth} breadth`,
    id: "direct_heat",
    label: "Direct heat",
    score,
  };
}

function buildCompositionHeatScore(edges: SkillGraphEdge[], node: SkillGraphNode): SkillScoreSignal {
  const incoming = edges.filter((edge) => edge.target === node.id);
  const referrers = new Set(incoming.map((edge) => edge.source));
  const chains = incoming.filter((edge) => edge.type === "common-chain").length;
  const markdownRefs = incoming.filter((edge) => edge.type !== "common-chain").length;
  const score = clampScore(referrers.size * 18 + chains * 8 + markdownRefs * 4);
  return {
    detail: `${referrers.size} referrers / ${incoming.length} refs`,
    id: "composition_heat",
    label: "Composition heat",
    score,
  };
}

function buildMaintainabilityScore({
  doc,
  evalTaskCount,
  model,
  rollout,
}: {
  doc: SkillDoc | null;
  evalTaskCount: number;
  model: SkillWorkbenchModel;
  rollout: SkillTemplateRolloutRow | null;
}): SkillScoreSignal {
  let burden = 0;
  const frontmatter = doc?.frontmatter ?? {};
  const qaChecklist = frontmatter.qa_checklist;
  const hasQaChecklist =
    typeof qaChecklist === "string" ? qaChecklist.trim().length > 0 : Array.isArray(qaChecklist);
  if (!hasQaChecklist && !hasText(model.qaTasks)) burden += 20;
  if (!hasText(model.checklist)) burden += 14;
  if (!hasText(model.references)) burden += 10;
  if (!hasText(model.todo)) burden += 10;
  burden += Math.max(0, EXPECTED_EVAL_COUNT - evalTaskCount) * 8;
  if (rollout?.status === "stale") burden += 16;
  if (rollout?.status === "missing") burden += 20;
  if ((doc?.body ?? "").length > 12_000) burden += 12;
  return {
    detail: `${Math.max(0, EXPECTED_EVAL_COUNT - evalTaskCount)} eval gaps / ${rollout?.status ?? "unknown"} template`,
    id: "maintainability",
    label: "Maintainability",
    score: clampScore(100 - burden),
  };
}

function buildUniquenessScore({
  doc,
  edges,
  model,
  node,
}: {
  doc: SkillDoc | null;
  edges: SkillGraphEdge[];
  model: SkillWorkbenchModel;
  node: SkillGraphNode;
}): SkillScoreSignal {
  const methods = Array.isArray(doc?.frontmatter?.methods) ? doc.frontmatter.methods.length : 0;
  const outgoingTargets = new Set(edges.filter((edge) => edge.source === node.id).map((edge) => edge.target));
  const proofSurface = hasText(model.evals) || hasText(model.qaTasks) || hasText(model.checklist);
  const description = node.description?.trim() || doc?.frontmatter?.description;
  const genericNamePenalty = /^(plan|review|execute|test|qa|research|summary|status)$/i.test(node.id)
    ? 12
    : 0;
  const score = clampScore(
    58 + Math.min(18, methods * 8) + Math.min(12, outgoingTargets.size * 3) + (proofSurface ? 10 : 0) + (description ? 8 : 0) - genericNamePenalty,
  );
  return {
    detail: `${methods} methods / ${outgoingTargets.size} owned links`,
    id: "uniqueness",
    label: "Uniqueness",
    score,
  };
}

function gapStatus(value: boolean): SkillMaintenanceGap["status"] {
  return value ? "good" : "missing";
}

function buildGaps({
  doc,
  evalTaskCount,
  model,
  rollout,
}: {
  doc: SkillDoc | null;
  evalTaskCount: number;
  model: SkillWorkbenchModel;
  rollout: SkillTemplateRolloutRow | null;
}): SkillMaintenanceGap[] {
  const frontmatter = doc?.frontmatter ?? {};
  const qaChecklist = frontmatter.qa_checklist;
  const hasQaChecklist =
    typeof qaChecklist === "string" ? qaChecklist.trim().length > 0 : Array.isArray(qaChecklist);
  const bodySize = doc?.body?.length ?? 0;
  const templateStatus = rollout?.status ?? "unknown";
  return [
    {
      label: "eval coverage",
      status: evalTaskCount >= EXPECTED_EVAL_COUNT ? "good" : evalTaskCount > 0 ? "risk" : "missing",
      value: `${Math.min(evalTaskCount, EXPECTED_EVAL_COUNT)} / ${EXPECTED_EVAL_COUNT}`,
    },
    {
      label: "qa_checklist.md",
      status: gapStatus(hasQaChecklist || hasText(model.qaTasks)),
      value: hasQaChecklist ? "declared" : hasText(model.qaTasks) ? "section" : "missing",
    },
    {
      label: "template age",
      status:
        templateStatus === "current"
          ? "good"
          : templateStatus === "unknown" || templateStatus === "external"
            ? "unknown"
            : "risk",
      value: rollout?.template_version ?? templateStatus,
    },
    {
      label: "owner clarity",
      status: doc?.frontmatter?.owner || doc?.frontmatter?.group ? "good" : "unknown",
      value: String(doc?.frontmatter?.owner ?? doc?.frontmatter?.group ?? "unknown"),
    },
    {
      label: "first-load size",
      status: bodySize > 12_000 ? "risk" : "good",
      value: bodySize > 0 ? `${Math.round(bodySize / 1000)}k chars` : "missing",
    },
  ];
}

function recommendAction(signals: SkillScoreSignal[], gaps: SkillMaintenanceGap[]): string {
  const signalById = new Map(signals.map((signal) => [signal.id, signal.score]));
  const evalGap = gaps.find((gap) => gap.label === "eval coverage");
  if (evalGap?.status !== "good") return "Add eval coverage before broader reuse.";
  if ((signalById.get("maintainability") ?? 0) < 70) return "Pay down maintenance debt next.";
  if ((signalById.get("direct_heat") ?? 0) > 70 && (signalById.get("uniqueness") ?? 0) > 80) {
    return "Protect this hot distinct workflow.";
  }
  if ((signalById.get("composition_heat") ?? 0) > 70) return "Keep stable; many skills compose through it.";
  return "Monitor; no urgent action.";
}

export function buildSkillDetailScorecard({
  doc,
  edges,
  evalTaskCount,
  invocationCount,
  model,
  node,
  templateIntelligence,
}: {
  doc: SkillDoc | null;
  edges: SkillGraphEdge[];
  evalTaskCount: number;
  invocationCount: number;
  model: SkillWorkbenchModel;
  node: SkillGraphNode;
  templateIntelligence: SkillTemplateIntelligencePayload | null;
}): SkillDetailScorecard {
  const rollout = getRolloutRow(node.id, templateIntelligence);
  const signals = [
    buildDirectHeatScore(node, invocationCount),
    buildCompositionHeatScore(edges, node),
    buildMaintainabilityScore({ doc, evalTaskCount, model, rollout }),
    buildUniquenessScore({ doc, edges, model, node }),
  ];
  const gaps = buildGaps({ doc, evalTaskCount, model, rollout });
  return {
    action: recommendAction(signals, gaps),
    gaps,
    score: clampScore(signals.reduce((sum, signal) => sum + signal.score, 0) / signals.length),
    signals,
  };
}
