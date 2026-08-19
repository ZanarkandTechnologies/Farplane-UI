import assert from "node:assert/strict";
import { once } from "node:events";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { z } from "zod";
import {
  ANALYST_PROJECT_PATH,
  analysisSchema,
  buildPrompt,
  canonicalVideoUrl,
  createLocalAgentServer,
  FARPLANE_EXTENSION_ORIGIN,
  parseCodexAnalysis,
  runCodexAnalysis,
  utcNewsAsOfDay,
  waitForTurnCompletion,
  SUMMARIZE_STATE_PATH,
  type Analysis,
  type RpcClient,
} from "./local-agent.js";
import type {
  VideoIngestJob,
  VideoIntelligenceStore,
} from "./video-intelligence-cloud.js";

const comparisonPacket = {
  asOfDay: "2026-08-12",
  windowStartDay: "2026-07-29",
  candidates: [
    {
      sourceId: "source-related",
      dossierId: "dossier-related",
      revisionId: "revision-related",
      canonicalUrl: "https://www.youtube.com/watch?v=AAAAAAAAAAA",
      title: "A second take on the Example product launch",
      publisher: "Other Creator",
      publishedAt: "2026-08-10",
      summary: "The creator evaluates the same launch from a deployment angle.",
      keyPoints: [
        {
          finding: "The deployment constraint changes the launch claim.",
          detail: null,
          timestamp: "02:10",
        },
      ],
    },
  ],
};

