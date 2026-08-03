import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KanbanTab } from "./kanban-tab";
import type { PanelTask } from "./team-panel-types";

function task(
  id: string,
  title: string,
  frontMatter?: Record<string, string>,
): PanelTask {
  return {
    id,
    title,
    status: "todo",
    priority: "high",
    provider: "internal",
    syncState: "healthy",
    frontMatter,
  };
}

describe("KanbanTab foundation gate", () => {
  it("shows only starter quests and their progress while the project is locked", () => {
    const html = renderToStaticMarkup(
      createElement(KanbanTab, {
        projectTasks: [
          task("TASK-0099", "Ordinary hidden work"),
          task("TASK-0002", "Deliver first value", {
            foundation_step: "deliver_value",
            foundation_sequence: "2",
          }),
          task("TASK-0001", "Find first customer", {
            foundation_step: "find_customer",
            foundation_sequence: "1",
          }),
        ],
        focusAgentId: "someone-else",
        ownerLabelById: new Map(),
        kanbanState: "ready",
      }),
    );

    expect(html).toContain("Business foundation 1/3");
    expect(html).toContain("Next: Find first customer");
    expect(html).toContain("Find first customer");
    expect(html).toContain("Deliver first value");
    expect(html).not.toContain("Ordinary hidden work");
    expect(html).not.toContain("Showing tasks owned by");
  });
});
