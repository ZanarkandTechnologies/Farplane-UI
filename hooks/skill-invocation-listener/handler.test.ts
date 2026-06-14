import { describe, expect, it, vi } from "vitest";
import {
  normalizeSkillPath,
  parseSkillInvocationsFromPayload,
  parseSkillInvocationsFromStdin,
  publishSkillInvocations,
  resolveDefaultEndpointBaseUrl,
  skillIdFromPath,
} from "./handler";

describe("skill invocation listener hook", () => {
  it("derives the skill id from the parent directory", () => {
    expect(skillIdFromPath("/Users/me/.codex/skills/harness-advisor/SKILL.md")).toBe(
      "harness-advisor",
    );
    expect(skillIdFromPath("/repo/skills/cross-cutting/ledger-manager/SKILL.md")).toBe(
      "ledger-manager",
    );
    expect(normalizeSkillPath("/repo/README.md")).toBeNull();
  });

  it("extracts a SKILL.md read from a PostToolUse payload", () => {
    const rows = parseSkillInvocationsFromPayload(
      {
        event: "PostToolUse",
        toolName: "Bash",
        cwd: "/repo",
        sessionId: "session-1",
        turnId: "turn-1",
        toolInput: {
          command: "sed -n '1,220p' /Users/me/.codex/skills/harness-advisor/SKILL.md",
        },
      },
      1_000,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        skillId: "harness-advisor",
        skillPath: "/Users/me/.codex/skills/harness-advisor/SKILL.md",
        sourceTool: "Bash",
        sourceEvent: "PostToolUse",
        label: "Read skill MD",
        sessionId: "session-1",
        turnId: "turn-1",
        projectPath: "/repo",
      }),
    );
  });

  it("ignores non-skill files and raw output-like fields", () => {
    const rows = parseSkillInvocationsFromPayload({
      event: "PostToolUse",
      toolName: "Bash",
      toolInput: { command: "sed -n '1,20p' README.md" },
      toolOutput: "/Users/me/.codex/skills/should-not-count/SKILL.md",
    });

    expect(rows).toEqual([]);
  });

  it("parses stdin JSON and dedupes repeated skill paths", () => {
    const rows = parseSkillInvocationsFromStdin(
      JSON.stringify({
        event: "PostToolUse",
        toolName: "mcp__filesystem__read_file",
        paths: [
          "/Users/me/.codex/skills/impl-plan/SKILL.md",
          "/Users/me/.codex/skills/impl-plan/SKILL.md",
        ],
      }),
      2_000,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.skillId).toBe("impl-plan");
  });

  it("publishes compact candidates to the Convex endpoint", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const candidate = parseSkillInvocationsFromPayload(
      {
        event: "PostToolUse",
        toolName: "Bash",
        toolInput: { command: "cat /skills/goal-advisor/SKILL.md" },
      },
      3_000,
    );

    const result = await publishSkillInvocations(candidate, {
      endpointBaseUrl: "http://127.0.0.1:3211/",
      telemetryToken: "token-1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ attempted: 1, published: 1, skipped: false });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:3211/skill-invocations/ingest",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-farplane-telemetry-token": "token-1" }),
      }),
    );
  });

  it("resolves the endpoint from environment before dotenv files", () => {
    expect(
      resolveDefaultEndpointBaseUrl({
        FARPLANE_CONVEX_SITE_URL: "https://example.convex.site",
      } as NodeJS.ProcessEnv),
    ).toBe("https://example.convex.site");
  });
});
