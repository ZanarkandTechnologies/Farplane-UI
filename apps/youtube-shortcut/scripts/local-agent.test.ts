import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  ANALYST_PROJECT_PATH,
  buildPrompt,
  canonicalVideoUrl,
  createLocalAgentServer,
  FARPLANE_EXTENSION_ORIGIN,
  runCodexAnalysis,
  SUMMARIZE_STATE_PATH,
  type Analysis,
  type RpcClient,
} from "./local-agent.js";
import { createVideoIntelligenceStore } from "./video-intelligence-store.js";

const result: Analysis = {
  schemaVersion: 3,
  sourceStatus: "TRANSCRIPT_USED",
  sourceNote: "Transcript inspected.",
  summary: "The title's claim is directionally correct but constrained.",
  publisher: "Example Channel",
  publishedAt: "2026-07-20",
  stories: [
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
            extractorVersion: "summarize-v3",
          },
        },
      ],
    },
  ],
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

async function isolatedStore(t: { after: (callback: () => unknown) => void }) {
  const directory = await mkdtemp(resolve(tmpdir(), "farplane-video-intelligence-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return createVideoIntelligenceStore(resolve(directory, "state.json"));
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

test("prompt invokes the full skill and stays honest without a profile", () => {
  const prompt = buildPrompt(
    { videoId: "dQw4w9WgXcQ", title: "You will not believe this" },
    { available: false, value: "" },
  );
  assert.match(prompt, /^\$summarize/);
  assert.match(prompt, /complete installed summarize skill/);
  assert.match(prompt, /substantive video description/);
  assert.match(prompt, /use SUMMARY_ONLY/);
  assert.match(prompt, /https:\/\/www\.youtube\.com\/watch\?v=dQw4w9WgXcQ/);
  assert.match(prompt, /PROFILE_UNAVAILABLE/);
  assert.match(prompt, /untrusted data/);
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
      if (method === "skills/list")
        return {
          data: [
            {
              skills: [
                {
                  name: "summarize",
                  path: "/skills/summarize/SKILL.md",
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
  const turn = calls.find((call) => call.method === "turn/start")!.params;
  assert.deepEqual(turn.sandboxPolicy, {
    type: "workspaceWrite",
    writableRoots: [SUMMARIZE_STATE_PATH],
    networkAccess: true,
  });
  assert.equal(turn.input[1].type, "skill");
  assert.equal(turn.input[1].name, "summarize");
  assert.ok(turn.outputSchema.properties.clickbait);
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
      if (method === "skills/list") {
        return {
          data: [
            {
              skills: [
                {
                  name: "summarize",
                  path: "/skills/summarize/SKILL.md",
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
    ),
    (error: Error & { threadId?: string }) => {
      assert.match(error.message, /^Summarize failed:/);
      assert.equal(error.threadId, "thread-failed");
      return true;
    },
  );
  assert.deepEqual(interrupted, [
    { threadId: "thread-failed", turnId: "turn-failed" },
  ]);
});

test("HTTP bridge denies foreign origins and exposes only the analysis contract", async (t) => {
  const store = await isolatedStore(t);
  const server = createLocalAgentServer(async () => ({
    analysis: result,
    threadId: "thread-1",
  }), store);
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
  const store = await isolatedStore(t);
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
      body: JSON.stringify({ videoId: "dQw4w9WgXcQ", title: "Claim?" }),
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
      threadId: jobsPayload.jobs[0].threadId,
      error: jobsPayload.jobs[0].error,
    },
    {
      videoId: "dQw4w9WgXcQ",
      title: "Claim?",
      status: "failed",
      threadId: "thread-failed",
      error: "Structured result rejected",
    },
  );
});
