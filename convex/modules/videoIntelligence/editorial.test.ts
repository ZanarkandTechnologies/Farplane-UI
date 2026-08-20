import { describe, expect, it } from "vitest";
import {
  authorityFromYouTubeChannel,
  canCarryForwardNewsContribution,
  candidatesForNewsEnrichment,
  evaluateNewsCandidate,
  hasCurrentRevision,
  hasOtherSourceCoverage,
  isCuratedWorldMarkdown,
  newsPublicationState,
  resolveNewsReferenceUrl,
  selectLatestCarryForwardNewsContributions,
  topicNamesForCoverage,
} from "./editorial";

const citedCandidate = {
  eventDate: "2026-08-10",
  eventKey: "https://example.gov/releases/2026-08-10",
  whyNow: "The rule was published today.",
  whyItMatters: "It changes the public compliance requirement.",
  claims: [{ evidence: { reference: "https://example.gov/releases/2026-08-10" } }],
};

describe("editorial News gate", () => {
  it("keeps a dossier-only analysis out of the News writer", () => {
    expect(candidatesForNewsEnrichment(null)).toEqual([]);
    expect(candidatesForNewsEnrichment({ candidates: [citedCandidate] })).toEqual([citedCandidate]);
  });

  it("accepts a current, exact-dated, cited candidate", () => {
    expect(
      evaluateNewsCandidate(citedCandidate, Date.parse("2026-08-12T12:00:00.000Z")),
    ).toMatchObject({
      eligible: true,
      eventDay: "2026-08-10",
    });
  });

  it("keeps undated, historical, and uncited material out of News", () => {
    const now = Date.parse("2026-08-12T12:00:00.000Z");
    expect(evaluateNewsCandidate({ ...citedCandidate, eventDate: null }, now)).toMatchObject({
      eligible: false,
    });
    expect(
      evaluateNewsCandidate({ ...citedCandidate, eventDate: "1993-08-10" }, now),
    ).toMatchObject({ eligible: false, reason: "event_outside_window" });
    expect(
      evaluateNewsCandidate({ ...citedCandidate, claims: [{ evidence: {} }] }, now),
    ).toMatchObject({ eligible: false, reason: "event_key_not_cited" });
    expect(
      evaluateNewsCandidate(
        {
          ...citedCandidate,
          eventKey: "release:immutable-id",
          claims: [{ evidence: { reference: "release:immutable-id" } }],
        },
        now,
      ),
    ).toMatchObject({ eligible: false, reason: "event_key_invalid" });
  });
});

it("projects only an exact cited HTTPS reference", () => {
  expect(resolveNewsReferenceUrl(citedCandidate.eventKey, citedCandidate.claims)).toBe(
    citedCandidate.eventKey,
  );
  expect(
    resolveNewsReferenceUrl(citedCandidate.eventKey, [{ evidence: { reference: null } }]),
  ).toBe(null);
  expect(
    resolveNewsReferenceUrl("http://example.gov/release", [
      { evidence: { reference: "http://example.gov/release" } },
    ]),
  ).toBe(null);
});

it("carries forward only a previously valid exact-cited News contribution", () => {
  const durableStory = {
    eventDate: "2026-08-10",
    eventKey: citedCandidate.eventKey,
    whyNow: citedCandidate.whyNow,
    whyItMatters: citedCandidate.whyItMatters,
  };
  expect(canCarryForwardNewsContribution(durableStory, citedCandidate.claims)).toBe(true);
  expect(
    canCarryForwardNewsContribution({ ...durableStory, eventKey: "story:internal-object" }, [
      { evidence: { reference: "story:internal-object" } },
    ]),
  ).toBe(false);
  expect(canCarryForwardNewsContribution(durableStory, [{ evidence: { reference: null } }])).toBe(
    false,
  );
  expect(
    canCarryForwardNewsContribution({ ...durableStory, whyNow: undefined }, citedCandidate.claims),
  ).toBe(false);
});

it("recovers the latest valid historical citation and skips an incoming duplicate event", () => {
  type HistoricalContribution = {
    storyId: string;
    revision: number;
    claims: Array<{ evidence: { reference: string | null } }>;
  };
  const story = {
    eventDate: "2026-08-10",
    eventKey: citedCandidate.eventKey,
    whyNow: citedCandidate.whyNow,
    whyItMatters: citedCandidate.whyItMatters,
  };
  const invalidNewest: HistoricalContribution = {
    storyId: "story-1",
    revision: 2,
    claims: [{ evidence: { reference: null } }],
  };
  const validOlder: HistoricalContribution = {
    storyId: "story-1",
    revision: 1,
    claims: citedCandidate.claims,
  };
  expect(
    selectLatestCarryForwardNewsContributions(
      [
        { contribution: invalidNewest, story },
        { contribution: validOlder, story },
      ],
      [],
    ).map((row) => row.contribution.revision),
  ).toEqual([1]);
  expect(
    selectLatestCarryForwardNewsContributions(
      [{ contribution: validOlder, story }],
      [`${story.eventKey}\u0000${story.eventDate}`],
    ),
  ).toEqual([]);
});

it("publishes one current cited contribution as developing News without requiring creator authority", () => {
  expect(newsPublicationState(true, 0)).toEqual({
    classification: "news",
    editorialStatus: "developing",
    visibleInNews: true,
  });
  expect(newsPublicationState(true, 2)).toEqual({
    classification: "news",
    editorialStatus: "aggregated",
    visibleInNews: true,
  });
  expect(newsPublicationState(false, 2)).toEqual({
    classification: "dossier_only",
    editorialStatus: "developing",
    visibleInNews: false,
  });
});

it("only builds an authority from exact YouTube channel metadata", () => {
  expect(authorityFromYouTubeChannel("UCabcdefghijklmnopqrstuv")).toBe(
    "youtube:UCabcdefghijklmnopqrstuv",
  );
  expect(authorityFromYouTubeChannel("Example Channel")).toBeUndefined();
  expect(isCuratedWorldMarkdown("[[world/ai-models]]")).toBe(true);
  expect(isCuratedWorldMarkdown("ai-models")).toBe(false);
});

it("keeps the analyst's named recurring Topic ahead of supporting tags", () => {
  expect(
    topicNamesForCoverage({
      title: "AI-assisted income",
      tags: ["Artificial Intelligence", "Creator Economy", "AI-assisted income"],
    }),
  ).toEqual(["AI-assisted income", "Artificial Intelligence", "Creator Economy"]);
});

it("keeps only a current revision eligible for a materialized paged read", () => {
  expect(hasCurrentRevision(["superseded", "superseded"])).toBe(false);
  expect(hasCurrentRevision(["superseded", "current"])).toBe(true);
});

it("shows dossier Related coverage only when another current source shares the lens", () => {
  const origin = {
    contentSourceId: "content-source-a",
    sourceAuthorityKey: "youtube:UCabcdefghijklmnopqrstuv",
  };
  expect(hasOtherSourceCoverage(origin, [{ ...origin }])).toBe(false);
  expect(
    hasOtherSourceCoverage(origin, [
      { contentSourceId: "content-source-b", sourceAuthorityKey: origin.sourceAuthorityKey },
    ]),
  ).toBe(true);
  expect(
    hasOtherSourceCoverage({ sourceAuthorityKey: "youtube:UCabcdefghijklmnopqrstuv" }, [
      { sourceAuthorityKey: "youtube:UCotherchannelidentifier" },
    ]),
  ).toBe(true);
  expect(hasOtherSourceCoverage({}, [{ contentSourceId: "content-source-b" }])).toBe(false);
});
