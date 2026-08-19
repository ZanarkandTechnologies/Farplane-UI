import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { runManifestIngest } from "./ingest-channel-manifest.js";
import { FARPLANE_EXTENSION_ORIGIN } from "./local-agent.js";

const origin = FARPLANE_EXTENSION_ORIGIN;

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function manifest() {
  return {
    schemaVersion: 1,
    channelUrl: "https://www.youtube.com/@davidfilterbuy/videos",
    requestedYear: 2026,
    generatedAt: "2026-08-04T22:00:00+08:00",
    videos: [
      { videoId: "dQw4w9WgXcQ", publishedAt: "2026-07-31", title: "First" },
      { videoId: "9bZkp7q19f0", publishedAt: "2026-07-30", title: "Second" },
    ],
    boundary: {
      videoId: "3JZ_D3ELwOQ",
      publishedAt: "2025-12-19",
      title: "Boundary",
    },
  };
}

test("manifest runner resumes, skips a reconciled Vidgard success, and retries a timeout once", async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), "farplane-manifest-runner-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const manifestPath = resolve(directory, "manifest.json");
  const reportPath = resolve(directory, "report.json");
  await writeFile(manifestPath, JSON.stringify(manifest()), "utf8");

  const originalFetch = globalThis.fetch;
  const jobs: any[] = [];
  const attempts = new Map<string, number>();
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.equal((init?.headers as Record<string, string>).origin, origin);
    if (url.endsWith("/health"))
      return response({ ok: true, service: true, appServer: true, intelligestSkill: true });
    if (url.endsWith("/jobs")) return response({ jobs });
    if (url.endsWith("/analyze-youtube")) {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.projectId, "Vidgard");
      const attempt = (attempts.get(body.videoId) ?? 0) + 1;
      attempts.set(body.videoId, attempt);
      if (body.videoId === "9bZkp7q19f0" && attempt === 1)
        return response({ ok: false, error: "Codex analysis timed out" }, 502);
      jobs.push({
        id: `job-${body.videoId}`,
        sourceId: `source-${body.videoId}`,
        videoId: body.videoId,
        title: body.title,
        projectId: body.projectId,
        status: "succeeded",
      });
      return response({ ok: true, threadId: `thread-${body.videoId}` });
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const first = await runManifestIngest({
    manifestPath,
    reportPath,
    endpoint: "http://bridge.test",
    maxSources: 1,
  });
  assert.equal(first.summary.succeeded, 1);
  assert.equal(first.summary.unresolved, 1);
  assert.equal(attempts.get("dQw4w9WgXcQ"), 1);

  const second = await runManifestIngest({
    manifestPath,
    reportPath,
    endpoint: "http://bridge.test",
  });
  assert.equal(second.summary.succeeded, 1);
  assert.equal(second.summary.skipped, 1);
  assert.equal(second.summary.unresolved, 0);
  assert.equal(attempts.get("9bZkp7q19f0"), 2);
  assert.deepEqual(
    JSON.parse(await readFile(reportPath, "utf8")).videos.map((record: any) => record.videoId),
    ["9bZkp7q19f0", "dQw4w9WgXcQ"],
  );
});

test("manifest runner preserves source-unavailable as a terminal failure", async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), "farplane-manifest-source-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const manifestPath = resolve(directory, "manifest.json");
  const reportPath = resolve(directory, "report.json");
  await writeFile(manifestPath, JSON.stringify(manifest()), "utf8");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/health"))
      return response({ ok: true, service: true, appServer: true, intelligestSkill: true });
    if (url.endsWith("/jobs")) return response({ jobs: [] });
    if (url.endsWith("/analyze-youtube"))
      return response({ ok: false, error: "Intelligest failed: no usable transcript or source material was returned" }, 502);
    throw new Error(`Unexpected fetch URL: ${url}`);
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const report = await runManifestIngest({
    manifestPath,
    reportPath,
    endpoint: "http://bridge.test",
    maxSources: 1,
  });
  assert.equal(report.summary.failed, 1);
  assert.equal(report.videos[0].classification, "source_unavailable");
  assert.equal(report.videos[0].attempts, 1);
});

