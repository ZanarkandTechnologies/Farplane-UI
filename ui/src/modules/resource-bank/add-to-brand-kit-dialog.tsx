import { Check, PackagePlus, ShieldCheck } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UI_Z } from "@/lib/z-index";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { BrandKit, BrandKitPromotionTarget } from "./types";

export function AddToBrandKitDialog(props: {
  element: BrandKitPromotionTarget | null;
  brandKits: BrandKit[];
  defaultBrandKitId: string;
  selectedKitId: Id<"brandKits"> | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectKit: (kitId: Id<"brandKits">) => void;
  onConfirm: () => void;
}): ReactElement {
  const selectedKit = props.brandKits.find((kit) => kit._id === props.selectedKitId) ?? null;
  const alreadyAdded = Boolean(
    props.element?.elementId &&
      selectedKit?.elements.some(
        (element) =>
          String(element.provenance.resourceElementId) === String(props.element?.elementId),
      ),
  );

  return (
    <Dialog open={props.element !== null} onOpenChange={props.onOpenChange}>
      <DialogContent
        className="max-h-[88dvh] max-w-xl overflow-hidden p-0"
        style={{ zIndex: UI_Z.panelModal }}
        overlayStyle={{ zIndex: UI_Z.panelModal - 1 }}
      >
        <DialogHeader className="border-b px-5 py-4 pr-12">
          <DialogTitle>Add to Brand Kit</DialogTitle>
          <DialogDescription className="line-clamp-2">
            {props.element?.title ?? "Choose an approved creative element"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-5 py-4">
          {props.brandKits.length > 0 ? (
            <div className="space-y-2" role="radiogroup" aria-label="Choose a Brand Kit">
              {props.brandKits.map((kit) => {
                if (!kit._id) return null;
                const selected = kit._id === props.selectedKitId;
                const containsElement = Boolean(
                  props.element?.elementId &&
                    kit.elements.some(
                      (element) =>
                        String(element.provenance.resourceElementId) ===
                        String(props.element?.elementId),
                    ),
                );
                return (
                  <label
                    key={kit.kitId}
                    className={`flex w-full cursor-pointer items-center gap-3 border px-3 py-3 text-left transition hover:border-primary/60 hover:bg-accent has-focus-visible:outline-none has-focus-visible:ring-2 has-focus-visible:ring-ring ${
                      selected ? "border-primary bg-primary/10" : "bg-background"
                    }`}
                  >
                    <input
                      type="radio"
                      name="brand-kit-destination"
                      value={String(kit._id)}
                      checked={selected}
                      onChange={() => props.onSelectKit(kit._id as Id<"brandKits">)}
                      className="sr-only"
                    />
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                        selected ? "border-primary bg-primary text-primary-foreground" : ""
                      }`}
                    >
                      {selected ? <Check className="size-3.5" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{kit.name}</span>
                      <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                        {kit.elements.length} approved elements | revision {kit.revision}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-wrap justify-end gap-1">
                      {kit.kitId === props.defaultBrandKitId ? (
                        <Badge variant="secondary" className="text-[10px]">
                          default
                        </Badge>
                      ) : null}
                      {containsElement ? (
                        <Badge variant="outline" className="text-[10px]">
                          added
                        </Badge>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-32 flex-col items-center justify-center border bg-muted px-4 text-center">
              <ShieldCheck className="size-5 text-muted-foreground" />
              <div className="mt-2 text-sm font-semibold">No active Brand Kits</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Create or restore a Brand Kit before approving this element.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t bg-card px-5 py-4">
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!props.selectedKitId || props.saving}
            onClick={props.onConfirm}
          >
            <PackagePlus className="size-4" />
            {props.saving ? "Saving..." : alreadyAdded ? "Refresh snapshot" : "Add element"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
