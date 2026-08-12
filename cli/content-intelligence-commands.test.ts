/** Tests Feed Scout selection and payload boundaries without calling Convex. */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  feedScoutImportInput,
  feedScoutPath,
  feedScoutSyncSucceeded,
  loadFeedScoutSyncPlan,
  syncFeedScout,
} from "./content-intelligence-commands.js";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanup.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("Content Intelligence Feed Scout sync", () => {
  it("keeps Feed Scout group provenance separate from an explicit content project", () => {
    const input = feedScoutImportInput(
      {
        canonical_url: "https://youtu.be/dQw4w9WgXcQ",
        canonical_key: "youtube-example",
        title: "A competitor video",
        platform: "youtube",
        kind: "video",
        entity_group_id: "competitor-watchlist",
        source_id: "competitor-channel",
        evidence_refs: ["feed:example"],
        tags: ["competitor"],
      },
      "/work/analyst",
      "2026-08-12",
      "project-alpha",
    );
    expect(input).toMatchObject({
      sourceKind: "video",
      feedScopeKey: "/work/analyst",
      observedDate: "2026-08-12",
      entityGroupId: "competitor-watchlist",
      contentProjectId: "project-alpha",
    });
  });

  it("loads a selected date, skips invalid rows, and writes a dry-run receipt", async () => {
    const projectPath = await mkdtemp(path.join(tmpdir(), "farplane-content-sync-"));
    cleanup.push(projectPath);
    const dailyPath = path.dirname(feedScoutPath(projectPath, "2026-08-12"));
    await mkdir(dailyPath, { recursive: true });
    await writeFile(
      feedScoutPath(projectPath, "2026-08-12"),
      JSON.stringify({
        date: "2026-08-12",
        items: [
          {
            canonical_url: "https://www.youtube.com/shorts/dQw4w9WgXcQ",
            canonical_key: "youtube-example",
            title: "A competitor video",
            platform: "youtube",
            kind: "video",
            entity_group_id: "competitor-watchlist",
            source_id: "competitor-channel",
            evidence_refs: ["feed:example"],
            tags: ["competitor"],
          },
          { title: "Missing URL" },
        ],
      }),
    );

    const plan = await loadFeedScoutSyncPlan({ projectPath, date: "2026-08-12" });
    expect(plan.candidates).toHaveLength(1);
    expect(plan.candidates[0]).toMatchObject({ sourceKind: "video", observedDate: "2026-08-12" });
    expect(plan.skipped).toEqual([{ index: 1, reason: "missing_canonical_url" }]);

    const receipt = await syncFeedScout({ projectPath, date: "2026-08-12", dryRun: true });
    expect(receipt).toMatchObject({ created: 1, reused: 0, dryRun: true, skipped: plan.skipped });
    expect(JSON.parse(await readFile(receipt.receiptPath, "utf8"))).toMatchObject({
      command: "content sync-feed-scout",
      observedDate: "2026-08-12",
      dryRun: true,
    });
  });

  it("keeps a remote writer failure in the receipt and marks the sync unsuccessful", async () => {
    const projectPath = await mkdtemp(path.join(tmpdir(), "farplane-content-sync-failure-"));
    cleanup.push(projectPath);
    const dailyPath = path.dirname(feedScoutPath(projectPath, "2026-08-12"));
    await mkdir(dailyPath, { recursive: true });
    await writeFile(
      feedScoutPath(projectPath, "2026-08-12"),
      JSON.stringify({
        date: "2026-08-12",
        items: [
          {
            canonical_url: "https://example.com/source",
            canonical_key: "source",
            title: "Source",
            entity_group_id: "watchlist",
            source_id: "feed",
          },
        ],
      }),
    );

    const receipt = await syncFeedScout({ projectPath, date: "2026-08-12" }, async () =>
      Promise.reject(new Error("writer_not_deployed")),
    );

    expect(receipt.invalid).toEqual([{ index: 0, reason: "writer_not_deployed" }]);
    expect(feedScoutSyncSucceeded(receipt)).toBe(false);
  });
});
