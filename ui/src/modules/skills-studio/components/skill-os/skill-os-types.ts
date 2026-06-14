"use client";

export type SkillGraphNode = {
  description?: string;
  group?: string;
  has_checklist?: boolean;
  id: string;
  label?: string;
  methods?: string[];
  path?: string;
  source?: "external" | "local" | string;
  tier?: number;
};

export type SkillGraphEdge = {
  label?: string;
  renderKey?: string;
  source: string;
  target: string;
  target_ref?: string;
  type?: "common-chain" | "markdown-ref" | string;
};

export type SkillGraphPayload = {
  counts?: {
    edge_types?: Record<string, number>;
    edges?: number;
    nodes?: number;
    sources?: Record<string, number>;
    tiers?: Record<string, number>;
  };
  edges: SkillGraphEdge[];
  nodes: SkillGraphNode[];
};

export type SkillDoc = {
  body?: string;
  frontmatter?: Record<string, unknown>;
  frontmatter_raw?: string;
  name?: string;
  path?: string;
};

export type SkillDocsPayload = {
  skills: Record<string, SkillDoc>;
};

export type GraphPoint = { x: number; y: number };

export type PositionedSkillNode = SkillGraphNode & {
  degree: number;
  radius: number;
  x: number;
  y: number;
};

export type SkillGraphLayout = {
  edges: SkillGraphEdge[];
  nodes: PositionedSkillNode[];
  points: Map<string, GraphPoint>;
};
