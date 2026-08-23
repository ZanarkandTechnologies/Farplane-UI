"use client";

export type SkillMethod = {
  class: "artifact" | "integration" | "internal" | string;
  id: string;
  output: string;
};

export type SkillGraphNode = {
  capability?: {
    consumes?: string[];
    produces?: string[];
  };
  area_id?: string;
  color?: string;
  department_id?: string;
  description?: string;
  eval?: string;
  group?: string;
  has_checklist?: boolean;
  facility_count?: number;
  heat?: {
    distinct_threads_30d?: number;
    distinct_threads_window?: number;
    distinct_tickets_30d?: number;
    distinct_tickets_window?: number;
    heat_score?: number;
    invocation_count_30d?: number;
    invocation_count_7d?: number;
    invocation_count_all?: number;
    invocation_count_recent?: number;
    invocation_count_window?: number;
    last_invoked_at?: string;
    observed_event_count_all?: number;
    recent_days?: number;
    window_days?: number;
  };
  id: string;
  kind?: string;
  label?: string;
  methods?: SkillMethod[];
  method_id?: string;
  output?: string;
  parent_skill?: string;
  path?: string;
  source?: "external" | "local" | string;
  role?: "facility" | "workstation" | string;
  skill_id?: string;
  tags?: string[];
  tier?: number;
  workstation_count?: number;
};

export type SkillGraphEdge = {
  label?: string;
  renderKey?: string;
  source: string;
  target: string;
  target_ref?: string;
  type?: "artifact-flow" | "common-chain" | "markdown-ref" | string;
};

export type SkillGraphPayload = {
  counts?: {
    edge_types?: Record<string, number>;
    edges?: number;
    node_kinds?: Record<string, number>;
    nodes?: number;
    sources?: Record<string, number>;
    tiers?: Record<string, number>;
  };
  edges: SkillGraphEdge[];
  nodes: SkillGraphNode[];
};

export type SkillCapabilityGraphPayload = SkillGraphPayload & {
  counts?: SkillGraphPayload["counts"] & {
    roles?: Record<"facility" | "workstation" | string, number>;
  };
  schema_version?: "2.2.0" | string;
  source?: {
    contract?: string;
    link_semantics?: string;
    omits?: string;
  };
};

export type SkillFrameworkCoreGraphNode = SkillGraphNode & {
  framework_role?: string;
  kind?: "file" | "skill" | "workflow" | string;
  source_match?: boolean;
  source_path?: string;
  tags?: string[];
};

export type SkillFrameworkCoreGraphPayload = {
  edges: SkillGraphEdge[];
  nodes: SkillFrameworkCoreGraphNode[];
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

export type SkillTemplateEpoch = {
  changed_sections?: string[];
  introduced_at?: string;
  section_count?: number;
  sections?: string[];
  snapshot_path?: string;
  source_commit?: string;
  summary?: string;
  version: string;
};

export type SkillTemplateVersionSummary = {
  introduced_at?: string;
  latest_at?: string;
  latest_commit?: string;
  latest_summary?: string;
  release_count?: number;
  sections?: string[];
  snapshot_path?: string;
  snapshots?: Array<{
    introduced_at?: string;
    snapshot_path?: string;
    source_commit?: string;
    summary?: string;
  }>;
  source_commit?: string;
  summary?: string;
  template_metadata?: {
    feature_refs?: string[];
    surface_fields?: Record<string, string>;
    template_id?: string;
    template_version?: string;
  };
  version: string;
};

export type SkillFeatureSummary = {
  evidence_refs?: string[];
  id: string;
  known_limits?: string;
  last_verified?: string;
  metrics?: string[];
  name: string;
  status?: string;
  surfaces?: string[];
};

export type SkillTemplateRolloutRow = {
  feature_refs?: string[];
  has_checklist?: boolean;
  path?: string;
  skill_id: string;
  source?: "external" | "local" | string;
  status?: "current" | "external" | "missing" | "stale" | "unknown" | string;
  template_version: string;
  tier?: number;
};

export type SkillTemplateEvalSummary = {
  behavior?: string;
  caveat?: string;
  eval_id: string;
  expected_signals?: string[];
  missing_signals?: string[];
  source_commit?: string;
  template_version: string;
  title?: string;
  verdict: "fail" | "pass" | "unknown" | string;
};

export type SkillTemplateIntelligencePayload = {
  caveats?: string[];
  current_template_version?: string;
  epochs?: SkillTemplateEpoch[];
  evals?: SkillTemplateEvalSummary[];
  features?: SkillFeatureSummary[];
  generated_at?: string;
  rollout?: SkillTemplateRolloutRow[];
  rollout_summary?: {
    by_source?: Record<string, number>;
    by_status?: Record<string, number>;
    by_template_version?: Record<string, number>;
    total_skills?: number;
  };
  schema_version?: string;
  source?: Record<string, string>;
  template_versions?: SkillTemplateVersionSummary[];
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
