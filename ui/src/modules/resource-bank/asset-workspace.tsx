import { ExternalLink, Lightbulb, PackageCheck } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MediaPreview } from "./media-preview";
import { assetIcon, formatKind, formatTag, formatTime, sourceUrl } from "./resource-bank-utils";
import type { BrandKit, ResourceBankAsset } from "./types";

type AssetElement = NonNullable<ResourceBankAsset["creativeElements"]>[number];

export function AssetWorkspace(props: {
  assets: ResourceBankAsset[];
  canSeedDemo: boolean;
  query: string;
  selectedAsset: ResourceBankAsset | null;
  selectedBrandKit: BrandKit | null;
  onSeedDemo: () => void;
  onSelectAsset: (assetId: string | null) => void;
  onPromoteElementId: (elementId: AssetElement["_id"]) => void;
}): ReactElement {
  const selected = props.selectedAsset;
  return (
    <div className="grid min-h-0 min-w-0 w-full max-w-full flex-1 grid-cols-[minmax(0,1fr)] gap-3 overflow-auto lg:grid-cols-[minmax(0,1fr)_360px] lg:overflow-hidden">
      <section className="min-h-0 min-w-0 border bg-card">
        <div className="grid h-full min-h-0 min-w-0 w-full max-w-full grid-cols-[minmax(0,1fr)] content-start gap-3 overflow-auto p-2 sm:grid-cols-2 sm:p-3 xl:grid-cols-3">
          {props.assets.length > 0 ? (
            props.assets.map((asset) => (
              <button
                key={asset._id ?? asset.title}
                type="button"
                onClick={() => props.onSelectAsset(asset._id ?? null)}
                className={`group min-w-0 overflow-hidden border p-2 text-left transition duration-150 hover:border-primary/60 hover:bg-accent ${
                  selected?._id === asset._id ? "border-primary bg-primary/10" : "bg-background"
                }`}
              >
                <MediaPreview
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
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {asset.assetKind}
                  </Badge>
                </div>
                <div className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {asset.searchableText || "Saved reference"}
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
            <EmptyAssetState
              canSeedDemo={props.canSeedDemo}
              query={props.query}
              onSeedDemo={props.onSeedDemo}
            />
          )}
        </div>
      </section>
      <AssetInspector
        asset={selected}
        selectedBrandKit={props.selectedBrandKit}
        onPromoteElementId={props.onPromoteElementId}
      />
    </div>
  );
}

function EmptyAssetState(props: {
  canSeedDemo: boolean;
  query: string;
  onSeedDemo: () => void;
}): ReactElement {
  return (
    <div className="col-span-full flex min-h-72 flex-col items-center justify-center border bg-muted px-4 py-6 text-center">
      <div className="text-sm font-semibold">
        {props.query.trim() ? "No assets match this search" : "No saved references yet"}
      </div>
      <div className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
        Ingest a link, image, video, or note to create media candidates.
      </div>
      {props.canSeedDemo && !props.query.trim() ? (
        <Button type="button" size="sm" className="mt-3" onClick={props.onSeedDemo}>
          Seed demo reference
        </Button>
      ) : null}
    </div>
  );
}

function AssetInspector(props: {
  asset: ResourceBankAsset | null;
  selectedBrandKit: BrandKit | null;
  onPromoteElementId: (elementId: AssetElement["_id"]) => void;
}): ReactElement {
  const asset = props.asset;
  if (!asset) {
    return (
      <aside className="min-h-0 min-w-0 border bg-card p-4 text-xs text-muted-foreground">
        Select an asset to inspect media, creative elements, and saved findings.
      </aside>
    );
  }
  const pinned = (asset.creativeElements ?? []).filter((element) => element.pinned);
  const supporting = (asset.creativeElements ?? []).filter((element) => !element.pinned);
  return (
    <aside className="flex min-h-0 min-w-0 flex-col border bg-card">
      <div className="border-b px-4 py-3">
        <div className="truncate text-sm font-semibold">{asset.title}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {asset.assetKind} | saved {formatTime(asset.createdAtMs)}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <MediaPreview
          asset={asset.previewAsset ?? asset}
          fallbackKind={asset.assetKind}
          previewStatus={asset.previewStatus}
          title={asset.title}
        />
        {sourceUrl(asset) ? (
          <Button asChild variant="outline" size="sm" className="mt-3 h-8">
            <a href={sourceUrl(asset)} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" />
              Open source
            </a>
          </Button>
        ) : null}
        <ElementGroup
          title="Pinned taste"
          elements={pinned}
          active
          selectedBrandKit={props.selectedBrandKit}
          onPromoteElementId={props.onPromoteElementId}
        />
        <ElementGroup
          title="Creative elements"
          elements={supporting}
          selectedBrandKit={props.selectedBrandKit}
          onPromoteElementId={props.onPromoteElementId}
        />
        <Breakdown asset={asset} />
      </div>
    </aside>
  );
}

function ElementGroup(props: {
  title: string;
  elements: NonNullable<ResourceBankAsset["creativeElements"]>;
  selectedBrandKit: BrandKit | null;
  active?: boolean;
  onPromoteElementId: (elementId: AssetElement["_id"]) => void;
}): ReactElement {
  return (
    <div className="mt-4">
      <div className="text-xs font-semibold uppercase text-muted-foreground">{props.title}</div>
      <div className="mt-2 space-y-2">
        {props.elements.length > 0 ? (
          props.elements.map((element) => (
            <div
              key={element._id ?? `${element.kind}:${element.title}`}
              className={`min-w-0 overflow-hidden border p-3 ${props.active ? "border-primary/40 bg-primary/5" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 truncate text-xs font-semibold">{element.title}</div>
                <div className="flex shrink-0 items-center gap-1">
                  {props.selectedBrandKit ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      disabled={!element._id}
                      onClick={() => props.onPromoteElementId(element._id)}
                    >
                      <PackageCheck className="size-3.5" />
                      Add
                    </Button>
                  ) : null}
                  <Badge variant={props.active ? "default" : "secondary"}>
                    {formatKind(element.kind)}
                  </Badge>
                </div>
              </div>
              <div className="mt-2 text-xs leading-5 text-muted-foreground">
                {element.description}
              </div>
              {element.anchor ? (
                <div className="mt-2 truncate text-[11px] font-medium text-muted-foreground">
                  {element.anchor}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="bg-muted px-3 py-2 text-xs text-muted-foreground">None saved here.</div>
        )}
      </div>
    </div>
  );
}

function Breakdown(props: { asset: ResourceBankAsset }): ReactElement {
  return (
    <div className="mt-4 space-y-3">
      <div className="text-xs font-semibold uppercase text-muted-foreground">Breakdown</div>
      {props.asset.analyses.slice(0, 2).map((analysis) => (
        <div
          key={analysis._id ?? `${analysis.analysisType}:${analysis.createdAtMs}`}
          className="border p-3"
        >
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary">{analysis.analysisType}</Badge>
            {analysis.confidence ? <Badge variant="outline">{analysis.confidence}</Badge> : null}
          </div>
          <TextList title="Why it works" items={analysis.whyItWorks} />
          <TextList title="Takeaways" items={analysis.takeaways} />
        </div>
      ))}
      {props.asset.skillFindings.map((finding) => (
        <div key={finding._id ?? finding.label} className="border p-3">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Lightbulb className="size-3.5 text-muted-foreground" />
            <span>{finding.label}</span>
            <Badge variant="secondary">{finding.findingKind.replace(/_/g, " ")}</Badge>
          </div>
          <div className="mt-2 text-xs leading-5 text-muted-foreground">{finding.capability}</div>
          <div className="mt-2 text-xs leading-5">{finding.howToReuse}</div>
        </div>
      ))}
    </div>
  );
}

function TextList(props: { title: string; items: string[] | undefined }): ReactElement | null {
  const items = props.items?.filter(Boolean) ?? [];
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <div className="text-[11px] font-semibold uppercase text-muted-foreground">{props.title}</div>
      <div className="mt-2 space-y-1">
        {items.slice(0, 3).map((text) => (
          <div key={text} className="bg-muted px-3 py-2 text-xs leading-5">
            {text}
          </div>
        ))}
      </div>
    </div>
  );
}
