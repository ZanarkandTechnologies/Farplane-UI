/**
 * Pre-watch tags each key point against the creator's Wiki note: `[NEW]`, `[EXTENDS]` or `[RESTATED]`.
 * The overlay shows new content first and keeps what is already on file below it.
 */

export type Novelty = "new" | "extends" | "restated" | "untagged";

export type RankedPoint = { novelty: Novelty; finding: string; detail: string | null; timestamp: string | null };

/** A finding's leading verdict, e.g. `[NEW] `. */
export const TAG = /^\s*\[(NEW|EXTENDS|RESTATED)\]\s*/i;
const ORDER: Record<Novelty, number> = { new: 0, extends: 1, untagged: 2, restated: 3 };

export function rankPoints(points: { finding: string; detail?: string | null; timestamp?: string | null }[]): RankedPoint[] {
  return points
    .map((point, index) => {
      const match = TAG.exec(point.finding);
      return {
        index,
        point: {
          novelty: (match ? match[1].toLowerCase() : "untagged") as Novelty,
          finding: match ? point.finding.slice(match[0].length) : point.finding,
          detail: point.detail ?? null,
          timestamp: point.timestamp ?? null,
        },
      };
    })
    .sort((a, b) => ORDER[a.point.novelty] - ORDER[b.point.novelty] || a.index - b.index)
    .map(({ point }) => point);
}

/** Seconds into the video for `m:ss` / `h:mm:ss`, or null. */
export function timestampSeconds(timestamp: string | null): number | null {
  if (!timestamp) return null;
  const parts = timestamp.split(":").map((part) => Number.parseInt(part, 10));
  if (!parts.length || parts.some((part) => !Number.isFinite(part))) return null;
  return parts.reduce((total, part) => total * 60 + part, 0);
}
