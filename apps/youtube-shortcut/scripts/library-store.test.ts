import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { getFunctionName } from "convex/server";
import {
  clipCanonicalUrl,
  type ClipDeps,
  librarySaveSchema,
  saveClip,
  saveReferenceArgs,
  wikiMentionOptions,
} from "./library-store.js";
import { withSourceContract } from "./convex-contract.js";

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const SAVED = { sourceId: "source-1", jobId: "job-1", assetId: "asset-1" };

/** A fake Convex client and upload endpoint that record the call sequence. */
function fakeDeps(options: { previewAssetId?: string } = {}) {
  const calls: { step: string; args?: unknown }[] = [];
  const prompts: string[] = [];
  const deps: ClipDeps = {
    convex: withSourceContract({
      mutation: (async (reference: unknown, args: unknown) => {
        const name = getFunctionName(reference as never);
        calls.push({ step: name, args });
        if (name === "modules/resourceBank/assets:generateResourceAssetUploadUrl") return "https://upload.example.test/u1";
        if (name === "modules/content/saves:saveReference") {
          const withPreview = (args as { previewStorageId?: string }).previewStorageId;
          return { ...SAVED, ...(withPreview ? { previewAssetId: options.previewAssetId ?? "preview-1" } : {}) };
        }
        throw new Error(`unexpected ${name}`);
      }) as ClipDeps["convex"]["mutation"],
    }),
    fetch: (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ step: `upload ${String(url)}`, args: { type: new Headers(init?.headers).get("content-type"), bytes: (init?.body as Buffer).length } });
      return new Response(JSON.stringify({ storageId: "storage-1" }), { status: 200 });
    }) as typeof fetch,
    startThread: async (prompt) => {
      calls.push({ step: "thread" });
      prompts.push(prompt);
      return "thread-1";
    },
  };
  return { deps, calls, prompts };
}

test("maps the clipper fields onto saveReference", () => {
  const args = saveReferenceArgs(
    librarySaveSchema.parse({
      url: "https://www.example.com/post/1#comments",
      title: "A post",
      why: "Tight structure",
      usefulFor: ["hank-globex#leads", "hank-globex#leads", "globex"],
      instruction: "pull the hook pattern",
    }),
  );
  assert.deepEqual(args, {
    sourceKind: "url",
    assetKind: "url",
    sourceRef: "https://www.example.com/post/1#comments",
    sourceUrl: "https://www.example.com/post/1#comments",
    canonicalUrl: "https://www.example.com/post/1",
    title: "A post",
    note: "Why it's good: Tight structure | Useful later for: @hank-globex#leads, @globex",
    originalInstruction: "pull the hook pattern",
    tags: ["for:hank-globex#leads", "for:globex"],
    platform: "example.com",
    sourcePrivacy: "public",
    searchableText: "A post\nhttps://www.example.com/post/1\nTight structure\nhank-globex#leads globex\npull the hook pattern",
  });
});

