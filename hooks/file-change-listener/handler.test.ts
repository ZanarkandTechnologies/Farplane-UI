import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  parseFileChangeBubbleCandidatesFromPayload,
  publishFileChangeBubbleCandidates,
} from "./handler";

const testSummaryRunner = async () => "Summarized tracked file update";

async function withTempRepo<T>(run: (repo: string) => Promise<T> | T): Promise<T> {
  const repo = mkdtempSync(path.join(tmpdir(), "farplane-file-hook-"));
  try {
    return await run(repo);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

function writeRepoFile(repo: string, filePath: string, contents: string): void {
  const absolutePath = path.join(repo, filePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents);
}

function applyPatchPayload(repo: string, filePath: string, addedLine: string) {
  return {
    event: "PostToolUse",
    toolName: "apply_patch",
    cwd: repo,
    sessionId: "thread-1",
    toolInput: `*** Begin Patch\n*** Update File: ${filePath}\n@@\n+${addedLine}\n*** End Patch\n`,
  };
}

const applyPatchSourceCases = [
  {
    name: "detects tracked progress file paths from the post-tool payload",
    filePath: "tickets/TASK-0001/progress.md",
    contents: "# Progress\n\n- Chose acquisition research next.\n",
    addedLine: "Chose acquisition research next.",
    now: 2_000,
    expectedRows: () => [
      expect.objectContaining({
        threadId: "thread-1",
        filePath: "tickets/TASK-0001/progress.md",
        message: "Summarized tracked file update",
        eventAt: 2_000,
      }),
    ],
  },
  {
    name: "ignores untracked paths even when a write-capable tool runs",
    filePath: "package.json",
    contents: "{}\n",
    addedLine: "{}",
    expectedRows: () => [],
  },
] as const;

describe("file-change-listener", () => {
  for (const {
    name,
    filePath,
    contents,
    addedLine,
    expectedRows,
    ...testCase
  } of applyPatchSourceCases) {
    it(name, async () => {
      await withTempRepo(async (repo) => {
        writeRepoFile(repo, filePath, contents);
        const nowSpy =
          "now" in testCase ? vi.spyOn(Date, "now").mockReturnValue(testCase.now) : undefined;
        try {
          const rows = await parseFileChangeBubbleCandidatesFromPayload(
            applyPatchPayload(repo, filePath, addedLine),
            1_000,
            { summaryDebounceMs: 0, codexSummary: { runner: testSummaryRunner } },
          );

          expect(rows).toEqual(expectedRows());
        } finally {
          nowSpy?.mockRestore();
        }
      });
    });
  }

  it("supports custom tracked path patterns", async () => {
    await withTempRepo(async (repo) => {
      writeRepoFile(repo, "package.json", '{"ok":true}\n');
      const rows = await parseFileChangeBubbleCandidatesFromPayload(
        applyPatchPayload(repo, "package.json", '{"ok":true}'),
        1_000,
        {
          trackedPathPatterns: ["package.json"],
          summaryDebounceMs: 0,
          codexSummary: { runner: testSummaryRunner },
        },
      );

      expect(rows).toEqual([
        expect.objectContaining({
          filePath: "package.json",
          message: "Summarized tracked file update",
        }),
      ]);
    });
  });

  it("debounces repeated summary spawns so only the latest tracked file event runs", async () => {
    await withTempRepo(async (repo) => {
      const debounceStateDir = path.join(repo, ".farplane", "summary-debounce-test");
      let summaryRuns = 0;
      writeRepoFile(repo, "tickets/TASK-0001/progress.md", "# Progress\n\n- First update.\n");
      const payload = applyPatchPayload(repo, "tickets/TASK-0001/progress.md", "First update.");

      const firstPromise = parseFileChangeBubbleCandidatesFromPayload(payload, 10_000, {
        summaryDebounceMs: 20,
        summaryDebounceStateDir: debounceStateDir,
        codexSummary: {
          runner: async () => {
            summaryRuns += 1;
            return "First progress";
          },
        },
      });
      const secondPromise = parseFileChangeBubbleCandidatesFromPayload(payload, 10_001, {
        summaryDebounceMs: 20,
        summaryDebounceStateDir: debounceStateDir,
        codexSummary: {
          runner: async () => {
            summaryRuns += 1;
            return "Latest progress";
          },
        },
      });
      const [first, second] = await Promise.all([firstPromise, secondPromise]);

      expect(first).toEqual([]);
      expect(second).toEqual([expect.objectContaining({ message: "Latest progress" })]);
      expect(summaryRuns).toBe(1);
    });
  });

  it("allows another summary after the debounce window settles", async () => {
    await withTempRepo(async (repo) => {
      const debounceStateDir = path.join(repo, ".farplane", "summary-debounce-test");
      let summaryRuns = 0;
      writeRepoFile(repo, "tickets/TASK-0001/progress.md", "# Progress\n\n- Later update.\n");
      const payload = applyPatchPayload(repo, "tickets/TASK-0001/progress.md", "Later update.");

      await parseFileChangeBubbleCandidatesFromPayload(payload, 10_000, {
        summaryDebounceMs: 1,
        summaryDebounceStateDir: debounceStateDir,
        codexSummary: {
          runner: async () => {
            summaryRuns += 1;
            return "Progress updated";
          },
        },
      });
      const second = await parseFileChangeBubbleCandidatesFromPayload(payload, 19_000, {
        summaryDebounceMs: 1,
        summaryDebounceStateDir: debounceStateDir,
        codexSummary: {
          runner: async () => {
            summaryRuns += 1;
            return "Progress refreshed";
          },
        },
      });

      expect(second).toEqual([expect.objectContaining({ message: "Progress refreshed" })]);
      expect(summaryRuns).toBe(2);
    });
  });

  it("detects top-level changedFiles payloads", async () => {
    await withTempRepo(async (repo) => {
      writeRepoFile(repo, "farplane/harness.yaml", "kind: project-harness\n");
      const rows = await parseFileChangeBubbleCandidatesFromPayload(
        {
          event: "PostToolUse",
          toolName: "write",
          cwd: repo,
          sessionId: "thread-1",
          changedFiles: ["farplane/harness.yaml"],
        },
        1_000,
        { summaryDebounceMs: 0, codexSummary: { runner: testSummaryRunner } },
      );

      expect(rows).toEqual([
        expect.objectContaining({
          filePath: "farplane/harness.yaml",
          message: "Summarized tracked file update",
        }),
      ]);
    });
  });

  it("detects tracked docs paths from bash command payloads", async () => {
    await withTempRepo(async (repo) => {
      writeRepoFile(repo, "docs/MEMORY.md", "# Memory\n\n- Define PM founder loop.\n");
      writeRepoFile(repo, "docs/LESSONS.md", "# Lessons\n\n- Track hook bubbles.\n");
      const rows = await parseFileChangeBubbleCandidatesFromPayload(
        {
          event: "PostToolUse",
          toolName: "bash",
          cwd: repo,
          sessionId: "thread-1",
          command:
            "printf '%s\\n' update > docs/MEMORY.md && printf '%s\\n' update | tee docs/LESSONS.md",
        },
        1_000,
        { summaryDebounceMs: 0, codexSummary: { runner: testSummaryRunner } },
      );

      expect(rows).toEqual([
        expect.objectContaining({
          filePath: "docs/MEMORY.md",
          message: "Summarized tracked file update",
        }),
        expect.objectContaining({
          filePath: "docs/LESSONS.md",
          message: "Summarized tracked file update",
        }),
      ]);
    });
  });

  it("ignores read-only bash commands that mention tracked docs paths", async () => {
    await withTempRepo(async (repo) => {
      writeRepoFile(repo, "docs/MEMORY.md", "# Memory\n\n- Existing plan.\n");
      const rows = await parseFileChangeBubbleCandidatesFromPayload(
        {
          event: "PostToolUse",
          toolName: "bash",
          cwd: repo,
          sessionId: "thread-1",
          command: "cat docs/MEMORY.md && rg Existing docs/MEMORY.md",
        },
        1_000,
        { summaryDebounceMs: 0, codexSummary: { runner: testSummaryRunner } },
      );

      expect(rows).toEqual([]);
    });
  });

  it("skips tracked file telemetry when summarization fails and fallback is disabled", async () => {
    await withTempRepo(async (repo) => {
      writeRepoFile(repo, "progress.md", "# Progress\n\n- Local summarizer unavailable.\n");
      const rows = await parseFileChangeBubbleCandidatesFromPayload(
        applyPatchPayload(repo, "progress.md", "Local summarizer unavailable."),
        1_000,
        { summaryDebounceMs: 0, codexSummary: { runner: async () => "" } },
      );

      expect(rows).toEqual([]);
    });
  });

  it("publishes file change summary telemetry without throwing on success", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const result = await publishFileChangeBubbleCandidates(
      [
        {
          threadId: "thread-1",
          sessionId: "thread-1",
          projectPath: "/repo",
          filePath: "progress.md",
          message: "Updated progress: chose acquisition research",
          eventAt: 1_000,
          eventKey: "file-change:thread-1:progress.md:hash",
        },
      ],
      {
        endpointBaseUrl: "http://127.0.0.1:3211/",
        telemetryToken: "token-1",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    );

    expect(result).toMatchObject({
      attempted: 1,
      published: 1,
      queued: 0,
      replayed: 0,
      skipped: false,
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual(
      expect.objectContaining({
        hookName: "file-change-listener",
        projectId: "codex-proj-repo",
        hookType: "PostToolUse",
        payload: expect.objectContaining({
          eventName: "file.change.summary",
          threadId: "thread-1",
          paths: ["progress.md"],
          message: "Updated progress: chose acquisition research",
        }),
      }),
    );
  });
});
