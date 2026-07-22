import assert from "node:assert/strict";
import { before, test } from "node:test";

const storage = new Map<string, unknown>();
let fetchCalls = 0;

Object.assign(globalThis, {
  chrome: {
    storage: {
      local: {
        async get(key: string) {
          return { [key]: storage.get(key) };
        },
        async set(values: Record<string, unknown>) {
          Object.entries(values).forEach(([key, value]) =>
            storage.set(key, value),
          );
        },
      },
    },
    runtime: { onMessage: { addListener() {} } },
  },
});

const analysis = {
  schemaVersion: 1 as const,
  sourceStatus: "TRANSCRIPT_USED" as const,
  sourceNote: "Transcript inspected.",
  clickbait: {
    answer: "The claim is qualified.",
    verdict: "PARTIAL" as const,
    confidence: 0.8,
    evidence: ["The transcript adds a constraint."],
  },
  keyPoints: [{ finding: "Constraint", detail: null, timestamp: "01:20" }],
  recommendation: {
    decision: "READ" as const,
    personalRelevance: null,
    contentQuality: 0.7,
    reasonCode: "PROFILE_UNAVAILABLE" as const,
    rationale: "The summary is sufficient.",
    matchedProfile: [],
  },
};

let analyze: typeof import("./background.js").analyze;
let getJobs: typeof import("./background.js").getJobs;

before(async () => {
  ({ analyze, getJobs } = await import("./background.js"));
});

test("job list is fetched from the local bridge", async () => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        ok: true,
        jobs: [
          {
            id: "job-1",
            videoId: "dQw4w9WgXcQ",
            title: "Claim?",
            status: "running",
            threadId: "thread-running",
            createdAt: "2026-07-22T00:00:00.000Z",
            updatedAt: "2026-07-22T00:00:01.000Z",
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  assert.equal((await getJobs()).jobs[0]?.threadId, "thread-running");
});

test("cache hit reuses analysis and thread id without a local-agent call", async () => {
  storage.clear();
  fetchCalls = 0;
  storage.set("farplane-youtube-analysis-v1:dQw4w9WgXcQ", {
    schemaVersion: 2,
    analysis,
    threadId: "thread-cached",
  });
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("cache hit must not fetch");
  };

  assert.deepEqual(await analyze("dQw4w9WgXcQ", "Claim?"), {
    ok: true,
    analysis,
    threadId: "thread-cached",
    cached: true,
  });
  assert.equal(fetchCalls, 0);
});

test("cache miss stores the validated analysis and persistent thread id", async () => {
  storage.clear();
  fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(
      JSON.stringify({ ok: true, analysis, threadId: "thread-new" }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  assert.deepEqual(await analyze("dQw4w9WgXcQ", "Claim?"), {
    ok: true,
    analysis,
    threadId: "thread-new",
    cached: false,
  });
  assert.equal(fetchCalls, 1);
  assert.deepEqual(storage.get("farplane-youtube-analysis-v1:dQw4w9WgXcQ"), {
    schemaVersion: 2,
    analysis,
    threadId: "thread-new",
  });
});

test("transcript-unavailable cache entries are not shown as answers", async () => {
  storage.clear();
  fetchCalls = 0;
  storage.set("farplane-youtube-analysis-v1:dQw4w9WgXcQ", {
    schemaVersion: 2,
    analysis: {
      ...analysis,
      sourceStatus: "TRANSCRIPT_UNAVAILABLE",
      sourceNote: "Transcript extraction failed.",
      clickbait: {
        answer: "The title cannot be verified.",
        verdict: "UNVERIFIABLE",
        confidence: 0,
        evidence: [],
      },
      keyPoints: [],
    },
    threadId: "thread-fake-result",
  });
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(
      JSON.stringify({ ok: true, analysis, threadId: "thread-retried" }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  assert.deepEqual(await analyze("dQw4w9WgXcQ", "Claim?"), {
    ok: true,
    analysis,
    threadId: "thread-retried",
    cached: false,
  });
  assert.equal(fetchCalls, 1);
});
