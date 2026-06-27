import { describe, expect, it } from "vitest";
import {
  filterEvalTasks,
  formatPercent,
  getTaskScope,
  isEvalSummary,
  resolveEvalArtifactsRoot,
  sortRunIndex,
} from "./eval-artifacts";
import { computeEvalHealth } from "./eval-health";
import type { EvalSummary } from "./eval-types";

const summary: EvalSummary = {
  job_id: "run-1",
  pass_rate: 0.5,
  verdict_counts: { A: 1, D: 1 },
  tasks: [
    { task_id: "task-a", title: "Happy path", pass: true, verdict: "A" },
    { task_id: "task-b", title: "Hard recovery", pass: false, verdict: "D" },
  ],
};

describe("Eval OS artifact helpers", () => {
  it("recognizes summary artifacts", () => {
    expect(isEvalSummary(summary)).toBe(true);
    expect(isEvalSummary({ job_id: "run-2" })).toBe(false);
  });

  it("computes health from summary and loaded detail count", () => {
    expect(computeEvalHealth(summary, { "task-a": { task_id: "task-a" } })).toMatchObject({
      failureCount: 1,
      loadedDetailCount: 1,
      score: 45,
      verdict: "blocked",
    });
  });

  it("filters tasks by search, pass state, verdict, and hardcase tag", () => {
    const details = { "task-b": { task_id: "task-b", task: { tags: ["hardcase"] } } };
    expect(filterEvalTasks(summary.tasks, details, "recovery", "all")).toHaveLength(1);
    expect(filterEvalTasks(summary.tasks, details, "", "pass")).toHaveLength(1);
    expect(filterEvalTasks(summary.tasks, details, "", "D")).toHaveLength(1);
    expect(filterEvalTasks(summary.tasks, details, "", "hardcase")).toHaveLength(1);
    expect(filterEvalTasks(summary.tasks, details, "", "all", "skill")).toHaveLength(0);
  });

  it("formats rates and sorts newest runs first", () => {
    expect(formatPercent(0.875)).toBe("88%");
    expect(
      sortRunIndex([
        { job_id: "old", created_at: "2026-01-01T00:00:00Z" },
        { job_id: "new", created_at: "2026-02-01T00:00:00Z" },
      ]).map((run) => run.job_id),
    ).toEqual(["new", "old"]);
  });

  it("classifies task scope from tags and names", () => {
    expect(getTaskScope({ task_id: "skill-a", tags: ["skill"] })).toBe("skill");
    expect(getTaskScope({ task_id: "agent-md-a", tags: ["agent.md"] })).toBe("agent-md");
    expect(getTaskScope({ task_id: "task-quality-a", tags: ["task-quality"] })).toBe("task");
  });

  it("resolves eval artifacts root with explicit and framework-first precedence", () => {
    const roots = {
      frameworkRoot: "/framework/.farplane/evals",
      globalRoot: "/home/user/.farplane/evals",
      projectRoot: "/project/.farplane/evals",
    };

    expect(
      resolveEvalArtifactsRoot({
        ...roots,
        envRoot: "/custom/evals",
        hasFrameworkIndex: true,
        hasGlobalIndex: true,
      }),
    ).toBe("/custom/evals");
    expect(
      resolveEvalArtifactsRoot({
        ...roots,
        envRoot: "   ",
        hasFrameworkIndex: true,
        hasGlobalIndex: true,
      }),
    ).toBe(roots.globalRoot);
    expect(
      resolveEvalArtifactsRoot({
        ...roots,
        hasFrameworkIndex: true,
        hasGlobalIndex: false,
      }),
    ).toBe(
      roots.frameworkRoot,
    );
    expect(resolveEvalArtifactsRoot({ ...roots, hasFrameworkIndex: false, hasGlobalIndex: false })).toBe(
      roots.projectRoot,
    );
  });
});
