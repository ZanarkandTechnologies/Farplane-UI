import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import {
  assetIcon,
  displayableMediaUrl,
  hasPreviewHandle,
  sourceLabel,
} from "./resource-bank-utils";
import type { ResourceBankAssetPreview, ResourceBankPreviewStatus } from "./types";

export function MediaPreview(props: {
  asset: ResourceBankAssetPreview | undefined;
  fallbackKind: string;
  previewStatus?: ResourceBankPreviewStatus;
  title: string;
  compact?: boolean;
  tall?: boolean;
  mosaic?: boolean;
}): ReactElement {
  const media = displayableMediaUrl(props.asset);
  const heightClass = props.mosaic
    ? "h-full min-h-0"
    : props.tall
      ? "h-44"
      : props.compact
        ? "h-28"
        : "h-44";
  if (media?.kind === "image") {
    return (
      <div className={`min-w-0 max-w-full overflow-hidden border bg-muted ${heightClass}`}>
        <img
          src={media.url}
          alt=""
          className="size-full min-w-0 max-w-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }
  if (media?.kind === "video") {
    return (
      <div className={`min-w-0 max-w-full overflow-hidden border bg-muted ${heightClass}`}>
        <video
          src={media.url}
          className="size-full min-w-0 max-w-full object-cover"
          muted
          playsInline
          preload="metadata"
        />
      </div>
    );
  }
  const hasHandle = hasPreviewHandle(props.asset);
  const stateLabel =
    props.previewStatus?.state === "missing"
      ? "No source saved"
      : hasHandle
        ? "Preview handle"
        : "Preview missing";
  return (
    <div
      className={`flex min-w-0 max-w-full flex-col items-center justify-center gap-2 overflow-hidden border bg-muted px-3 text-center text-muted-foreground ${heightClass}`}
      title={props.previewStatus?.message}
    >
      {assetIcon(props.asset?.assetKind ?? props.fallbackKind)}
      <span className="max-w-full truncate text-[11px] font-semibold">{stateLabel}</span>
      <span className="max-w-full truncate text-[10px]">
        {sourceLabel(props.asset) ?? props.fallbackKind}
      </span>
      <span className="sr-only">{props.title}</span>
    </div>
  );
}

export function CoverMosaic(props: {
  examples: ResourceBankAssetPreview[];
  fallbackKind?: string;
}): ReactElement {
  const uniqueExamples = props.examples.filter(
    (example, index, all) =>
      all.findIndex((candidate) => mediaKey(candidate) === mediaKey(example)) === index,
  );
  const displayableExamples = uniqueExamples.filter((example) => displayableMediaUrl(example));
  const examples = (displayableExamples.length > 0 ? displayableExamples : uniqueExamples).slice(
    0,
    4,
  );
  if (examples.length === 0) {
    return (
      <div className="grid h-24 min-w-0 max-w-full grid-cols-2 grid-rows-2 overflow-hidden border bg-muted text-muted-foreground">
        {[0, 1, 2, 3].map((slot) => (
          <div
            key={slot}
            className="flex items-center justify-center border-border/70 border-r border-b"
          >
            {assetIcon(props.fallbackKind ?? "image")}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid h-24 min-w-0 max-w-full grid-cols-2 grid-rows-2 overflow-hidden border bg-muted">
      {examples.map((example) => (
        <MediaPreview
          key={mediaKey(example)}
          asset={example}
          fallbackKind={example.assetKind ?? props.fallbackKind ?? "image"}
          title={example.title ?? "Brand example"}
          mosaic
        />
      ))}
      {examples.length < 4
        ? ["a", "b", "c", "d"].slice(0, 4 - examples.length).map((slot) => (
            <div
              key={`empty-${slot}`}
              className="flex items-center justify-center border-border/70 border-r border-b text-muted-foreground"
            >
              <Badge variant="outline" className="text-[10px]">
                open
              </Badge>
            </div>
          ))
        : null}
    </div>
  );
}

function mediaKey(asset: ResourceBankAssetPreview): string {
  return String(
    asset.storageUrl ??
      asset.storageId ??
      asset.localPath ??
      asset.canonicalUrl ??
      asset.sourceUrl ??
      asset.assetId ??
      asset.title,
  );
}