test("videos, local hosts and bare saves map to their kinds and privacy", () => {
  const video = saveReferenceArgs(librarySaveSchema.parse({ url: "https://youtu.be/dQw4w9WgXcQ" }));
  assert.equal(video.sourceKind, "video");
  assert.equal(video.assetKind, "video");
  assert.equal(video.platform, "youtube");
  assert.equal(video.canonicalUrl, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(video.title, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  const local = saveReferenceArgs(librarySaveSchema.parse({ url: "http://localhost:3000/draft" }));
  assert.equal(local.sourcePrivacy, "unknown");
  assert.equal(local.note, undefined);
  assert.equal(local.originalInstruction, undefined);
  assert.deepEqual(local.tags, []);
});

test("re-saving a link sends the same canonical URL, so Convex adds a clip to one source", () => {
  assert.equal(clipCanonicalUrl("https://x.com/a/status/1#top"), clipCanonicalUrl("https://x.com/a/status/1"));
  assert.equal(
    clipCanonicalUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
    clipCanonicalUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=30"),
  );
});

test("a note-only save calls saveReference once and starts no thread", async () => {
  const { deps, calls } = fakeDeps();
  const clip = await saveClip(librarySaveSchema.parse({ url: "https://example.com/a", why: "Good" }), deps);
  assert.deepEqual(calls.map((call) => call.step), ["modules/content/saves:saveReference"]);
  assert.equal((calls[0].args as { previewStorageId?: string }).previewStorageId, undefined);
  assert.deepEqual(clip, { ...SAVED, canonicalUrl: "https://example.com/a", threadId: null });
});

test("a snapshot is uploaded first and attached as the saved reference's preview", async () => {
  const { deps, calls } = fakeDeps();
  const clip = await saveClip(librarySaveSchema.parse({ url: "https://example.com/a", snapshot: PNG }), deps);
  assert.deepEqual(calls.map((call) => call.step), [
    "modules/resourceBank/assets:generateResourceAssetUploadUrl",
    "upload https://upload.example.test/u1",
    "modules/content/saves:saveReference",
  ]);
  assert.deepEqual(calls[1].args, { type: "image/png", bytes: 8 });
  assert.equal((calls[2].args as { previewStorageId?: string }).previewStorageId, "storage-1");
  assert.equal(clip.previewAssetId, "preview-1");
});

test("an instruction starts an intelligest thread that names the saved asset and carries the fields", async () => {
  const { deps, calls, prompts } = fakeDeps();
  const clip = await saveClip(
    librarySaveSchema.parse({
      url: "https://example.com/a#x",
      title: "A post",
      snapshot: PNG,
      why: "Tight structure",
      usefulFor: ["hank-globex#leads"],
      instruction: "pull the hook pattern",
    }),
    deps,
  );
  assert.deepEqual(calls.map((call) => call.step).slice(-2), ["modules/content/saves:saveReference", "thread"]);
  assert.equal(clip.threadId, "thread-1");
  const [prompt] = prompts;
  assert.match(prompt, /^\$intelligest\n/);
  assert.match(prompt, /Do not create another save/);
  const parameters = JSON.parse(prompt.slice(prompt.indexOf("```json\n") + 8, prompt.lastIndexOf("\n```")));
  assert.deepEqual(parameters, {
    source: "https://example.com/a",
    title: "A post",
    instruction: "pull the hook pattern",
    note: "Tight structure",
    usefulFor: ["hank-globex#leads"],
    resourceBank: { assetId: "asset-1", contentJobId: "job-1", contentSourceId: "source-1", previewAssetId: "preview-1" },
  });
});

test("a failed snapshot upload saves nothing", async () => {
  const { deps, calls } = fakeDeps();
  deps.fetch = (async () => new Response("no", { status: 500 })) as typeof fetch;
  await assert.rejects(saveClip(librarySaveSchema.parse({ url: "https://example.com/a", snapshot: PNG }), deps), /HTTP 500/);
  assert.deepEqual(calls.map((call) => call.step), ["modules/resourceBank/assets:generateResourceAssetUploadUrl"]);
});

test("rejects non-web URLs, non-PNG snapshots and malformed refs", () => {
  assert.throws(() => librarySaveSchema.parse({ url: "file:///etc/passwd" }));
  assert.throws(() => librarySaveSchema.parse({ url: "https://a.test", snapshot: "data:text/html;base64,PGh0bWw+" }));
  assert.throws(() => librarySaveSchema.parse({ url: "https://a.test", usefulFor: ["../x"] }));
});

test("offers people, companies and their open problems for @ mentions", async () => {
  const root = await mkdtemp(join(tmpdir(), "library-"));
  await mkdir(join(root, ".farplane/entities"), { recursive: true });
  await writeFile(
    join(root, ".farplane/entities/index.json"),
    JSON.stringify({
      entities: [
        { id: "hank-globex", name: "Hank Globex", kind: "person", problems: [{ id: "leads", text: "Needs leads", status: "open" }, { id: "done", text: "Old", status: "solved" }] },
      ],
    }),
  );
  assert.deepEqual(await wikiMentionOptions(root), [
    { ref: "hank-globex", label: "Hank Globex", kind: "person" },
    { ref: "hank-globex#leads", label: "Hank Globex · Needs leads", kind: "problem" },
  ]);
});
