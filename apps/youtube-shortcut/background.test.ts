import assert from "node:assert/strict";
import { before, test } from "node:test";

let messageListener:
  | ((
      request: unknown,
      sender: unknown,
      sendResponse: (response: unknown) => void,
    ) => boolean)
  | undefined;
type RuntimePort = {
  name: string;
  onMessage: { addListener(listener: (request: unknown) => void): void };
  postMessage(response: unknown): void;
};
let connectionListener: ((port: RuntimePort) => void) | undefined;

Object.assign(globalThis, {
  chrome: {
    runtime: {
      onMessage: {
        addListener(listener: typeof messageListener) {
          messageListener = listener;
        },
      },
      onConnect: {
        addListener(listener: typeof connectionListener) {
          connectionListener = listener;
        },
      },
    },
  },
});

let forwardRuntimeRequest: typeof import("./background.js").forwardRuntimeRequest;

before(async () => {
  ({ forwardRuntimeRequest } = await import("./background.js"));
});

test("health is relayed by the startup-safe background worker", async () => {
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "http://127.0.0.1:47893/health");
    assert.equal(init?.method, "POST");
    assert.equal((init?.headers as Record<string, string>)["x-farplane-client"], "youtube-shortcut");
    return new Response(
      JSON.stringify({
        ok: true,
        service: true,
        appServer: true,
        intelligestSkill: true,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  assert.deepEqual(await forwardRuntimeRequest({ type: "GET_LOCAL_HEALTH" }), {
    ok: true,
    service: true,
    appServer: true,
    intelligestSkill: true,
  });
});

test("projects are relayed without loading the analysis validator", async () => {
  globalThis.fetch = async (input) => {
    assert.equal(String(input), "http://127.0.0.1:47893/projects");
    return new Response(
      JSON.stringify({
        ok: true,
        projects: [{ id: "proj-vidgard", name: "Vidgard" }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  assert.deepEqual(
    await forwardRuntimeRequest({ type: "GET_FARPLANE_PROJECTS" }),
    { ok: true, projects: [{ id: "proj-vidgard", name: "Vidgard" }] },
  );
});

test("analysis forwards selected project and operator instruction", async () => {
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "http://127.0.0.1:47893/analyze-youtube");
    assert.deepEqual(JSON.parse(String(init?.body)), {
      videoId: "dQw4w9WgXcQ",
      title: "Claim?",
      channelId: "UCaaaaaaaaaaaaaaaaaaaaaa",
      reAnalyze: false,
      projectId: "proj-vidgard",
      instruction: "Focus on product positioning.",
    });
    return new Response(
      JSON.stringify({ ok: true, threadId: "thread-1", analysis: {} }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const response = await forwardRuntimeRequest({
    type: "ANALYZE_YOUTUBE",
    videoId: "dQw4w9WgXcQ",
    title: "Claim?",
    channelId: "UCaaaaaaaaaaaaaaaaaaaaaa",
    projectId: "proj-vidgard",
    instruction: "Focus on product positioning.",
  });
  assert.deepEqual(response, { ok: true, threadId: "thread-1", analysis: {} });
});

test("the listener keeps the message channel open until relay completion", async () => {
  assert.ok(messageListener);
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: true, jobs: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  const response = await new Promise<unknown>((resolve) => {
    const keptOpen = messageListener?.(
      { type: "GET_YOUTUBE_JOBS" },
      {},
      resolve,
    );
    assert.equal(keptOpen, true);
  });
  assert.deepEqual(response, { ok: true, jobs: [] });
});

test("the previous port transport remains usable until the extension reloads", async () => {
  assert.ok(connectionListener);
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: true, projects: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  const response = await new Promise<unknown>((resolve) => {
    let portMessageListener: ((request: unknown) => void) | undefined;
    connectionListener?.({
      name: "farplane-youtube",
      onMessage: {
        addListener(listener) {
          portMessageListener = listener;
        },
      },
      postMessage: resolve,
    });
    portMessageListener?.({ type: "GET_FARPLANE_PROJECTS" });
  });
  assert.deepEqual(response, { ok: true, projects: [] });
});
