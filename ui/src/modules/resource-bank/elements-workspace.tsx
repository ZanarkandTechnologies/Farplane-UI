import {
  ArrowLeft,
  ExternalLink,
  Lightbulb,
  PackagePlus,
  Pin,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { type ReactElement, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MediaPreview } from "./media-preview";
import { displayableMediaUrl, formatKind, formatTag } from "./resource-bank-utils";
import type { CreativeElementKind, ResourceBankCreativeElement } from "./types";

export const CREATIVE_ELEMENT_KINDS: CreativeElementKind[] = [
  "all",
  "format",
  "storyboard",
  "visual",
  "character",
  "audio",
  "editing",
];

export function ElementsWorkspace(props: {
  creativeElements: ResourceBankCreativeElement[] | undefined;
  elementKind: CreativeElementKind;
  onKindChange: (kind: CreativeElementKind) => void;
  onRequestAddToKit: (element: ResourceBankCreativeElement) => void;
  onSelectAsset: (assetId: string) => void;
}): ReactElement {
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const selectedElement =
    props.creativeElements?.find((element) => elementKey(element) === selectedElementId) ?? null;

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

      <div
        className={`grid min-h-0 min-w-0 flex-1 overflow-hidden ${
          selectedElement ? "xl:grid-cols-[minmax(0,1fr)_420px]" : "grid-cols-1"
        }`}
      >
        <div
          className={`${selectedElement ? "hidden xl:grid" : "grid"} min-h-0 min-w-0 content-start gap-3 overflow-x-hidden overflow-y-auto p-2 sm:grid-cols-2 sm:p-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5`}
        >
          {props.creativeElements === undefined ? (
            <div className="col-span-full bg-muted px-3 py-2 text-xs text-muted-foreground">
              Loading creative elements.
            </div>
          ) : props.creativeElements.length > 0 ? (
            props.creativeElements.map((element) => (
              <CreativeElementCard
                key={elementKey(element)}
                element={element}
                selected={elementKey(element) === selectedElementId}
                onOpen={() => setSelectedElementId(elementKey(element))}
                onRequestAddToKit={() => props.onRequestAddToKit(element)}
              />
            ))
          ) : (
            <div className="col-span-full flex min-h-60 items-center justify-center border bg-muted px-4 py-6 text-center text-xs text-muted-foreground">
              No creative elements match this search.
            </div>
          )}
        </div>

        {selectedElement ? (
          <CreativeElementInspector
            element={selectedElement}
            onClose={() => setSelectedElementId(null)}
            onRequestAddToKit={() => props.onRequestAddToKit(selectedElement)}
            onSelectAsset={() => props.onSelectAsset(selectedElement.assetId)}
          />
        ) : null}
      </div>
    </section>
  );
}

