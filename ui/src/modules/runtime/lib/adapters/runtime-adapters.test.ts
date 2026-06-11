import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CODEX_MAIN_AGENT_ID,
  CodexRuntimeAdapter,
  OpenClawRuntimeAdapter,
  createOfficeRuntimeAdapter,
  resolveRuntimeAdapterKind,
  toCodexAgentCards,
  toCodexCompanyModel,
  toCodexSessionRows,
  toCodexTimeline,
} from "../..";
import { CodexAppServerClient } from "../..";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runtime adapters", () => {
  it("binds browser fetch for Codex app-server requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(function (this: unknown) {
        if (this !== globalThis) {
          throw new Error("Illegal invocation");
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              result: {
                data: [],
              },
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          ),
        );
      }),
    );

    const client = new CodexAppServerClient({ stateUrl: "http://state" });

    await expect(client.listThreads()).resolves.toEqual({ data: [] });
  });

  it("defaults unknown runtime values to codex", () => {
    expect(resolveRuntimeAdapterKind(undefined)).toBe("codex");
    expect(resolveRuntimeAdapterKind("")).toBe("codex");
    expect(resolveRuntimeAdapterKind("openclaw")).toBe("openclaw");
  });

  it("creates concrete adapters for codex and openclaw", () => {
    const codex = createOfficeRuntimeAdapter({ kind: "codex", stateUrl: "http://state" });
    const openclaw = createOfficeRuntimeAdapter({ kind: "openclaw", stateUrl: "http://state" });

    expect(codex).toBeInstanceOf(CodexRuntimeAdapter);
    expect(codex.runtimeKind).toBe("codex");
    expect(codex.capabilities.persistentAgents).toBe(false);
    expect(codex.capabilities.agentConfigWrite).toBe(false);
    expect(openclaw).toBeInstanceOf(OpenClawRuntimeAdapter);
    expect(openclaw.runtimeKind).toBe("openclaw");
    expect(openclaw.capabilities.persistentAgents).toBe(true);
    expect(openclaw.capabilities.agentConfigWrite).toBe(true);
  });

  it("synthesizes a main Codex agent when no runtime registry is available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    const adapter = new CodexRuntimeAdapter("", "http://state");

    await expect(adapter.listAgents()).resolves.toEqual([
      expect.objectContaining({
        agentId: CODEX_MAIN_AGENT_ID,
        displayName: "Codex",
        workspacePath: "~/.codex",
      }),
    ]);
    await expect(adapter.getConfigSnapshot()).resolves.toEqual(
      expect.objectContaining({
        config: expect.objectContaining({
          runtime: expect.objectContaining({ kind: "codex" }),
        }),
      }),
    );
    await expect(adapter.getAgentsLiveStatus([CODEX_MAIN_AGENT_ID])).resolves.toEqual({
      [CODEX_MAIN_AGENT_ID]: expect.objectContaining({
        agentId: CODEX_MAIN_AGENT_ID,
        state: "idle",
      }),
    });
  });

  it("skips Codex RPC calls when app-server health is unavailable", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/codex/app-server/health")) {
        return new Response(JSON.stringify({ ok: false, configured: false }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.endsWith("/farplane/codex-ui-state")) {
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.endsWith("/farplane/projects/read-model")) {
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: false, error: "unexpected" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new CodexRuntimeAdapter("", "http://state");
    await expect(adapter.getUnifiedOfficeModel()).resolves.toEqual(
      expect.objectContaining({
        runtimeAgents: [expect.objectContaining({ agentId: CODEX_MAIN_AGENT_ID })],
      }),
    );
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).endsWith("/codex/app-server/rpc")),
    ).toBe(false);
  });

  it("maps Codex threads into workers, sessions, and timelines", () => {
    const thread = {
      id: "thread-1",
      sessionId: "session-1",
      preview: "Implement app server mode",
      cwd: "/workspace/farplane-ui",
      modelProvider: "openai",
      updatedAt: 1770000000,
      status: { type: "active" as const, activeFlags: [] },
      turns: [
        {
          id: "turn-1",
          status: "completed",
          startedAt: 1770000000,
          completedAt: 1770000001,
          items: [
            { type: "userMessage" as const, id: "u1", content: [{ type: "text", text: "hello" }] },
            { type: "agentMessage" as const, id: "a1", text: "hi", phase: null },
            {
              type: "commandExecution" as const,
              id: "c1",
              command: "npm test",
              cwd: "/workspace/farplane-ui",
              status: "completed",
              aggregatedOutput: "passed",
              exitCode: 0,
            },
          ],
        },
      ],
    };

    expect(toCodexAgentCards([thread])[0]).toEqual(
      expect.objectContaining({
        agentId: "codex-thread:thread-1",
        displayName: "Implement app server mode",
        workspacePath: "/workspace/farplane-ui",
      }),
    );
    expect(toCodexSessionRows("codex-thread:thread-1", [thread])).toEqual([
      expect.objectContaining({
        agentId: "codex-thread:thread-1",
        sessionKey: "codex-thread:thread-1",
        peerLabel: "Implement app server mode",
      }),
    ]);
    expect(toCodexTimeline("codex-thread:thread-1", "codex-thread:thread-1", thread).events).toEqual([
      expect.objectContaining({ role: "user", text: "hello", type: "message" }),
      expect.objectContaining({ role: "assistant", text: "hi", type: "message" }),
      expect.objectContaining({ role: "tool", text: "$ npm test\npassed", type: "tool" }),
    ]);
  });

  it("maps Codex cwd groups into projects and recent threads into project agents", () => {
    const nowMs = 1770000000 * 1000;
    const company = toCodexCompanyModel(
      [
        {
          id: "recent-farplane",
          preview: "Recent Farplane work",
          cwd: "/workspace/farplane-ui",
          updatedAt: 1770000000,
        },
        {
          id: "old-farplane",
          preview: "Old Farplane work",
          cwd: "/workspace/farplane-ui",
          updatedAt: 1769980000,
        },
        {
          id: "recent-aikage",
          preview: "Recent Aikage work",
          cwd: "/workspace/sigmax/aikage",
          updatedAt: 1769999000,
        },
        {
          id: "nested-under-home",
          preview: "Nested home project",
          cwd: "/Users/example/project-x",
          updatedAt: 1769999000,
        },
        {
          id: "projectless-chat",
          preview: "General chat",
          updatedAt: 1769999500,
        },
        {
          id: "documents-codex-chat",
          preview: "Scratch Codex chat",
          cwd: "/Users/example/Documents/Codex/2026-06-11/am-i-being-scammed-over-here",
          updatedAt: 1769999500,
        },
      ],
      nowMs,
      [
        "/Users/example",
        "/Users/example/Documents/Codex/2026-06-11/am-i-being-scammed-over-here",
        "/workspace/farplane-ui",
        "/workspace/sigmax",
        "/workspace/sigmax/aikage",
        "/workspace/no-threads",
      ],
    );

    expect(company.projects.map((project) => project.name)).toEqual([
      "aikage",
      "example",
      "farplane-ui",
      "no-threads",
      "sigmax",
      "Misc",
    ]);
    expect(company.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ agentId: CODEX_MAIN_AGENT_ID, role: "ceo" }),
        expect.objectContaining({
          agentId: "codex-thread:recent-farplane",
          projectId: "codex-proj-workspace-farplane-ui",
        }),
        expect.objectContaining({
          agentId: "codex-thread:recent-aikage",
          projectId: "codex-proj-workspace-sigmax-aikage",
        }),
        expect.objectContaining({
          agentId: "codex-thread:nested-under-home",
          projectId: "codex-proj-misc",
        }),
        expect.objectContaining({
          agentId: "codex-thread:projectless-chat",
          projectId: "codex-proj-misc",
        }),
        expect.objectContaining({
          agentId: "codex-thread:documents-codex-chat",
          projectId: "codex-proj-misc",
        }),
      ]),
    );
    expect(company.projects.some((project) => project.name === "am-i-being-scammed-over-here")).toBe(
      false,
    );
    expect(company.projects.find((project) => project.name === "no-threads")).toEqual(
      expect.objectContaining({
        id: "codex-proj-workspace-no-threads",
      }),
    );
    expect(company.agents.some((agent) => agent.agentId === "codex-thread:old-farplane")).toBe(
      false,
    );
  });

  it("uses Codex office visibility config for recency and heartbeat-pinned workers", () => {
    const nowMs = 1770000000 * 1000;
    const company = toCodexCompanyModel(
      [
        {
          id: "old-hidden",
          preview: "Too old for a short window",
          cwd: "/workspace/farplane-ui",
          updatedAt: 1769999000,
        },
        {
          id: "old-heartbeat",
          preview: "Heartbeat worker",
          cwd: "/workspace/farplane-ui",
          updatedAt: 1769900000,
        },
        {
          id: "status-active",
          preview: "Running worker",
          cwd: "/workspace/farplane-ui",
          updatedAt: 1769900000,
          status: { type: "active" as const, activeFlags: [] },
        },
      ],
      nowMs,
      ["/workspace/farplane-ui"],
      {
        officeVisibility: {
          recentThreadWindowMinutes: 5,
          alwaysShowHeartbeatThreads: true,
          heartbeatThreadIds: ["old-heartbeat"],
        },
      },
    );

    expect(company.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentId: "codex-thread:old-heartbeat",
          projectId: "codex-proj-workspace-farplane-ui",
        }),
        expect.objectContaining({
          agentId: "codex-thread:status-active",
          projectId: "codex-proj-workspace-farplane-ui",
        }),
      ]),
    );
    expect(company.agents.some((agent) => agent.agentId === "codex-thread:old-hidden")).toBe(false);
  });

  it("keeps Codex automation heartbeat threads visible when they are older than recency", () => {
    const nowMs = 1770000000 * 1000;
    const company = toCodexCompanyModel(
      [
        {
          id: "notion-fields",
          name: "Notion task field fill",
          preview:
            "Automation: Notion task field fill\nAutomation ID: notion-task-field-fill\nAutomation memory: $CODEX_HOME/automations/notion-task-field-fill/memory.md",
          cwd: "/Users/example/life",
          updatedAt: 1769900000,
          status: { type: "notLoaded" as const },
        },
        {
          id: "weekly-strategy",
          name: "Weekly Strategy and Opportunity Planning",
          preview:
            "Automation: Weekly Strategy and Opportunity Planning\nAutomation ID: weekly-opportunity-deep-research\nAutomation memory: $CODEX_HOME/automations/weekly-opportunity-deep-research/memory.md",
          cwd: "/Users/example/life",
          updatedAt: 1769800000,
          status: { type: "notLoaded" as const },
        },
        {
          id: "ordinary-old-life-chat",
          name: "Old life chat",
          preview: "Not an automation",
          cwd: "/Users/example/life",
          updatedAt: 1769800000,
          status: { type: "notLoaded" as const },
        },
      ],
      nowMs,
      ["/Users/example/life"],
      {
        officeVisibility: {
          recentThreadWindowMinutes: 5,
          alwaysShowHeartbeatThreads: true,
          showAutomationThreadsAsHeartbeat: true,
        },
      },
    );

    expect(company.projects).toEqual([
      expect.objectContaining({
        id: "codex-proj-users-example-life",
        name: "life",
      }),
    ]);
    expect(company.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentId: "codex-thread:notion-fields",
          projectId: "codex-proj-users-example-life",
        }),
        expect.objectContaining({
          agentId: "codex-thread:weekly-strategy",
          projectId: "codex-proj-users-example-life",
        }),
      ]),
    );
    expect(company.agents.some((agent) => agent.agentId === "codex-thread:ordinary-old-life-chat")).toBe(
      false,
    );
  });

  it("keeps pinned Codex manager threads visible even when inactive", () => {
    const nowMs = 1770000000 * 1000;
    const company = toCodexCompanyModel(
      [
        {
          id: "old-manager",
          preview: "Long-running planning thread",
          cwd: "/workspace/farplane-ui",
          updatedAt: 1769980000,
        },
      ],
      nowMs,
      ["/workspace/farplane-ui"],
      {
        projectManagers: [
          {
            projectId: "codex-proj-workspace-farplane-ui",
            threadId: "old-manager",
          },
        ],
      },
    );

    expect(company.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentId: "codex-thread:old-manager",
          projectId: "codex-proj-workspace-farplane-ui",
          role: "pm",
        }),
      ]),
    );
  });

  it("prefers Codex UI project roots over stale trusted config projects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/codex/app-server/health")) {
          return new Response(
            JSON.stringify({ ok: true, configured: true, transport: "websocket" }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        if (url.endsWith("/codex/app-server/rpc")) {
          const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
          if (body.method === "thread/list") {
            return new Response(
              JSON.stringify({
                ok: true,
                result: {
                  data: [
                    {
                      id: "recent-farplane",
                      preview: "Recent Farplane work",
                      cwd: "/workspace/farplane",
                      updatedAt: 1770000000,
                      status: { type: "active" },
                    },
                    {
                      id: "recent-stale",
                      preview: "Recent stale project work",
                      cwd: "/workspace/codexter",
                      updatedAt: 1770000000,
                      status: { type: "active" },
                    },
                  ],
                },
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (body.method === "config/read") {
            return new Response(
              JSON.stringify({
                ok: true,
                result: {
                  config: {
                    projects: {
                      "/workspace/codexter": {},
                      "/workspace/shellcorp": {},
                    },
                  },
                },
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
        }
        if (url.endsWith("/farplane/codex-ui-state")) {
          return new Response(
            JSON.stringify({
              savedWorkspaceRoots: ["/workspace/farplane", "/workspace/life"],
              pinnedProjectIds: ["/workspace/farplane"],
              projectOrder: ["/workspace/farplane"],
              pinnedThreadIds: ["pinned-life-manager"],
              projectlessThreadIds: ["recent-stale"],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        if (url.endsWith("/farplane/projects/read-model")) {
          return new Response(
            JSON.stringify({
              generatedAt: 1770000000 * 1000,
              ticketTasks: [],
              projectManagers: [],
              officeVisibility: {
                recentThreadWindowMinutes: 180,
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({}), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    const adapter = new CodexRuntimeAdapter("", "http://state");
    const office = await adapter.getUnifiedOfficeModel();

    expect(office.company.projects.map((project) => project.name)).toEqual([
      "farplane",
      "life",
      "Misc",
    ]);
    expect(office.company.projects.some((project) => project.name === "codexter")).toBe(false);
    expect(office.company.projects.some((project) => project.name === "shellcorp")).toBe(false);
    expect(office.company.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentId: "codex-thread:recent-farplane",
          projectId: "codex-proj-workspace-farplane",
        }),
        expect.objectContaining({
          agentId: "codex-thread:recent-stale",
          projectId: "codex-proj-misc",
        }),
      ]),
    );
  });

  it("maps ticket-folder read model tasks onto the Codex company board", () => {
    const company = toCodexCompanyModel([], 1770000000 * 1000, ["/workspace/farplane-ui"], {
      ticketTasks: [
        {
          id: "ticket:codex-proj-workspace-farplane-ui:TASK-1",
          projectId: "codex-proj-workspace-farplane-ui",
          title: "Sync tickets into Kanban",
          status: "review",
          priority: "high",
          artefactPath: "tickets/TASK-1/ticket.md",
          updatedAt: 1770000000,
        },
      ],
    });

    expect(company.tasks).toEqual([
      expect.objectContaining({
        id: "ticket:codex-proj-workspace-farplane-ui:TASK-1",
        projectId: "codex-proj-workspace-farplane-ui",
        title: "Sync tickets into Kanban",
        status: "review",
        priority: "high",
        provider: "internal",
        artefactPath: "tickets/TASK-1/ticket.md",
      }),
    ]);
  });
});
