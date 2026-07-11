import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  parseFileChangeBubbleCandidatesFromPayload,
  publishFileChangeBubbleCandidates,
} from "./handler";

const testSummaryRunner = async () => "Summarized tracked file update";

describe("file-change-listener", () => {
  it("detects tracked progress file paths from the post-tool payload", async () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-file-hook-"));
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(2_000);
    try {
      writeFileSync(
        path.join(repo, "progress.md"),
        "# Progress\n\n- Chose acquisition research next.\n",
      );

      const rows = await parseFileChangeBubbleCandidatesFromPayload(
        {
          event: "PostToolUse",
          toolName: "apply_patch",
          cwd: repo,
          sessionId: "thread-1",
          toolInput:
            "*** Begin Patch\n*** Update File: progress.md\n@@\n+Chose acquisition research next.\n*** End Patch\n",
        },
        1_000,
        { summaryDebounceMs: 0, codexSummary: { runner: testSummaryRunner } },
      );

      expect(rows).toEqual([
        expect.objectContaining({
          threadId: "thread-1",
          filePath: "progress.md",
          message: "Summarized tracked file update",
          eventAt: 2_000,
        }),
      ]);
    } finally {
      nowSpy.mockRestore();
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("ignores untracked paths even when a write-capable tool runs", async () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-file-hook-"));
    try {
      writeFileSync(path.join(repo, "package.json"), "{}\n");
      const rows = await parseFileChangeBubbleCandidatesFromPayload(
        {
          event: "PostToolUse",
          toolName: "apply_patch",
          cwd: repo,
          sessionId: "thread-1",
          toolInput: "*** Begin Patch\n*** Update File: package.json\n@@\n+{}\n*** End Patch\n",
        },
        1_000,
        { summaryDebounceMs: 0, codexSummary: { runner: testSummaryRunner } },
      );

      expect(rows).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("supports custom tracked path patterns", async () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-file-hook-"));
    try {
      writeFileSync(path.join(repo, "package.json"), '{"ok":true}\n');
      const rows = await parseFileChangeBubbleCandidatesFromPayload(
        {
          event: "PostToolUse",
          toolName: "apply_patch",
          cwd: repo,
          sessionId: "thread-1",
          toolInput:
            '*** Begin Patch\n*** Update File: package.json\n@@\n+{"ok":true}\n*** End Patch\n',
        },
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
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("debounces repeated summary spawns so only the latest tracked file event runs", async () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-file-hook-"));
    const debounceStateDir = path.join(repo, ".farplane", "summary-debounce-test");
    let summaryRuns = 0;
    try {
      writeFileSync(path.join(repo, "progress.md"), "# Progress\n\n- First update.\n");
      const payload = {
        event: "PostToolUse",
        toolName: "apply_patch",
        cwd: repo,
        sessionId: "thread-1",
        toolInput:
          "*** Begin Patch\n*** Update File: progress.md\n@@\n+First update.\n*** End Patch\n",
      };

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
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("allows another summary after the debounce window settles", async () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-file-hook-"));
    const debounceStateDir = path.join(repo, ".farplane", "summary-debounce-test");
    let summaryRuns = 0;
    try {
      writeFileSync(path.join(repo, "progress.md"), "# Progress\n\n- Later update.\n");
      const payload = {
        event: "PostToolUse",
        toolName: "apply_patch",
        cwd: repo,
        sessionId: "thread-1",
        toolInput:
          "*** Begin Patch\n*** Update File: progress.md\n@@\n+Later update.\n*** End Patch\n",
      };

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
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("detects top-level changedFiles payloads", async () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-file-hook-"));
    try {
      writeFileSync(path.join(repo, "goals.md"), "# Goals\n\n- Harden telemetry hooks.\n");
      const rows = await parseFileChangeBubbleCandidatesFromPayload(
        {
          event: "PostToolUse",
          toolName: "write",
          cwd: repo,
          sessionId: "thread-1",
          changedFiles: ["goals.md"],
        },
        1_000,
        { summaryDebounceMs: 0, codexSummary: { runner: testSummaryRunner } },
      );

      expect(rows).toEqual([
        expect.objectContaining({
          filePath: "goals.md",
          message: "Summarized tracked file update",
        }),
      ]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("detects tracked docs paths from bash command payloads", async () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-file-hook-"));
    try {
      const docsDir = path.join(repo, "docs", "specs");
      mkdirSync(docsDir, { recursive: true });
      writeFileSync(path.join(repo, "docs", "prd.md"), "# PRD\n\n- Define PM founder loop.\n");
      writeFileSync(path.join(docsDir, "telemetry.md"), "# Telemetry\n\n- Track hook bubbles.\n");
      const rows = await parseFileChangeBubbleCandidatesFromPayload(
        {
          event: "PostToolUse",
          toolName: "bash",
          cwd: repo,
          sessionId: "thread-1",
          command:
            "printf '%s\\n' update > docs/prd.md && printf '%s\\n' update | tee docs/specs/telemetry.md",
        },
        1_000,
        { summaryDebounceMs: 0, codexSummary: { runner: testSummaryRunner } },
      );

      expect(rows).toEqual([
        expect.objectContaining({
          filePath: "docs/prd.md",
          message: "Summarized tracked file update",
        }),
        expect.objectContaining({
          filePath: "docs/specs/telemetry.md",
          message: "Summarized tracked file update",
        }),
      ]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("ignores read-only bash commands that mention tracked docs paths", async () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-file-hook-"));
    try {
      mkdirSync(path.join(repo, "docs"), { recursive: true });
      writeFileSync(path.join(repo, "docs", "prd.md"), "# PRD\n\n- Existing plan.\n");
      const rows = await parseFileChangeBubbleCandidatesFromPayload(
        {
          event: "PostToolUse",
          toolName: "bash",
          cwd: repo,
          sessionId: "thread-1",
          command: "cat docs/prd.md && rg Existing docs/prd.md",
        },
        1_000,
        { summaryDebounceMs: 0, codexSummary: { runner: testSummaryRunner } },
      );

      expect(rows).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("skips tracked file telemetry when summarization fails and fallback is disabled", async () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-file-hook-"));
    try {
      writeFileSync(
        path.join(repo, "progress.md"),
        "# Progress\n\n- Local summarizer unavailable.\n",
      );
      const rows = await parseFileChangeBubbleCandidatesFromPayload(
        {
          event: "PostToolUse",
          toolName: "apply_patch",
          cwd: repo,
          sessionId: "thread-1",
          toolInput:
            "*** Begin Patch\n*** Update File: progress.md\n@@\n+Local summarizer unavailable.\n*** End Patch\n",
        },
        1_000,
        { summaryDebounceMs: 0, codexSummary: { runner: async () => "" } },
      );

      expect(rows).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
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
