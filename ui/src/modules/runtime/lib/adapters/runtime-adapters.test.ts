import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CODEX_MAIN_AGENT_ID,
  CodexAppServerClient,
  CodexRuntimeAdapter,
  createOfficeRuntimeAdapter,
  createReadOnlyOfficeRuntimeAdapter,
  OpenClawRuntimeAdapter,
  READONLY_MODE_ERROR,
  resolveRuntimeAdapterKind,
  toCodexAgentCards,
  toCodexCompanyModel,
  toCodexLiveStatus,
  toCodexSessionRows,
  toCodexTimeline,
} from "../..";
import { mergeSavedTeamCharacterPolicies } from "./codex-runtime-adapter";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("runtime adapters", () => {
  it("preserves sidecar-owned team character policy in the Codex projection", () => {
    const projected = toCodexCompanyModel([], Date.now(), ["/workspace/farplane"]);
    const project = projected.projects[0];
    if (!project) throw new Error("expected projected project");
    const policy = {
      persistent: { renderer: "three-human" as const },
      ephemeral: { renderer: "three-human" as const },
      skillTransformations: {
        research: {
          character: { renderer: "sprite-sheet-2d" as const, petId: "mini-chua" },
          enterAnimation: "poof" as const,
        },
      },
    };
    const merged = mergeSavedTeamCharacterPolicies(projected, {
      ...projected,
      projects: [{ ...project, characterPolicy: policy }],
    });
    expect(merged.projects[0]?.characterPolicy).toEqual(policy);
  });

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

  it("blocks write methods in a read-only adapter without calling through", async () => {
    const adapter = createOfficeRuntimeAdapter({ kind: "codex", stateUrl: "http://state" });
    const saveOfficeObjects = vi.spyOn(adapter, "saveOfficeObjects");
    const saveOfficeSettings = vi.spyOn(adapter, "saveOfficeSettings");
    const saveOfficeKitState = vi.spyOn(adapter, "saveOfficeKitState");
    const sendMessage = vi.spyOn(adapter, "sendMessage");
    const upsertOfficeObject = vi.spyOn(adapter, "upsertOfficeObject");
    const readOnly = createReadOnlyOfficeRuntimeAdapter(adapter, true);

    await expect(
      readOnly.saveOfficeObjects([
        {
          id: "plant-1",
          identifier: "plant-1",
          meshType: "plant",
          position: [0, 0, 0],
        },
      ]),
    ).resolves.toEqual({
      ok: false,
      error: READONLY_MODE_ERROR,
      objects: [
        {
          id: "plant-1",
          identifier: "plant-1",
          meshType: "plant",
          position: [0, 0, 0],
        },
      ],
    });
    await expect(readOnly.saveOfficeSettings(await adapter.getOfficeSettings())).resolves.toEqual(
      expect.objectContaining({ ok: false, error: READONLY_MODE_ERROR }),
    );
    await expect(
      readOnly.saveOfficeKitState({
        expectedRevision: 3,
        expectedObjects: [],
        settings: await adapter.getOfficeSettings(),
        objects: [],
      }),
    ).resolves.toEqual({
      ok: false,
      error: READONLY_MODE_ERROR,
      status: "failed",
      revision: 3,
    });
    await expect(
      readOnly.sendMessage({ agentId: "main", sessionKey: "session", message: "hello" }),
    ).resolves.toEqual({ ok: false, error: READONLY_MODE_ERROR });
    await expect(
      readOnly.upsertOfficeObject(
        {
          id: "plant-2",
          identifier: "plant-2",
          meshType: "plant",
          position: [1, 0, 1],
        },
        { currentObjects: [] },
      ),
    ).resolves.toEqual({ ok: false, error: READONLY_MODE_ERROR, objects: [] });

    expect(readOnly.capabilities.promptSend).toBe(false);
    expect(readOnly.capabilities.teamAgentProvisioning).toBe(false);
    expect(saveOfficeObjects).not.toHaveBeenCalled();
    expect(saveOfficeSettings).not.toHaveBeenCalled();
    expect(saveOfficeKitState).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(upsertOfficeObject).not.toHaveBeenCalled();
  });

  it("shuffles office objects through the state bridge", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/farplane/office-objects/shuffle")) {
        return new Response(
          JSON.stringify({
            ok: true,
            movedCount: 2,
            placementViolationCount: 0,
            objects: [
              {
                id: "team-cluster-team-alpha",
                identifier: "team-cluster-team-alpha",
                meshType: "team-cluster",
                position: [7, 0, 8],
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ ok: false }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createOfficeRuntimeAdapter({ kind: "codex", stateUrl: "http://state" });
    const result = await adapter.shuffleOfficeObjects(
      [
        {
          _id: "team-cluster-team-alpha",
          meshType: "team-cluster",
          position: [0, 0, 0],
          rotation: [0, 0, 0],
        },
      ],
      { seed: "test-seed" },
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        movedCount: 2,
        placementViolationCount: 0,
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://state/farplane/office-objects/shuffle",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("test-seed"),
      }),
    );
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

  it("dedupes concurrent Codex bootstrap reads across office model and config snapshot", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/codex/app-server/health")) {
        return new Response(JSON.stringify({ ok: true, configured: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.endsWith("/codex/app-server/rpc")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
        if (body.method === "thread/list") {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return new Response(
            JSON.stringify({
              ok: true,
              result: {
                data: [
                  {
                    id: "thread-farplane",
                    preview: "Farplane work",
                    cwd: "/workspace/farplane",
                    updatedAt: 1770000000,
                    status: { type: "active" },
                  },
                ],
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ ok: false, error: "unexpected_rpc" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.endsWith("/farplane/codex-ui-state")) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return new Response(
          JSON.stringify({
            savedWorkspaceRoots: ["/workspace/farplane"],
            pinnedProjectIds: ["local-farplane-id"],
            projectOrder: ["local-farplane-id"],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.endsWith("/farplane/projects/read-model")) {
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({}), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new CodexRuntimeAdapter("", "http://state");
    await Promise.all([adapter.getUnifiedOfficeModel(), adapter.getConfigSnapshot()]);

    const rpcMethods = fetchMock.mock.calls
      .filter(([input]) => String(input).endsWith("/codex/app-server/rpc"))
      .map(([, init]) => JSON.parse(String(init?.body ?? "{}")).method);
    const uiStateReads = fetchMock.mock.calls.filter(([input]) =>
      String(input).endsWith("/farplane/codex-ui-state"),
    );

    expect(rpcMethods).toEqual(["thread/list"]);
    expect(uiStateReads).toHaveLength(1);
  });

  it("maps Codex threads into workers, sessions, and timelines", () => {
    const thread = {
      id: "thread-1",
      sessionId: "session-1",
      parentThreadId: "parent-thread",
      name: "App server mode",
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
        displayName: "App server mode",
        workspacePath: "/workspace/farplane-ui",
      }),
    );
    expect(toCodexSessionRows("codex-thread:thread-1", [thread])).toEqual([
      expect.objectContaining({
        agentId: "codex-thread:thread-1",
        sessionKey: "codex-thread:thread-1",
        parentThreadId: "parent-thread",
        peerLabel: "App server mode",
      }),
    ]);
    expect(
      toCodexSessionRows("codex-thread:delegated-thread", [
        {
          id: "delegated-thread",
          sessionId: "delegated-thread",
          name: "Verify thread lineage hook",
          preview:
            "<codex_delegation> <source_thread_id>parent-from-preview</source_thread_id> <input>Probe thread</input>",
          cwd: "/workspace/farplane-ui",
          updatedAt: 1770000000,
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        agentId: "codex-thread:delegated-thread",
        sessionKey: "codex-thread:delegated-thread",
        parentThreadId: "parent-from-preview",
      }),
    ]);
    expect(
      toCodexTimeline("codex-thread:thread-1", "codex-thread:thread-1", thread).events,
    ).toEqual([
      expect.objectContaining({ role: "user", text: "hello", type: "message" }),
      expect.objectContaining({ role: "assistant", text: "hi", type: "message" }),
      expect.objectContaining({ role: "tool", text: "$ npm test\npassed", type: "tool" }),
    ]);
  });

  it("keeps Farplane agent chat threads persistent without duplicating office workers", async () => {
    let namedThread: { id: string; name?: string; status?: { type: "idle" } } | null = null;
    let latestTurnId = "";
    const rpcMethods: Array<{ method?: string; params?: Record<string, unknown> }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/codex/app-server/health")) {
        return new Response(JSON.stringify({ ok: true, configured: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (!url.endsWith("/codex/app-server/rpc")) {
        return new Response(JSON.stringify({}), { status: 404 });
      }
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        method?: string;
        params?: Record<string, unknown>;
      };
      rpcMethods.push(body);
      if (body.method === "thread/list") {
        return new Response(JSON.stringify({ ok: true, result: { data: namedThread ? [namedThread] : [] } }));
      }
      if (body.method === "thread/start") {
        return new Response(
          JSON.stringify({ ok: true, result: { thread: { id: "ledger-thread", status: { type: "idle" } } } }),
        );
      }
      if (body.method === "thread/name/set") {
        namedThread = {
          id: "ledger-thread",
          name: String(body.params?.name ?? ""),
          status: { type: "idle" },
        };
        return new Response(JSON.stringify({ ok: true, result: {} }));
      }
      if (body.method === "thread/read") {
        return new Response(
          JSON.stringify({
            ok: true,
            result: {
              thread: namedThread
                ? {
                    ...namedThread,
                    turns: latestTurnId
                      ? [{ id: latestTurnId, status: "completed", items: [] }]
                      : [],
                  }
                : null,
            },
          }),
        );
      }
      if (body.method === "turn/start") {
        latestTurnId = "turn-ledger";
        return new Response(JSON.stringify({ ok: true, result: { turn: { id: "turn-ledger" } } }));
      }
      return new Response(JSON.stringify({ ok: false, error: "unexpected_rpc" }), { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new CodexRuntimeAdapter("", "http://state");
    const request = {
      agentId: "farplane-finance",
      sessionKey: CODEX_MAIN_AGENT_ID,
      message: "How much runway do we have?",
      metadata: {
        farplaneAgentProfile: {
          agentId: "farplane-finance",
          name: "Ledger",
          title: "Finance Director",
          background: "Protects runway and reviews spending.",
        },
      },
    };

    await expect(adapter.sendMessage(request)).resolves.toEqual({
      ok: true,
      eventId: "turn-ledger",
      sessionKey: "codex-thread:ledger-thread",
    });
    await expect(
      adapter.sendMessage({ ...request, sessionKey: "codex-thread:ledger-thread" }),
    ).resolves.toEqual(expect.objectContaining({ sessionKey: "codex-thread:ledger-thread" }));
    await expect(adapter.listSessions("farplane-finance")).resolves.toEqual([
      expect.objectContaining({
        agentId: "farplane-finance",
        sessionKey: "codex-thread:ledger-thread",
        peerLabel: "Chat with Ledger",
      }),
    ]);
    await expect(adapter.listAgents()).resolves.toEqual([
      expect.objectContaining({ agentId: CODEX_MAIN_AGENT_ID }),
    ]);

    expect(rpcMethods.filter((entry) => entry.method === "thread/start")).toHaveLength(1);
    expect(rpcMethods.filter((entry) => entry.method === "thread/name/set")).toHaveLength(1);
    expect(
      rpcMethods.find((entry) => entry.method === "thread/start")?.params?.developerInstructions,
    ).toContain("You are Ledger, the Finance Director");
    expect(namedThread?.name).toBe("Farplane Agent [farplane-finance] Ledger");
  });

  it("hides failed Farplane backing threads so the next message can recover", () => {
    expect(
      toCodexSessionRows("farplane-finance", [
        {
          id: "failed-ledger",
          name: "Farplane Agent [farplane-finance] Ledger",
          status: { type: "systemError" },
        },
        {
          id: "healthy-ledger",
          name: "Farplane Agent [farplane-finance] Ledger",
          status: { type: "idle" },
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        sessionKey: "codex-thread:healthy-ledger",
        peerLabel: "Chat with Ledger",
      }),
    ]);
  });

  it("does not use Codex thread preview as the office worker title", () => {
    expect(
      toCodexAgentCards([
        {
          id: "thread-with-last-message-preview",
          preview: "okay pls continue",
          cwd: "/workspace/farplane-ui",
        },
      ])[0],
    ).toEqual(
      expect.objectContaining({
        displayName: "farplane-ui",
      }),
    );
  });

  it("maps Codex thread status into loader-friendly live status", () => {
    expect(
      toCodexLiveStatus({
        id: "running-thread",
        preview: "Running work",
        updatedAt: 1770000000,
        status: {
          type: "active",
          activeFlags: ["Planning", { label: "Tool call" }],
        },
      }),
    ).toEqual(
      expect.objectContaining({
        agentId: "codex-thread:running-thread",
        sessionKey: "codex-thread:running-thread",
        state: "running",
        statusText: "Codex turn running.",
        updatedAt: 1770000000000,
        bubbles: [
          { id: "codex-thread-running", label: "Running", weight: 100 },
          { id: "codex-active-flag-0-planning", label: "Planning", weight: 90 },
          { id: "codex-active-flag-1-tool-call", label: "Tool call", weight: 89 },
        ],
      }),
    );

    expect(
      toCodexLiveStatus({
        id: "error-thread",
        preview: "Broken work",
        status: { type: "systemError" },
      }),
    ).toEqual(
      expect.objectContaining({
        state: "error",
        statusText: "Codex thread error.",
        bubbles: [{ id: "codex-thread-error", label: "Error", weight: 100 }],
      }),
    );

    expect(
      toCodexLiveStatus({
        id: "idle-thread",
        preview: "Idle work",
        status: { type: "idle" },
      }),
    ).toEqual(
      expect.objectContaining({
        state: "idle",
        statusText: "Codex thread idle.",
        bubbles: [],
      }),
    );

    expect(
      toCodexLiveStatus(
        {
          id: "recent-idle-thread",
          preview: "Just replied",
          updatedAt: 1770000100,
          status: { type: "idle" },
        },
        { nowMs: 1770000105_000 },
      ),
    ).toEqual(
      expect.objectContaining({
        state: "done",
        statusText: "Codex response ready.",
        updatedAt: 1770000100000,
        bubbles: [{ id: "codex-thread-update-ready", label: "Update ready", weight: 100 }],
      }),
    );

    expect(
      toCodexLiveStatus(
        {
          id: "not-loaded-running-thread",
          preview: "Still working",
          updatedAt: 1770000100,
          status: { type: "notLoaded" },
          turns: [{ id: "turn-1", status: "interrupted", startedAt: 1770000090 }],
        },
        { nowMs: 1770000105_000 },
      ),
    ).toEqual(
      expect.objectContaining({
        state: "running",
        statusText: "Codex turn running.",
        bubbles: [{ id: "codex-thread-running", label: "Running", weight: 100 }],
      }),
    );

    expect(
      toCodexLiveStatus(
        {
          id: "not-loaded-completed-thread",
          preview: "New reply",
          updatedAt: 1770000100,
          status: { type: "notLoaded" },
          turns: [{ id: "turn-1", status: "completed", completedAt: 1770000100 }],
        },
        { nowMs: 1770000105_000 },
      ),
    ).toEqual(
      expect.objectContaining({
        state: "done",
        statusText: "Codex response ready.",
        bubbles: [{ id: "codex-thread-update-ready", label: "Update ready", weight: 100 }],
      }),
    );

    expect(
      toCodexLiveStatus({
        id: "not-loaded-thread",
        preview: "Cold work",
        status: { type: "notLoaded" },
      }),
    ).toEqual(
      expect.objectContaining({
        state: "idle",
        statusText: "Codex thread not loaded yet.",
        bubbles: [{ id: "codex-thread-not-loaded", label: "Not loaded", weight: 50 }],
      }),
    );
  });

  it("gets Codex live status from thread/list without reading full transcripts", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/codex/app-server/health")) {
        return new Response(JSON.stringify({ ok: true, configured: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
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
                    id: "thread-running",
                    preview: "Running thread",
                    status: { type: "active", activeFlags: [] },
                  },
                ],
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ ok: false, error: "unexpected_rpc" }), {
          status: 500,
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

    await expect(adapter.getAgentsLiveStatus(["codex-thread:thread-running"])).resolves.toEqual({
      "codex-thread:thread-running": expect.objectContaining({
        agentId: "codex-thread:thread-running",
        state: "running",
        statusText: "Codex turn running.",
      }),
    });
    const rpcMethods = fetchMock.mock.calls
      .filter(([input]) => String(input).endsWith("/codex/app-server/rpc"))
      .map(([, init]) => JSON.parse(String(init?.body ?? "{}")).method);
    expect(rpcMethods).toEqual(["thread/list"]);
  });

  it("hydrates notLoaded Codex live status from thread/read for visible thread agents", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/codex/app-server/health")) {
        return new Response(JSON.stringify({ ok: true, configured: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.endsWith("/codex/app-server/rpc")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          method?: string;
          params?: { threadId?: string };
        };
        if (body.method === "thread/list") {
          return new Response(
            JSON.stringify({
              ok: true,
              result: {
                data: [
                  {
                    id: "thread-running",
                    preview: "Running thread",
                    updatedAt: nowSeconds,
                    status: { type: "notLoaded" },
                  },
                ],
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        if (body.method === "thread/read" && body.params?.threadId === "thread-running") {
          return new Response(
            JSON.stringify({
              ok: true,
              result: {
                thread: {
                  id: "thread-running",
                  preview: "Running thread",
                  updatedAt: nowSeconds,
                  status: { type: "notLoaded" },
                  turns: [{ id: "turn-1", status: "inProgress", startedAt: nowSeconds - 10 }],
                },
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ ok: false, error: "unexpected_rpc" }), {
          status: 500,
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

    await expect(adapter.getAgentsLiveStatus(["codex-thread:thread-running"])).resolves.toEqual({
      "codex-thread:thread-running": expect.objectContaining({
        agentId: "codex-thread:thread-running",
        state: "running",
        statusText: "Codex turn running.",
      }),
    });
    const rpcMethods = fetchMock.mock.calls
      .filter(([input]) => String(input).endsWith("/codex/app-server/rpc"))
      .map(([, init]) => JSON.parse(String(init?.body ?? "{}")).method);
    expect(rpcMethods).toEqual(["thread/list", "thread/read"]);
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
          id: "recent-console",
          preview: "Recent Console work",
          cwd: "/workspace/farplane-console",
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
        "/workspace/farplane-console-archive",
        "/workspace/farplane-console",
        "/workspace/no-threads",
      ],
    );

    expect(company.projects.map((project) => project.name)).toEqual([
      "example",
      "farplane-console",
      "farplane-console-archive",
      "farplane-ui",
      "no-threads",
      "Misc",
    ]);
    expect(company.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ agentId: CODEX_MAIN_AGENT_ID, role: "ceo" }),
        expect.objectContaining({
          agentId: "codex-thread:recent-farplane",
          projectId: "codex-proj-workspace-farplane-ui",
          presenceExpiresAt: 1770010800000,
        }),
        expect.objectContaining({
          agentId: "codex-thread:recent-console",
          projectId: "codex-proj-workspace-farplane-console",
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
    expect(
      company.projects.some((project) => project.name === "am-i-being-scammed-over-here"),
    ).toBe(false);
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
          presenceExpiresAt: undefined,
        }),
        expect.objectContaining({
          agentId: "codex-thread:status-active",
          projectId: "codex-proj-workspace-farplane-ui",
        }),
      ]),
    );
    expect(company.agents.some((agent) => agent.agentId === "codex-thread:old-hidden")).toBe(false);
  });

  it("keeps goal-backed Codex threads persistent after the recent-thread window expires", () => {
    const nowMs = 1770000000 * 1000;
    const goal = {
      threadId: "old-goal-thread",
      objective: "Keep improving the office until the goal view is proven.",
      status: "active" as const,
      tokenBudget: 200_000,
      tokensUsed: 12_500,
      timeUsedSeconds: 3_600,
      createdAt: 1769900000,
      updatedAt: 1769990000,
    };
    const thread = {
      id: "old-goal-thread",
      name: "Goal worker",
      cwd: "/workspace/farplane-ui",
      updatedAt: 1769900000,
      goal,
    };

    const company = toCodexCompanyModel([thread], nowMs, ["/workspace/farplane-ui"], {
      officeVisibility: { recentThreadWindowMinutes: 5 },
    });

    expect(company.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentId: "codex-thread:old-goal-thread",
          heartbeatProfileId: "hb-codex-goal-thread",
          presenceExpiresAt: undefined,
          runtimeMetadata: { codexThreadGoal: goal },
        }),
      ]),
    );
    expect(toCodexAgentCards([thread])[0]).toEqual(
      expect.objectContaining({ runtimeMetadata: { codexThreadGoal: goal } }),
    );
  });

  it("does not promote delegated child Codex threads into office workers unless pinned", () => {
    const nowMs = 1770000000 * 1000;
    const company = toCodexCompanyModel(
      [
        {
          id: "parent-thread",
          preview: "Parent worker",
          cwd: "/workspace/farplane-ui",
          updatedAt: 1769999990,
        },
        {
          id: "child-thread",
          parentThreadId: "parent-thread",
          preview: "Delegated review lane",
          cwd: "/workspace/farplane-ui",
          updatedAt: 1769999995,
        },
        {
          id: "delegation-envelope-thread",
          preview:
            "<codex_delegation> <source_thread_id>parent-thread</source_thread_id> <input>Review lane</input>",
          cwd: "/workspace/farplane-ui",
          updatedAt: 1769999995,
        },
        {
          id: "pinned-child-thread",
          parentThreadId: "parent-thread",
          preview: "Promoted delegated lane",
          cwd: "/workspace/farplane-ui",
          updatedAt: 1769999995,
        },
      ],
      nowMs,
      ["/workspace/farplane-ui"],
      {
        projectManagers: [
          {
            projectId: "codex-proj-workspace-farplane-ui",
            threadId: "pinned-child-thread",
          },
        ],
      },
    );

    expect(company.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ agentId: "codex-thread:parent-thread" }),
        expect.objectContaining({
          agentId: "codex-thread:pinned-child-thread",
          role: "pm",
        }),
      ]),
    );
    expect(company.agents.some((agent) => agent.agentId === "codex-thread:child-thread")).toBe(
      false,
    );
    expect(
      company.agents.some((agent) => agent.agentId === "codex-thread:delegation-envelope-thread"),
    ).toBe(false);
  });

  it("does not promote Farplane internal Codex helper threads into office workers", () => {
    const nowMs = 1770000000 * 1000;
    const company = toCodexCompanyModel(
      [
        {
          id: "operator-thread",
          name: "Implement visible task",
          preview: "please implement the office fix",
          cwd: "/workspace/farplane-ui",
          updatedAt: 1769999995,
        },
        {
          id: "file-summary-thread",
          name: "Summarize this project file change as one tiny employee status bubble l...",
          preview:
            "Summarize this project file change as one tiny employee status bubble label. File: docs/HISTORY.md Rules: Return 2 to 4 words only.",
          cwd: "/workspace/farplane-ui",
          updatedAt: 1769999995,
        },
        {
          id: "suggestion-thread",
          name: "# Overview Generate 0 to 3 hyperpersonalized suggestions for what this...",
          preview:
            "# Overview Generate 0 to 3 hyperpersonalized suggestions for what this user can do with Codex in this local project: /workspace/farplane-ui",
          cwd: "/workspace/farplane-ui",
          updatedAt: 1769999995,
        },
      ],
      nowMs,
      ["/workspace/farplane-ui"],
    );

    expect(company.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ agentId: "codex-thread:operator-thread" }),
      ]),
    );
    expect(
      company.agents.some((agent) => agent.agentId === "codex-thread:file-summary-thread"),
    ).toBe(false);
    expect(company.agents.some((agent) => agent.agentId === "codex-thread:suggestion-thread")).toBe(
      false,
    );
  });

  it("does not promote headless Codex exec eval runs into office workers", () => {
    const nowMs = 1770000000 * 1000;
    const company = toCodexCompanyModel(
      [
        {
          id: "operator-thread",
          name: "Implement visible task",
          preview: "please implement the office fix",
          cwd: "/workspace/farplane-ui",
          updatedAt: 1769999995,
        },
        {
          id: "eval-judge-thread",
          name: "Context: AGI Toy Shop is a clean-room toy app...",
          preview:
            "Context: AGI Toy Shop is a clean-room toy app. You are judging an agent answer for macness.",
          cwd: "/workspace/farplane-ui",
          updatedAt: 1769999995,
        },
        {
          id: "ephemeral-exec-thread",
          name: "Clean eval coverage",
          preview: "Run the eval and report the pass/fail result.",
          cwd: "/workspace/farplane-ui",
          updatedAt: 1769999995,
          source: { command: "codex exec", mode: "ephemeral", purpose: "evaluation" },
        },
        {
          id: "eval-runner-source-thread",
          name: "Goal advisor material goal packet",
          preview: "Context: AGI Toy Shop\n\nUser request:\nCreate a Goal Packet for this eval.",
          cwd: "/workspace/farplane-ui",
          updatedAt: 1769999995,
          source: {
            argv: [
              "codex",
              "exec",
              "--json",
              "-o",
              "/workspace/farplane-ui/.farplane/evals/runs/run/tasks/task/agent_answer.txt",
            ],
            runner: ".farplane/evals/run_evals.py",
          },
        },
        {
          id: "harness-judge-turn-thread",
          name: "Judge eval response",
          preview: "Evaluate task result.",
          cwd: "/workspace/farplane-ui",
          updatedAt: 1769999995,
          turns: [
            {
              id: "turn-judge",
              startedAt: 1769999994,
              items: [
                {
                  type: "userMessage",
                  id: "item-judge",
                  content: [
                    {
                      type: "input_text",
                      text:
                        "You are judging an agent answer for a harness eval.\n\n" +
                        'Task:\n{"reference_points":["Uses the right skill"]}',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      nowMs,
      ["/workspace/farplane-ui"],
    );

    expect(company.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ agentId: "codex-thread:operator-thread" }),
      ]),
    );
    expect(company.agents.some((agent) => agent.agentId === "codex-thread:eval-judge-thread")).toBe(
      false,
    );
    expect(
      company.agents.some((agent) => agent.agentId === "codex-thread:ephemeral-exec-thread"),
    ).toBe(false);
    expect(
      company.agents.some((agent) => agent.agentId === "codex-thread:eval-runner-source-thread"),
    ).toBe(false);
    expect(
      company.agents.some((agent) => agent.agentId === "codex-thread:harness-judge-turn-thread"),
    ).toBe(false);
  });

  it("keeps persistent automation heartbeats visible while scheduled automations age out", () => {
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
          id: "ticket-drainer",
          name: "Farplane ticket drainer",
          preview:
            "Automation: Farplane ticket drainer\nAutomation ID: farplane-ticket-update\nAutomation memory: $CODEX_HOME/automations/farplane-ticket-update/memory.md",
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
          agentId: "codex-thread:weekly-strategy",
          projectId: "codex-proj-users-example-life",
        }),
      ]),
    );
    expect(company.agents.some((agent) => agent.agentId === "codex-thread:notion-fields")).toBe(
      false,
    );
    expect(company.agents.some((agent) => agent.agentId === "codex-thread:ticket-drainer")).toBe(
      false,
    );
    expect(
      company.agents.some((agent) => agent.agentId === "codex-thread:ordinary-old-life-chat"),
    ).toBe(false);
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

  it("keeps a project-local Codex PM visible before child threads are pinned", () => {
    const company = toCodexCompanyModel([], 1770000000 * 1000, ["/workspace/farplane-ui"], {
      projectPms: [
        {
          projectId: "codex-proj-workspace-farplane-ui",
          projectPath: "/workspace/farplane-ui",
          pm: {
            version: 1,
            name: "Farplane UI PM",
            threads: { chats: [], automations: [] },
          },
        },
      ],
    });

    expect(company.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentId: "codex-pm:codex-proj-workspace-farplane-ui",
          projectId: "codex-proj-workspace-farplane-ui",
          role: "pm",
        }),
      ]),
    );
  });

  it("uses configured project PM names, groups PM children, and renders non-PM thread workers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/codex/app-server/health")) {
          return new Response(JSON.stringify({ ok: true, configured: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.endsWith("/farplane/codex-ui-state")) {
          return new Response(JSON.stringify({ savedWorkspaceRoots: ["/workspace/farplane-ui"] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.endsWith("/farplane/projects/read-model")) {
          return new Response(
            JSON.stringify({
              generatedAt: 1770000000 * 1000,
              projectPms: [
                {
                  projectId: "codex-proj-workspace-farplane-ui",
                  projectPath: "/workspace/farplane-ui",
                  pm: {
                    version: 1,
                    name: "Farplane UI PM",
                    threads: { automations: ["pulse-child"] },
                  },
                },
              ],
            }),
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
                      id: "pulse-child",
                      preview: "Heartbeat child",
                      cwd: "/workspace/farplane-ui",
                      updatedAt: Math.floor(Date.now() / 1000),
                      status: { type: "notLoaded" },
                    },
                    {
                      id: "outside-child",
                      preview: "Independent child",
                      cwd: "/workspace/farplane-ui",
                      updatedAt: Math.floor(Date.now() / 1000),
                      status: { type: "notLoaded" },
                    },
                  ],
                },
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
        }
        return new Response(JSON.stringify({}), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    const adapter = new CodexRuntimeAdapter("", "http://state");

    const office = await adapter.getUnifiedOfficeModel();

    expect(office.runtimeAgents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentId: "codex-pm:codex-proj-workspace-farplane-ui",
          displayName: "Farplane UI PM",
          runtimeMetadata: {
            codexProjectPm: {
              projectId: "codex-proj-workspace-farplane-ui",
              threadIds: ["pulse-child"],
            },
          },
        }),
        expect.objectContaining({
          agentId: "codex-thread:outside-child",
          displayName: "farplane-ui",
        }),
      ]),
    );
    expect(office.runtimeAgents).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentId: "codex-thread:pulse-child",
        }),
      ]),
    );
    expect(office.company.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentId: "codex-thread:outside-child",
          projectId: "codex-proj-workspace-farplane-ui",
          role: "builder",
        }),
      ]),
    );
    expect(office.company.agents).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentId: "codex-thread:pulse-child",
        }),
      ]),
    );
  });

  it("keeps thread workers when Codex thread listing is slower than generic bootstrap RPCs", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/codex/app-server/health")) {
          return new Response(JSON.stringify({ ok: true, configured: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.endsWith("/farplane/codex-ui-state")) {
          return new Response(JSON.stringify({ savedWorkspaceRoots: ["/workspace/farplane-ui"] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.endsWith("/farplane/projects/read-model")) {
          return new Response(JSON.stringify({ generatedAt: 1770000000 * 1000 }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.endsWith("/codex/app-server/rpc")) {
          const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
          if (body.method === "thread/list") {
            return await new Promise<Response>((resolve) => {
              setTimeout(() => {
                resolve(
                  new Response(
                    JSON.stringify({
                      ok: true,
                      result: {
                        data: [
                          {
                            id: "slow-worker",
                            preview: "Slow merged worker",
                            cwd: "/workspace/farplane-ui",
                            updatedAt: Math.floor(Date.now() / 1000),
                            status: { type: "notLoaded" },
                          },
                        ],
                      },
                    }),
                    { status: 200, headers: { "content-type": "application/json" } },
                  ),
                );
              }, 1700);
            });
          }
        }
        return new Response(JSON.stringify({}), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    const adapter = new CodexRuntimeAdapter("", "http://state");

    const officePromise = adapter.getUnifiedOfficeModel();
    await vi.advanceTimersByTimeAsync(1700);
    const office = await officePromise;

    expect(office.runtimeAgents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentId: "codex-thread:slow-worker",
          displayName: "farplane-ui",
        }),
      ]),
    );
    expect(office.company.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentId: "codex-thread:slow-worker",
          role: "builder",
        }),
      ]),
    );
  });

  it("labels the configured Codex CEO placeholder while app-server is disconnected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/codex/app-server/health")) {
          return new Response(JSON.stringify({ ok: false, configured: false }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.endsWith("/farplane/codex-ui-state")) {
          return new Response(JSON.stringify({ savedWorkspaceRoots: ["/workspace/farplane-ui"] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.endsWith("/farplane/projects/read-model")) {
          return new Response(
            JSON.stringify({
              generatedAt: 1770000000 * 1000,
              officeVisibility: {
                ceoThreadId: "missing-strategy-thread",
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

    expect(office.runtimeAgents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentId: "codex-thread:missing-strategy-thread",
          displayName: "Pinned CEO",
        }),
      ]),
    );
    expect(office.runtimeAgents.some((agent) => agent.agentId === CODEX_MAIN_AGENT_ID)).toBe(false);
  });

  it("assigns pinned Codex manager threads to the pinned project even after cwd drift", () => {
    const nowMs = 1770000000 * 1000;
    const company = toCodexCompanyModel(
      [
        {
          id: "wandering-manager",
          preview: "Cross-project planning thread",
          cwd: "/workspace/life",
          updatedAt: 1769980000,
        },
      ],
      nowMs,
      ["/workspace/farplane-ui", "/workspace/life"],
      {
        projectManagers: [
          {
            projectId: "codex-proj-workspace-farplane-ui",
            threadId: "wandering-manager",
          },
        ],
      },
    );

    expect(company.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentId: "codex-thread:wandering-manager",
          projectId: "codex-proj-workspace-farplane-ui",
          role: "pm",
        }),
      ]),
    );
  });

  it("lets an inactive pinned Codex CEO thread replace the synthetic Codex main CEO", () => {
    const nowMs = 1770000000 * 1000;
    const company = toCodexCompanyModel(
      [
        {
          id: "strategy-thread",
          preview: "Long-running strategy thread",
          cwd: "/workspace/farplane-ui",
          updatedAt: 1769900000,
        },
      ],
      nowMs,
      ["/workspace/farplane-ui"],
      {
        officeVisibility: {
          recentThreadWindowMinutes: 5,
          ceoThreadId: "strategy-thread",
        },
      },
    );

    expect(company.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentId: "codex-thread:strategy-thread",
          projectId: "codex-proj-workspace-farplane-ui",
          role: "ceo",
          isCeo: true,
        }),
      ]),
    );
    expect(company.agents.some((agent) => agent.agentId === CODEX_MAIN_AGENT_ID)).toBe(false);
  });

  it("keeps a configured Codex CEO pinned when the thread is disconnected", () => {
    const company = toCodexCompanyModel([], 1770000000 * 1000, ["/workspace/farplane-ui"], {
      officeVisibility: {
        ceoThreadId: "missing-strategy-thread",
      },
    });

    expect(company.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentId: "codex-thread:missing-strategy-thread",
          role: "ceo",
          isCeo: true,
        }),
      ]),
    );
    expect(company.agents.some((agent) => agent.agentId === CODEX_MAIN_AGENT_ID)).toBe(false);
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
                    {
                      id: "pinned-life-manager",
                      preview: "Old pinned app thread",
                      cwd: "/workspace/life",
                      updatedAt: 1769900000,
                      status: { type: "notLoaded" },
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
              pinnedProjectIds: ["local-farplane-id"],
              projectOrder: ["local-life-id", "local-farplane-id"],
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
    expect(office.company.projects.some((project) => project.name.startsWith("local-"))).toBe(
      false,
    );
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
    expect(
      office.company.agents.some((agent) => agent.agentId === "codex-thread:pinned-life-manager"),
    ).toBe(false);
  });

  it("maps ticket-folder read model tasks onto the Codex company board", () => {
    const company = toCodexCompanyModel([], 1770000000 * 1000, ["/workspace/farplane-ui"], {
      ticketTasks: [
        {
          id: "TASK-1",
          projectId: "codex-proj-workspace-farplane-ui",
          title: "Sync tickets into Kanban",
          status: "review",
          priority: "high",
          artefactPath: "tickets/TASK-1/ticket.md",
          markdown: "# TASK-1\n\n## Notes\n\nReview the filesystem projection.",
          frontMatter: { ticket_id: "TASK-1", status: "review" },
          notes: "Review the filesystem projection.",
          approvalState: "pending_review",
          updatedAt: 1770000000,
        },
      ],
    });

    expect(company.tasks).toEqual([
      expect.objectContaining({
        id: "TASK-1",
        projectId: "codex-proj-workspace-farplane-ui",
        title: "Sync tickets into Kanban",
        status: "review",
        priority: "high",
        provider: "internal",
        artefactPath: "tickets/TASK-1/ticket.md",
        notes: "Review the filesystem projection.",
        approvalState: "pending_review",
      }),
    ]);
  });
});
