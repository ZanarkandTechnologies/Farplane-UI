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
  schemaVersion: 5 as const,
  sourceStatus: "TRANSCRIPT_USED" as const,
  sourceNote: "Transcript inspected.",
  summary: "The claim is qualified.",
  publisher: "Example Channel",
  publishedAt: "2026-07-20",
  news: {
    candidates: [
      {
        title: "Example claim is qualified",
        summary: "A constraint changes the headline claim.",
        eventDate: "2026-07-20",
        entities: ["Example"],
        tags: ["Example", "Product Claim"],
        frame: "Constraint-first reporting.",
        claims: [
          {
            statement: "The claim has an important constraint.",
            stance: "neutral" as const,
            evidence: {
              timestamp: "01:20",
              excerpt: "The transcript adds a constraint.",
              schemaVersion: 2 as const,
              extractorVersion: "intelligest-v1",
              reference: null,
            },
          },
        ],
        eventKey: null,
        whyNow: null,
        whyItMatters: null,
      },
    ],
  },
  concepts: ["Example", "Product Claim"],
  relatedCoverage: [],
  projectRelevance: [],
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
            progress: {
              stage: "analyzing",
              message: "Analyzing source evidence and recent comparisons.",
              updatedAt: "2026-07-22T00:00:01.000Z",
            },
            createdAt: "2026-07-22T00:00:00.000Z",
            updatedAt: "2026-07-22T00:00:01.000Z",
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  const job = (await getJobs()).jobs[0];
  assert.equal(job?.threadId, "thread-running");
  assert.deepEqual(job?.progress, {
    stage: "analyzing",
    message: "Analyzing source evidence and recent comparisons.",
    updatedAt: "2026-07-22T00:00:01.000Z",
  });
});

test("cache hit reuses analysis and thread id without a local-agent call", async () => {
  storage.clear();
  fetchCalls = 0;
  storage.set("farplane-youtube-analysis-v5:dQw4w9WgXcQ", {
    schemaVersion: 5,
    analysis,
    threadId: "thread-cached",
  });
  globalThis.fetch = async (_input, init) => {
    fetchCalls += 1;
    assert.match(String(init?.body), /thread-cached/);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  assert.deepEqual(await analyze("dQw4w9WgXcQ", "Claim?"), {
    ok: true,
    analysis,
    threadId: "thread-cached",
    cached: true,
  });
  assert.equal(fetchCalls, 1);
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
  assert.deepEqual(storage.get("farplane-youtube-analysis-v5:dQw4w9WgXcQ"), {
    schemaVersion: 5,
    analysis,
    threadId: "thread-new",
  });
});

test("a remote ready dossier is reused without requiring a local analysis payload", async () => {
  storage.clear();
  fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(
      JSON.stringify({
        ok: true,
        reused: true,
        disposition: "reused_ready",
        dossierId: "dossier-existing",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  assert.deepEqual(await analyze("dQw4w9WgXcQ", "Claim?"), {
    ok: true,
    reused: true,
    dossierId: "dossier-existing",
    threadId: undefined,
    cached: false,
  });
  assert.equal(fetchCalls, 1);
});

test("transcript-unavailable cache entries are not shown as answers", async () => {
  storage.clear();
  fetchCalls = 0;
  storage.set("farplane-youtube-analysis-v5:dQw4w9WgXcQ", {
    schemaVersion: 5,
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

test("pre-News-enrichment cache entries are invalidated before they can reach the cloud writer", async () => {
  storage.clear();
  fetchCalls = 0;
  const { news: _news, ...preNewsAnalysis } = analysis;
  storage.set("farplane-youtube-analysis-v5:dQw4w9WgXcQ", {
    schemaVersion: 5,
    analysis: preNewsAnalysis,
    threadId: "thread-pre-news",
  });
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ ok: true, analysis, threadId: "thread-fresh" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const result = await analyze("dQw4w9WgXcQ", "Claim?");
  assert.equal(result.cached, false);
  assert.equal(result.threadId, "thread-fresh");
  assert.equal(fetchCalls, 1);
});

test("stale v4 cache entries are ignored and replaced by v5 analysis", async () => {
  storage.clear();
  fetchCalls = 0;
  storage.set("farplane-youtube-analysis-v4:dQw4w9WgXcQ", {
    schemaVersion: 4,
    analysis: { ...analysis, schemaVersion: 4 },
    threadId: "thread-stale",
  });
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(
      JSON.stringify({ ok: true, analysis, threadId: "thread-v5" }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const result = await analyze("dQw4w9WgXcQ", "Claim?");
  assert.equal(result.cached, false);
  assert.equal(result.threadId, "thread-v5");
  assert.equal(fetchCalls, 1);
  assert.ok(storage.has("farplane-youtube-analysis-v5:dQw4w9WgXcQ"));
});

test("invalid analysis reports the failing strict field path", async () => {
  storage.clear();
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        ok: true,
        analysis: { ...analysis, concepts: undefined },
        threadId: "thread-invalid",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  await assert.rejects(
    analyze("dQw4w9WgXcQ", "Claim?"),
    /Invalid analysis payload.*concepts/,
  );
});
