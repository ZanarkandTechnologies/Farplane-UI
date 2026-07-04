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
import { UI_Z } from "@/lib/z-index";
import { isConvexEnabled } from "@/providers/convex-provider";
import { api } from "../../../../convex/_generated/api";

type ResourceBankPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

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
  derivedAssets?: ResourceBankAssetPreview[];
  analyses: Array<{
    _id?: string;
    analysisType: string;
    whyItWorks: string[];
    takeaways: string[];
    promptGuess?: string;
    remixConstraints: string[];
  }>;
  creativeElements?: Array<{
    _id?: string;
    kind: string;
    title: string;
    description: string;
    anchor?: string;
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
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-md border bg-muted px-3 text-center text-muted-foreground ${heightClass}`}
      title={
        hasPreviewHandle(props.asset)
          ? "Preview handle saved but not browser-displayable"
          : undefined
      }
    >
      {assetIcon(props.asset?.assetKind ?? props.fallbackKind)}
      <span className="max-w-full truncate text-[11px]">
        {sourceLabel(props.asset) ?? props.fallbackKind}
      </span>
      <span className="sr-only">{props.title}</span>
    </div>
  );
}

export function ResourceBankPanel({ open, onOpenChange }: ResourceBankPanelProps): ReactElement {
  const convexEnabled = isConvexEnabled();
  const canSeedDemo = import.meta.env.DEV;
  const [query, setQuery] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const seedDemo = useMutation(api.modules.resourceBank.demo.seedDemoResourceBank);
  const data = useQuery(
    api.modules.resourceBank.retrieval.getResourceBankDashboard,
    convexEnabled && open ? { query: query.trim() || undefined, limit: 28 } : "skip",
  ) as ResourceBankDashboard | undefined;

  const selectedAsset = useMemo(() => {
    if (!data) return null;
    return data.assets.find((asset) => asset._id === selectedAssetId) ?? data.assets[0] ?? null;
  }, [data, selectedAssetId]);

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
    if (data.totals.assetCount === 0) {
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

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-h-0 rounded-md border bg-card">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Search className="size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedAssetId(null);
                }}
                placeholder="Search assets, notes, tags, and extracted techniques"
                className="h-8"
              />
            </div>
            <div className="grid max-h-[54vh] gap-3 overflow-auto p-3 md:grid-cols-2 xl:grid-cols-3">
              {data.assets.map((asset) => (
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
              ))}
            </div>
          </section>

          <aside className="min-h-0 rounded-md border bg-card">
            <div className="border-b px-4 py-3 text-sm font-semibold">Selected Asset</div>
            {selectedAsset ? (
              <div className="max-h-[54vh] overflow-auto p-4">
                <AssetPreview
                  asset={selectedAsset.previewAsset ?? selectedAsset}
                  fallbackKind={selectedAsset.assetKind}
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
                    Creative Elements
                  </div>
                  <div className="mt-2 space-y-2">
                    {(selectedAsset.creativeElements ?? []).length > 0 ? (
                      selectedAsset.creativeElements?.map((element) => (
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
                        No creative elements extracted yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">
                    Analysis
                  </div>
                  <div className="mt-2 space-y-2">
                    {selectedAsset.analyses
                      .flatMap((analysis) => analysis.whyItWorks)
                      .map((text) => (
                        <div key={text} className="rounded-md bg-muted px-3 py-2 text-xs leading-5">
                          {text}
                        </div>
                      ))}
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
