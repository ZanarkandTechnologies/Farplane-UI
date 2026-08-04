import { describe, expect, it } from "vitest";
import type {
  AgentCardModel,
  AgentLiveStatus,
  CompanyAgentModel,
  ProjectModel,
} from "@/modules/runtime";
import {
  deriveVisibleOfficeProjects,
  OFFICE_PROJECT_ACTIVITY_WINDOW_MS,
} from "./office-project-visibility";

const NOW_MS = Date.UTC(2026, 7, 5, 12);

function project(id: string, overrides: Partial<ProjectModel> = {}): ProjectModel {
  return {
    id,
    departmentId: "department",
    name: id,
    githubUrl: "",
    status: "active",
    goal: "Ship it",
    kpis: [],
    accountEvents: [],
    ledger: [],
    experiments: [],
    metricEvents: [],
    resources: [],
    resourceEvents: [],
    ...overrides,
  };
}

function companyAgent(
  agentId: string,
  projectId: string,
  overrides: Partial<CompanyAgentModel> = {},
): CompanyAgentModel {
  return {
    agentId,
    projectId,
    role: "builder",
    heartbeatProfileId: "heartbeat",
    lifecycleState: "active",
    ...overrides,
  };
}

function runtimeAgent(agentId: string, overrides: Partial<AgentCardModel> = {}): AgentCardModel {
  return {
    agentId,
    displayName: agentId,
    workspacePath: "/workspace",
    agentDir: "/workspace",
    sandboxMode: "codex",
    toolPolicy: { allow: [], deny: [] },
    sessionCount: 1,
    ...overrides,
  };
}

function liveStatus(agentId: string, overrides: Partial<AgentLiveStatus> = {}): AgentLiveStatus {
  return {
    agentId,
    state: "idle",
    statusText: "Idle",
    bubbles: [],
    ...overrides,
  };
}

describe("deriveVisibleOfficeProjects", () => {
  it.each([
    ["6d23h59", NOW_MS - OFFICE_PROJECT_ACTIVITY_WINDOW_MS + 60_000, true],
    ["exactly 7d", NOW_MS - OFFICE_PROJECT_ACTIVITY_WINDOW_MS, true],
    ["7d+1ms", NOW_MS - OFFICE_PROJECT_ACTIVITY_WINDOW_MS - 1, false],
  ])("applies the inclusive seven-day boundary at %s", (_label, lastActivityAt, visible) => {
    const result = deriveVisibleOfficeProjects(
      [project("boundary", { lastActivityAt })],
      { companyAgents: [], runtimeAgents: [], liveStatusByAgentId: {} },
      NOW_MS,
    );

    expect(result.visibleIds.includes("boundary")).toBe(visible);
    expect(result.reasons.boundary).toBe(visible ? "recent_activity" : "stale_idle");
    expect(result.latestActivity.boundary).toBe(lastActivityAt);
  });

  it("uses fixed precedence for running, goal, heartbeat, unknown, stale, and archived projects", () => {
    const cutoff = NOW_MS - OFFICE_PROJECT_ACTIVITY_WINDOW_MS;
    const projects = [
      project("running", { lastActivityAt: cutoff - 1 }),
      project("goal", { lastActivityAt: cutoff - 1 }),
      project("heartbeat", { lastActivityAt: cutoff - 1 }),
      project("unknown"),
      project("stale", { lastActivityAt: cutoff - 1 }),
      project("archived", { status: "archived", lastActivityAt: NOW_MS }),
    ];
    const companyAgents = [
      companyAgent("running-agent", "running"),
      companyAgent("goal-agent", "goal", {
        runtimeMetadata: {
          codexThreadGoal: {
            threadId: "goal-agent",
            objective: "Continue",
            status: "paused",
            tokenBudget: null,
            tokensUsed: 1,
            timeUsedSeconds: 1,
            createdAt: cutoff,
            updatedAt: cutoff,
          },
        },
      }),
      companyAgent("heartbeat-agent", "heartbeat"),
      companyAgent("completed-goal-agent", "stale", {
        runtimeMetadata: {
          codexThreadGoal: {
            threadId: "completed-goal-agent",
            objective: "Already done",
            status: "complete",
            tokenBudget: null,
            tokensUsed: 1,
            timeUsedSeconds: 1,
            createdAt: cutoff,
            updatedAt: cutoff,
          },
        },
      }),
      companyAgent("archived-agent", "archived"),
    ];
    const liveStatusByAgentId = {
      "running-agent": liveStatus("running-agent", {
        state: "executing",
        latestHeartbeat: {
          beatId: "run",
          sessionKey: "run",
          startedAt: NOW_MS,
          trigger: "manual",
          status: "running",
          summary: "Running",
          skillBubbles: [],
          eventCount: 0,
        },
      }),
      "heartbeat-agent": liveStatus("heartbeat-agent", {
        latestHeartbeat: {
          beatId: "recent",
          sessionKey: "recent",
          startedAt: cutoff / 1000,
          trigger: "scheduled",
          status: "ok",
          summary: "Recent",
          skillBubbles: [],
          eventCount: 0,
        },
      }),
      "archived-agent": liveStatus("archived-agent", { state: "running" }),
    };

    const result = deriveVisibleOfficeProjects(
      projects,
      { companyAgents, runtimeAgents: [], liveStatusByAgentId },
      NOW_MS,
    );

    expect(result.reasons).toEqual({
      running: "running",
      goal: "goal_backed",
      heartbeat: "recent_heartbeat",
      unknown: "unknown_activity",
      stale: "stale_idle",
      archived: "archived",
    });
    expect(result.visibleIds).toEqual(["running", "goal", "heartbeat", "unknown"]);
    expect(result.hiddenIds).toEqual(["stale", "archived"]);
  });

  it("uses runtime activity and non-complete runtime goals associated through company agents", () => {
    const agent = companyAgent("worker", "project");
    const result = deriveVisibleOfficeProjects(
      [project("project", { lastActivityAt: NOW_MS - OFFICE_PROJECT_ACTIVITY_WINDOW_MS - 1 })],
      {
        companyAgents: [agent],
        runtimeAgents: [
          runtimeAgent("worker", {
            lastUpdatedAt: NOW_MS / 1000,
            runtimeMetadata: {
              codexThreadGoal: {
                threadId: "worker",
                objective: "Keep going",
                status: "blocked",
                tokenBudget: null,
                tokensUsed: 0,
                timeUsedSeconds: 0,
                createdAt: NOW_MS / 1000,
                updatedAt: NOW_MS / 1000,
              },
            },
          }),
        ],
        liveStatusByAgentId: {},
      },
      NOW_MS,
    );

    expect(result.reasons.project).toBe("goal_backed");
    expect(result.latestActivity.project).toBe(NOW_MS);
  });
});
