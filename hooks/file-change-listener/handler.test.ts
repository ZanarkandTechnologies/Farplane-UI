import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createTicketAuditRunsForCompletedEvents,
  parseFarplaneFileEventCandidatesFromPayload,
  parseFileChangeBubbleCandidatesFromPayload,
  publishFarplaneFileEventCandidates,
  publishFileChangeBubbleCandidates,
  publishTicketAuditRunEvents,
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
        { codexSummary: { runner: testSummaryRunner } },
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
        { codexSummary: { runner: testSummaryRunner } },
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
        { trackedPathPatterns: ["package.json"], codexSummary: { runner: testSummaryRunner } },
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
        { codexSummary: { runner: testSummaryRunner } },
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
        { codexSummary: { runner: testSummaryRunner } },
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
        { codexSummary: { runner: testSummaryRunner } },
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
        { codexSummary: { runner: async () => "" } },
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

  it("emits typed Farplane ticket completion events from frontmatter transitions", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-file-hook-"));
    const stateDir = path.join(repo, ".farplane", "file-events", "state-test");
    try {
      const ticketDir = path.join(repo, "tickets", "TASK-0099");
      mkdirSync(ticketDir, { recursive: true });
      const ticketPath = path.join(ticketDir, "ticket.md");
      writeFileSync(
        ticketPath,
        [
          "---",
          "ticket_id: TASK-0099",
          "title: Typed file event proof",
          "status: review",
          "phase: planning",
          "next_action: finish proof",
          "---",
          "",
          "# TASK-0099: Typed file event proof",
          "",
        ].join("\n"),
      );

      const basePayload = {
        event: "PostToolUse",
        toolName: "apply_patch",
        cwd: repo,
        sessionId: "thread-1",
        toolInput:
          "*** Begin Patch\n*** Update File: tickets/TASK-0099/ticket.md\n@@\n+status change\n*** End Patch\n",
      };
      const first = parseFarplaneFileEventCandidatesFromPayload(basePayload, 1_000, {
        fileEventStateDir: stateDir,
      });
      expect(first).toEqual([
        expect.objectContaining({
          eventName: "farplane.ticket.changed",
          entityKind: "ticket",
          entityId: "TASK-0099",
          firstObservation: true,
          terminal: false,
        }),
      ]);

      writeFileSync(
        ticketPath,
        [
          "---",
          "ticket_id: TASK-0099",
          "title: Typed file event proof",
          "status: done",
          "phase: complete",
          "next_action: done",
          "---",
          "",
          "# TASK-0099: Typed file event proof",
          "",
        ].join("\n"),
      );
      const second = parseFarplaneFileEventCandidatesFromPayload(basePayload, 2_000, {
        fileEventStateDir: stateDir,
      });
      expect(second).toEqual([
        expect.objectContaining({
          eventName: "farplane.ticket.completed",
          entityId: "TASK-0099",
          firstObservation: false,
          terminal: true,
          frontmatterDiff: expect.objectContaining({
            changed: expect.objectContaining({
              status: expect.objectContaining({
                before: expect.objectContaining({ preview: "review" }),
                after: expect.objectContaining({ preview: "done" }),
              }),
              next_action: expect.objectContaining({
                after: expect.objectContaining({ preview: "done" }),
              }),
            }),
          }),
        }),
      ]);
      expect(JSON.stringify(second)).not.toContain("# TASK-0099");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("publishes typed Farplane file events without raw file bodies", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const result = await publishFarplaneFileEventCandidates(
      [
        {
          schemaVersion: 1,
          eventName: "farplane.goals.changed",
          source: "local_file_post_tool_use",
          sessionId: "thread-1",
          threadId: "thread-1",
          projectPath: "/repo",
          path: "farplane/goals.md",
          entityKind: "goal",
          contentHash: "hash-1",
          changedFields: [
            { path: "heading:North Star", after: { hash: "hash-2", preview: "North Star" } },
          ],
          sectionHints: ["North Star"],
          summary: "goal changed",
          eventAt: 1_000,
          eventKey: "farplane-file-event:thread-1:farplane/goals.md:hash",
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
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body).toEqual(
      expect.objectContaining({
        hookName: "file-change-listener",
        payload: expect.objectContaining({
          eventName: "farplane.goals.changed",
          path: "farplane/goals.md",
          contentHash: "hash-1",
          changedFields: [expect.objectContaining({ path: "heading:North Star" })],
        }),
      }),
    );
    expect(JSON.stringify(body)).not.toContain("# Goals");
  });

  it("creates an idempotent ticket audit mining run for completed ticket events", async () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-file-hook-"));
    const stateDir = path.join(repo, ".farplane", "file-events", "state-test");
    try {
      const ticketDir = path.join(repo, "tickets", "TASK-0099");
      mkdirSync(ticketDir, { recursive: true });
      const ticketPath = path.join(ticketDir, "ticket.md");
      const payload = {
        event: "PostToolUse",
        toolName: "apply_patch",
        cwd: repo,
        sessionId: "thread-1",
        toolInput:
          "*** Begin Patch\n*** Update File: tickets/TASK-0099/ticket.md\n@@\n+status change\n*** End Patch\n",
      };
      writeFileSync(
        ticketPath,
        [
          "---",
          "ticket_id: TASK-0099",
          "title: Audit proof",
          "status: review",
          "phase: proof",
          "---",
          "",
          "# TASK-0099: Audit proof",
          "",
        ].join("\n"),
      );
      parseFarplaneFileEventCandidatesFromPayload(payload, 1_000, { fileEventStateDir: stateDir });
      writeFileSync(
        ticketPath,
        [
          "---",
          "ticket_id: TASK-0099",
          "title: Audit proof",
          "status: done",
          "phase: complete",
          "next_action: done",
          "---",
          "",
          "# TASK-0099: Audit proof",
          "",
        ].join("\n"),
      );
      const completed = parseFarplaneFileEventCandidatesFromPayload(payload, 2_000, {
        fileEventStateDir: stateDir,
      });

      const first = await createTicketAuditRunsForCompletedEvents(completed);
      const second = await createTicketAuditRunsForCompletedEvents(completed);

      expect(first).toMatchObject({ attempted: 1, created: 1, failed: 0 });
      expect(second).toMatchObject({ attempted: 1, created: 1, failed: 0 });
      expect(first.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            eventName: "ticket.audit.created",
            ticketId: "TASK-0099",
          }),
          expect.objectContaining({
            eventName: "ticket.audit.scored",
            outputId: expect.any(String),
            runId: expect.any(String),
            ticketId: "TASK-0099",
          }),
        ]),
      );
      const runsIndexPath = path.join(repo, ".farplane", "mine", "runs", "index.json");
      const runs = JSON.parse(readFileSync(runsIndexPath, "utf8"));
      expect(runs).toHaveLength(1);
      const runId = runs[0].runId;
      const input = JSON.parse(
        readFileSync(path.join(repo, ".farplane", "mine", "runs", runId, "input.json"), "utf8"),
      );
      const sources = JSON.parse(
        readFileSync(path.join(repo, ".farplane", "mine", "runs", runId, "sources.json"), "utf8"),
      );
      expect(input).toEqual(
        expect.objectContaining({
          mode: "ticket_completion",
          source: "hook",
          sourceEventKey: completed[0]?.eventKey,
        }),
      );
      expect(sources[0]).toEqual(
        expect.objectContaining({
          sourceKind: "ticket_packet",
          ticketId: "TASK-0099",
        }),
      );
      expect(
        existsSync(path.join(repo, ".farplane", "mine", "runs", runId, "outputs", "index.json")),
      ).toBe(true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("publishes ticket audit creation telemetry", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const result = await publishTicketAuditRunEvents(
      {
        attempted: 1,
        created: 1,
        skipped: 0,
        failed: 0,
        events: [
          {
            eventName: "ticket.audit.created",
            eventKey: "ticket-audit:v1:created:key",
            projectId: "codex-proj-repo",
            sessionId: "thread-1",
            ticketId: "TASK-0099",
            summary: "Created ticket completion audit for TASK-0099",
            runId: "mine-test",
            reviewRunPath: ".farplane/mine/runs/mine-test",
            eventAt: 3_000,
          },
        ],
      },
      {
        endpointBaseUrl: "http://127.0.0.1:3211/",
        fetchImpl: fetchImpl as unknown as typeof fetch,
        projectPath: "/repo",
      },
    );

    expect(result).toMatchObject({ attempted: 1, published: 1, queued: 0, skipped: false });
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual(
      expect.objectContaining({
        hookName: "file-change-listener",
        projectId: "codex-proj-repo",
        payload: expect.objectContaining({
          eventName: "ticket.audit.created",
          ticketId: "TASK-0099",
          runId: "mine-test",
        }),
      }),
    );
  });
});
