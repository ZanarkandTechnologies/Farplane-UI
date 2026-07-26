/**
 * Weekly grouping model for daily failure cards.
 *
 * Projected daily failures become stable Monday-based browsing groups.
 */
import type { OverviewHighlightCard } from "@/modules/team-workspace/lib/dashboard-projections/overview-surface";

export type FailureWeekGroup = {
  id: string;
  label: string;
  cards: OverviewHighlightCard[];
};

function weekIdForCard(card: OverviewHighlightCard): string {
  const period = card.period || card.createdAt?.slice(0, 10) || "";
  const match = period.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (!Number.isFinite(date.getTime())) return "";
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function weekLabel(weekId: string): string {
  const start = new Date(`${weekId}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(start)}–${formatter.format(end)}`;
}

export function buildFailureWeekGroups(cards: OverviewHighlightCard[]): FailureWeekGroup[] {
  const grouped = new Map<string, OverviewHighlightCard[]>();
  for (const card of cards) {
    const weekId = weekIdForCard(card);
    if (!weekId) continue;
    const existing = grouped.get(weekId) ?? [];
    existing.push(card);
    grouped.set(weekId, existing);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([id, weekCards]) => {
      return {
        id,
        label: weekLabel(id),
        cards: weekCards.sort((left, right) =>
          (right.createdAt ?? right.period ?? "").localeCompare(
            left.createdAt ?? left.period ?? "",
          ),
        ),
      };
    });
}