const result: Analysis = {
  schemaVersion: 5,
  sourceStatus: "TRANSCRIPT_USED",
  sourceNote: "Transcript inspected.",
  summary: "The title's claim is directionally correct but constrained.",
  publisher: "Example Channel",
  publishedAt: "2026-07-20",
  news: {
    candidates: [
      {
        title: "Example product launches with a constraint",
        summary: "The product launched, although one advertised capability is limited.",
        eventDate: "2026-07-20",
        entities: ["Example product"],
        tags: ["Example Product", "Product Launch"],
        frame: "A practical assessment of the launch claim.",
        claims: [
          {
            statement: "The product launched with a limited capability.",
            stance: "neutral",
            evidence: {
              timestamp: "01:20",
              excerpt: "The capability is available, with this important limit.",
              schemaVersion: 2,
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
  concepts: ["Example product", "Product launch"],
  relatedCoverage: [],
  projectRelevance: [],
  clickbait: {
    answer: "Yes, with limits.",
    verdict: "PARTIAL",
    confidence: 0.8,
    evidence: ["The transcript qualifies the claim."],
  },
  keyPoints: [
    {
      finding: "The main claim has an important constraint.",
      timestamp: "01:20",
      detail: null,
    },
  ],
  recommendation: {
    decision: "READ",
    personalRelevance: null,
    contentQuality: 0.7,
    reasonCode: "PROFILE_UNAVAILABLE",
    rationale: "The summary contains the useful substance.",
    matchedProfile: [],
  },
};

function isolatedStore(): VideoIntelligenceStore {
  const jobs: VideoIngestJob[] = [];
  const updateJob: VideoIntelligenceStore["updateJob"] = async (jobId, update) => {
    const job = jobs.find((candidate) => candidate.id === jobId);
    if (!job) throw new Error(`Unknown test job: ${jobId}`);
    Object.assign(job, update, { updatedAt: new Date().toISOString() });
    return job;
  };
  return {
    async readProjection() {
      return { jobs };
    },
    async enqueue(input) {
      const now = new Date().toISOString();
      const job: VideoIngestJob = {
        id: `test-job-${jobs.length + 1}`,
        ...input,
        status: "queued",
        createdAt: now,
        updatedAt: now,
      };
      jobs.unshift(job);
      return job;
    },
    async getComparisonCandidates() {
      return comparisonPacket;
    },
    async updateProgress(jobId, update) {
      const job = jobs.find((candidate) => candidate.id === jobId);
      if (!job) throw new Error(`Unknown test job: ${jobId}`);
      const updatedAt = new Date().toISOString();
      job.progress = { ...update, updatedAt };
      job.updatedAt = updatedAt;
      return job;
    },
    updateJob,
    async complete(jobId, _analysis, threadId) {
      const dossierId = `test-dossier-${jobId}`;
      await updateJob(jobId, { status: "succeeded", threadId, dossierId });
      return { id: dossierId };
    },
    async fail(jobId, error, threadId) {
      return updateJob(jobId, { status: "failed", error, threadId });
    },
  };
}

test("canonical URL accepts only a YouTube video id", () => {
  assert.equal(
    canonicalVideoUrl("dQw4w9WgXcQ"),
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  );
  assert.throws(() => canonicalVideoUrl("https://evil.example"));
});

test("new shortcut tasks default to the registered Analyst workspace", () => {
  assert.equal(
    ANALYST_PROJECT_PATH,
    resolve(homedir(), "Zanarkand Technologies", "Analyst"),
  );
});

test("Codex output schema recursively resolves references and requires every object property", () => {
  const failures: Array<{ path: string; missing: string[] }> = [];
  const root = z.toJSONSchema(analysisSchema) as Record<string, unknown>;
  const visited = new Set<unknown>();
  const resolveReference = (reference: string): unknown => {
    if (reference === "#") return root;
    if (!reference.startsWith("#/")) return undefined;
    return reference
      .slice(2)
      .split("/")
      .reduce<unknown>((value, segment) => {
        if (!value || typeof value !== "object") return undefined;
        const key = segment.replaceAll("~1", "/").replaceAll("~0", "~");
        return (value as Record<string, unknown>)[key];
      }, root);
  };
  const visit = (node: unknown, path: string): void => {
    if (Array.isArray(node)) {
      node.forEach((value, index) => visit(value, `${path}[${index}]`));
      return;
    }
    if (!node || typeof node !== "object") return;
    if (visited.has(node)) return;
    visited.add(node);
    const schema = node as Record<string, unknown>;
    if (typeof schema.$ref === "string") {
      const referenced = resolveReference(schema.$ref);
      if (!referenced) failures.push({ path, missing: [`unresolved ${schema.$ref}`] });
      else visit(referenced, `${path}->${schema.$ref}`);
    }
    if (schema.type === "object" && schema.properties) {
      const properties = schema.properties as Record<string, unknown>;
      const required = Array.isArray(schema.required)
        ? schema.required.filter((value): value is string => typeof value === "string")
        : [];
      const missing = Object.keys(properties).filter((key) => !required.includes(key));
      if (schema.additionalProperties !== false) missing.push("additionalProperties:false");
      if (missing.length > 0) failures.push({ path, missing });
    }
    for (const [key, value] of Object.entries(schema)) {
      visit(value, `${path}.${key}`);
    }
  };

  visit(root, "$schema");
  assert.deepEqual(failures, []);
});

test("prompt invokes the full skill and stays honest without a profile", () => {
  const prompt = buildPrompt(
    { videoId: "dQw4w9WgXcQ", title: "You will not believe this" },
    { available: false, value: "" },
    Date.parse("2026-08-12T12:00:00.000Z"),
    comparisonPacket,
  );
  assert.match(prompt, /^\$intelligest/);
  assert.match(prompt, /complete installed skill/);
  assert.match(prompt, /substantive reliable page-owned material/);
  assert.match(prompt, /use SUMMARY_ONLY/);
  assert.match(prompt, /https:\/\/www\.youtube\.com\/watch\?v=dQw4w9WgXcQ/);
  assert.match(prompt, /PROFILE_UNAVAILABLE/);
  assert.match(prompt, /untrusted data/);
  assert.match(prompt, /News as-of \(server-generated UTC day\): 2026-08-12/);
  assert.match(prompt, /News is nullable enrichment/);
  assert.match(prompt, /broad tag or industry overlap/);
  assert.match(prompt, /No Resource Bank reuse intent was supplied/);
  assert.match(prompt, /"sourceId": "source-related"/);
  assert.match(prompt, /"revisionId": "revision-related"/);
  assert.match(prompt, /copy candidateSourceId from sourceId/);
  assert.match(prompt, /Concepts are descriptive lenses only/);
  assert.match(prompt, /eventKey must be the direct HTTPS URL/);
  assert.match(prompt, /never be an immutable ID/);
  assert.match(prompt, /evidence\.reference must exactly equal/);
  assert.match(prompt, /set news to null/);
  assert.doesNotMatch(prompt, /or immutable public ID/);
});

test("News references accept only direct HTTPS URLs", () => {
  const officialUrl = "https://example.gov/releases/example-product";
  const newsCandidate = result.news?.candidates[0];
  assert.ok(newsCandidate);
  const newsWithReference = {
    ...result,
    news: {
      candidates: [
        {
          ...newsCandidate,
          eventKey: officialUrl,
          claims: newsCandidate.claims.map((claim) => ({
            ...claim,
            evidence: { ...claim.evidence, reference: officialUrl },
          })),
        },
      ],
    },
  };

  assert.equal(
    analysisSchema.parse(newsWithReference).news?.candidates[0]?.eventKey,
    officialUrl,
  );
  for (const rejectedReference of [
    "release:immutable-id",
    "http://example.gov/releases/example-product",
  ]) {
    assert.throws(() =>
      analysisSchema.parse({
        ...newsWithReference,
        news: {
          candidates: [
            {
              ...newsWithReference.news.candidates[0],
              eventKey: rejectedReference,
              claims: newsWithReference.news.candidates[0].claims.map((claim) => ({
                ...claim,
                evidence: { ...claim.evidence, reference: rejectedReference },
              })),
            },
          ],
        },
      }),
    );
  }
});

test("UTC news date is derived by the local bridge, not supplied by a model", () => {
  assert.equal(utcNewsAsOfDay(Date.parse("2026-08-12T23:59:59.000Z")), "2026-08-12");
});

test("related coverage accepts only server-owned same-development decisions", () => {
  const comparison = analysisSchema.parse({
    ...result,
    news: null,
    relatedCoverage: [
      {
        candidateSourceId: "source-related",
        candidateRevisionId: "revision-related",
        relationship: "same_development",
        rationale: "Both videos evaluate the same Example product launch.",
      },
    ],
  });
  assert.equal(comparison.news, null);
  assert.equal(
    parseCodexAnalysis(JSON.stringify(comparison), comparisonPacket)
      .relatedCoverage[0]?.candidateSourceId,
    "source-related",
  );
  assert.throws(
    () =>
      parseCodexAnalysis(
        JSON.stringify({
          ...comparison,
          relatedCoverage: [
            {
              ...comparison.relatedCoverage[0],
              candidateSourceId: "invented-broad-topic-source",
            },
          ],
        }),
        comparisonPacket,
      ),
    /not supplied by the server/,
  );
});

test("schema v5 rejects the retired top-level stories and topics transports", () => {
  assert.throws(() => analysisSchema.parse({ ...result, stories: [] }));
  assert.throws(() => analysisSchema.parse({ ...result, topics: [] }));
});

test("Codex run is persistent, writable, skill-bound, and schema-constrained", async () => {
  const calls: { method: string; params: any }[] = [];
  let listener: (message: any) => void = () => undefined;
  const rpc: RpcClient = {
    notify() {},
    close() {},
    onNotification(next) {
      listener = next;
      return () => undefined;
    },
    async request(method, params): Promise<any> {
      calls.push({ method, params });
      if (method === "model/list") {
        return {
          data: [
            {
              model: "gpt-5.6-terra",
              supportedReasoningEfforts: [{ reasoningEffort: "xhigh" }],
            },
          ],
        };
      }
      if (method === "skills/list")
        return {
          data: [
            {
              skills: [
                {
                  name: "intelligest",
                  path: "/skills/intelligest/SKILL.md",
                  enabled: true,
                },
              ],
            },
          ],
        };
      if (method === "thread/start") return { thread: { id: "thread-1" } };
      if (method === "turn/start") {
        queueMicrotask(() => {
          listener({
            method: "item/completed",
            params: {
              threadId: "thread-1",
              item: { type: "agentMessage", text: JSON.stringify(result) },
            },
          });
          listener({
            method: "turn/completed",
            params: {
              threadId: "thread-1",
              turn: { status: "completed", items: [] },
            },
          });
        });
        return { turn: { id: "turn-1" } };
      }
      throw new Error(`Unexpected ${method}`);
    },
  };
  assert.deepEqual(
    await runCodexAnalysis(
      { videoId: "dQw4w9WgXcQ", title: "Claim?" },
      { available: false, value: "" },
      rpc,
      ANALYST_PROJECT_PATH,
      undefined,
      Date.now(),
      {
        definition: "video_intelligence.analysis.v1",
        model: "gpt-5.6-terra",
        reasoningEffort: "xhigh",
      },
      comparisonPacket,
    ),
    { analysis: result, threadId: "thread-1" },
  );
  assert.equal(
    calls.find((call) => call.method === "thread/start")?.params.ephemeral,
    false,
  );
  assert.equal(
    calls.find((call) => call.method === "thread/start")?.params.cwd,
    ANALYST_PROJECT_PATH,
  );
  assert.equal(
    calls.find((call) => call.method === "thread/start")?.params.model,
    "gpt-5.6-terra",
  );
  const turn = calls.find((call) => call.method === "turn/start")!.params;
  assert.equal(turn.model, "gpt-5.6-terra");
  assert.equal(turn.effort, "xhigh");
  assert.deepEqual(turn.sandboxPolicy, {
    type: "workspaceWrite",
    writableRoots: [SUMMARIZE_STATE_PATH],
    networkAccess: true,
  });
  assert.equal(turn.input[1].type, "skill");
  assert.equal(turn.input[1].name, "intelligest");
  assert.ok(turn.outputSchema.properties.clickbait);
  assert.ok(turn.outputSchema.properties.news);
  assert.ok(turn.outputSchema.properties.concepts);
  assert.ok(turn.outputSchema.properties.relatedCoverage);
  assert.match(turn.input[0].text, /source-related/);
});

test("transcript extraction failure is surfaced as a failure, not an answer", async () => {
  let listener: (message: any) => void = () => undefined;
  const interrupted: unknown[] = [];
  const failedResult: Analysis = {
    ...result,
    sourceStatus: "TRANSCRIPT_UNAVAILABLE",
    sourceNote: "Transcript extraction failed.",
    clickbait: {
      answer: "The title cannot be verified.",
      verdict: "UNVERIFIABLE",
      confidence: 0,
      evidence: [],
    },
    keyPoints: [],
  };
  const rpc: RpcClient = {
    notify() {},
    close() {},
    onNotification(next) {
      listener = next;
      return () => undefined;
    },
    async request(method, params): Promise<any> {
      if (method === "model/list") {
        return {
          data: [
            {
              model: "gpt-5.6-terra",
              supportedReasoningEfforts: [{ reasoningEffort: "xhigh" }],
            },
          ],
        };
      }
      if (method === "skills/list") {
        return {
          data: [
            {
              skills: [
                {
                  name: "intelligest",
                  path: "/skills/intelligest/SKILL.md",
                  enabled: true,
                },
              ],
            },
          ],
        };
      }
      if (method === "thread/start") return { thread: { id: "thread-failed" } };
      if (method === "turn/start") {
        queueMicrotask(() => {
          listener({
            method: "item/completed",
            params: {
              threadId: "thread-failed",
              item: { type: "agentMessage", text: JSON.stringify(failedResult) },
            },
          });
          listener({
            method: "turn/completed",
            params: {
              threadId: "thread-failed",
              turn: { status: "completed", items: [] },
            },
          });
        });
        return { turn: { id: "turn-failed" } };
      }
      if (method === "turn/interrupt") {
        interrupted.push(params);
        return {};
      }
      throw new Error(`Unexpected ${method}`);
    },
  };

  await assert.rejects(
    runCodexAnalysis(
      { videoId: "dQw4w9WgXcQ", title: "Claim?" },
      { available: false, value: "" },
      rpc,
      "/tmp/farplane-youtube-shortcut",
      undefined,
      Date.now(),
      {
        definition: "video_intelligence.analysis.v1",
        model: "gpt-5.6-terra",
        reasoningEffort: "xhigh",
      },
      comparisonPacket,
    ),
    (error: Error & { threadId?: string }) => {
      assert.match(error.message, /^Intelligest failed:/);
      assert.equal(error.threadId, "thread-failed");
      return true;
    },
  );
  assert.deepEqual(interrupted, [
    { threadId: "thread-failed", turnId: "turn-failed" },
  ]);
});

test("Codex idle timeout refreshes on progress while an absolute cap remains", async () => {
  let listener: (message: any) => void = () => undefined;
  const rpc: RpcClient = {
    notify() {},
    close() {},
    onNotification(next) {
      listener = next;
      return () => undefined;
    },
    request: async <T>() => ({} as T),
  };
  const completion = waitForTurnCompletion(rpc, "thread-timeout", {
    idleTimeoutMs: 60,
    absoluteTimeoutMs: 200,
  });
  setTimeout(() => {
    listener({
      method: "item/updated",
      params: { threadId: "thread-timeout", item: { type: "commandExecution" } },
    });
  }, 10);
  setTimeout(() => {
    listener({
      method: "turn/completed",
      params: { threadId: "thread-timeout", turn: { status: "completed", items: [] } },
    });
  }, 45);
  const completed = await completion;
  assert.equal(completed.turn.status, "completed");

  const capped = waitForTurnCompletion(rpc, "thread-cap", {
    idleTimeoutMs: 200,
    absoluteTimeoutMs: 40,
  });
  await assert.rejects(capped, /absolute timeout/);
});

test("HTTP bridge denies foreign origins and exposes only the analysis contract", async (t) => {
  const store = isolatedStore();
  const progressStages: string[] = [];
  const updateProgress = store.updateProgress;
  store.updateProgress = async (jobId, update) => {
    progressStages.push(update.stage);
    return updateProgress(jobId, update);
  };
  const receivedPackets: unknown[] = [];
  const server = createLocalAgentServer(
    async (_input, _onThreadStarted, _analysisProfile, packet) => {
      receivedPackets.push(packet);
      return {
        analysis: result,
        threadId: "thread-1",
      };
    },
    store,
  );
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const endpoint = `http://127.0.0.1:${address.port}/analyze-youtube`;
  const denied = await fetch(endpoint, {
    method: "POST",
    headers: {
      origin: "https://evil.example",
      "content-type": "application/json",
    },
    body: "{}",
  });
  assert.equal(denied.status, 403);
  const spoofed = await fetch(endpoint, {
    method: "POST",
    headers: {
      origin: "https://evil.example",
      "x-farplane-client": "youtube-shortcut",
      "content-type": "application/json",
    },
    body: JSON.stringify({ videoId: "dQw4w9WgXcQ", title: "Claim?" }),
  });
  assert.equal(spoofed.status, 403);
  const extensionWorker = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-farplane-client": "youtube-shortcut",
      origin: FARPLANE_EXTENSION_ORIGIN,
      "content-type": "application/json",
    },
    body: JSON.stringify({ videoId: "dQw4w9WgXcQ", title: "Claim?" }),
  });
  assert.equal(extensionWorker.status, 200);
  const allowed = await fetch(endpoint, {
    method: "POST",
    headers: {
      origin: FARPLANE_EXTENSION_ORIGIN,
      "content-type": "application/json",
    },
    body: JSON.stringify({ videoId: "dQw4w9WgXcQ", title: "Claim?" }),
  });
  assert.equal(allowed.status, 200);
  const response = await allowed.json();
  assert.deepEqual(response.analysis, result);
  assert.equal(response.threadId, "thread-1");
  assert.equal(
    (receivedPackets[0] as typeof comparisonPacket).candidates[0]?.sourceId,
    "source-related",
  );
  assert.deepEqual(progressStages.slice(0, 3), [
    "preparing",
    "analyzing",
    "persistence",
  ]);
  const injectedComparison = await fetch(endpoint, {
    method: "POST",
    headers: {
      origin: FARPLANE_EXTENSION_ORIGIN,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      videoId: "dQw4w9WgXcQ",
      title: "Claim?",
      comparisonPacket: { candidates: [] },
    }),
  });
  assert.equal(injectedComparison.status, 400);
  const invalidVideo = await fetch(endpoint, {
    method: "POST",
    headers: {
      origin: FARPLANE_EXTENSION_ORIGIN,
      "content-type": "application/json",
    },
    body: JSON.stringify({ videoId: "bad", title: "Claim?" }),
  });
  assert.equal(invalidVideo.status, 400);
  const missing = await fetch(`http://127.0.0.1:${address.port}/rpc`, {
    headers: { origin: FARPLANE_EXTENSION_ORIGIN },
  });
  assert.equal(missing.status, 404);
});

test("HTTP bridge preserves the persistent thread id when analysis fails", async (t) => {
  const store = isolatedStore();
  const server = createLocalAgentServer(async () => {
    throw Object.assign(new Error("Structured result rejected"), {
      threadId: "thread-failed",
    });
  }, store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const response = await fetch(
    `http://127.0.0.1:${address.port}/analyze-youtube`,
    {
      method: "POST",
      headers: {
        origin: FARPLANE_EXTENSION_ORIGIN,
        "content-type": "application/json",
      },
      body: JSON.stringify({ videoId: "dQw4w9WgXcQ", title: "Claim?", projectId: "Vidgard" }),
    },
  );
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "Structured result rejected",
    threadId: "thread-failed",
  });

  const jobsResponse = await fetch(
    `http://127.0.0.1:${address.port}/jobs`,
    {
      method: "POST",
      headers: { origin: FARPLANE_EXTENSION_ORIGIN },
    },
  );
  assert.equal(jobsResponse.status, 200);
  const jobsPayload = await jobsResponse.json();
  assert.equal(jobsPayload.jobs.length, 1);
  assert.deepEqual(
    {
      videoId: jobsPayload.jobs[0].videoId,
      title: jobsPayload.jobs[0].title,
      status: jobsPayload.jobs[0].status,
      projectId: jobsPayload.jobs[0].projectId,
      threadId: jobsPayload.jobs[0].threadId,
      error: jobsPayload.jobs[0].error,
    },
    {
      videoId: "dQw4w9WgXcQ",
      title: "Claim?",
      status: "failed",
      projectId: "Vidgard",
      threadId: "thread-failed",
      error: "Structured result rejected",
    },
  );
});

test("HTTP bridge returns ready reuse without launching or completing analysis", async (t) => {
  let analyzeCalls = 0;
  let updateCalls = 0;
  let completeCalls = 0;
  const now = "2026-08-12T00:00:00.000Z";
  const store: VideoIntelligenceStore = {
    async readProjection() {
      return { jobs: [] };
    },
    async enqueue(input) {
      return {
        id: "ready-job",
        sourceId: "source-1",
        videoId: input.videoId,
        title: input.title,
        status: "succeeded",
        disposition: "reused_ready",
        dossierId: "dossier-1",
        createdAt: now,
        updatedAt: now,
      };
    },
    async getComparisonCandidates() {
      throw new Error("ready jobs must not fetch comparisons");
    },
    async updateProgress() {
      throw new Error("ready jobs must not update progress");
    },
    async updateJob() {
      updateCalls += 1;
      throw new Error("ready jobs must not update");
    },
    async complete() {
      completeCalls += 1;
      throw new Error("ready jobs must not complete");
    },
    async fail() {
      throw new Error("ready jobs must not fail");
    },
  };
  const server = createLocalAgentServer(async () => {
    analyzeCalls += 1;
    return { analysis: result, threadId: "thread-new" };
  }, store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const response = await fetch(`http://127.0.0.1:${address.port}/analyze-youtube`, {
    method: "POST",
    headers: {
      origin: FARPLANE_EXTENSION_ORIGIN,
      "content-type": "application/json",
    },
    body: JSON.stringify({ videoId: "dQw4w9WgXcQ", title: "Claim?" }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    reused: true,
    disposition: "reused_ready",
    jobId: "ready-job",
    sourceId: "source-1",
    dossierId: "dossier-1",
  });
  assert.equal(analyzeCalls, 0);
  assert.equal(updateCalls, 0);
  assert.equal(completeCalls, 0);
});

test("HTTP bridge forwards an explicit re-analysis request as a new analysis run", async (t) => {
  const store = isolatedStore();
  const enqueue = store.enqueue;
  let requestedReanalysis = false;
  let analyzeCalls = 0;
  store.enqueue = async (input) => {
    requestedReanalysis = input.reAnalyze === true;
    return enqueue(input);
  };
  const server = createLocalAgentServer(async () => {
    analyzeCalls += 1;
    return { analysis: result, threadId: "thread-reanalysis" };
  }, store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const response = await fetch(`http://127.0.0.1:${address.port}/analyze-youtube`, {
    method: "POST",
    headers: {
      origin: FARPLANE_EXTENSION_ORIGIN,
      "content-type": "application/json",
    },
    body: JSON.stringify({ videoId: "dQw4w9WgXcQ", title: "Claim?", reAnalyze: true }),
  });
  assert.equal(response.status, 200);
  assert.equal(requestedReanalysis, true);
  assert.equal(analyzeCalls, 1);
});

test("cached bridge reuse keeps the local answer without completing a ready job", async (t) => {
  let updateCalls = 0;
  let completeCalls = 0;
  let enqueuedInput: unknown;
  const now = "2026-08-12T00:00:00.000Z";
  const store: VideoIntelligenceStore = {
    async readProjection() {
      return { jobs: [] };
    },
    async enqueue(input) {
      enqueuedInput = input;
      return {
        id: "ready-job",
        sourceId: "source-1",
        videoId: input.videoId,
        title: input.title,
        status: "succeeded",
        disposition: "reused_ready",
        dossierId: "dossier-1",
        createdAt: now,
        updatedAt: now,
      };
    },
    async getComparisonCandidates() {
      throw new Error("ready jobs must not fetch comparisons");
    },
    async updateProgress() {
      throw new Error("ready jobs must not update progress");
    },
    async updateJob() {
      updateCalls += 1;
      throw new Error("ready jobs must not update");
    },
    async complete() {
      completeCalls += 1;
      throw new Error("ready jobs must not complete");
    },
    async fail() {
      throw new Error("ready jobs must not fail");
    },
  };
  const server = createLocalAgentServer(async () => {
    throw new Error("cached reuse must not analyze");
  }, store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const response = await fetch(`http://127.0.0.1:${address.port}/ingest-cached`, {
    method: "POST",
    headers: {
      origin: FARPLANE_EXTENSION_ORIGIN,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      videoId: "dQw4w9WgXcQ",
      title: "Claim?",
      analysis: result,
      threadId: "thread-cached",
    }),
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.reused, true);
  assert.equal(payload.dossierId, "dossier-1");
  assert.deepEqual(payload.analysis, result);
  assert.deepEqual(enqueuedInput, {
    videoId: "dQw4w9WgXcQ",
    title: "Claim?",
  });
  assert.equal(updateCalls, 0);
  assert.equal(completeCalls, 0);
});
