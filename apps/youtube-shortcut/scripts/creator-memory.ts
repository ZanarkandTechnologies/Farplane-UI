/**
 * Creator memory for pre-watch novelty: the company Wiki keeps one person page per creator
 * (`kind: person`, `roles: [creator]`). The analysis turn reads it and returns judgments; the bridge owns every Wiki write.
 */
import { execFile } from "node:child_process";
import { readdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { TAG } from "../key-point-novelty.js";

const run = promisify(execFile);
const TIMESTAMP = /^(\d{1,2}:)?\d{1,2}:\d{2}$/;

export const creatorMemorySchema = z
  .object({
    creatorId: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/).max(120).nullable(),
    creatorName: z.string().trim().min(1).max(160),
    newShare: z.number().min(0).max(1),
    restated: z.array(z.string().trim().min(1).max(400)).max(20),
    additions: z
      .array(
        z
          .object({
            type: z.enum(["claim", "story"]),
            text: z.string().trim().min(1).max(400),
            timestamp: z.string().regex(TIMESTAMP),
          })
          .strict(),
      )
      .max(40),
  })
  .strict();

export type CreatorMemory = z.infer<typeof creatorMemorySchema>;
export type CreatorPage = { id: string; name: string; aliases: string[]; path: string };

/**
 * Nearest ancestor whose `.farplane/entities/` already holds pages (same rule as `farplane wiki`), tried
 * from each start in turn: a project outside the company folder falls back to the company's Wiki.
 */
export function resolveWikiRoot(...starts: string[]): string | null {
  for (const start of starts) {
    for (let dir = start; ; dir = dirname(dir)) {
      try {
        if (readdirSync(join(dir, ".farplane", "entities")).some((name) => name.endsWith(".md"))) return dir;
      } catch {
        // No Wiki at this level.
      }
      if (dirname(dir) === dir) break;
    }
  }
  return null;
}

function frontmatter(text: string): Record<string, string | string[]> {
  const block = text.startsWith("---\n") ? text.slice(4, text.indexOf("\n---", 4)) : "";
  const fields: Record<string, string | string[]> = {};
  let listKey: string | null = null;
  for (const line of block.split("\n")) {
    const item = line.match(/^\s*-\s+(.+)$/);
    if (item && listKey) {
      (fields[listKey] as string[]).push(item[1].trim());
      continue;
    }
    const pair = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!pair) continue;
    listKey = pair[2] === "" ? pair[1] : null;
    fields[pair[1]] = pair[2] === "" ? [] : pair[2].trim();
  }
  return fields;
}

export async function loadCreatorIndex(wikiRoot: string): Promise<CreatorPage[]> {
  const dir = join(wikiRoot, ".farplane", "entities");
  const pages: CreatorPage[] = [];
  for (const name of readdirSync(dir).filter((file) => file.endsWith(".md"))) {
    const fields = frontmatter(await readFile(join(dir, name), "utf8"));
    const roles = Array.isArray(fields.roles) ? fields.roles : [];
    if (fields.kind !== "person" || !roles.includes("creator")) continue;
    pages.push({
      id: String(fields.id),
      name: String(fields.name),
      aliases: Array.isArray(fields.aliases) ? fields.aliases : [],
      path: join(dir, name),
    });
  }
  return pages;
}

export function creatorMemoryPrompt(pages: CreatorPage[]): string {
  return `Pre-watch novelty: the company Wiki keeps one creator page per creator.\n<creator_memory_index>\n${JSON.stringify(pages, null, 2)}\n</creator_memory_index>\nIf this video's creator matches a page, read it and classify every substantive point as NEW, RESTATED, or EXTENDS per the skill's pre-watch-novelty reference, and start each keyPoints[].finding with its class in brackets, e.g. "[NEW] Price the outcome, not the hours", so the stored analysis keeps the verdict per point (when no page matches, nothing is on file for this creator yet, so every point is [NEW]). Return creatorMemory with creatorId (the matching id, or null when no page exists), creatorName, newShare (fraction NEW or EXTENDS), restated (exact restated memory lines), and additions (every NEW or EXTENDS claim or story as one atomic line with its m:ss timestamp). When fewer than a third of points are NEW or EXTENDS, recommend SKIP with reasonCode ALREADY_KNOWN and list up to three restated lines in matchedProfile. Do not edit Wiki files; the bridge appends additions. Return creatorMemory as null only when the source has no identifiable creator.`;
}

