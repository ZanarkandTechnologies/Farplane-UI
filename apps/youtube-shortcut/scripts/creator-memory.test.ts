import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  creatorMemoryPrompt,
  appendCreatorMemory,
  loadCreatorIndex,
  resolveWikiRoot,
  splitCreatorMemory,
} from "./creator-memory.js";

const page = `---
id: alex-hormozi
kind: person
name: Alex Hormozi
aliases:
- Hormozi
roles:
  - creator
---

# Alex Hormozi

## Claims

- Elimination beats automation. [A@8:30](https://youtu.be/A?t=510)

## Stories

- MySpace chased total users, Facebook chased monthly actives. [B@5:00](https://youtu.be/B?t=300)

## Videos covered

- 2026: [A](https://youtu.be/A), [B](https://youtu.be/B)
`;

async function companyWiki() {
  const root = await mkdtemp(join(tmpdir(), "creator-memory-"));
  await mkdir(join(root, ".farplane", "entities"), { recursive: true });
  await writeFile(join(root, ".farplane", "entities", "alex-hormozi.md"), page);
  await mkdir(join(root, "Analyst"));
  return root;
}

test("resolves the company Wiki from a nested analysis folder and indexes creators", async () => {
  const root = await companyWiki();
  assert.equal(resolveWikiRoot(join(root, "Analyst")), root);
  const index = await loadCreatorIndex(root);
  assert.deepEqual(index.map(({ id, aliases }) => ({ id, aliases })), [{ id: "alex-hormozi", aliases: ["Hormozi"] }]);
});

test("splits creator memory out so the stored analysis keeps its strict schema", () => {
  const memory = { creatorId: "alex-hormozi", creatorName: "Alex Hormozi", newShare: 0.25, restated: [], additions: [] };
  const { rest, creatorMemory } = splitCreatorMemory(JSON.stringify({ schemaVersion: 6, creatorMemory: memory }));
  assert.deepEqual(JSON.parse(rest), { schemaVersion: 6 });
  assert.deepEqual(creatorMemory, memory);
  assert.equal(splitCreatorMemory(JSON.stringify({ creatorMemory: { creatorId: "BAD ID" } })).creatorMemory, null);
});

test("appends only new atomic lines with timestamp links and syncs the page", async () => {
  const root = await companyWiki();
  const synced: string[] = [];
  const result = await appendCreatorMemory(
    root,
    {
      creatorId: "alex-hormozi",
      creatorName: "Alex Hormozi",
      newShare: 0.5,
      restated: ["Elimination beats automation."],
      additions: [
        { type: "claim", text: "Measure AI by whether it makes money.", timestamp: "8:28" },
        { type: "claim", text: "Elimination beats automation.", timestamp: "1:00" },
        { type: "story", text: "A team cut a step and doubled output.", timestamp: "1:02:03" },
      ],
    },
    "WttZ6b-KUP4",
    async (_root, relativePath) => void synced.push(relativePath),
  );
  const text = await readFile(result.path, "utf8");
  assert.equal(result.appended, 2);
  assert.match(text, /- Measure AI by whether it makes money\. \[WttZ6b-KUP4@8:28\]\(https:\/\/youtu\.be\/WttZ6b-KUP4\?t=508\)\n\n## Stories/);
  assert.match(text, /\[WttZ6b-KUP4@1:02:03\]\(https:\/\/youtu\.be\/WttZ6b-KUP4\?t=3723\)\n\n## Videos covered/);
  assert.equal(text.match(/Elimination beats automation/g)?.length, 1);
  assert.match(text, /\[WttZ6b-KUP4\]\(https:\/\/youtu\.be\/WttZ6b-KUP4\)\n$/);
  assert.deepEqual(synced, [join(".farplane", "entities", "alex-hormozi.md")]);
});

test("creates a creator page on first sight", async () => {
  const root = await companyWiki();
  const result = await appendCreatorMemory(
    root,
    { creatorId: null, creatorName: "Ali Abdaal", newShare: 1, restated: [], additions: [{ type: "claim", text: "Start before you feel ready.", timestamp: "0:45" }] },
    "abcdefghijk",
    async () => undefined,
  );
  const text = await readFile(result.path, "utf8");
  assert.match(result.path, /ali-abdaal\.md$/);
  assert.match(text, /kind: person\nname: Ali Abdaal\nroles:\n  - creator/);
  assert.match(text, /## Claims\n- Start before you feel ready\./);
  assert.match(text, /- \[abcdefghijk\]\(https:\/\/youtu\.be\/abcdefghijk\)\n$/);
});

test("asks for each stored key point to carry its novelty tag, which the panels read back", () => {
  const prompt = creatorMemoryPrompt([]);
  assert.match(prompt, /start each keyPoints\[\]\.finding with its class in brackets/);
  assert.match(prompt, /"\[NEW\] /);
  assert.match(prompt, /leave findings untagged when no page matches/);
});
