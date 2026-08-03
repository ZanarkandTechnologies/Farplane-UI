import { describe, expect, it } from "vitest";
import {
  buildKanbanColumns,
  type CommunicationRow,
  deriveAgentPresenceRows,
  derivePanelFoundationState,
  isTaskInReviewLane,
  type PanelTask,
  type PresenceEmployee,
} from "./team-panel-types";

describe("deriveAgentPresenceRows", () => {
  it("prefers an active assigned task over older completed work", () => {
    const employees: PresenceEmployee[] = [
      {
        _id: "employee-growth",
        name: "Growth Marketer",
        jobTitle: "growth_marketer",
        status: "executing",
        statusMessage: "Refreshing affiliate content",
      },
    ];
    const tasks: PanelTask[] = [
      {
        id: "task-done",
        title: "Old completed task",
        status: "done",
        ownerAgentId: "growth",
        priority: "high",
        provider: "internal",
        syncState: "healthy",
        updatedAt: 10,
      },
      {
        id: "task-live",
        title: "Publish roundup",
        status: "in_progress",
        ownerAgentId: "growth",
        priority: "medium",
        provider: "internal",
        syncState: "healthy",
        updatedAt: 20,
      },
    ];
    const rows = deriveAgentPresenceRows({
      employees,
      projectTasks: tasks,
      communicationRows: [],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.agentId).toBe("growth");
    expect(rows[0]?.latestTaskTitle).toBe("Publish roundup");
    expect(rows[0]?.latestTaskStatus).toBe("in_progress");
    expect(rows[0]?.openTaskCount).toBe(1);
    expect(rows[0]?.completedTaskCount).toBe(1);
  });

  it("falls back to recent communication when no task is assigned", () => {
    const employees: PresenceEmployee[] = [
      {
        _id: "employee-pm",
        name: "PM",
        jobTitle: "pm",
      },
    ];
    const communicationRows: CommunicationRow[] = [
      {
        id: "comm-1",
        agentId: "pm",
        activityType: "planning",
        label: "Queue shaped",
        detail: "Reviewing next affiliate batch",
        occurredAt: 123,
      },
    ];

    const rows = deriveAgentPresenceRows({
      employees,
      projectTasks: [],
      communicationRows,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.latestTaskTitle).toBeUndefined();
    expect(rows[0]?.statusText).toBe("Reviewing next affiliate batch");
    expect(rows[0]?.latestOccurredAt).toBe(123);
  });

  it("preserves employee appearance data for renderer-aware member cards", () => {
    const employees: PresenceEmployee[] = [
      {
        _id: "employee-sprite",
        name: "Sprite Builder",
        profileImageUrl: "https://example.com/profile.png",
        isSupervisor: true,
        appearance: {
          clothesStyle: "techBro",
          hairColor: "#123456",
          characterRenderer: {
            id: "sprite-sheet-2d",
            source: { type: "codex-pet", petId: "mini-kenji" },
          },
        },
      },
    ];

    const rows = deriveAgentPresenceRows({
      employees,
      projectTasks: [],
      communicationRows: [],
    });

    expect(rows[0]?.avatarUrl).toBe("https://example.com/profile.png");
    expect(rows[0]?.isSupervisor).toBe(true);
    expect(rows[0]?.appearance?.hairColor).toBe("#123456");
    expect(rows[0]?.appearance?.characterRenderer).toEqual({
      id: "sprite-sheet-2d",
      source: { type: "codex-pet", petId: "mini-kenji" },
    });
  });

  it("sorts agents by freshest active context", () => {
    const employees: PresenceEmployee[] = [
      { _id: "employee-alpha", name: "Alpha" },
      { _id: "employee-beta", name: "Beta" },
    ];
    const tasks: PanelTask[] = [
      {
        id: "task-beta",
        title: "Active task",
        status: "in_progress",
        ownerAgentId: "beta",
        priority: "high",
        provider: "internal",
        syncState: "healthy",
        updatedAt: 200,
      },
    ];
    const communicationRows: CommunicationRow[] = [
      {
        id: "comm-alpha",
        agentId: "alpha",
        activityType: "planning",
        label: "Backlog updated",
        occurredAt: 100,
      },
    ];

    const rows = deriveAgentPresenceRows({
      employees,
      projectTasks: tasks,
      communicationRows,
    });

    expect(rows.map((row) => row.agentId)).toEqual(["beta", "alpha"]);
  });
});

describe("kanban lane helpers", () => {
  it("uses active foundation tickets as the whole locked board and advances progress", () => {
    const foundationTask = (
      id: string,
      step: string,
      sequence: number,
      status: PanelTask["status"],
    ): PanelTask => ({
      id,
      title: `Foundation ${sequence}`,
      status,
      priority: "high",
      provider: "internal",
      syncState: "healthy",
      frontMatter: {
        foundation_step: step,
        foundation_sequence: String(sequence),
      },
    });
    const ordinary: PanelTask = {
      id: "TASK-0042",
      title: "Ordinary work",
      status: "todo",
      priority: "medium",
      provider: "internal",
      syncState: "healthy",
    };

    const initial = derivePanelFoundationState([
      ordinary,
      foundationTask("TASK-0003", "collect_revenue", 3, "blocked"),
      foundationTask("TASK-0001", "find_customer", 1, "in_progress"),
      foundationTask("TASK-0002", "deliver_value", 2, "blocked"),
    ]);
    expect(initial).toMatchObject({ mode: "locked", completedCount: 0, totalCount: 3 });
    expect(initial.activeTasks.map((task) => task.id)).toEqual([
      "TASK-0001",
      "TASK-0002",
      "TASK-0003",
    ]);

    const afterOne = derivePanelFoundationState([
      ordinary,
      foundationTask("TASK-0002", "deliver_value", 2, "in_progress"),
      foundationTask("TASK-0003", "collect_revenue", 3, "blocked"),
    ]);
    expect(afterOne).toMatchObject({ mode: "locked", completedCount: 1 });

    expect(derivePanelFoundationState([ordinary])).toMatchObject({ mode: "legacy" });
    expect(
      derivePanelFoundationState([
        ordinary,
        foundationTask("TASK-0003", "collect_revenue", 3, "done"),
      ]),
    ).toMatchObject({ mode: "unlocked", activeTasks: [], completedCount: 3 });
  });

  it("routes review-status tasks into the review lane", () => {
    const tasks: PanelTask[] = [
      {
        id: "task-review",
        title: "Founder review",
        status: "review",
        priority: "high",
        provider: "internal",
        syncState: "healthy",
      },
      {
        id: "task-normal",
        title: "Ship follow-up",
        status: "in_progress",
        priority: "medium",
        provider: "internal",
        syncState: "healthy",
      },
    ];

    const columns = buildKanbanColumns(tasks);

    expect(isTaskInReviewLane(tasks[0] as PanelTask)).toBe(true);
    expect(columns.review.map((task) => task.id)).toEqual(["task-review"]);
    expect(columns.in_progress.map((task) => task.id)).toEqual(["task-normal"]);
  });

  it("keeps completed tasks in done when they are not under review", () => {
    const tasks: PanelTask[] = [
      {
        id: "task-done",
        title: "Closed task",
        status: "done",
        priority: "low",
        provider: "internal",
        syncState: "healthy",
      },
    ];

    const columns = buildKanbanColumns(tasks);

    expect(columns.done.map((task) => task.id)).toEqual(["task-done"]);
    expect(columns.review).toHaveLength(0);
  });
});
