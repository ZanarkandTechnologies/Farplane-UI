import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  createVideoIntelligenceStore,
  type VideoIntelligenceAnalysis,
} from "./video-intelligence-store.js";

function analysis(
  storyTitle: string,
  claim: string,
  timestamp: string,
): VideoIntelligenceAnalysis {
  return {
    schemaVersion: 3,
    sourceStatus: "TRANSCRIPT_USED",
    sourceNote: "Transcript inspected.",
    summary: "A source-grounded video summary.",
    publisher: "Example publisher",
    publishedAt: "2026-07-30",
    stories: [
      {
        title: storyTitle,
        summary: "Company X launched Device Y at a stated price.",
        eventDate: "2026-07-30",
        entities: ["Company X", "Device Y"],
        tags: ["Company X", "Product Launch"],
        frame: "The launch is framed around market impact.",
        claims: [
          {
            statement: claim,
            stance: "neutral",
            evidence: {
              timestamp,
              excerpt: "Device Y is launching at a price of 499 dollars.",
              schemaVersion: 2,
              extractorVersion: "summarize-v3",
            },
          },
        ],
      },
    ],
    projectRelevance: [],
    clickbait: {
      answer: "The launch happened.",
      verdict: "DELIVERED",
      confidence: 0.9,
      evidence: ["The transcript states the date and price."],
    },
    keyPoints: [
      {
        finding: "Device Y launched at $499.",
        detail: null,
        timestamp,
      },
    ],
    recommendation: {
      decision: "READ",
      personalRelevance: null,
      contentQuality: 0.8,
      reasonCode: "PROFILE_UNAVAILABLE",
      rationale: "The cited summary contains the core information.",
      matchedProfile: [],
    },
  };
}

test("persists queued, running, completed, and failed lifecycle states", async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), "video-intelligence-store-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const statePath = resolve(directory, "state.json");
  const store = createVideoIntelligenceStore(statePath);

  const succeeded = await store.enqueue({
    videoId: "dQw4w9WgXcQ",
    title: "Company X launches Device Y",
  });
  assert.equal((await store.readState()).jobs[0]?.status, "queued");
  await store.updateJob(succeeded.id, { status: "running" });
  await store.complete(
    succeeded.id,
    analysis("Company X launches Device Y at $499", "Device Y launched at $499.", "01:20"),
    "thread-1",
  );

  const failed = await store.enqueue({
    videoId: "aaaaaaaaaaa",
    title: "Unavailable source",
  });
  await store.fail(failed.id, "Transcript unavailable", "thread-2");

  const reloaded = await createVideoIntelligenceStore(statePath).readState();
  assert.equal(reloaded.jobs.find((job) => job.id === succeeded.id)?.status, "succeeded");
  assert.equal(reloaded.jobs.find((job) => job.id === failed.id)?.status, "failed");
  assert.equal(reloaded.dossiers.length, 1);
  assert.equal(reloaded.stories.length, 1);
  assert.equal(reloaded.revision, 5);
  const evidence = reloaded.contributions[0]?.claims[0]?.evidence;
  assert.deepEqual(
    {
      videoId: evidence?.videoId,
      sourceStatus: evidence?.sourceStatus,
      sourceKind: evidence?.sourceKind,
      extractorVersion: evidence?.extractorVersion,
    },
    {
      videoId: "dQw4w9WgXcQ",
      sourceStatus: "TRANSCRIPT_USED",
      sourceKind: "transcript",
      extractorVersion: "summarize-v3",
    },
  );
});

test("serializes overlapping completions into one aggregate with both perspectives", async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), "video-intelligence-race-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const statePath = resolve(directory, "state.json");
  const store = createVideoIntelligenceStore(statePath);
  const first = await store.enqueue({
    videoId: "bbbbbbbbbbb",
    title: "Device Y launch details",
  });
  const second = await store.enqueue({
    videoId: "ccccccccccc",
    title: "Why Device Y changes the market",
  });

  await Promise.all([
    store.complete(
      second.id,
      analysis(
        "Why Company X's Device Y launch matters",
        "Company X launched Device Y for $499.",
        "00:42",
      ),
      "thread-second",
    ),
    store.complete(
      first.id,
      analysis(
        "Company X launches Device Y at $499",
        "Device Y launched at a price of $499.",
        "02:14",
      ),
      "thread-first",
    ),
  ]);

  const reloaded = await createVideoIntelligenceStore(statePath).readState();
  assert.equal(reloaded.stories.length, 1);
  assert.equal(reloaded.contributions.length, 2);
  assert.equal(reloaded.aggregates[0]?.perspectiveCount, 2);
  assert.equal(reloaded.aggregates[0]?.sourceCount, 2);
  assert.equal(reloaded.aggregates[0]?.sharedClaims.length, 1);
  assert.equal(reloaded.aggregates[0]?.sharedClaims[0]?.evidence.length, 2);
});