/**
 * A creator's first video against an empty note: when the analysis names a creator with no page in the
 * index, every point is new, so untagged findings get `[NEW]` whatever the turn returned. A creator
 * with a page keeps the turn's judgment, and no identifiable creator leaves the points untagged.
 */
export function tagFirstSight<T extends { finding: string }>(
  keyPoints: T[],
  memory: CreatorMemory | null,
  pages: CreatorPage[],
): T[] {
  if (!memory || pages.some((page) => page.id === memory.creatorId)) return keyPoints;
  return keyPoints.map((point) => (TAG.test(point.finding) ? point : { ...point, finding: `[NEW] ${point.finding}` }));
}

/** Remove the creator judgment from the turn output so the stored analysis keeps its schema. */
export function splitCreatorMemory(text: string): { rest: string; creatorMemory: CreatorMemory | null } {
  const value = JSON.parse(text) as Record<string, unknown>;
  const { creatorMemory, ...rest } = value;
  const parsed = creatorMemorySchema.nullable().safeParse(creatorMemory ?? null);
  return { rest: JSON.stringify(rest), creatorMemory: parsed.success ? parsed.data : null };
}

function seconds(timestamp: string): number {
  return timestamp.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}

function slug(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function insertBeforeHeading(text: string, heading: string, lines: string[]): string {
  if (!lines.length) return text;
  const index = text.indexOf(`\n${heading}`);
  const at = index === -1 ? text.length : index;
  return `${text.slice(0, at).replace(/\n+$/, "")}\n${lines.join("\n")}\n${text.slice(at)}`;
}

export async function appendCreatorMemory(
  wikiRoot: string,
  memory: CreatorMemory,
  videoId: string,
  sync: (root: string, relativePath: string) => Promise<void> = syncWikiPage,
): Promise<{ path: string; appended: number }> {
  const id = memory.creatorId ?? slug(memory.creatorName);
  const relativePath = join(".farplane", "entities", `${id}.md`);
  const path = join(wikiRoot, relativePath);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    text = `---\nid: ${id}\nkind: person\nname: ${memory.creatorName}\nroles:\n  - creator\n---\n\n# ${memory.creatorName}\n\n## Claims\n\n## Stories\n\n## Videos covered\n\n- none yet\n`;
  }
  const video = `https://youtu.be/${videoId}`;
  const fresh = memory.additions.filter((item) => !text.includes(item.text));
  const line = (item: CreatorMemory["additions"][number]) =>
    `- ${item.text} [${videoId}@${item.timestamp}](${video}?t=${seconds(item.timestamp)})`;
  text = insertBeforeHeading(text, "## Stories", fresh.filter((item) => item.type === "claim").map(line));
  text = insertBeforeHeading(text, "## Videos covered", fresh.filter((item) => item.type === "story").map(line));
  if (!text.includes(`[${videoId}](${video})`)) {
    text = `${text.replace(/\n+$/, "")}, [${videoId}](${video})\n`.replace("- none yet, ", "- ");
  }
  await writeFile(path, text, "utf8");
  await sync(wikiRoot, relativePath);
  return { path, appended: fresh.length };
}

async function syncWikiPage(root: string, relativePath: string): Promise<void> {
  await run("farplane", ["wiki", "sync", "--project-root", root, "--path", relativePath], { timeout: 60_000 });
}
