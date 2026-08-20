/** Pure editorial eligibility rules. The model supplies judgment; the server enforces shape. */
import { isTimelineDay, timelineDayFromMs } from "../content/timeline";

export const NEWS_WINDOW_DAYS = 30;
const YOUTUBE_CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const PUBLIC_REFERENCE = /^https:\/\/[^\s]+$/;

export type EditorialCandidate = {
  eventDate?: string | null;
  eventKey?: string | null;
  whyNow?: string | null;
  whyItMatters?: string | null;
  claims: { evidence: { reference?: string | null } }[];
};

export type EditorialGate =
  | { eligible: true; eventDay: string; eventKey: string; whyNow: string; whyItMatters: string }
  | { eligible: false; reason: string };

/** The writer consumes News only as additive analysis enrichment. */
export function candidatesForNewsEnrichment<T>(enrichment: { candidates: T[] } | null): T[] {
  return enrichment?.candidates ?? [];
}

export function evaluateNewsCandidate(candidate: EditorialCandidate, nowMs: number): EditorialGate {
  const eventDay = candidate.eventDate?.trim() ?? "";
  const eventKey = candidate.eventKey?.trim() ?? "";
  const whyNow = candidate.whyNow?.trim() ?? "";
  const whyItMatters = candidate.whyItMatters?.trim() ?? "";
  if (!isTimelineDay(eventDay)) return { eligible: false, reason: "event_day_invalid" };
  if (!PUBLIC_REFERENCE.test(eventKey)) return { eligible: false, reason: "event_key_invalid" };
  if (!whyNow || !whyItMatters) return { eligible: false, reason: "editorial_explanation_missing" };
  if (!candidate.claims.some((claim) => claim.evidence.reference?.trim() === eventKey)) {
    return { eligible: false, reason: "event_key_not_cited" };
  }
  const age = calendarDayDifference(timelineDayFromMs(nowMs), eventDay);
  if (age < 0 || age > NEWS_WINDOW_DAYS) return { eligible: false, reason: "event_outside_window" };
  return { eligible: true, eventDay, eventKey, whyNow, whyItMatters };
}

export function resolveNewsReferenceUrl(
  eventKey: string | undefined,
  claims: Array<{ evidence: { reference?: string | null } }>,
): string | null {
  const candidate = eventKey?.trim() ?? "";
  if (!PUBLIC_REFERENCE.test(candidate)) return null;
  return claims.some((claim) => claim.evidence.reference?.trim() === candidate) ? candidate : null;
}

/**
 * News enrichment is additive: omission in a later analysis is not a revocation.
 * Only a previously published shape with the same exact cited HTTPS event key
 * may advance to a new immutable revision.
 */
export function canCarryForwardNewsContribution(
  story: {
    eventDate?: string;
    eventKey?: string;
    whyNow?: string;
    whyItMatters?: string;
  },
  claims: Array<{ evidence: { reference?: string | null } }>,
): boolean {
  return Boolean(
    story.eventDate &&
      isTimelineDay(story.eventDate) &&
      story.whyNow?.trim() &&
      story.whyItMatters?.trim() &&
      resolveNewsReferenceUrl(story.eventKey, claims),
  );
}

export function selectLatestCarryForwardNewsContributions<
  TContribution extends {
    storyId: unknown;
    claims: Array<{ evidence: { reference?: string | null } }>;
  },
  TStory extends {
    eventDate?: string;
    eventKey?: string;
    whyNow?: string;
    whyItMatters?: string;
  },
>(
  newestFirst: Array<{ contribution: TContribution; story: TStory | null }>,
  currentEventKeys: Iterable<string>,
): Array<{ contribution: TContribution; story: TStory }> {
  const selectedStoryIds = new Set<string>();
  const selectedEventKeys = new Set(currentEventKeys);
  const selected: Array<{ contribution: TContribution; story: TStory }> = [];
  for (const row of newestFirst) {
    if (!row.story || !canCarryForwardNewsContribution(row.story, row.contribution.claims)) {
      continue;
    }
    const storyId = String(row.contribution.storyId);
    const eventComposite = `${row.story.eventKey}\u0000${row.story.eventDate}`;
    if (selectedStoryIds.has(storyId) || selectedEventKeys.has(eventComposite)) continue;
    selectedStoryIds.add(storyId);
    selectedEventKeys.add(eventComposite);
    selected.push({ contribution: row.contribution, story: row.story });
  }
  return selected;
}

export function newsPublicationState(
  hasCurrentCitedContribution: boolean,
  distinctAuthorityCount: number,
) {
  return hasCurrentCitedContribution
    ? {
        classification: "news" as const,
        editorialStatus:
          distinctAuthorityCount >= 2 ? ("aggregated" as const) : ("developing" as const),
        visibleInNews: true,
      }
    : {
        classification: "dossier_only" as const,
        editorialStatus: "developing" as const,
        visibleInNews: false,
      };
}

export function calendarDayDifference(laterDay: string, earlierDay: string): number {
  if (!isTimelineDay(laterDay) || !isTimelineDay(earlierDay)) return Number.NaN;
  return (
    (Date.parse(`${laterDay}T00:00:00.000Z`) - Date.parse(`${earlierDay}T00:00:00.000Z`)) /
    86_400_000
  );
}

export function authorityFromYouTubeChannel(channelId: string | undefined): string | undefined {
  return channelId && YOUTUBE_CHANNEL_ID.test(channelId) ? `youtube:${channelId}` : undefined;
}

export function isYouTubeChannelId(value: string): boolean {
  return YOUTUBE_CHANNEL_ID.test(value);
}

export function topicMonth(day: string): string {
  return isTimelineDay(day) ? day.slice(0, 7) : "";
}

/** Preserve the model's named recurring lens before its supporting tag vocabulary. */
export function topicNamesForCoverage(topic: { title: string; tags: string[] }): string[] {
  return [...new Set([topic.title, ...topic.tags].map((value) => value.trim()).filter(Boolean))];
}

export function hasCurrentRevision(lifecycles: Array<"current" | "superseded">): boolean {
  return lifecycles.includes("current");
}

/**
 * Source identity is deliberately narrower than a dossier ID: Related coverage
 * must come from a different canonical source, or (when that is unavailable)
 * a different immutable reporting authority. A discovery receipt is never an
 * authority substitute.
 */
export type CoverageSourceIdentity = {
  contentSourceId?: string | null;
  sourceAuthorityKey?: string | null;
};

export function hasOtherSourceCoverage(
  origin: CoverageSourceIdentity,
  candidates: CoverageSourceIdentity[],
): boolean {
  return candidates.some((candidate) => {
    if (origin.contentSourceId && candidate.contentSourceId) {
      return origin.contentSourceId !== candidate.contentSourceId;
    }
    if (origin.sourceAuthorityKey && candidate.sourceAuthorityKey) {
      return origin.sourceAuthorityKey !== candidate.sourceAuthorityKey;
    }
    return false;
  });
}

export function isCuratedWorldMarkdown(value: string): boolean {
  return /^\[\[world\/[A-Za-z0-9._-]+\]\]$/.test(value.trim());
}
