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
} from "./runtime-adapters";
import { CodexAppServerClient } from "./codex-app-server";

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
      ],
      nowMs,
      [
        "/Users/example",
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
      "project-x",
      "sigmax",
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
          projectId: "codex-proj-users-example-project-x",
        }),
      ]),
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
});