function CreativeElementCard(props: {
  element: ResourceBankCreativeElement;
  selected: boolean;
  onOpen: () => void;
  onRequestAddToKit: () => void;
}): ReactElement {
  return (
    <article
      className={`group relative min-h-[390px] min-w-0 w-full max-w-full overflow-hidden border bg-background p-3 text-left transition duration-150 hover:border-primary/60 hover:bg-accent ${
        props.selected ? "border-primary bg-primary/10" : ""
      }`}
      data-testid={`creative-element-card-${String(props.element._id ?? props.element.title)}`}
    >
      <button
        type="button"
        aria-label={`Inspect ${props.element.title}`}
        onClick={props.onOpen}
        className="absolute inset-0 z-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      />
      <div className="pointer-events-none relative z-10 flex min-h-[364px] flex-col">
        <MediaPreview
          asset={elementPreview(props.element)}
          fallbackKind={props.element.assetKind ?? props.element.kind}
          title={props.element.assetTitle ?? props.element.title}
          compact
          tall
        />
        <div className="mt-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="line-clamp-2 text-sm font-semibold leading-5">
              {props.element.title}
            </div>
            <div className="mt-1 truncate text-[11px] text-muted-foreground">
              {props.element.assetTitle ?? "Unknown source"}
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {formatKind(props.element.kind)}
          </Badge>
        </div>
        <div className="mt-3 line-clamp-4 text-xs leading-5 text-muted-foreground">
          {props.element.description}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
            {props.element.pinned ? <Pin className="size-3 fill-current" /> : null}
            <span className="truncate">
              {props.element.tags.slice(0, 2).map(formatTag).join(" | ")}
            </span>
          </div>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="pointer-events-auto size-8 shrink-0"
            disabled={!props.element._id}
            aria-label={`Add ${props.element.title} to a Brand Kit`}
            title="Add to Brand Kit"
            onClick={props.onRequestAddToKit}
          >
            <PackagePlus className="size-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}

function CreativeElementInspector(props: {
  element: ResourceBankCreativeElement;
  onClose: () => void;
  onRequestAddToKit: () => void;
  onSelectAsset: () => void;
}): ReactElement {
  const sourceHref = props.element.assetCanonicalUrl ?? props.element.assetSourceUrl;
  return (
    <aside
      className="flex min-h-0 min-w-0 flex-col border-l bg-background xl:border-l"
      data-testid="creative-element-inspector"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 xl:hidden"
          onClick={props.onClose}
          aria-label="Back to Creative Elements"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold uppercase text-muted-foreground">
            {formatKind(props.element.kind)}
          </div>
          <div className="truncate text-sm font-semibold">{props.element.title}</div>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="hidden size-8 xl:inline-flex"
          onClick={props.onClose}
          aria-label="Close Creative Element inspector"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <MediaPreview
          asset={elementPreview(props.element)}
          fallbackKind={props.element.assetKind ?? props.element.kind}
          title={props.element.assetTitle ?? props.element.title}
          tall
        />

        <InspectorSection icon={<Lightbulb className="size-4" />} title="What it is">
          <p>{props.element.description}</p>
        </InspectorSection>

        <InspectorSection icon={<Sparkles className="size-4" />} title="Why it works">
          <p>{props.element.whyItWorks}</p>
        </InspectorSection>

        <InspectorSection title="Golden example">
          <p>
            {props.element.goldenExample.description || "Use the linked media as the reference."}
          </p>
        </InspectorSection>

        <InspectorSection icon={<WandSparkles className="size-4" />} title="Generation prompt">
          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            {props.element.goldenRecipe}
          </p>
        </InspectorSection>

        <InspectorSection title="Source">
          <div className="space-y-2 text-[11px] text-muted-foreground">
            <div>{props.element.assetTitle ?? "Saved Resource Bank asset"}</div>
            {props.element.anchor ? <div>Anchor: {props.element.anchor}</div> : null}
            {props.element.projectId ? <div>Project: {props.element.projectId}</div> : null}
            {props.element.taskId ? <div>Task: {props.element.taskId}</div> : null}
            <div className="flex flex-wrap gap-1 pt-1">
              {props.element.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px]">
                  {formatTag(tag)}
                </Badge>
              ))}
            </div>
          </div>
        </InspectorSection>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t bg-card p-3">
        <Button type="button" variant="outline" size="sm" onClick={props.onSelectAsset}>
          <ExternalLink className="size-3.5" />
          View asset
        </Button>
        {sourceHref ? (
          <Button asChild type="button" variant="outline" size="sm">
            <a href={sourceHref} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" />
              Open source
            </a>
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          className="ml-auto"
          disabled={!props.element._id}
          onClick={props.onRequestAddToKit}
        >
          <PackagePlus className="size-3.5" />
          Add to Brand Kit
        </Button>
      </div>
    </aside>
  );
}

function InspectorSection(props: {
  children: ReactElement;
  icon?: ReactElement;
  title: string;
}): ReactElement {
  return (
    <section className="border-b py-4 last:border-b-0">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        {props.icon}
        {props.title}
      </div>
      <div className="mt-2 text-sm leading-6">{props.children}</div>
    </section>
  );
}

function elementPreview(element: ResourceBankCreativeElement) {
  if (displayableMediaUrl(element.goldenExampleAsset)) return element.goldenExampleAsset;
  if (displayableMediaUrl(element.previewAsset)) return element.previewAsset;
  return (
    element.goldenExampleAsset ??
    element.previewAsset ?? {
      title: element.assetTitle ?? element.title,
      assetKind: element.assetKind ?? "url",
      sourceUrl: element.assetSourceUrl,
      canonicalUrl: element.assetCanonicalUrl,
    }
  );
}

function elementKey(element: ResourceBankCreativeElement): string {
  return String(element._id ?? `${element.assetId}:${element.kind}:${element.title}`);
}
