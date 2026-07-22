import { Boxes, ShieldCheck } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { Id } from "../../../../convex/_generated/dataModel";
import { BrandKitDetail, BrandKitSettingsDialog } from "./brand-kit-detail";
import {
  activeKits,
  exampleKey,
  kitExamples,
  promptFirstLine,
  promptStatus,
} from "./brand-kit-presentation";
import { MediaPreview } from "./media-preview";
import { formatTime } from "./resource-bank-utils";
import type {
  BrandKit,
  ResourceBankAssetPreview,
  ResourceBankCreativeElement,
} from "./types";

export function BrandKitWorkspace(props: {
  brandKits: BrandKit[] | undefined;
  creativeElements: ResourceBankCreativeElement[] | undefined;
  filteredBrandKits: BrandKit[];
  selectedBrandKit: BrandKit | null;
  selectedBrandKitId: Id<"brandKits"> | null;
  defaultBrandKitId: string;
  brandConfigState: "idle" | "loading" | "saving";
  onSelectBrandKit: (id: Id<"brandKits"> | null) => void;
  onUpdateKit: (kit: BrandKit, name: string, description: string) => void;
  onSetDefault: (kitId: string) => void;
}): ReactElement {
  const [detailKitId, setDetailKitId] = useState<Id<"brandKits"> | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const previewByElementId = useMemo(
    () =>
      new Map(
        (props.creativeElements ?? []).flatMap((element) =>
          element._id && element.previewAsset
            ? [[String(element._id), element.previewAsset] as const]
            : [],
        ),
      ),
    [props.creativeElements],
  );
  const detailKit =
    props.brandKits?.find((kit) => kit._id && kit._id === detailKitId) ??
    (props.selectedBrandKitId === detailKitId ? props.selectedBrandKit : null);

  if (detailKit) {
    return (
      <section className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden border bg-card">
        <BrandKitDetail
          kit={detailKit}
          defaultBrandKitId={props.defaultBrandKitId}
          brandConfigState={props.brandConfigState}
          previewByElementId={previewByElementId}
          onBack={() => setDetailKitId(null)}
          onOpenSettings={() => setSettingsOpen(true)}
          onSetDefault={props.onSetDefault}
        />
        <BrandKitSettingsDialog
          kit={detailKit}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onSave={props.onUpdateKit}
        />
      </section>
    );
  }

  return (
    <section className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden border bg-card">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4 text-muted-foreground" />
            Brand Kits
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {activeKits(props.brandKits ?? []).length} active kits
          </div>
        </div>
      </div>
      <div className="grid min-h-0 min-w-0 w-full max-w-full flex-1 grid-cols-[minmax(0,1fr)] content-start gap-3 overflow-x-hidden overflow-y-auto p-2 sm:grid-cols-2 sm:p-3 xl:grid-cols-3 2xl:grid-cols-4">
        {props.brandKits === undefined ? (
          <div className="col-span-full bg-muted px-3 py-2 text-xs text-muted-foreground">
            Loading Brand Kits.
          </div>
        ) : props.filteredBrandKits.length > 0 ? (
          props.filteredBrandKits.map((kit) => (
            <BrandKitGalleryCard
              key={kit._id ?? kit.kitId}
              kit={kit}
              defaultBrandKitId={props.defaultBrandKitId}
              previewByElementId={previewByElementId}
              onOpen={() => {
                props.onSelectBrandKit(kit._id ?? null);
                setDetailKitId(kit._id ?? null);
              }}
            />
          ))
        ) : (
          <div className="col-span-full flex min-h-60 items-center justify-center border bg-muted px-4 py-6 text-center text-xs text-muted-foreground">
            No Brand Kits match this search.
          </div>
        )}
      </div>
    </section>
  );
}

function BrandKitGalleryCard(props: {
  kit: BrandKit;
  defaultBrandKitId: string;
  previewByElementId: ReadonlyMap<string, ResourceBankAssetPreview>;
  onOpen: () => void;
}): ReactElement {
  const preview = promptFirstLine(props.kit.prompt);
  return (
    <button
      type="button"
      onClick={props.onOpen}
      className="group flex min-h-[360px] min-w-0 w-full max-w-full flex-col overflow-hidden border bg-background text-left transition duration-150 hover:border-primary/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <LargeKitCover kit={props.kit} previewByElementId={props.previewByElementId} />
      <div className="flex min-h-0 flex-1 flex-col p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold">{props.kit.name}</div>
            <div className="mt-1 truncate text-[11px] text-muted-foreground">
              Updated {formatTime(props.kit.updatedAtMs)}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {props.kit.kitId === props.defaultBrandKitId ? (
              <Badge className="text-[10px]">default</Badge>
            ) : null}
            <Badge
              variant={props.kit.status === "active" ? "secondary" : "outline"}
              className="text-[10px]"
            >
              {props.kit.status}
            </Badge>
          </div>
        </div>
        <div className="mt-3 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">
          {preview || props.kit.description || "Open this kit to edit the production prompt."}
        </div>
        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Boxes className="size-3" />
            {props.kit.elements.length} elements
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {promptStatus(props.kit.prompt)}
          </Badge>
        </div>
      </div>
    </button>
  );
}

function LargeKitCover(props: {
  kit: BrandKit;
  previewByElementId: ReadonlyMap<string, ResourceBankAssetPreview>;
}): ReactElement {
  const examples = kitExamples(props.kit, props.previewByElementId);
  const primary = examples[0];
  if (!primary) {
    return (
      <div className="flex h-56 items-center justify-center border-b bg-muted text-muted-foreground">
        <ShieldCheck className="size-6" />
      </div>
    );
  }
  return (
    <div className="grid h-56 grid-rows-[minmax(0,1fr)_56px] overflow-hidden border-b bg-muted">
      <MediaPreview
        asset={primary}
        fallbackKind={primary.assetKind ?? "image"}
        title={primary.title}
        mosaic
      />
      <div className="grid grid-cols-3 border-t">
        {examples.slice(1, 4).map((example) => (
          <MediaPreview
            key={exampleKey(example)}
            asset={example}
            fallbackKind={example.assetKind ?? "image"}
            title={example.title}
            mosaic
          />
        ))}
        {examples.length < 4
          ? ["a", "b", "c"].slice(0, 4 - examples.length).map((slot) => (
              <div
                key={`empty-${slot}`}
                className="flex items-center justify-center border-r text-muted-foreground"
              >
                <Boxes className="size-4" />
              </div>
            ))
          : null}
      </div>
    </div>
  );
}

export {
  elementExamples,
  promptFirstLine,
  promptStatus,
  promptTextForDraft,
  promptUnsaved,
} from "./brand-kit-presentation";
