import { describe, expect, it } from "vitest";
import { buildSkillInvocationDashboard, type SkillInvocationRow } from "./contracts";
import { parseSkillInvocationPayload } from "./httpContracts";

function row(
  input: Partial<SkillInvocationRow> & Pick<SkillInvocationRow, "skillId" | "occurredAt">,
): SkillInvocationRow {
  return {
    skillPath: `/skills/${input.skillId}/SKILL.md`,
    sourceTool: "Bash",
    sourceEvent: "PostToolUse",
    label: "Read skill MD",
    source: "test",
    receivedAt: input.occurredAt,
    ...input,
  };
}

describe("skill invocation contracts", () => {
  it("builds dashboard counts by skill and source tool", () => {
    const dashboard = buildSkillInvocationDashboard([
      row({ skillId: "harness-advisor", occurredAt: 1_000 }),
      row({
        skillId: "harness-advisor",
        occurredAt: 2_000,
        sourceTool: "mcp__filesystem__read_file",
      }),
      row({ skillId: "impl-plan", occurredAt: 3_000 }),
    ]);

    expect(dashboard.totals).toEqual({
      invocationCount: 3,
      skillCount: 2,
      sourceToolCount: 2,
      lastSeenAt: 3_000,
    });
    expect(dashboard.bySkill.map((entry) => [entry.key, entry.count])).toEqual([
      ["harness-advisor", 2],
      ["impl-plan", 1],
    ]);
    expect(dashboard.recentEvents.map((entry) => entry.skillId)).toEqual([
      "impl-plan",
      "harness-advisor",
      "harness-advisor",
    ]);
  });

  it("parses compact ingest payloads and rejects non-skill paths", () => {
    expect(
      parseSkillInvocationPayload({
        skillId: "goal-advisor",
        skillPath: "/Users/me/.codex/skills/goal-advisor/SKILL.md",
        sourceTool: "Bash",
        label: "Read skill MD",
      }),
    ).toEqual(
      expect.objectContaining({
        skillId: "goal-advisor",
        sourceTool: "Bash",
      }),
    );
    expect(
      parseSkillInvocationPayload({
        skillId: "goal-advisor",
        skillPath: "/Users/me/.codex/skills/goal-advisor/README.md",
        sourceTool: "Bash",
      }),
    ).toBeNull();
  });
});
