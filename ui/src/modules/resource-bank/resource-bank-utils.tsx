import { Database, Film, ImageIcon, LinkIcon } from "lucide-react";
import type { ReactElement } from "react";
import type { FarplaneProjectConfigFile, ResourceBankAssetPreview } from "./types";

export function formatTime(value: number | undefined): string {
  if (!value) return "never";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatTag(tag: string): string {
  return tag.replace(/^[^:]+:/, "").replace(/-/g, " ");
}

export function formatKind(kind: string): string {
  return kind.replace(/-/g, " ");
}

export function assetIcon(kind: string): ReactElement {
  if (kind === "video" || kind === "clip") return <Film className="size-4" />;
  if (kind === "image" || kind === "screenshot" || kind === "frame")
    return <ImageIcon className="size-4" />;
  if (kind === "url") return <LinkIcon className="size-4" />;
  return <Database className="size-4" />;
}

export function sourceUrl(asset: ResourceBankAssetPreview | undefined): string | undefined {
  return asset?.canonicalUrl ?? asset?.sourceUrl;
}

export function sourceLabel(asset: ResourceBankAssetPreview | undefined): string | undefined {
  const value = sourceUrl(asset);
  if (!value) return asset?.localPath?.split("/").pop();
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

export function displayableMediaUrl(
  asset: ResourceBankAssetPreview | undefined,
): { kind: "image" | "video"; url: string } | undefined {
  if (asset?.storageUrl) {
    if (asset.assetKind === "video" || asset.assetKind === "clip") {
      return { kind: "video", url: asset.storageUrl };
    }
    if (asset.assetKind !== "audio") {
      return { kind: "image", url: asset.storageUrl };
    }
  }
  const direct = localFsUrl(asset?.localPath);
  const candidate = direct ?? sourceUrl(asset);
  if (!candidate) return undefined;
  if (
    candidate.startsWith("data:image/") ||
    /\.(avif|gif|jpe?g|png|webp)(\?.*)?$/i.test(candidate)
  ) {
    return { kind: "image", url: candidate };
  }
  if (candidate.startsWith("data:video/") || /\.(mp4|mov|webm|m4v)(\?.*)?$/i.test(candidate)) {
    return { kind: "video", url: candidate };
  }
  return undefined;
}

export function hasPreviewHandle(asset: ResourceBankAssetPreview | undefined): boolean {
  return Boolean(asset?.sourceUrl ?? asset?.canonicalUrl ?? asset?.storageId ?? asset?.localPath);
}

export function readDefaultBrandKitId(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const files = (response as { files?: FarplaneProjectConfigFile[] }).files ?? [];
  const brandFile = files.find(
    (file) => file.kind === "brand" || file.path === "farplane/brand.yaml",
  );
  const parsed = brandFile?.parsedJson;
  const value = parsed?.default_brand_kit_id ?? parsed?.defaultBrandKitId;
  return typeof value === "string" ? value.trim() : "";
}

export async function fetchDefaultBrandKitId(): Promise<string> {
  const response = await fetch("/farplane/project-config");
  if (!response.ok) throw new Error("brand_config_read_failed");
  return readDefaultBrandKitId(await response.json());
}

export async function saveDefaultBrandKitId(defaultBrandKitId: string): Promise<void> {
  const response = await fetch("/farplane/brand-config", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ defaultBrandKitId }),
  });
  if (!response.ok) throw new Error("brand_config_write_failed");
}

function localFsUrl(path: string | undefined): string | undefined {
  if (!path) return undefined;
  return `/@fs${path.split("/").map(encodeURIComponent).join("/")}`;
}
