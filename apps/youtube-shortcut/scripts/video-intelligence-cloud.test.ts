import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { getFunctionName } from "convex/server";
import {
  createVideoIntelligenceCloudStore,
  resolveConvexUrl,
} from "./video-intelligence-cloud.js";

test("cloud adapter lets the backend create a failed-job retry without a reAnalyze shim", async () => {
  const mutationArgs: unknown[] = [];
  const client = {
    async mutation(_function: unknown, args: unknown) {
      mutationArgs.push(args);
      return {
        jobId: "job-retry",
        sourceId: "source-1",
        videoId: "dQw4w9WgXcQ",
        title: "Claim?",
        disposition: "created",
        jobStatus: "queued",
        createdAtMs: 1,
        updatedAtMs: 1,
      };
    },
  };
  const store = createVideoIntelligenceCloudStore(
    Promise.resolve(client as never),
  );

  const job = await store.enqueue({
    videoId: "dQw4w9WgXcQ",
    title: "Claim?",
  });

  assert.equal(job.id, "job-retry");
  assert.deepEqual(mutationArgs, [{ videoId: "dQw4w9WgXcQ", title: "Claim?" }]);
});

test("cloud adapter preserves backend active and ready dedupe dispositions", async () => {
  for (const disposition of ["reused_active", "reused_ready"] as const) {
    let mutations = 0;
    const client = {
      async mutation() {
        mutations += 1;
        return {
          jobId: `job-${disposition}`,
          sourceId: "source-1",
          videoId: "dQw4w9WgXcQ",
          title: "Claim?",
          disposition,
          jobStatus: disposition === "reused_ready" ? "ready" : "analyzing",
          createdAtMs: 1,
          updatedAtMs: 1,
        };
      },
    };
    const store = createVideoIntelligenceCloudStore(
      Promise.resolve(client as never),
    );
    assert.equal(
      (await store.enqueue({ videoId: "dQw4w9WgXcQ", title: "Claim?" }))
        .disposition,
      disposition,
    );
    assert.equal(mutations, 1);
  }
});

test("cloud adapter sends the configured executionProfile unchanged", async () => {
  const mutationArgs: unknown[] = [];
  const client = {
    async mutation(_function: unknown, args: unknown) {
      mutationArgs.push(args);
      if (mutationArgs.length === 1) {
        return {
          jobId: "job-profile",
          sourceId: "source-1",
          videoId: "dQw4w9WgXcQ",
          title: "Claim?",
          disposition: "created",
          jobStatus: "queued",
          createdAtMs: 1,
          updatedAtMs: 1,
        };
      }
      return { ok: true };
    },
  };
  const store = createVideoIntelligenceCloudStore(
    Promise.resolve(client as never),
  );
  await store.enqueue({ videoId: "dQw4w9WgXcQ", title: "Claim?" });
  const executionProfile = {
    definition: "video_intelligence.analysis.v1" as const,
    model: "gpt-5.6-terra",
    reasoningEffort: "xhigh" as const,
  };
  await store.updateJob("job-profile", {
    status: "running",
    executionProfile,
  });
  assert.deepEqual(mutationArgs[1], {
    jobId: "job-profile",
    executionProfile,
  });
});

test("cloud adapter fetches the server packet and writes flat progress checkpoints", async () => {
  const mutationArgs: unknown[] = [];
  const queryArgs: unknown[] = [];
  const queryFunctions: unknown[] = [];
  const packet = {
    asOfDay: "2026-08-12",
    windowStartDay: "2026-07-29",
    candidates: [],
  };
  const client = {
    async mutation(_function: unknown, args: unknown) {
      mutationArgs.push(args);
      if (mutationArgs.length === 1) {
        return {
          jobId: "job-progress",
          sourceId: "source-1",
          videoId: "dQw4w9WgXcQ",
          title: "Claim?",
          disposition: "created",
          jobStatus: "queued",
          createdAtMs: 1,
          updatedAtMs: 1,
        };
      }
      return { ok: true };
    },
    async query(functionReference: unknown, args: unknown) {
      queryFunctions.push(functionReference);
      queryArgs.push(args);
      return packet;
    },
  };
  const store = createVideoIntelligenceCloudStore(
    Promise.resolve(client as never),
  );
  await store.enqueue({ videoId: "dQw4w9WgXcQ", title: "Claim?" });
  await store.updateProgress("job-progress", {
    stage: "preparing",
    message: "Preparing source and recent comparison context.",
  });

  assert.deepEqual(await store.getComparisonCandidates("job-progress"), packet);
  assert.equal(
    getFunctionName(queryFunctions[0] as never),
    "modules/videoIntelligence/comparisons:getComparisonCandidates",
  );
  assert.deepEqual(mutationArgs[1], {
    jobId: "job-progress",
    stage: "preparing",
    message: "Preparing source and recent comparison context.",
  });
  assert.deepEqual(queryArgs, [{ jobId: "job-progress", limit: 8 }]);
});

test("cloud adapter prefers an explicit Convex URL", async () => {
  assert.equal(
    await resolveConvexUrl({ CONVEX_URL: "https://example.convex.cloud" }),
    "https://example.convex.cloud",
  );
});

test("cloud adapter reads the public Convex URL from repo env syntax", async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), "farplane-convex-env-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const envPath = resolve(directory, ".env.local");
  await writeFile(
    envPath,
    'CONVEX_DEPLOYMENT=dev:example\nVITE_CONVEX_URL="https://example.convex.cloud/"\n',
  );
  assert.equal(
    await resolveConvexUrl({}, envPath),
    "https://example.convex.cloud",
  );
});

test("cloud adapter rejects an insecure remote Convex URL", async () => {
  await assert.rejects(
    resolveConvexUrl({ CONVEX_URL: "http://example.com" }),
    /must use HTTPS/,
  );
});
