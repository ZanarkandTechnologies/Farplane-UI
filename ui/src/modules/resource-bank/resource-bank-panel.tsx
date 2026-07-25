"use client";

/**
 * RESOURCE BANK PANEL
 * ===================
 * Ownership: Resource Bank UI module.
 * Inputs: Convex Resource Bank dashboard, creative elements, and Brand Kits.
 * Outputs: media-first asset, element, and Brand Kit prompt workspaces.
 * Side effects: optional demo seed, Brand Kit mutations, project default kit config.
 */

import { useMutation, useQuery } from "convex/react";
import { Database, Search, Sparkles } from "lucide-react";
import { type ReactElement, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UI_Z } from "@/lib/z-index";
import { isConvexEnabled } from "@/providers/convex-provider";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { AddToBrandKitDialog } from "./add-to-brand-kit-dialog";
import { AssetWorkspace } from "./asset-workspace";
import { BrandKitWorkspace } from "./brand-kit-workspace";
import { ElementsWorkspace } from "./elements-workspace";
import { fetchDefaultBrandKitId, saveDefaultBrandKitId } from "./resource-bank-utils";
import { StatePanel } from "./state-panel";
import type {
  BrandKit,
  BrandKitPromotionReceipt,
  BrandKitPromotionTarget,
  CreativeElementKind,
  ResourceBankCreativeElement,
  ResourceBankDashboard,
  ResourceBankPanelProps,
  ResourceBankTab,
} from "./types";

