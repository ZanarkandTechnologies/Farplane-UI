"use client";

/**
 * SKILL WORKBENCH MODEL
 * =====================
 * Ownership: Skill OS selected-skill detail derivation.
 * Inputs: embedded skill docs, graph node/edge metadata, invocation counts.
 * Outputs: virtual special-file graph and section snippets for UI renderers.
 * Side effects: none.
 * Invariants: derives read-only views from existing skill graph/doc payloads.
 */

import type { SkillDoc, SkillGraphEdge, SkillGraphNode } from "./skill-os-types";

export type SkillArtifactKind =
  | "skill"
  | "frontmatter"
  | "todo"
  | "qa"
  | "checklist"
  | "references"
  | "evals"
  | "ui"
  | "raw";

export type SkillArtifactNode = {
  id: SkillArtifactKind;
  label: string;
  detail: string;
  available: boolean;
};

export type SkillWorkbenchModel = {
  artifacts: SkillArtifactNode[];
  checklist: string;
  evalCount: number;
  evalPath?: string;
  fileEdges: Array<{ source: SkillArtifactKind; target: SkillArtifactKind }>;
  frontmatterEntries: Array<[string, unknown]>;
  invocationCount: number;
  outgoing: SkillGraphEdge[];
  incoming: SkillGraphEdge[];
  qaTasks: string;
  raw: string;
  references: string;
  summary: string;
  todo: string;
  ui: string;
};

function extractHeadingSection(body: string, headingMatcher: RegExp): string {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => /^#{1,4}\s+/.test(line) && headingMatcher.test(line));
  if (start < 0) return "";
  const startLevel = lines[start].match(/^#+/)?.[0].length ?? 1;
  const collected: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const level = line.match(/^#+/)?.[0].length;
    if (level && level <= startLevel) break;
    collected.push(line);
  }
  return collected.join("\n").trim();
}

function extractChecklistLines(body: string): string {
  return body
    .split(/\r?\n/)
    .filter((line) => /^\s*[-*]\s+\[[ xX]\]/.test(line))
    .join("\n")
    .trim();
}

function extractMarkdownLinks(body: string): string {
  const matches = [...body.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)];
  return matches
    .map((match) => `- ${match[1]}: ${match[2]}`)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join("\n");
}

function stringifyFrontmatterRefs(doc: SkillDoc | null): string {
  const refs = doc?.frontmatter?.feature_refs;
  if (!Array.isArray(refs)) return "";
  return refs.map((ref) => `- ${String(ref)}`).join("\n");
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

export function buildSkillWorkbenchModel({
  doc,
  edges,
  invocationCount,
  node,
  evalCount = 0,
  evalPath,
}: {
  doc: SkillDoc | null;
  edges: SkillGraphEdge[];
  invocationCount: number;
  node: SkillGraphNode;
  evalCount?: number;
  evalPath?: string;
}): SkillWorkbenchModel {
  const body = doc?.body ?? "";
  const checklistSection = extractHeadingSection(body, /checklist|done\s*\/\s*proof/i);
  const checklist = checklistSection;
  const todo = extractHeadingSection(body, /todo\s*list|runbook|program/i);
  const qaTasks = extractHeadingSection(body, /qa\s*tasks?|test\s*plan|proof\s*tasks?/i);
  const references = [
    extractHeadingSection(body, /reference|source|link/i),
    extractMarkdownLinks(body),
    stringifyFrontmatterRefs(doc),
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();
  const ui = extractHeadingSection(body, /ui|interface|viewer|surface|panel/i);
  const outgoing = edges.filter((edge) => edge.source === node.id);
  const incoming = edges.filter((edge) => edge.target === node.id);
  const frontmatterEntries = Object.entries(doc?.frontmatter ?? {});

  const artifacts: SkillArtifactNode[] = [
    {
      id: "skill",
      label: "SKILL.md",
      detail: doc?.path ?? node.path ?? "",
      available: hasText(body),
    },
    {
      id: "frontmatter",
      label: "frontmatter",
      detail: `${frontmatterEntries.length} keys`,
      available: frontmatterEntries.length > 0,
    },
    { id: "todo", label: "todo", detail: "extracted tasks", available: hasText(todo) },
    { id: "qa", label: "qa tasks", detail: "proof/test section", available: hasText(qaTasks) },
    {
      id: "checklist",
      label: "checklist",
      detail: "checkboxes / done proof",
      available: hasText(checklist),
    },
    {
      id: "references",
      label: "references",
      detail: "links and refs",
      available: hasText(references),
    },
    {
      id: "evals",
      label: "evals/evals.json",
      detail: evalPath ?? "not registered",
      available: evalCount > 0,
    },
    { id: "ui", label: "ui", detail: "surface hints", available: hasText(ui) },
    { id: "raw", label: "raw files", detail: "embedded document", available: hasText(body) },
  ];

  return {
    artifacts,
    checklist,
    evalCount,
    evalPath,
    fileEdges: artifacts.slice(1).map((artifact) => ({ source: "skill", target: artifact.id })),
    frontmatterEntries,
    invocationCount,
    incoming,
    outgoing,
    qaTasks,
    raw: body,
    references,
    summary: node.description || "No description available.",
    todo,
    ui,
  };
}
