"use client";

export type HarnessGraphNode = {
  id: string;
  kind: string;
  label?: string;
  path?: string;
};

export type HarnessGraphEdge = {
  from_file?: string;
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
    scanned_files?: number;
    unresolved_refs?: number;
  };
  edges: HarnessGraphEdge[];
  generated_at?: string;
  nodes: HarnessGraphNode[];
  schema_version?: string;
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