test("re-ingesting an exact video updates one dossier and records the repeat", async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), "video-intelligence-repeat-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = createVideoIntelligenceStore(resolve(directory, "state.json"));
  for (let index = 0; index < 2; index += 1) {
    const job = await store.enqueue({
      videoId: "ddddddddddd",
      title: "Company X launches Device Y",
    });
    await store.complete(
      job.id,
      analysis("Company X launches Device Y at $499", "Device Y launched at $499.", "01:20"),
      `thread-${index}`,
    );
  }
  const state = await store.readState();
  assert.equal(state.dossiers.length, 1);
  assert.equal(state.dossiers[0]?.duplicateIngestCount, 2);
  assert.equal(state.contributions.length, 1);
});

test("re-analysis removes the dossier's abandoned story and aggregate", async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), "video-intelligence-reanalysis-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = createVideoIntelligenceStore(resolve(directory, "state.json"));
  const first = await store.enqueue({
    videoId: "eeeeeeeeeee",
    title: "Company X launches Device Y",
  });
  await store.complete(
    first.id,
    analysis("Company X launches Device Y at $499", "Device Y launched at $499.", "01:20"),
    "thread-first",
  );
  const firstState = await store.readState();
  const abandonedStoryId = firstState.stories[0]?.id;

  const second = await store.enqueue({
    videoId: "eeeeeeeeeee",
    title: "City Z opens a new transit line",
  });
  const replacement = analysis(
    "City Z opens its first orbital transit line",
    "The orbital transit line opened on Friday.",
    "00:35",
  );
  replacement.stories[0] = {
    ...replacement.stories[0],
    eventDate: "2026-08-15",
    entities: ["City Z", "Orbital transit line"],
    summary: "City Z opened its first orbital transit line.",
  };
  await store.complete(second.id, replacement, "thread-second");

  const state = await store.readState();
  assert.equal(state.stories.length, 1);
  assert.equal(state.aggregates.length, 1);
  assert.notEqual(state.stories[0]?.id, abandonedStoryId);
  assert.equal(state.aggregates[0]?.storyId, state.stories[0]?.id);
  assert.equal(state.contributions[0]?.storyId, state.stories[0]?.id);
});

test("reads v1 as an in-memory v2 projection without mutating the file", async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), "video-intelligence-migration-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const statePath = resolve(directory, "state.json");
  const legacy = {
    schemaVersion: 1,
    revision: 4,
    jobs: [],
    dossiers: [],
    stories: [
      {
        id: "story-legacy",
        title: "Legacy event",
        summary: "Legacy summary",
        eventDate: "2026-07-01",
        entities: ["Company X"],
        status: "provisional",
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ],
    contributions: [],
    aggregates: [],
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
  await writeFile(statePath, JSON.stringify(legacy), "utf8");
  const before = await readFile(statePath, "utf8");
  const store = createVideoIntelligenceStore(statePath);
  const projection = await store.readState();
  assert.equal(projection.schemaVersion, 2);
  assert.equal(projection.stories[0]?.id, "story-legacy");
  assert.equal(projection.tags[0]?.canonicalName, "Company X");
  assert.equal(await readFile(statePath, "utf8"), before);

  await store.enqueue({ videoId: "fffffffffff", title: "New video" });
  assert.equal(JSON.parse(await readFile(statePath, "utf8")).schemaVersion, 2);
});

test("dedupes tag aliases and derives only strongly supported related events", async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), "video-intelligence-relations-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = createVideoIntelligenceStore(resolve(directory, "state.json"));
  const first = await store.enqueue({
    videoId: "ggggggggggg",
    title: "Company X previews Device Y",
  });
  const preview = analysis(
    "Company X previews Device Y",
    "Company X previewed Device Y.",
    "00:20",
  );
  preview.stories[0] = {
    ...preview.stories[0],
    eventDate: "2026-06-01",
    tags: ["Product Launch"],
  };
  await store.complete(first.id, preview, "thread-preview");

  const second = await store.enqueue({
    videoId: "hhhhhhhhhhh",
    title: "Company X launches Device Y",
  });
  const launch = analysis(
    "Company X launches Device Y",
    "Company X launched Device Y.",
    "00:40",
  );
  launch.stories[0] = {
    ...launch.stories[0],
    eventDate: "2026-07-30",
    tags: ["product launches"],
  };
  await store.complete(second.id, launch, "thread-launch");

  const state = await store.readState();
  assert.equal(state.stories.length, 2);
  assert.equal(state.tags.length, 1);
  assert.deepEqual(state.tags[0]?.aliases, ["product launches"]);
  assert.equal(state.relations.length, 1);
  assert.deepEqual(state.relations[0]?.supportingEntityNames, [
    "Company X",
    "Device Y",
  ]);
});
