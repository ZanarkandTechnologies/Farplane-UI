import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  buildMinerTelemetryEnvelope,
  launchResultCandidate,
  parseCodexEventMinerFromPayload,
  publishMinerEvents,
} from "./handler";
import { buildMinerAgentInput, buildMinerAgentPrompt, launchMinerAgent } from "./launcher";

describe("codex-event-miner", () => {
  it("emits queued telemetry and returns a launch request instead of mining inline", () => {
    const parsed = parseCodexEventMinerFromPayload(
      {
        hook_event_name: "Stop",
        session_id: "session-1",
        turn_id: "turn-1",
        cwd: "/repo/TASK-0019",
        last_assistant_message:
          "Decision: use hookTelemetryEvents projections instead of a separate self event log table.",
      },
      1_000,
      {
        cadenceTurns: 1,
        includeReviewReports: false,
      },
    );

    expect(parsed.candidates.map((candidate) => candidate.eventName)).toEqual(["miner.agent.queued"]);
    expect(parsed.launchRequest).toEqual(
      expect.objectContaining({ sessionId: "session-1", turnId: "turn-1", ticketId: "TASK-0019" }),
    );
    expect(JSON.stringify(parsed.candidates)).not.toContain("last_assistant_message");
    expect(JSON.stringify(parsed.candidates)).not.toContain("use hookTelemetryEvents projections");
  });

  it("keeps not-due cadence telemetry quiet unless verbose telemetry is enabled", () => {
    const payload = {
      hook_event_name: "Stop",
      session_id: "session-1",
      turn_id: "turn-1",
      cwd: "/repo",
    };
    const quiet = parseCodexEventMinerFromPayload(payload, 1_000, {
      cadenceTurns: 5,
      includeReviewReports: false,
    });
    const verbose = parseCodexEventMinerFromPayload(payload, 1_000, {
      cadenceTurns: 5,
      includeCadenceTelemetry: true,
      includeReviewReports: false,
    });

    expect(quiet.candidates).toEqual([]);
    expect(quiet.windowState).toEqual(expect.objectContaining({ turnCount: 1 }));
    expect(verbose.candidates.map((candidate) => candidate.eventName)).toEqual([
      "miner.window.updated",
      "miner.agent.skipped",
    ]);
  });

  it("queues miner agent every configured cadence without recounting duplicate turns", () => {
    const first = parseCodexEventMinerFromPayload(
      {
        hook_event_name: "Stop",
        session_id: "session-1",
        turn_id: "turn-1",
        cwd: "/repo",
      },
      1_000,
      { cadenceTurns: 2, includeReviewReports: false },
    );
    const duplicate = parseCodexEventMinerFromPayload(
      {
        hook_event_name: "Stop",
        session_id: "session-1",
        turn_id: "turn-1",
        cwd: "/repo",
      },
      2_000,
      { cadenceTurns: 2, windowState: first.windowState, includeReviewReports: false },
    );
    const second = parseCodexEventMinerFromPayload(
      {
        hook_event_name: "Stop",
        session_id: "session-1",
        turn_id: "turn-2",
        cwd: "/repo",
      },
      3_000,
      { cadenceTurns: 2, windowState: duplicate.windowState, includeReviewReports: false },
    );

    expect(duplicate.windowState?.turnCount).toBe(1);
    expect(second.windowState?.turnCount).toBe(2);
    expect(second.candidates.some((candidate) => candidate.eventName === "miner.agent.queued")).toBe(true);
    expect(second.launchRequest).toEqual(expect.objectContaining({ sessionId: "session-1", turnCount: 2 }));
  });

  it("flushes completed miner-agent reports into compact events", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-miner-"));
    try {
      const runDir = path.join(repo, ".farplane", "event-miner", "runs", "run-1");
      mkdirSync(runDir, { recursive: true });
      writeFileSync(path.join(runDir, "input.json"), JSON.stringify({ sessionId: "session-1" }));
      writeFileSync(
        path.join(runDir, "report.json"),
        JSON.stringify({
          status: "published",
          summary: "Miner agent published events.",
          events: [
            {
              eventName: "learning.lesson.observed",
              sourceProgram: "learning-docs-v1",
              summary: "Prefer event projections over raw self event logs.",
              docsDelta: { target: "docs/LESSONS.md", rowsAdded: 1 },
            },
            {
              eventName: "learning.trouble.observed",
              sourceProgram: "learning-docs-v1",
              summary: "Detached reviewer reports were missing for UI runs.",
              docsDelta: { target: "docs/TROUBLES.md", rowsAdded: 1 },
            },
            {
              eventName: "decision.observed",
              sourceProgram: "decision-v1",
              summary: "Use codex-event-miner as the Stop hook abstraction.",
              status: "accepted",
              decisionKind: "architecture",
            },
          ],
        }),
      );

      const parsed = parseCodexEventMinerFromPayload(
        {
          hook_event_name: "Stop",
          session_id: "session-1",
          turn_id: "turn-1",
          cwd: repo,
        },
        4_000,
        { includeReviewReports: true },
      );

      expect(parsed.candidates.map((candidate) => candidate.eventName)).not.toContain("learning.review.completed");
      expect(parsed.candidates.map((candidate) => candidate.eventName)).toContain("miner.agent.completed");
      expect(parsed.candidates.map((candidate) => candidate.eventName)).toContain("learning.lesson.observed");
      expect(parsed.candidates.map((candidate) => candidate.eventName)).toContain("learning.trouble.observed");
      expect(parsed.candidates.map((candidate) => candidate.eventName)).toContain("decision.observed");
      expect(JSON.stringify(parsed.candidates)).not.toContain("docs_updated\\n");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("does not flush completed reports from a different session", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-miner-"));
    try {
      const runDir = path.join(repo, ".farplane", "event-miner", "runs", "run-1");
      mkdirSync(runDir, { recursive: true });
      writeFileSync(path.join(runDir, "input.json"), JSON.stringify({ sessionId: "other-session" }));
      writeFileSync(
        path.join(runDir, "report.json"),
        JSON.stringify({
          status: "published",
          events: [
            {
              eventName: "decision.observed",
              sourceProgram: "decision-v1",
              summary: "This should not attach to the current session.",
            },
          ],
        }),
      );

      const parsed = parseCodexEventMinerFromPayload(
        {
          hook_event_name: "Stop",
          session_id: "session-1",
          turn_id: "turn-1",
          cwd: repo,
        },
        4_000,
        { includeReviewReports: true },
      );

      expect(parsed.candidates.map((candidate) => candidate.eventName)).not.toContain("decision.observed");
      expect(parsed.candidates.map((candidate) => candidate.eventName)).not.toContain("miner.agent.completed");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("builds an agent prompt that instructs Codex to mine and call telemetry APIs", () => {
    const input = buildMinerAgentInput({
      sessionId: "session-1",
      turnId: "turn-1",
      ticketId: "TASK-0019",
      projectPath: "/repo",
      transcriptPath: "/Users/me/.codex/sessions/thread.jsonl",
      eventAt: 1_000,
      turnCount: 5,
      cadenceTurns: 5,
      programs: [],
    });
    const prompt = buildMinerAgentPrompt(input);

    expect(prompt).toContain("You are the Farplane Codex event miner agent.");
    expect(prompt).toContain("/telemetry/hooks");
    expect(prompt).toContain("The Stop hook is only a launcher.");
    expect(prompt).toContain("/Users/me/.codex/sessions/thread.jsonl");
    expect(prompt).toContain("Do not do a broad repo investigation.");
  });

  it("launches the detached miner agent through an injectable runner", async () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-miner-launch-"));
    try {
      const runner = vi.fn(async () => ({ pid: 1234 }));
      const result = await launchMinerAgent(
        {
          sessionId: "session-1",
          turnId: "turn-1",
          projectPath: repo,
          eventAt: 1_000,
          turnCount: 5,
          cadenceTurns: 5,
          programs: [],
        },
        { runner },
      );

      expect(result).toEqual(expect.objectContaining({ status: "launched", pid: 1234 }));
      expect(runner).toHaveBeenCalledWith(
        expect.objectContaining({
          command: "codex",
          args: expect.arrayContaining(["exec", "--disable", "hooks", "--output-last-message", "--output-schema"]),
          prompt: expect.stringContaining("Codex event miner agent"),
        }),
      );
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("publishes miner events through telemetry outbox", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const parsed = parseCodexEventMinerFromPayload(
      {
        hook_event_name: "Stop",
        session_id: "session-1",
        turn_id: "turn-1",
        cwd: "/repo",
      },
      5_000,
      { cadenceTurns: 1, includeReviewReports: false },
    );
    parsed.candidates.push(
      launchResultCandidate(parsed.launchRequest!, {
        status: "launched",
        reason: "started detached miner agent",
        runPath: ".farplane/event-miner/runs/run-1",
        pid: 123,
      }),
    );

    const result = await publishMinerEvents(parsed.candidates, {
      endpointBaseUrl: "http://127.0.0.1:3211",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toMatchObject({ attempted: 2, published: 2, skipped: false });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:3211/telemetry/hooks",
      expect.objectContaining({ method: "POST" }),
    );
    const envelope = buildMinerTelemetryEnvelope(
      parsed.candidates.find((candidate) => candidate.eventName === "miner.agent.launched")!,
    );
    expect(envelope).toEqual(
      expect.objectContaining({
        hookName: "codex-event-miner",
        hookType: "Stop",
        sessionId: "session-1",
        payload: expect.objectContaining({
          eventName: "miner.agent.launched",
          sourceProgram: "codex-event-miner",
        }),
      }),
    );
  });
});
