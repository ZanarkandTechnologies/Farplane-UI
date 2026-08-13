/**
 * Ownership: Resource Bank Elements workspace view model.
 * Inputs: creative elements with persisted creation timestamps.
 * Outputs: stable kind filters and newest-first recency groups for rendering.
 * Invariant: grouping never mutates the caller's element collection.
 */

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

export type CreativeElementDateGroup = {
  key: "today" | "week" | "month" | "earlier";
  label: string;
  elements: ResourceBankCreativeElement[];
};

export function groupCreativeElementsByRecency(
  elements: readonly ResourceBankCreativeElement[],
  now = Date.now(),
): CreativeElementDateGroup[] {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const buckets: CreativeElementDateGroup[] = [
    { key: "today", label: "Today", elements: [] },
    { key: "week", label: "Last 7 days", elements: [] },
    { key: "month", label: "Last 30 days", elements: [] },
    { key: "earlier", label: "Earlier", elements: [] },
  ];
  const weekStart = startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000;
  const monthStart = startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000;

  for (const element of [...elements].sort((left, right) => right.createdAtMs - left.createdAtMs)) {
    const bucket =
      element.createdAtMs >= startOfToday.getTime()
        ? buckets[0]
        : element.createdAtMs >= weekStart
          ? buckets[1]
          : element.createdAtMs >= monthStart
            ? buckets[2]
            : buckets[3];
    bucket.elements.push(element);
  }

  return buckets.filter((bucket) => bucket.elements.length > 0);
}
