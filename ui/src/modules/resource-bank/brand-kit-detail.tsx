import { useMutation } from "convex/react";
import { makeFunctionReference } from "convex/server";
import {
  ArrowLeft,
  BadgeCheck,
  ExternalLink,
  MoreHorizontal,
  PackageCheck,
  Save,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { type ReactElement, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UI_Z } from "@/lib/z-index";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  elementExamples,
  promptStatus,
  promptTextForDraft,
  promptUnsaved,
} from "./brand-kit-presentation";
import { CoverMosaic } from "./media-preview";
import { formatKind, formatTag, formatTime, sourceUrl } from "./resource-bank-utils";
import type {
  BrandKit,
  BrandKitElementSnapshot,
  ResourceBankAssetPreview,
} from "./types";

type UpdateBrandKitPromptArgs = {
  brandKitId: Id<"brandKits">;
  expectedKitRevision: number;
  expectedPromptRevision: number;
  text: string;
};

const updateBrandKitPromptRef = makeFunctionReference<
  "mutation",
  UpdateBrandKitPromptArgs,
  unknown
>("modules/resourceBank/brandKits:updateBrandKitPrompt");

export function BrandKitDetail(props: {
  kit: BrandKit;
  defaultBrandKitId: string;
  brandConfigState: "idle" | "loading" | "saving";
  previewByElementId: ReadonlyMap<string, ResourceBankAssetPreview>;
  onBack: () => void;
  onOpenSettings: () => void;
  onSetDefault: (kitId: string) => void;
}): ReactElement {
  const [draftPrompt, setDraftPrompt] = useState(() => promptTextForDraft(props.kit.prompt));

  useEffect(() => {
    setDraftPrompt(promptTextForDraft(props.kit.prompt));
  }, [props.kit.prompt]);

  return (
    <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b px-3 py-3">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 px-2 sm:px-3"
              onClick={props.onBack}
            >
              <ArrowLeft className="size-3.5" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2 text-sm font-semibold sm:text-base">
                <PackageCheck className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{props.kit.name}</span>
                {props.kit.kitId === props.defaultBrandKitId ? (
                  <Badge className="shrink-0 text-[10px]">default</Badge>
                ) : null}
              </div>
              <div className="mt-1 truncate text-[11px] text-muted-foreground">
                {props.kit.kitId} | kit rev {props.kit.revision} | {promptStatus(props.kit.prompt)}{" "}
                | {props.kit.elements.length} elements
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="hidden h-8 sm:inline-flex"
              disabled={
                props.brandConfigState !== "idle" ||
                props.kit.status !== "active" ||
                props.kit.kitId === props.defaultBrandKitId
              }
              onClick={() => props.onSetDefault(props.kit.kitId)}
            >
              <Save className="size-3.5" />
              Default
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  aria-label="Brand Kit actions"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" style={{ zIndex: UI_Z.panelModal }}>
                <DropdownMenuItem onSelect={props.onOpenSettings}>
                  Edit kit details
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <div className="min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-hidden overflow-y-auto p-2 sm:p-3">
        <div className="grid min-w-0 w-full max-w-full grid-cols-[minmax(0,1fr)] content-start gap-4">
          <PromptEditor kit={props.kit} text={draftPrompt} onTextChange={setDraftPrompt} />
          <ApprovedElementsGrid kit={props.kit} previewByElementId={props.previewByElementId} />
        </div>
      </div>
    </div>
  );
}

