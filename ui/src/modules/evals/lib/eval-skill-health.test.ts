import { describe, expect, it } from "vitest";
import {
  buildAgentMdHealthRow,
  buildEvalSkillHealthRows,
  buildEvalSkillHealthRowsFromCatalog,
} from "./eval-skill-health";

describe("eval skill health projection", () => {
  it("returns every catalog skill and keeps missing evidence unscored", () => {
    const rows = buildEvalSkillHealthRows({
      skillIds: ["functional-ui", "skill-maintenance", "uncovered"],
      tasks: [
        { task_id: "functional_ui_flow", pass: true, verdict: "A", evaluated_at: "2026-07-10" },
        { task_id: "maintenance-safe", pass: false, verdict: "D", tags: ["skill-maintenance"] },
      ],
      detailsByTaskId: {},
    });

    expect(rows).toHaveLength(3);
    expect(rows.find((row) => row.skillId === "functional-ui")).toMatchObject({
      score: 100,
      status: "healthy",
      passedCount: 1,
    });
    expect(rows.find((row) => row.skillId === "skill-maintenance")).toMatchObject({
      score: 0,
      status: "blocked",
      failureCount: 1,
    });
    expect(rows.find((row) => row.skillId === "uncovered")).toMatchObject({
      score: null,
      status: "no-coverage",
    });
  });

  it("projects catalog metadata and Agent.md evidence separately", () => {
    const tasks = [
      { task_id: "agent-policy", pass: true, verdict: "A", tags: ["agent.md"] },
      { task_id: "skill-a-case", pass: true, verdict: "B", tags: ["skill-a"] },
    ];
    expect(
      buildEvalSkillHealthRowsFromCatalog({
        catalog: [{ skillId: "skill-a", tier: 2, description: "A workflow" }],
        tasks,
        detailsByTaskId: {},
      })[0],
    ).toMatchObject({ skillId: "skill-a", tier: 2, description: "A workflow", score: 75 });
    expect(buildAgentMdHealthRow({ tasks, detailsByTaskId: {} })).toMatchObject({
      skillId: "agent.md",
      score: 100,
      taskCount: 1,
    });
  });
});
