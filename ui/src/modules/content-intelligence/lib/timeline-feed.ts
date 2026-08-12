/**
 * Client-side day-feed accumulator for date-paged Convex subscriptions.
 * It preserves newest-to-oldest sections while a hook advances one active
 * server day at a time; it never changes server ordering or pagination.
 */

export type TimelinePage<T> = { day: string; items: T[] };

export type TimelinePageStatus = "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";

/** Replaces an already-reactive day in place, or appends the next older day once. */
export function mergeTimelinePage<T extends { id: string }>(
  pages: TimelinePage<T>[],
  day: string,
  items: T[],
): TimelinePage<T>[] {
  const index = pages.findIndex((page) => page.day === day);
  if (index < 0) return [...pages, { day, items }];
  const existing = pages[index];
  if (sameItems(existing.items, items)) return pages;
  return pages.map((page, pageIndex) => (pageIndex === index ? { day, items } : page));
}

/** More can mean a wider page for this day or the next older populated day. */
export function canLoadOlderTimeline(
  status: TimelinePageStatus,
  olderDay: string | null | undefined,
): boolean {
  return status === "CanLoadMore" || (status === "Exhausted" && Boolean(olderDay));
}

function sameItems<T extends { id: string }>(left: T[], right: T[]): boolean {
  return (
    left.length === right.length &&
    left.every(
      (item, index) =>
        item.id === right[index]?.id && JSON.stringify(item) === JSON.stringify(right[index]),
    )
  );
}
