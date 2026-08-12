/** Read-only view types returned by the paginated Content Intelligence projection. */

export type ContentJob = {
  id: string;
  kind: "save_reference" | "analyze_youtube" | "ingest_feed_scout";
  status: "queued" | "analyzing" | "ready" | "failed" | "needs_review";
  projectId?: string;
  updatedAt: string;
  error?: string;
};

export type ContentIntelligenceItem = {
  id: string;
  sourceKind: string;
  sourceRef: string;
  canonicalRef: string;
  title: string;
  platform?: string;
  createdAt: string;
  updatedAt: string;
  lastObservedAt: string;
  latestDiscovery: {
    origin: "feed_scout";
    observedDate: string;
    entityGroupId: string;
    feedSourceId: string;
    externalKey: string;
    evidenceRefs: string[];
    tags: string[];
  } | null;
  jobs: ContentJob[];
  projectIds: string[];
  summary?: string;
  summarySource: "dossier" | "resource_bank" | "feed_scout" | null;
  dossierId?: string;
  resourceAssetId?: string;
};

export type ContentIntelligencePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: "content" | "world";
  companyWorldSource?: import("@/modules/world-map/hooks/use-company-world-projection").CompanyWorldProjectionSource;
};