function PromptEditor(props: {
  kit: BrandKit;
  text: string;
  onTextChange: (value: string) => void;
}): ReactElement {
  const updatePrompt = useMutation(updateBrandKitPromptRef);
  const [saving, setSaving] = useState(false);
  const unsaved = promptUnsaved(props.kit.prompt, props.text);

  async function handleSave(): Promise<void> {
    if (!props.kit._id) return;
    try {
      setSaving(true);
      await updatePrompt({
        brandKitId: props.kit._id,
        expectedKitRevision: props.kit.revision,
        expectedPromptRevision: props.kit.prompt.revision,
        text: props.text.trim(),
      });
      toast.success("Brand Kit prompt saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save Brand Kit prompt.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid min-w-0 w-full max-w-full grid-cols-[minmax(0,1fr)] gap-3 overflow-hidden border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase text-muted-foreground">
            Brand Kit prompt
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {promptStatus(props.kit.prompt)}
            {` | updated ${formatTime(props.kit.prompt.updatedAtMs)}`}
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8"
          disabled={props.kit.status !== "active" || saving || !unsaved}
          onClick={() => void handleSave()}
        >
          <Save className="size-3.5" />
          {saving ? "Saving" : "Save"}
        </Button>
      </div>
      <Textarea
        value={props.text}
        onChange={(event) => props.onTextChange(event.target.value)}
        placeholder="Captioned Low-Poly Explainer. Add provider hints, subtitle styling, voice direction, format, and production constraints."
        className="h-52 min-h-52 w-full min-w-0 max-w-full resize-none overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words leading-5 [field-sizing:fixed] [overflow-wrap:anywhere] sm:h-44 sm:min-h-44 sm:max-h-44"
        disabled={props.kit.status !== "active" || saving}
      />
    </section>
  );
}

function ApprovedElementsGrid(props: {
  kit: BrandKit;
  previewByElementId: ReadonlyMap<string, ResourceBankAssetPreview>;
}): ReactElement {
  return (
    <section className="grid min-w-0 w-full max-w-full grid-cols-[minmax(0,1fr)] content-start gap-3 md:grid-cols-2 2xl:grid-cols-3">
      {props.kit.elements.length > 0 ? (
        props.kit.elements.map((element) => (
          <ApprovedElementCard
            key={element.elementId}
            element={element}
            previewByElementId={props.previewByElementId}
          />
        ))
      ) : (
        <div className="col-span-full flex min-h-60 items-center justify-center border bg-muted px-4 text-center text-xs text-muted-foreground">
          No approved creative elements yet. Add pinned Resource Bank elements to this kit.
        </div>
      )}
    </section>
  );
}

function ApprovedElementCard(props: {
  element: BrandKitElementSnapshot;
  previewByElementId: ReadonlyMap<string, ResourceBankAssetPreview>;
}): ReactElement {
  const examples = elementExamples(props.element, props.previewByElementId);
  return (
    <article
      className="min-w-0 w-full max-w-full overflow-hidden border bg-background p-3 transition duration-150 hover:border-primary/50 hover:bg-accent"
      data-testid={`approved-element-${props.element.elementId}`}
    >
      <CoverMosaic examples={examples} fallbackKind={props.element.kind} />
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{props.element.title}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {formatKind(props.element.kind)}
          </div>
        </div>
        <Badge className="shrink-0 gap-1 text-[10px]">
          <BadgeCheck className="size-3" />
          approved
        </Badge>
      </div>
      <div className="mt-3 line-clamp-5 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
        {props.element.description}
      </div>
      <div className="mt-3 border-l-2 border-primary/50 pl-3">
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
      <details className="mt-3 max-w-full overflow-hidden border bg-muted/50 px-3 py-2">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] font-semibold">
          <WandSparkles className="size-3.5 text-muted-foreground" />
          Generation prompt
        </summary>
        <div className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
          {props.element.goldenRecipe}
        </div>
      </details>
      <div className="mt-3 flex flex-wrap gap-1">
        {props.element.tags.slice(0, 5).map((tag) => (
          <Badge key={tag} variant="secondary" className="text-[10px]">
            {formatTag(tag)}
          </Badge>
        ))}
      </div>
      {examples[0] && sourceUrl(examples[0]) ? (
        <Button asChild size="sm" variant="outline" className="mt-3 h-7 px-2 text-[11px]">
          <a href={sourceUrl(examples[0])} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" />
            Source
          </a>
        </Button>
      ) : null}
    </article>
  );
}

export function BrandKitSettingsDialog(props: {
  kit: BrandKit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (kit: BrandKit, name: string, description: string) => void;
}): ReactElement {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  useEffect(() => {
    setName(props.kit?.name ?? "");
    setDescription(props.kit?.description ?? "");
  }, [props.kit]);
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        style={{ zIndex: UI_Z.panelModal }}
        overlayStyle={{ zIndex: UI_Z.panelModal - 1 }}
      >
        <DialogHeader>
          <DialogTitle>Brand Kit Details</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Kit name"
          />
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Description"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!props.kit || !name.trim()}
              onClick={() => {
                if (props.kit) props.onSave(props.kit, name, description);
                props.onOpenChange(false);
              }}
            >
              <BadgeCheck className="size-3.5" />
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
