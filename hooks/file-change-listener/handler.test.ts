import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  parseFileChangeBubbleCandidatesFromPayload,
  publishFileChangeBubbleCandidates,
} from "./handler";

describe("file-change-listener", () => {
  it("detects tracked progress file paths from the post-tool payload", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-file-hook-"));
    try {
      writeFileSync(
        path.join(repo, "progress.md"),
        "# Progress\n\n- Chose acquisition research next.\n",
      );

      const rows = parseFileChangeBubbleCandidatesFromPayload(
        {
          event: "PostToolUse",
          toolName: "apply_patch",
          cwd: repo,
          sessionId: "thread-1",
          toolInput: "*** Begin Patch\n*** Update File: progress.md\n@@\n+Chose acquisition research next.\n*** End Patch\n",
        },
        1_000,
      );

      expect(rows).toEqual([
        expect.objectContaining({
          threadId: "thread-1",
          filePath: "progress.md",
          message: "Updated progress: Chose acquisition research next.",
          eventAt: 1_000,
        }),
      ]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("ignores untracked paths even when a write-capable tool runs", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-file-hook-"));
    try {
      writeFileSync(path.join(repo, "package.json"), "{}\n");
      const rows = parseFileChangeBubbleCandidatesFromPayload(
        {
          event: "PostToolUse",
          toolName: "apply_patch",
          cwd: repo,
          sessionId: "thread-1",
          toolInput: "*** Begin Patch\n*** Update File: package.json\n@@\n+{}\n*** End Patch\n",
        },
        1_000,
      );

      expect(rows).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("supports custom tracked path patterns", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-file-hook-"));
    try {
      writeFileSync(path.join(repo, "package.json"), "{\"ok\":true}\n");
      const rows = parseFileChangeBubbleCandidatesFromPayload(
        {
          event: "PostToolUse",
          toolName: "apply_patch",
          cwd: repo,
          sessionId: "thread-1",
          toolInput: "*** Begin Patch\n*** Update File: package.json\n@@\n+{\"ok\":true}\n*** End Patch\n",
        },
        1_000,
        { trackedPathPatterns: ["package.json"] },
      );

      expect(rows).toEqual([
        expect.objectContaining({
          filePath: "package.json",
          message: "Updated package.json: {\"ok\":true}",
        }),
      ]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("detects top-level changedFiles payloads", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-file-hook-"));
    try {
      writeFileSync(path.join(repo, "goals.md"), "# Goals\n\n- Harden telemetry hooks.\n");
      const rows = parseFileChangeBubbleCandidatesFromPayload(
        {
          event: "PostToolUse",
          toolName: "write",
          cwd: repo,
          sessionId: "thread-1",
          changedFiles: ["goals.md"],
        },
        1_000,
      );

      expect(rows).toEqual([
        expect.objectContaining({
          filePath: "goals.md",
          message: "Updated goals: Harden telemetry hooks.",
        }),
      ]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("detects tracked docs paths from bash command payloads", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-file-hook-"));
    try {
      const docsDir = path.join(repo, "docs", "specs");
      mkdirSync(docsDir, { recursive: true });
      writeFileSync(path.join(repo, "docs", "prd.md"), "# PRD\n\n- Define PM founder loop.\n");
      writeFileSync(path.join(docsDir, "telemetry.md"), "# Telemetry\n\n- Track hook bubbles.\n");
      const rows = parseFileChangeBubbleCandidatesFromPayload(
        {
          event: "PostToolUse",
          toolName: "bash",
          cwd: repo,
          sessionId: "thread-1",
          command: "printf '%s\\n' update > docs/prd.md && printf '%s\\n' update | tee docs/specs/telemetry.md",
        },
        1_000,
      );

      expect(rows).toEqual([
        expect.objectContaining({
          filePath: "docs/prd.md",
          message: "Updated prd.md: Define PM founder loop.",
        }),
        expect.objectContaining({
          filePath: "docs/specs/telemetry.md",
          message: "Updated telemetry.md: Track hook bubbles.",
        }),
      ]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("ignores read-only bash commands that mention tracked docs paths", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-file-hook-"));
    try {
      mkdirSync(path.join(repo, "docs"), { recursive: true });
      writeFileSync(path.join(repo, "docs", "prd.md"), "# PRD\n\n- Existing plan.\n");
      const rows = parseFileChangeBubbleCandidatesFromPayload(
        {
          event: "PostToolUse",
          toolName: "bash",
          cwd: repo,
          sessionId: "thread-1",
          command: "cat docs/prd.md && rg Existing docs/prd.md",
        },
        1_000,
      );

      expect(rows).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("publishes file changed telemetry without throwing on success", async () => {
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

    expect(result).toEqual({ attempted: 1, published: 1, skipped: false });
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual(
      expect.objectContaining({
        hookName: "file-change-listener",
        hookType: "PostToolUse",
        payload: expect.objectContaining({
          eventName: "file.changed",
          threadId: "thread-1",
          paths: ["progress.md"],
          message: "Updated progress: chose acquisition research",
        }),
      }),
    );
  });
});
