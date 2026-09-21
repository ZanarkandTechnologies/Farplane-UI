import assert from "node:assert/strict";
import test from "node:test";
import {
  PROJECT_OPTIONS_CACHE_KEY,
  createProjectOptionsCache,
  parseProjectOptionsCache,
  readProjectOptionsCache,
  writeProjectOptionsCache,
  type ProjectOptionsStorage,
} from "./project-options-cache.js";

function createStorage(): ProjectOptionsStorage {
  const values: Record<string, unknown> = {};
  return {
    async get(key) {
      const keys = typeof key === "string" ? [key] : key;
      return Object.fromEntries(keys.map((requestedKey) => [requestedKey, values[requestedKey]]));
    },
    async set(next) {
      Object.assign(values, next);
    },
  } as ProjectOptionsStorage;
}

test("project option cache persists validated options in name order", async () => {
  const storage = createStorage();
  const cache = await writeProjectOptionsCache(
    [
      { id: "proj-zeta", name: "Zeta" },
      { id: "proj-alpha", name: " Alpha " },
    ],
    storage,
    1_234,
  );

  assert.deepEqual(cache, {
    projects: [
      { id: "proj-alpha", name: "Alpha" },
      { id: "proj-zeta", name: "Zeta" },
    ],
    syncedAtMs: 1_234,
  });
  assert.deepEqual(await readProjectOptionsCache(storage), cache);
});

test("project option cache preserves an explicit empty project list", () => {
  assert.deepEqual(createProjectOptionsCache([], 1_234), {
    projects: [],
    syncedAtMs: 1_234,
  });
});

test("project option cache rejects malformed, duplicate, and missing values", () => {
  assert.equal(parseProjectOptionsCache(undefined), null);
  assert.equal(
    parseProjectOptionsCache({
      projects: [{ id: "proj-a", name: "A" }, { id: "proj-a", name: "Duplicate" }],
      syncedAtMs: 1_234,
    }),
    null,
  );
  assert.throws(() =>
    createProjectOptionsCache([{ id: "proj-a", name: "" }], 1_234),
  );
  assert.equal(PROJECT_OPTIONS_CACHE_KEY, "farplane-youtube-project-options-v1");
});
