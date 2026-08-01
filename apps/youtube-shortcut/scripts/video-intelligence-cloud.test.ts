import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { resolveConvexUrl } from "./video-intelligence-cloud.js";

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
