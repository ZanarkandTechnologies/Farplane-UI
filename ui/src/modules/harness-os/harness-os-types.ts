"use client";

export type HarnessGraphNode = {
  description?: string;
  eval?: string;
  has_checklist?: boolean;
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
  framework_role?: "source" | "linked" | "isolated" | "other" | string;
  kind: string;
  label?: string;
  matched_patterns?: string[];
  path?: string;
  qa_checklist?: string;
  skill_ui?: string;
  source?: string;
  source_match?: boolean;
  source_path?: string;
  tier?: number;
  workflow_order?: number;
  workflow_skills?: string[];
};

export type HarnessGraphEdge = {
  confidence?: "explicit" | "parsed" | "curated" | string;
  evidence_ref?: string;
  from_file?: string;
  label?: string;
  raw_ref?: string;
  source: string;
  target: string;
  type?: string;
};

export type HarnessGraphPayload = {
  counts?: {
    edge_types?: Record<string, number>;
    edges?: number;
    node_kinds?: Record<string, number>;
    nodes?: number;
    framework_roles?: Record<string, number>;
    isolated_nodes?: number;
    linked_nodes?: number;
    other_nodes?: number;
    scanned_files?: number;
    source_nodes?: number;
    unresolved_refs?: number;
    workflow_nodes?: number;
  };
  edges: HarnessGraphEdge[];
  generated_at?: string;
  nodes: HarnessGraphNode[];
  schema_version?: string;
  source?: {
    exclude?: string[];
    expansion?: string;
    include?: string[];
    manifest?: string;
  };
  unresolved_refs?: unknown[];
};

export type HarnessFeatureSummary = {
  evidence_refs?: string[];
  id: string;
  known_limits?: string;
  last_verified?: string;
  metrics?: string[];
  name: string;
  status?: string;
  surfaces?: string[];
};

export type HarnessTemplateIntelligencePayload = {
  features?: HarnessFeatureSummary[];
  generated_at?: string;
};

export type HarnessAdoptionFeature = {
  explicitProjects?: string[];
  id: string;
  impliedProjects?: string[];
  name?: string;
  projectCount?: number;
  status?: string;
};

export type HarnessAdoptionProject = {
  drift?: unknown[];
  expectedSpecVersion?: string;
  featurePins?: Record<string, unknown>;
  impliedFeaturePins?: Record<string, unknown>;
  issues?: unknown[];
  localSkills?: string[];
  manifestExists?: boolean;
  manifestPath?: string;
  ok?: boolean;
  projectId?: string;
  root?: string;
  skillSourcePolicy?: string;
  specVersion?: string;
  templateUses?: Record<string, string>;
  usesLocalSkills?: boolean;
};

export type HarnessAdoptionPayload = {
  counts?: {
    driftItems?: number;
    manifests?: number;
    projects?: number;
    projectsWithLocalSkills?: number;
  };
  features?: Record<string, HarnessAdoptionFeature>;
  globalSpecVersion?: string;
  globalTemplateUses?: Record<string, string>;
  projects?: HarnessAdoptionProject[];
  schema?: string;
  schemaVersion?: string;
  standardRoot?: string;
};

export type HarnessSkillRolloutRow = {
  eval?: string;
  hasChecklist?: boolean;
  path?: string;
  qaChecklist?: string;
  skillId?: string;
  skillUi?: string;
  source?: string;
  status?: string;
  templateVersion?: string;
  tier?: number;
};

export type HarnessTemplateRolloutRow = {
  consumerId?: string;
  consumerScope?: string;
  currentVersion?: string;
  featureRefs?: string[];
  path?: string;
  status?: string;
  targetBasis?: string;
  templateId?: string;
  usedVersion?: string;
};

export type HarnessSkillRolloutPayload = {
  counts?: {
    current?: number;
    external?: number;
    missing?: number;
    skills?: number;
    stale?: number;
    templateDriftItems?: number;
    templateRolloutRows?: number;
    withChecklist?: number;
    withEval?: number;
    withQaChecklist?: number;
    withSkillUi?: number;
  };
  currentTemplateVersion?: string;
  registryCounts?: {
    bySource?: Record<string, number>;
    byTier?: Record<string, number>;
    skills?: number;
  };
  rolloutSummary?: {
    byStatus?: Record<string, number>;
    byTemplateVersion?: Record<string, number>;
    totalSkills?: number;
  };
  schema?: string;
  schemaVersion?: string;
  skills?: HarnessSkillRolloutRow[];
  templateRollout?: HarnessTemplateRolloutRow[];
  templateRolloutSummary?: Record<
    string,
    {
      by_scope?: Record<string, number>;
      by_status?: Record<string, number>;
      current_version?: string;
      feature_refs?: string[];
      target_basis?: string;
      total_consumers?: number;
    }
  >;
};

export type HarnessTemplateTrackingStatus =
  | "tracked"
  | "stale"
  | "unversioned"
  | "missing"
  | "scanner-gap";

export type HarnessTemplateTrackingFamily = {
  consumerScope?: string;
  consumerCount?: number;
  currentVersion?: string;
  description?: string;
  familyId: string;
  featureRefs?: string[];
  historyPolicy?: "git" | "snapshot" | "none" | string;
  installTarget?:
    | "codex-global"
    | "project-scaffold"
    | "skill-package"
    | "ticket-scaffold"
    | "runtime-template"
    | "source-only"
    | "unknown"
    | string;
  label: string;
  notes?: string;
  observedVersion?: string;
  owner?: string;
  paths?: string[];
  registryPath?: string;
  scope: string;
  source: "manifest" | "frontmatter" | "template-file" | "derived" | "scanner-gap" | "registry";
  status: HarnessTemplateTrackingStatus;
  templateVersion?: string;
  usedVersion?: string;
};

export type HarnessTemplateTrackingPayload = {
  counts?: {
    families?: number;
    missing?: number;
    scannerGaps?: number;
    stale?: number;
    tracked?: number;
    unversioned?: number;
  };
  families: HarnessTemplateTrackingFamily[];
  generatedAt?: string;
  projectRoot?: string;
  registrySource?: string | null;
  registryStatus?: "loaded" | "fallback" | string;
  schema?: string;
  schemaVersion?: string;
};

export type HarnessBridgePayload<T> = {
  error?: string;
  frameworkRoot?: string;
  ok: boolean;
  payload?: T;
};

export type HarnessLifecycleNode = {
  id: string;
  kind: string;
  label: string;
  metadata?: Record<string, unknown>;
  owner?: string;
  path?: string;
  tags?: string[];
};

export type HarnessLifecycleEdge = HarnessGraphEdge & {
  confidence: "explicit" | "parsed" | "curated" | string;
  evidence_ref: string;
};

export type HarnessFsaProjection = {
  id: string;
  label: string;
  start: string;
  states: string[];
  terminal: string[];
  transitions: HarnessLifecycleEdge[];
};

export type HarnessLifecyclePayload = {
  counts?: {
    edge_confidence?: Record<string, number>;
    edge_types?: Record<string, number>;
    edges?: number;
    fsa_projections?: number;
    node_kinds?: Record<string, number>;
    nodes?: number;
    parsed_skills?: number;
  };
  edges: HarnessLifecycleEdge[];
  fsa_projections?: HarnessFsaProjection[];
  generated_at?: string;
  nodes: HarnessLifecycleNode[];
  schema_version?: string;
  source?: string;
};