export function ResourceBankPanel({ open, onOpenChange }: ResourceBankPanelProps): ReactElement {
  const convexEnabled = isConvexEnabled();
  const canSeedDemo = import.meta.env.DEV;
  const [activeTab, setActiveTab] = useState<ResourceBankTab>("assets");
  const [elementKind, setElementKind] = useState<CreativeElementKind>("all");
  const [query, setQuery] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedBrandKitId, setSelectedBrandKitId] = useState<Id<"brandKits"> | null>(null);
  const [defaultBrandKitId, setDefaultBrandKitId] = useState("");
  const [brandConfigState, setBrandConfigState] = useState<"idle" | "loading" | "saving">("idle");
  const [promotionTarget, setPromotionTarget] = useState<BrandKitPromotionTarget | null>(null);
  const [promotionKitId, setPromotionKitId] = useState<Id<"brandKits"> | null>(null);
  const [promotionSaving, setPromotionSaving] = useState(false);

  const seedDemo = useMutation(api.modules.resourceBank.demo.seedDemoResourceBank);
  const updateBrandKit = useMutation(api.modules.resourceBank.brandKits.updateBrandKit);
  const promoteResourceElementsToBrandKit = useMutation(
    api.modules.resourceBank.brandKits.promoteResourceElementsToBrandKit,
  );

  const data = useQuery(
    api.modules.resourceBank.retrieval.getResourceBankDashboard,
    convexEnabled && open ? { query: query.trim() || undefined, limit: 36 } : "skip",
  ) as ResourceBankDashboard | undefined;
  const creativeElements = useQuery(
    api.modules.resourceBank.creativeElements.listCreativeElements,
    convexEnabled && open
      ? {
          query: activeTab === "elements" ? query.trim() || undefined : undefined,
          kind: activeTab === "elements" && elementKind !== "all" ? elementKind : undefined,
          limit: 140,
        }
      : "skip",
  ) as ResourceBankCreativeElement[] | undefined;
  const brandKits = useQuery(
    api.modules.resourceBank.brandKits.listBrandKits,
    convexEnabled && open ? { includeArchived: true, limit: 80 } : "skip",
  ) as BrandKit[] | undefined;

  const activeBrandKits = (brandKits ?? []).filter((kit) => kit.status === "active");
  const selectedAsset = useMemo(() => {
    if (!data) return null;
    return data.assets.find((asset) => asset._id === selectedAssetId) ?? data.assets[0] ?? null;
  }, [data, selectedAssetId]);
  const selectedBrandKit =
    brandKits?.find((kit) => kit._id === selectedBrandKitId) ?? activeBrandKits[0] ?? null;
  const filteredBrandKits = useMemo(
    () => filterBrandKits(brandKits ?? [], query),
    [brandKits, query],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBrandConfigState("loading");
    void fetchDefaultBrandKitId()
      .then((kitId) => {
        if (!cancelled) setDefaultBrandKitId(kitId);
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not read farplane/brand.yaml.");
      })
      .finally(() => {
        if (!cancelled) setBrandConfigState("idle");
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!selectedBrandKitId && activeBrandKits.length > 0) {
      const defaultKit = activeBrandKits.find((kit) => kit.kitId === defaultBrandKitId);
      setSelectedBrandKitId((defaultKit ?? activeBrandKits[0])._id ?? null);
    }
  }, [activeBrandKits, defaultBrandKitId, selectedBrandKitId]);

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
          detail="Reading saved assets, analyses, creative elements, Brand Kits, and previews."
        />
      );
    }
    return (
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as ResourceBankTab)}
        className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden"
      >
        <div className="flex min-w-0 shrink-0 flex-col gap-2 overflow-hidden border bg-card px-2 py-2 sm:px-3 md:flex-row md:items-center">
          <TabsList className="h-8 max-w-full shrink-0 overflow-x-auto">
            <TabsTrigger value="assets" className="h-7 px-2 text-[11px]">
              Assets {data.totals.assetCount}
            </TabsTrigger>
            <TabsTrigger value="elements" className="h-7 px-2 text-[11px]">
              Elements {data.totals.creativeElementCount ?? 0}
            </TabsTrigger>
            <TabsTrigger value="brand-kits" className="h-7 px-2 text-[11px]">
              Kits {activeBrandKits.length}
            </TabsTrigger>
          </TabsList>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedAssetId(null);
              }}
              placeholder={placeholderFor(activeTab)}
              className="h-8 min-w-0"
            />
          </div>
        </div>

        <TabsContent
          value="assets"
          className="m-0 mt-3 flex min-h-0 min-w-0 w-full max-w-full flex-1 overflow-hidden"
        >
          <AssetWorkspace
            assets={data.assets}
            canSeedDemo={canSeedDemo}
            query={query}
            selectedAsset={selectedAsset}
            onSeedDemo={() => void seedDemo({ confirm: "seed-resource-bank-demo" })}
            onSelectAsset={setSelectedAssetId}
            onRequestAddToKit={openKitPicker}
          />
        </TabsContent>

        <TabsContent
          value="elements"
          className="m-0 mt-3 flex min-h-0 min-w-0 w-full max-w-full flex-1 overflow-hidden"
        >
          <ElementsWorkspace
            creativeElements={creativeElements}
            elementKind={elementKind}
            onKindChange={setElementKind}
            onRequestAddToKit={openKitPicker}
            onSelectAsset={(assetId) => {
              setSelectedAssetId(assetId);
              setActiveTab("assets");
            }}
          />
        </TabsContent>

        <TabsContent
          value="brand-kits"
          className="m-0 mt-3 flex min-h-0 min-w-0 w-full max-w-full flex-1 overflow-hidden"
        >
          <BrandKitWorkspace
            brandKits={brandKits}
            creativeElements={creativeElements}
            filteredBrandKits={filteredBrandKits}
            selectedBrandKit={selectedBrandKit}
            selectedBrandKitId={selectedBrandKitId}
            defaultBrandKitId={defaultBrandKitId}
            brandConfigState={brandConfigState}
            onSelectBrandKit={setSelectedBrandKitId}
            onUpdateKit={(kit, name, description) =>
              void handleUpdateBrandKit(kit, name, description)
            }
            onSetDefault={(kitId) => void handleSetDefaultBrandKit(kitId)}
          />
        </TabsContent>
      </Tabs>
    );
  })();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-md p-0 sm:h-[94dvh] sm:w-[96vw] sm:max-w-[96vw]"
          style={{ zIndex: UI_Z.panelElevated }}
        >
          <DialogHeader className="shrink-0 border-b px-3 py-3 sm:px-4">
            <DialogTitle className="text-base">Resource Bank</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 min-w-0 flex-1 px-2 py-2 sm:px-4 sm:py-3">{content}</div>
        </DialogContent>
      </Dialog>
      <AddToBrandKitDialog
        element={promotionTarget}
        brandKits={activeBrandKits}
        defaultBrandKitId={defaultBrandKitId}
        selectedKitId={promotionKitId}
        saving={promotionSaving}
        onOpenChange={(pickerOpen) => {
          if (!pickerOpen && !promotionSaving) {
            setPromotionTarget(null);
            setPromotionKitId(null);
          }
        }}
        onSelectKit={setPromotionKitId}
        onConfirm={() => void handleConfirmPromotion()}
      />
    </>
  );

  async function handleUpdateBrandKit(
    kit: BrandKit,
    name: string,
    description: string,
  ): Promise<void> {
    if (!kit._id) return;
    try {
      await updateBrandKit({
        brandKitId: kit._id,
        expectedRevision: kit.revision,
        name: name.trim() || kit.name,
        description: description.trim() || undefined,
      });
      toast.success("Brand Kit saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save Brand Kit.");
    }
  }

  async function handleSetDefaultBrandKit(kitId: string): Promise<void> {
    try {
      setBrandConfigState("saving");
      await saveDefaultBrandKitId(kitId);
      setDefaultBrandKitId(kitId);
      toast.success(kitId ? "Default Brand Kit saved." : "Default Brand Kit cleared.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save farplane/brand.yaml.");
    } finally {
      setBrandConfigState("idle");
    }
  }

  function openKitPicker(element: {
    _id?: Id<"resourceBankCreativeElements">;
    title: string;
  }): void {
    if (!element._id) return;
    const defaultKit = activeBrandKits.find((kit) => kit.kitId === defaultBrandKitId);
    const initialKit = defaultKit ?? selectedBrandKit ?? activeBrandKits[0] ?? null;
    setPromotionTarget({ elementId: element._id, title: element.title });
    setPromotionKitId(initialKit?._id ?? null);
  }

  async function handleConfirmPromotion(): Promise<void> {
    const destinationKit = activeBrandKits.find((kit) => kit._id === promotionKitId);
    if (!destinationKit?._id || !promotionTarget) return;
    try {
      setPromotionSaving(true);
      const receipt = (await promoteResourceElementsToBrandKit({
        brandKitId: destinationKit._id,
        elementIds: [promotionTarget.elementId],
        requestedBy: "resource-bank-ui",
      })) as BrandKitPromotionReceipt;
      toast.success(
        receipt.createdElementIds.length > 0
          ? `Added to ${destinationKit.name}.`
          : receipt.updatedElementIds.length > 0
            ? `Updated in ${destinationKit.name}.`
            : `Already in ${destinationKit.name}.`,
      );
      setPromotionTarget(null);
      setPromotionKitId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add element to Brand Kit.");
    } finally {
      setPromotionSaving(false);
    }
  }
}

function filterBrandKits(rows: BrandKit[], query: string): BrandKit[] {
  const term = query.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((kit) =>
    [
      kit.name,
      kit.description ?? "",
      kit.kitId,
      kit.prompt.text,
      ...kit.elements.flatMap((element) => [
        element.title,
        element.description,
        element.whyItWorks,
        element.goldenExample.description ?? "",
        element.goldenRecipe,
        element.kind,
        ...element.tags,
      ]),
    ]
      .join("\n")
      .toLowerCase()
      .includes(term),
  );
}

function placeholderFor(tab: ResourceBankTab): string {
  if (tab === "elements") return "Search elements, why they work, prompts, and tags";
  if (tab === "brand-kits") return "Search kits, prompts, creative elements, and tags";
  return "Search assets, notes, tags, and extracted techniques";
}
