import { describe, expect, it } from "vitest";
import { groupEvalRunTasks } from "./eval-run-grouped-list";

describe("single-run evidence grouping", () => {
  it("groups Agent.md first, then skills, without hiding unassigned evidence", () => {
    const groups = groupEvalRunTasks({
      catalog: [{ skillId: "documentation" }, { skillId: "goal-advisor" }],
      detailsByTaskId: {},
      tasks: [
        { task_id: "goal-advisor-case", tags: ["goal-advisor"] },
        { task_id: "global-policy", tags: ["agent.md"] },
        { task_id: "documentation-case", tags: ["skill", "documentation"] },
        { task_id: "legacy-case" },
      ],
    });

    expect(groups.map((group) => group.label)).toEqual([
      "Agent.md",
      "documentation",
      "goal-advisor",
      "Unassigned evidence",
    ]);
    expect(groups.map((group) => group.tasks.length)).toEqual([1, 1, 1, 1]);
  });
});
