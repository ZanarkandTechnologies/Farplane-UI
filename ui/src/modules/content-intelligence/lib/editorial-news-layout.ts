/**
 * Keeps the News list chronological without inventing visual priority. Input
 * order comes from the indexed timeline; output only creates in-order date
 * groups for the compact reading surface.
 */

export type TimelineNewsItem = {
  id: string;
  timelineDay: string | null;
};

export type EditorialNewsGroup<T extends TimelineNewsItem> = {
  day: string;
  items: T[];
};

export function groupEditorialNewsByDay<T extends TimelineNewsItem>(
  items: T[],
): EditorialNewsGroup<T>[] {
  const feedByDay = new Map<string, T[]>();

  for (const item of items) {
    const day = item.timelineDay ?? "Earlier reporting";
    const current = feedByDay.get(day);
    if (current) current.push(item);
    else feedByDay.set(day, [item]);
  }

  return [...feedByDay.entries()].map(([day, groupedItems]) => ({
    day,
    items: groupedItems,
  }));
}
