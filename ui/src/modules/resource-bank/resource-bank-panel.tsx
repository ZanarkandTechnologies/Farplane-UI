"use client";

/**
 * RESOURCE BANK PANEL
 * ===================
 * Ownership: Resource Bank UI module.
 * Inputs: Convex resource-bank dashboard query.
 * Outputs: searchable visual asset cards and selected creative elements.
 * Side effects: optional demo seed mutation; no raw media copying.
 */

import { useMutation, useQuery } from "convex/react";
import {
  Database,
  ExternalLink,
  Film,
  ImageIcon,
  Lightbulb,
  LinkIcon,
  Search,
  Sparkles,
  Tags,
} from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UI_Z } from "@/lib/z-index";
import { isConvexEnabled } from "@/providers/convex-provider";
import { api } from "../../../../convex/_generated/api";

type ResourceBankPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ResourceBankTab = "assets" | "elements";

type CreativeElementKind =
  | "all"
  | "visual"
  | "audio"
  | "hook"
  | "storyboard"
  | "editing"
  | "copy"
  | "character"
  | "format"
  | "constraint";

type ResourceBankDashboard = {
  totals: {
    assetCount: number;
    creativeElementCount?: number;
    skillFindingCount: number;
    latestSavedAt?: number;
  };
  assets: ResourceBankAsset[];
  topTags: Array<{ tag: string; count: number }>;
};

type ResourceBankCreativeElement = {
  _id?: string;
  assetId: string;
  kind: Exclude<CreativeElementKind, "all">;
  title: string;
  description: string;
  anchor?: string;
  pinned?: boolean;
  tags: string[];
  assetTitle?: string;
  assetKind?: string;
  assetSourceUrl?: string;
  assetCanonicalUrl?: string;
};

