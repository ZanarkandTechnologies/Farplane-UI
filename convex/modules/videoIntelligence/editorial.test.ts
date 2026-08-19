import { describe, expect, it } from "vitest";
import {
  authorityFromYouTubeChannel,
  candidatesForNewsEnrichment,
  evaluateNewsCandidate,
  hasCurrentRevision,
  hasOtherSourceCoverage,
  isCuratedWorldMarkdown,
  resolveNewsReferenceUrl,
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
