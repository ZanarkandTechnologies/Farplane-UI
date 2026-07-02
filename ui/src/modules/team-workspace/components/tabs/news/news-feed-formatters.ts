/**
 * News tab display helpers.
 * Owns presentation-only formatting for Feed Scout daily items; no fetches or UI state.
 */

import type {
  FeedScoutEmbed,
  FeedScoutItem,
} from "@/modules/team-workspace/lib/feed-scout/feed-scout";

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export type NewsFeedFact = {
  label: string;
  value: string;
};

export function actionabilityVariant(label: string): "default" | "secondary" | "outline" {
  const normalized = label.toLowerCase();
  if (normalized === "adapt" || normalized === "inspect") return "default";
  if (normalized === "watch") return "secondary";
  return "outline";
}

export function buildFeedItemBookmark(item: FeedScoutItem): FeedScoutEmbed | null {
  const url = parseWebUrl(item.canonicalUrl);
  if (!url) return null;
  return {
    provider: item.platform || "web",
    cardType: item.kind || "bookmark",
    url: url.href,
    title: item.title,
    byline: `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`,
  };
}

export function displayText(value: string): string {
  return value.replace(/_/g, " ");
}

export function formatDateTime(value: string | undefined): string {
  if (!value) return "undated";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return dateTimeFormatter.format(parsed);
}

export function parseWebUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function shortUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return value;
  }
}

export function sourceFacts(item: FeedScoutItem): NewsFeedFact[] {
  const snapshot = item.sourceSnapshot ?? {};
  const delta = recordLike(item.todayDelta?.delta);
  const facts: NewsFeedFact[] = [];
  pushFact(facts, "Delta", formatDelta(item.todayDelta?.delta));
  pushFact(facts, "Observed", formatDateTime(item.todayDelta?.observedAt));
  pushFact(facts, "Stars", formatNumber(snapshot.stars));
  pushFact(facts, "Stars delta", formatSignedNumber(delta.stars));
  pushFact(facts, "Forks", formatNumber(snapshot.forks));
  pushFact(facts, "Forks delta", formatSignedNumber(delta.forks));
  pushFact(facts, "Latest release", stringOrNumber(snapshot.latest_release));
  pushFact(facts, "Release date", formatDateTime(stringOrNumber(snapshot.release_published_at)));
  pushFact(facts, "Pushed", formatDateTime(stringOrNumber(snapshot.pushed_at)));
  pushFact(facts, "Updated", formatDateTime(stringOrNumber(snapshot.updated_at)));
  pushFact(facts, "Video", stringOrNumber(snapshot.latest_video_title ?? snapshot.video_title));
  pushFact(facts, "Author", item.author);
  return facts;
}

function formatDelta(value: unknown): string | undefined {
  if (typeof value === "string" || typeof value === "number") return stringOrNumber(value);
  const delta = recordLike(value);
  const parts = Object.entries(delta)
    .map(([key, entry]) => {
      const formatted = formatSignedNumber(entry);
      return formatted ? `${displayText(key)} ${formatted}` : "";
    })
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function formatNumber(value: unknown): string | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("en-US").format(value)
    : stringOrNumber(value);
}

function formatSignedNumber(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return stringOrNumber(value);
  return `${value > 0 ? "+" : ""}${new Intl.NumberFormat("en-US").format(value)}`;
}

function pushFact(facts: NewsFeedFact[], label: string, value: string | undefined): void {
  if (value && value !== "undated") facts.push({ label, value });
}

function recordLike(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringOrNumber(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}