type ResourceBankAsset = {
  _id?: string;
  title: string;
  assetKind: string;
  assetRole: string;
  sourceUrl?: string;
  canonicalUrl?: string;
  storageId?: string;
  storageUrl?: string | null;
  localPath?: string;
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
    analysisType: string;
    sourceSkill?: string;
    facts?: string[];
    interpretation?: string[];
    userIntent?: string;
    whyItWorks: string[];
    takeaways: string[];
    transcriptText?: string;
    frameNotes?: string;
    promptGuess?: string;
    remixConstraints: string[];
    confidence?: string;
    createdAtMs: number;
  }>;
  creativeElements?: Array<{
    _id?: string;
    kind: string;
    title: string;
    description: string;
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

const CREATIVE_ELEMENT_KINDS: CreativeElementKind[] = [
  "all",
  "visual",
  "hook",
  "format",
  "character",
  "storyboard",
  "editing",
  "copy",
  "audio",
  "constraint",
];

type ResourceBankPreviewStatus = {
  state: "ready" | "source_handle" | "missing";
  message: string;
};

type ResourceBankAssetPreview = {
  _id?: string;
  title: string;
  assetKind: string;
  assetRole: string;
  sourceUrl?: string;
  canonicalUrl?: string;
  storageId?: string;
  storageUrl?: string | null;
  localPath?: string;
};

function StatePanel(props: {
  action?: ReactElement;
  detail: string;
  icon: ReactElement;
  title: string;
}): ReactElement {
  return (
    <div className="flex h-full min-h-[360px] items-center justify-center">
      <div className="max-w-md rounded-md border bg-card px-5 py-5 text-center shadow-sm">
        <div className="mx-auto flex size-10 items-center justify-center rounded-md border bg-background text-muted-foreground">
          {props.icon}
        </div>
        <div className="mt-3 text-sm font-semibold">{props.title}</div>
        <div className="mt-1 text-xs leading-5 text-muted-foreground">{props.detail}</div>
        {props.action ? <div className="mt-4">{props.action}</div> : null}
      </div>
    </div>
  );
}

function MetricTile(props: {
  icon: ReactElement;
  label: string;
  value: string;
  detail: string;
}): ReactElement {
  return (
    <div className="rounded-md border bg-card px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {props.icon}
        <span>{props.label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{props.value}</div>
      <div className="mt-1 truncate text-xs text-muted-foreground">{props.detail}</div>
    </div>
  );
}

function formatTime(value: number | undefined): string {
  if (!value) return "never";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTag(tag: string): string {
  return tag.replace(/^[^:]+:/, "").replace(/-/g, " ");
}

function formatKind(kind: string): string {
  return kind.replace(/-/g, " ");
}

function assetIcon(kind: string): ReactElement {
  if (kind === "video" || kind === "clip") return <Film className="size-4" />;
  if (kind === "image" || kind === "screenshot" || kind === "frame")
    return <ImageIcon className="size-4" />;
  if (kind === "url") return <LinkIcon className="size-4" />;
  return <Database className="size-4" />;
}

function displayablePreviewUrl(asset: ResourceBankAssetPreview | undefined): string | undefined {
  if (asset?.storageUrl) return asset.storageUrl;
  if (asset?.localPath) {
    return `/@fs${asset.localPath.split("/").map(encodeURIComponent).join("/")}`;
  }
  const candidate = sourceUrl(asset);
  if (!candidate) return undefined;
  if (candidate.startsWith("data:image/") || candidate.startsWith("blob:")) {
    return candidate;
  }
  if (!candidate.startsWith("https://") && !candidate.startsWith("http://")) return undefined;
  if (/\.(avif|gif|jpe?g|png|webp)(\?.*)?$/i.test(candidate)) return candidate;
  return undefined;
}

function hasPreviewHandle(asset: ResourceBankAssetPreview | undefined): boolean {
  return Boolean(asset?.sourceUrl ?? asset?.canonicalUrl ?? asset?.storageId ?? asset?.localPath);
}

function sourceUrl(asset: ResourceBankAssetPreview | undefined): string | undefined {
  return asset?.canonicalUrl ?? asset?.sourceUrl;
}

function sourceLabel(asset: ResourceBankAssetPreview | undefined): string | undefined {
  const value = sourceUrl(asset);
  if (!value) return asset?.localPath?.split("/").pop();
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

function AssetPreview(props: {
  asset: ResourceBankAssetPreview | undefined;
  fallbackKind: string;
  previewStatus?: ResourceBankPreviewStatus;
  title: string;
  compact?: boolean;
}): ReactElement {
  const previewUrl = displayablePreviewUrl(props.asset);
  const heightClass = props.compact ? "h-28" : "h-40";
  if (previewUrl) {
    return (
      <div className={`overflow-hidden rounded-md border bg-muted ${heightClass}`}>
        <img src={previewUrl} alt="" className="size-full object-cover" loading="lazy" />
      </div>
    );
  }
  const hasHandle = hasPreviewHandle(props.asset);
  const stateLabel =
    props.previewStatus?.state === "missing"
      ? "No source saved"
      : hasHandle
        ? "Preview not stored"
        : "Preview missing";
  const statusDetail =
    props.previewStatus?.state === "source_handle"
      ? "Source saved only"
      : sourceLabel(props.asset) ?? props.fallbackKind;
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-md border bg-muted px-3 text-center text-muted-foreground ${heightClass}`}
      title={props.previewStatus?.message}
    >
      {assetIcon(props.asset?.assetKind ?? props.fallbackKind)}
      <span className="max-w-full truncate text-[11px] font-semibold">{stateLabel}</span>
      <span className="max-w-full truncate text-[10px]">{statusDetail}</span>
      <span className="sr-only">{props.title}</span>
    </div>
  );
}

function CreativeElementCard(props: {
  element: ResourceBankCreativeElement;
  onSelectAsset: (assetId: string) => void;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={() => props.onSelectAsset(props.element.assetId)}
      className="rounded-md border bg-background p-3 text-left transition hover:bg-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <Lightbulb className="size-4 shrink-0 text-muted-foreground" />
            <div className="truncate text-sm font-semibold">{props.element.title}</div>
          </div>
          <div className="mt-1 truncate text-[11px] text-muted-foreground">
            {props.element.assetTitle ?? "Unknown source"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {props.element.pinned ? (
            <Badge variant="default" className="text-[10px]">
              pinned
            </Badge>
          ) : null}
          <Badge variant="secondary" className="text-[10px]">
            {formatKind(props.element.kind)}
          </Badge>
        </div>
      </div>
      <div className="mt-3 line-clamp-3 text-xs leading-5 text-muted-foreground">
        {props.element.description}
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {props.element.anchor ? (
          <Badge variant="outline" className="max-w-full truncate text-[10px]">
            {props.element.anchor}
          </Badge>
        ) : null}
        {props.element.assetKind ? (
          <Badge variant="outline" className="text-[10px]">
            {props.element.assetKind}
          </Badge>
        ) : null}
        {props.element.tags.slice(0, 3).map((tag) => (
          <Badge key={tag} variant="secondary" className="text-[10px]">
            {formatTag(tag)}
          </Badge>
        ))}
      </div>
    </button>
  );
}

function TextListSection(props: { title: string; items: string[] | undefined }): ReactElement | null {
  const items = props.items?.filter(Boolean) ?? [];
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase text-muted-foreground">{props.title}</div>
      <div className="mt-2 space-y-2">
        {items.map((text) => (
          <div key={text} className="rounded-md bg-muted px-3 py-2 text-xs leading-5">
            {text}
          </div>
        ))}
      </div>
    </div>
  );
}

function TextBlockSection(props: {
  title: string;
  text: string | undefined;
}): ReactElement | null {
  if (!props.text) return null;
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase text-muted-foreground">{props.title}</div>
      <div className="mt-2 whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-xs leading-5">
        {props.text}
      </div>
    </div>
  );
}

export function ResourceBankPanel({ open, onOpenChange }: ResourceBankPanelProps): ReactElement {
  const convexEnabled = isConvexEnabled();
  const canSeedDemo = import.meta.env.DEV;
  const [activeTab, setActiveTab] = useState<ResourceBankTab>("assets");
  const [elementKind, setElementKind] = useState<CreativeElementKind>("all");
  const [query, setQuery] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const seedDemo = useMutation(api.modules.resourceBank.demo.seedDemoResourceBank);
  const data = useQuery(
    api.modules.resourceBank.retrieval.getResourceBankDashboard,
    convexEnabled && open ? { query: query.trim() || undefined, limit: 28 } : "skip",
  ) as ResourceBankDashboard | undefined;
  const creativeElements = useQuery(
    api.modules.resourceBank.creativeElements.listCreativeElements,
    convexEnabled && open
      ? {
          query: query.trim() || undefined,
          kind: elementKind === "all" ? undefined : elementKind,
          limit: 120,
        }
      : "skip",
  ) as ResourceBankCreativeElement[] | undefined;

  const selectedAsset = useMemo(() => {
    if (!data) return null;
    return data.assets.find((asset) => asset._id === selectedAssetId) ?? data.assets[0] ?? null;
  }, [data, selectedAssetId]);
  const selectedCreativeElements = selectedAsset?.creativeElements ?? [];
  const pinnedSelectedElements = selectedCreativeElements.filter((element) => element.pinned);
  const unpinnedSelectedElements = selectedCreativeElements.filter((element) => !element.pinned);

  const content = (() => {
    if (!convexEnabled) {
      return (
        <StatePanel
          icon={<Database className="size-5" />}
          title="Resource Bank unavailable"
          detail="Convex is not configured for this UI session, so saved media references cannot be loaded."
        />
      );
    }
    if (data === undefined) {
      return (
        <StatePanel
          icon={<Sparkles className="size-5" />}
          title="Loading Resource Bank"
          detail="Reading saved assets, analyses, creative elements, and previews."
        />
      );
    }
    if (data.totals.assetCount === 0 && query.trim().length === 0) {
      return (
        <StatePanel
          icon={<Lightbulb className="size-5" />}
          title="No saved references yet"
          detail="Ingest a link, image, video, poster, landing page, or note with $ingest-content. The bank stores the source, compact analysis, and extracted creative elements."
          action={
            canSeedDemo ? (
              <Button
                size="sm"
                onClick={() => void seedDemo({ confirm: "seed-resource-bank-demo" })}
              >
                Seed demo reference
              </Button>
            ) : undefined
          }
        />
      );
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-4">
          <MetricTile
            icon={<Database className="size-4" />}
            label="Assets"
            value={String(data.totals.assetCount)}
            detail="Primary saved references"
          />
          <MetricTile
            icon={<Lightbulb className="size-4" />}
            label="Elements"
            value={String(data.totals.creativeElementCount ?? 0)}
            detail="Extracted creative parts"
          />
          <MetricTile
            icon={<Tags className="size-4" />}
            label="Tags"
            value={String(data.topTags.length)}
            detail="Typed facets"
          />
          <MetricTile
            icon={<Sparkles className="size-4" />}
            label="Latest"
            value={formatTime(data.totals.latestSavedAt)}
            detail="Most recent save"
          />
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as ResourceBankTab)}
          className="min-h-0 flex-1 overflow-hidden"
        >
          <div className="flex flex-col gap-3 rounded-md border bg-card px-4 py-3 md:flex-row md:items-center">
            <TabsList className="shrink-0">
              <TabsTrigger value="assets">Assets</TabsTrigger>
              <TabsTrigger value="elements">Elements</TabsTrigger>
            </TabsList>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedAssetId(null);
                }}
                placeholder={
                  activeTab === "elements"
                    ? "Search creative elements, descriptions, anchors, and tags"
                    : "Search assets, notes, tags, and extracted techniques"
                }
                className="h-8 min-w-0"
              />
            </div>
          </div>

          <TabsContent value="assets" className="m-0 mt-4 min-h-0">
            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
              <section className="min-h-0 rounded-md border bg-card">
                <div className="grid max-h-[54vh] gap-3 overflow-auto p-3 md:grid-cols-2 xl:grid-cols-3">
                  {data.assets.length > 0 ? (
                    data.assets.map((asset) => (
                      <button
                        key={asset._id ?? asset.title}
                        type="button"
                        onClick={() => {
                          setSelectedAssetId(asset._id ?? null);
                        }}
                        className={`rounded-md border p-3 text-left transition hover:bg-accent ${
                          selectedAsset?._id === asset._id
                            ? "border-primary bg-primary/10"
                            : "bg-background"
                        }`}
                      >
                        <AssetPreview
                          asset={asset.previewAsset ?? asset}
                          fallbackKind={asset.assetKind}
                          previewStatus={asset.previewStatus}
                          title={asset.title}
                          compact
                        />
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            {assetIcon(asset.assetKind)}
                            <div className="truncate text-sm font-semibold">{asset.title}</div>
                          </div>
                          <Badge variant="outline">{asset.assetKind}</Badge>
                        </div>
                        <div className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {asset.searchableText}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1">
                          {asset.tags.slice(0, 4).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-[10px]">
                              {formatTag(tag)}
                            </Badge>
                          ))}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                      No assets match this search.
                    </div>
                  )}
                </div>
              </section>

              <aside className="min-h-0 rounded-md border bg-card">
                <div className="border-b px-4 py-3 text-sm font-semibold">Selected Asset</div>
                {selectedAsset ? (
                  <div className="max-h-[54vh] overflow-auto p-4">
                    <AssetPreview
                      asset={selectedAsset.previewAsset ?? selectedAsset}
                      fallbackKind={selectedAsset.assetKind}
                      previewStatus={selectedAsset.previewStatus}
                      title={selectedAsset.title}
                    />
                    <div className="mt-4 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{selectedAsset.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {selectedAsset.assetKind} | saved {formatTime(selectedAsset.createdAtMs)}
                        </div>
                        {sourceUrl(selectedAsset) ? (
                          <Button asChild variant="outline" size="sm" className="mt-3">
                            <a href={sourceUrl(selectedAsset)} target="_blank" rel="noreferrer">
                              <ExternalLink className="size-3.5" />
                              Open source
                            </a>
                          </Button>
                        ) : null}
                      </div>
                      <Badge variant="outline">{selectedAsset.skillFindings.length} findings</Badge>
                      <Badge variant="outline">
                        {selectedAsset.creativeElements?.length ?? 0} elements
                      </Badge>
                    </div>

                    <div className="mt-4">
                      <div className="text-xs font-semibold uppercase text-muted-foreground">
                        Pinned Taste
                      </div>
                      <div className="mt-2 space-y-2">
                        {pinnedSelectedElements.length > 0 ? (
                          pinnedSelectedElements.map((element) => (
                            <div
                              key={element._id ?? `${element.kind}:${element.title}`}
                              className="rounded-md border border-primary/40 bg-primary/5 p-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-xs font-semibold">{element.title}</div>
                                <Badge variant="default">{element.kind}</Badge>
                              </div>
                              <div className="mt-2 text-xs leading-5 text-muted-foreground">
                                {element.description}
                              </div>
                              {element.anchor ? (
                                <div className="mt-2 text-[11px] font-medium text-muted-foreground">
                                  {element.anchor}
                                </div>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                            No pinned taste elements on this asset.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="text-xs font-semibold uppercase text-muted-foreground">
                        Other Creative Elements
                      </div>
                      <div className="mt-2 space-y-2">
                        {unpinnedSelectedElements.length > 0 ? (
                          unpinnedSelectedElements.map((element) => (
                            <div
                              key={element._id ?? `${element.kind}:${element.title}`}
                              className="rounded-md border p-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-xs font-semibold">{element.title}</div>
                                <Badge variant="secondary">{element.kind}</Badge>
                              </div>
                              <div className="mt-2 text-xs leading-5 text-muted-foreground">
                                {element.description}
                              </div>
                              {element.anchor ? (
                                <div className="mt-2 text-[11px] font-medium text-muted-foreground">
                                  {element.anchor}
                                </div>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                            No supporting creative elements extracted yet.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="text-xs font-semibold uppercase text-muted-foreground">
                        Full Breakdown
                      </div>
                      <div className="mt-2 space-y-4">
                        {selectedAsset.analyses.length > 0 ? (
                          selectedAsset.analyses.map((analysis) => (
                            <div
                              key={analysis._id ?? `${analysis.analysisType}:${analysis.createdAtMs}`}
                              className="space-y-3 rounded-md border p-3"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">{analysis.analysisType}</Badge>
                                {analysis.confidence ? (
                                  <Badge variant="outline">{analysis.confidence}</Badge>
                                ) : null}
                                {analysis.sourceSkill ? (
                                  <Badge variant="outline">{analysis.sourceSkill}</Badge>
                                ) : null}
                              </div>
                              <TextBlockSection title="User Intent" text={analysis.userIntent} />
                              <TextListSection title="Facts" items={analysis.facts} />
                              <TextListSection
                                title="Interpretation"
                                items={analysis.interpretation}
                              />
                              <TextListSection title="Why It Works" items={analysis.whyItWorks} />
                              <TextListSection title="Takeaways" items={analysis.takeaways} />
                              <TextBlockSection title="Frame Notes" text={analysis.frameNotes} />
                              <TextBlockSection title="Transcript" text={analysis.transcriptText} />
                              <TextBlockSection title="Prompt Guess" text={analysis.promptGuess} />
                              <TextListSection
                                title="Remix Constraints"
                                items={analysis.remixConstraints}
                              />
                            </div>
                          ))
                        ) : (
                          <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                            No analysis records saved yet.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="text-xs font-semibold uppercase text-muted-foreground">
                        Skill Findings
                      </div>
                      <div className="mt-2 space-y-2">
                        {selectedAsset.skillFindings.map((finding) => (
                          <div key={finding._id ?? finding.label} className="rounded-md border p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-semibold">{finding.label}</div>
                              <Badge variant="secondary">
                                {finding.findingKind.replace(/_/g, " ")}
                              </Badge>
                            </div>
                            <div className="mt-2 text-xs leading-5 text-muted-foreground">
                              {finding.capability}
                            </div>
                            <div className="mt-2 text-xs leading-5">{finding.howToReuse}</div>
                            {finding.skillId ? (
                              <Badge variant="outline" className="mt-2">
                                {finding.skillId}
                              </Badge>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-xs text-muted-foreground">Select an asset.</div>
                )}
              </aside>
            </div>
          </TabsContent>

          <TabsContent value="elements" className="m-0 mt-4 min-h-0">
            <section className="flex min-h-0 flex-1 flex-col rounded-md border bg-card">
              <div className="flex flex-wrap gap-2 border-b px-4 py-3">
                {CREATIVE_ELEMENT_KINDS.map((kind) => (
                  <Button
                    key={kind}
                    type="button"
                    size="sm"
                    variant={elementKind === kind ? "default" : "outline"}
                    onClick={() => setElementKind(kind)}
                    className="h-7 px-2 text-[11px]"
                  >
                    {formatKind(kind)}
                  </Button>
                ))}
              </div>
              <div className="grid max-h-[54vh] gap-3 overflow-auto p-3 md:grid-cols-2 xl:grid-cols-3">
                {creativeElements === undefined ? (
                  <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                    Loading creative elements.
                  </div>
                ) : creativeElements.length > 0 ? (
                  creativeElements.map((element) => (
                    <CreativeElementCard
                      key={element._id ?? `${element.assetId}:${element.kind}:${element.title}`}
                      element={element}
                      onSelectAsset={(assetId) => {
                        setSelectedAssetId(assetId);
                        setActiveTab("assets");
                      }}
                    />
                  ))
                ) : (
                  <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                    No creative elements match this search.
                  </div>
                )}
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    );
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[88vh] min-w-[88vw] max-w-none flex-col overflow-hidden p-0"
        style={{ zIndex: UI_Z.panelElevated }}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Resource Bank</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden px-6 py-4">{content}</div>
      </DialogContent>
    </Dialog>
  );
}
