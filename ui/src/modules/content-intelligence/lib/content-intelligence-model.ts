import type { ContentIntelligenceItem } from "../types";

/** Primary places to read; recurring Topics remain dossier-scoped context. */
export const contentIntelligencePrimaryTabs = ["content", "news", "concepts", "world"] as const;
export type ContentIntelligencePrimaryTab = (typeof contentIntelligencePrimaryTabs)[number];

export type ContentDateGroup = {
  date: string;
  items: ContentIntelligenceItem[];
};

/**
 * Renders a stable newest-first timeline even when differently updated source records share one page.
 * Cursor paging remains server-owned; this only orders the records already visible to the operator.
 */
export function groupContentByObservedDate(items: ContentIntelligenceItem[]): ContentDateGroup[] {
  const groups = new Map<string, ContentIntelligenceItem[]>();

  for (const item of items) {
    const date = item.lastObservedAt.slice(0, 10);
    const current = groups.get(date);
    if (current) {
      current.push(item);
    } else {
      groups.set(date, [item]);
    }
  }

  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([date, groupedItems]) => ({
      date,
      items: groupedItems.sort((left, right) =>
        right.lastObservedAt.localeCompare(left.lastObservedAt),
      ),
    }));
}

/** Uses only safe, predictable YouTube thumbnail URLs; other sources keep an explicit visual fallback. */
export function contentThumbnailUrl(
  item: Pick<ContentIntelligenceItem, "canonicalRef" | "sourceKind">,
): string | undefined {
  if (item.sourceKind !== "video") return undefined;
  const videoId = youtubeVideoId(item.canonicalRef);
  return videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : undefined;
}

function youtubeVideoId(value: string): string | undefined {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const candidate =
      host === "youtu.be"
        ? url.pathname.split("/")[1]
        : host === "youtube.com"
          ? url.pathname === "/watch"
            ? (url.searchParams.get("v") ?? undefined)
            : url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1]
          : undefined;
    return candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : undefined;
  } catch {
    return undefined;
  }
}
