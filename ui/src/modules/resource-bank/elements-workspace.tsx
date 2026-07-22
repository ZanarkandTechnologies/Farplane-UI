import { ExternalLink, Lightbulb, PackageCheck, Sparkles, WandSparkles } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MediaPreview } from "./media-preview";
import { formatKind, formatTag } from "./resource-bank-utils";
import type { BrandKit, CreativeElementKind, ResourceBankCreativeElement } from "./types";

export const CREATIVE_ELEMENT_KINDS: CreativeElementKind[] = [
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

export function ElementsWorkspace(props: {
  creativeElements: ResourceBankCreativeElement[] | undefined;
  elementKind: CreativeElementKind;
  selectedBrandKit: BrandKit | null;
  onKindChange: (kind: CreativeElementKind) => void;
  onPromoteElement: (element: ResourceBankCreativeElement) => void;
  onSelectAsset: (assetId: string) => void;
}): ReactElement {
  return (
    <section className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden border bg-card">
      <div className="flex min-w-0 gap-2 overflow-x-auto border-b px-3 py-2">
        {CREATIVE_ELEMENT_KINDS.map((kind) => (
          <Button
            key={kind}
            type="button"
            size="sm"
            variant={props.elementKind === kind ? "default" : "outline"}
            onClick={() => props.onKindChange(kind)}
            className="h-7 shrink-0 px-2 text-[11px]"
          >
            {formatKind(kind)}
          </Button>
        ))}
      </div>
      <div className="grid min-h-0 min-w-0 w-full max-w-full flex-1 grid-cols-[minmax(0,1fr)] content-start gap-3 overflow-x-hidden overflow-y-auto p-2 sm:grid-cols-2 sm:p-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {props.creativeElements === undefined ? (
          <div className="col-span-full bg-muted px-3 py-2 text-xs text-muted-foreground">
            Loading creative elements.
          </div>
        ) : props.creativeElements.length > 0 ? (
          props.creativeElements.map((element) => (
            <CreativeElementCard
              key={element._id ?? `${element.assetId}:${element.kind}:${element.title}`}
              element={element}
              selectedBrandKit={props.selectedBrandKit}
              onPromoteElement={props.onPromoteElement}
              onSelectAsset={props.onSelectAsset}
            />
          ))
        ) : (
          <div className="col-span-full flex min-h-60 items-center justify-center border bg-muted px-4 py-6 text-center text-xs text-muted-foreground">
            No creative elements match this search.
          </div>
        )}
      </div>
    </section>
  );
}

function CreativeElementCard(props: {
  element: ResourceBankCreativeElement;
  selectedBrandKit: BrandKit | null;
  onPromoteElement: (element: ResourceBankCreativeElement) => void;
  onSelectAsset: (assetId: string) => void;
}): ReactElement {
  return (
    <div className="flex min-h-[520px] min-w-0 w-full max-w-full flex-col overflow-hidden border bg-background p-3 text-left transition duration-150 hover:border-primary/60 hover:bg-accent">
      <MediaPreview
        asset={
          props.element.goldenExampleAsset ??
          props.element.previewAsset ?? {
            title: props.element.assetTitle ?? props.element.title,
            assetKind: props.element.assetKind ?? "url",
            sourceUrl: props.element.assetSourceUrl,
            canonicalUrl: props.element.assetCanonicalUrl,
          }
        }
        fallbackKind={props.element.assetKind ?? props.element.kind}
        title={props.element.assetTitle ?? props.element.title}
        compact
        tall
      />
      <div className="mt-3 flex items-start justify-between gap-3">
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
          {props.element.pinned ? <Badge className="text-[10px]">pinned</Badge> : null}
          <Badge variant="secondary" className="text-[10px]">
            {formatKind(props.element.kind)}
          </Badge>
        </div>
      </div>
      <div className="mt-3 line-clamp-4 text-xs leading-5 text-muted-foreground">
        {props.element.description}
      </div>
      <div
        className="mt-3 border-l-2 border-primary/50 pl-3"
        data-testid={`creative-element-why-${String(props.element._id ?? props.element.title)}`}
      >
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
          <Sparkles className="size-3" />
          Why it works
        </div>
        <div className="mt-1 line-clamp-3 text-xs leading-5">{props.element.whyItWorks}</div>
      </div>
      {props.element.goldenExample.description ? (
        <div className="mt-3 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
          Example: {props.element.goldenExample.description}
        </div>
      ) : null}
      <details
        className="mt-3 max-w-full overflow-hidden border bg-muted/50 px-3 py-2"
        data-testid={`creative-element-recipe-${String(props.element._id ?? props.element.title)}`}
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] font-semibold">
          <WandSparkles className="size-3.5 text-muted-foreground" />
          Generation prompt
        </summary>
        <div className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
          {props.element.goldenRecipe}
        </div>
      </details>
      <div className="mt-auto flex flex-wrap gap-1 pt-3">
        {props.element.anchor ? (
          <Badge variant="outline" className="max-w-full truncate text-[10px]">
            {props.element.anchor}
          </Badge>
        ) : null}
        {props.element.tags.slice(0, 3).map((tag) => (
          <Badge key={tag} variant="secondary" className="text-[10px]">
            {formatTag(tag)}
          </Badge>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-[11px]"
          onClick={() => props.onSelectAsset(props.element.assetId)}
        >
          <ExternalLink className="size-3.5" />
          Source
        </Button>
        {props.selectedBrandKit ? (
          <Button
            type="button"
            size="sm"
            className="h-7 px-2 text-[11px]"
            disabled={!props.element._id}
            title={`Add to ${props.selectedBrandKit.name}`}
            onClick={() => props.onPromoteElement(props.element)}
          >
            <PackageCheck className="size-3.5" />
            Add to kit
          </Button>
        ) : null}
      </div>
    </div>
  );
}
