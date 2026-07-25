import type { ReactElement } from "react";
import type { Id } from "../../../../convex/_generated/dataModel";

export type ResourceBankPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export type ResourceBankTab = "assets" | "elements" | "brand-kits";

export type CreativeElementKind =
  | "all"
  | "visual"
  | "audio"
  | "storyboard"
  | "editing"
  | "character"
  | "format";

export type ResourceBankPreviewStatus = {
  state: "ready" | "source_handle" | "missing";
  message: string;
};

export type ResourceBankAssetPreview = {
  _id?: string;
  title: string;
  assetKind: string;
  assetRole?: string;
  sourceUrl?: string;
  canonicalUrl?: string;
  storageId?: string | Id<"_storage">;
  storageUrl?: string | null;
  localPath?: string;
  assetId?: string | Id<"resourceBankAssets">;
};

export type ResourceBankDashboard = {
  totals: {
    assetCount: number;
    creativeElementCount?: number;
    skillFindingCount: number;
    latestSavedAt?: number;
  };
  assets: ResourceBankAsset[];
  topTags: Array<{ tag: string; count: number }>;
};

export type ResourceBankCreativeElement = {
  _id?: Id<"resourceBankCreativeElements">;
  ingestionJobId?: string;
  assetId: string;
  analysisId?: string;
  kind: Exclude<CreativeElementKind, "all">;
  title: string;
  description: string;
  whyItWorks: string;
  goldenExample: {
    assetId: string | Id<"resourceBankAssets">;
    description?: string;
  };
  goldenExampleAsset?: ResourceBankAssetPreview;
  goldenRecipe: string;
  anchor?: string;
  pinned?: boolean;
  tags: string[];
  assetTitle?: string;
  assetKind?: string;
  assetSourceUrl?: string;
  assetCanonicalUrl?: string;
  previewAsset?: ResourceBankAssetPreview;
  projectId?: string;
  taskId?: string;
};

export type BrandKitPromotionTarget = {
  elementId: Id<"resourceBankCreativeElements">;
  title: string;
};

export type ResourceBankAsset = ResourceBankAssetPreview & {
  _id?: string;
  assetRole: string;
  tags: string[];
  searchableText: string;
  projectId?: string;
  taskId?: string;
  createdAtMs: number;
  previewAsset?: ResourceBankAssetPreview;
  previewStatus?: ResourceBankPreviewStatus;
  derivedAssets?: ResourceBankAssetPreview[];
  analyses: Array<{
    _id?: string;
    sourceSkill?: string;
    analysisMarkdown: string;
    userIntent?: string;
    transcriptText?: string;
    confidence?: string;
    createdAtMs: number;
  }>;
  creativeElements?: Array<{
    _id?: Id<"resourceBankCreativeElements">;
    kind: string;
    title: string;
    description: string;
    whyItWorks: string;
    goldenExample: {
      assetId: string | Id<"resourceBankAssets">;
      description?: string;
    };
    goldenRecipe: string;
    anchor?: string;
    pinned?: boolean;
    tags: string[];
  }>;
  skillFindings: Array<{
    _id?: string;
    findingKind: string;
    skillId?: string;
    label: string;
    capability: string;
    evidenceAnchor: string;
    howToReuse: string;
    suggestedSkillChange?: string;
    tags: string[];
  }>;
};

export type BrandKitElementKind = Exclude<CreativeElementKind, "all">;

export type BrandKitElementSnapshot = {
  elementId: string;
  kind: BrandKitElementKind;
  title: string;
  description: string;
  whyItWorks: string;
  goldenExample: ResourceBankAssetPreview & { description?: string };
  goldenRecipe: string;
  anchor?: string;
  tags: string[];
  providerHandles?: Array<{
    provider: "elevenlabs" | "fish" | "other";
    handleKind: "voice_id" | "model_id" | "style_id" | "other";
    handle: string;
  }>;
  provenance: {
    resourceElementId?: string;
    ingestionJobId?: string;
    assetId?: string;
    analysisId?: string;
    promotedFrom: "resource_bank" | "manual";
    promotedAtMs: number;
    promotedBy?: string;
    idempotencyKeyHash?: string;
  };
  sourceSnapshotHash: string;
  approvedAtMs: number;
  approvedBy?: string;
};

export type BrandKitPrompt = {
  text: string;
  revision: number;
  updatedAtMs: number;
};

export type BrandKit = {
  _id?: Id<"brandKits">;
  kitId: string;
  projectId?: string;
  slug: string;
  name: string;
  description?: string;
  status: "active" | "archived";
  revision: number;
  elements: BrandKitElementSnapshot[];
  prompt: BrandKitPrompt;
  createdAtMs: number;
  updatedAtMs: number;
  archivedAtMs?: number;
};

export type BrandKitPromotionReceipt = {
  brandKitId: string;
  revisionBefore: number;
  revisionAfter: number;
  createdElementIds: string[];
  updatedElementIds: string[];
  dedupedElementIds: string[];
  sourceElementIds: string[];
};

export type FarplaneProjectConfigFile = {
  path?: string;
  kind?: string;
  parsedJson?: Record<string, unknown> | null;
};

export type StatePanelProps = {
  action?: ReactElement;
  detail: string;
  icon: ReactElement;
  title: string;
};