test("manifest runner waits for an active canonical job instead of duplicating it", async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), "farplane-manifest-running-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const manifestPath = resolve(directory, "manifest.json");
  const reportPath = resolve(directory, "report.json");
  await writeFile(manifestPath, JSON.stringify(manifest()), "utf8");
  const originalFetch = globalThis.fetch;
  let jobsReads = 0;
  const jobs = [
    {
      id: "job-dQw4w9WgXcQ",
      sourceId: "source-dQw4w9WgXcQ",
      videoId: "dQw4w9WgXcQ",
      title: "First",
      projectId: "Vidgard",
      status: "running",
    },
  ];
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/health"))
      return response({ ok: true, service: true, appServer: true, intelligestSkill: true });
    if (url.endsWith("/jobs")) {
      jobsReads += 1;
      if (jobsReads > 1) jobs[0].status = "succeeded";
      return response({ jobs });
    }
    if (url.endsWith("/analyze-youtube"))
      throw new Error("The active canonical job must be reused");
    throw new Error(`Unexpected fetch URL: ${url}`);
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const report = await runManifestIngest({
    manifestPath,
    reportPath,
    endpoint: "http://bridge.test",
    maxSources: 0,
    concurrency: 1,
  });
  assert.equal(report.summary.skipped, 1);
  assert.equal(report.summary.unresolved, 1);
  assert.equal(jobsReads, 3);
});

test("manifest runner caps source analysis at the requested concurrency", async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), "farplane-manifest-concurrency-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const manifestPath = resolve(directory, "manifest.json");
  const reportPath = resolve(directory, "report.json");
  await writeFile(manifestPath, JSON.stringify(manifest()), "utf8");
  const originalFetch = globalThis.fetch;
  const jobs: any[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/health"))
      return response({ ok: true, service: true, appServer: true, intelligestSkill: true });
    if (url.endsWith("/jobs")) return response({ jobs });
    if (url.endsWith("/analyze-youtube")) {
      const body = JSON.parse(String(init?.body));
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
      jobs.push({
        id: `job-${body.videoId}`,
        sourceId: `source-${body.videoId}`,
        videoId: body.videoId,
        title: body.title,
        projectId: body.projectId,
        status: "succeeded",
      });
      inFlight -= 1;
      return response({ ok: true, threadId: `thread-${body.videoId}` });
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const report = await runManifestIngest({
    manifestPath,
    reportPath,
    endpoint: "http://bridge.test",
    maxSources: 2,
    concurrency: 2,
  });
  assert.equal(report.summary.succeeded, 2);
  assert.equal(report.summary.unresolved, 0);
  assert.equal(maxInFlight, 2);
});

test("manifest runner reconciles a durable job after a transport error before retrying", async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), "farplane-manifest-transport-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const manifestPath = resolve(directory, "manifest.json");
  const reportPath = resolve(directory, "report.json");
  await writeFile(manifestPath, JSON.stringify(manifest()), "utf8");
  const originalFetch = globalThis.fetch;
  const jobs: any[] = [];
  let attempts = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/health"))
      return response({ ok: true, service: true, appServer: true, intelligestSkill: true });
    if (url.endsWith("/jobs")) return response({ jobs });
    if (url.endsWith("/analyze-youtube")) {
      const body = JSON.parse(String(init?.body));
      attempts += 1;
      jobs.push({
        id: `job-${body.videoId}`,
        sourceId: `source-${body.videoId}`,
        videoId: body.videoId,
        title: body.title,
        projectId: body.projectId,
        status: "succeeded",
      });
      throw new TypeError("fetch failed");
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const report = await runManifestIngest({
    manifestPath,
    reportPath,
    endpoint: "http://bridge.test",
    maxSources: 1,
    concurrency: 1,
  });
  assert.equal(report.summary.succeeded, 1);
  assert.equal(report.videos[0].status, "succeeded");
  assert.equal(report.videos[0].attempts, 1);
  assert.equal(attempts, 1);
});
