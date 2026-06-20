export type CodexSpawnInput = {
  stateBase: string;
  cwd: string;
  threadName: string;
  prompt: string;
  fetchImpl?: typeof fetch;
};

export type CodexSpawnResult = {
  threadId: string;
  turnId?: string;
};

export async function spawnCodexThread(input: CodexSpawnInput): Promise<CodexSpawnResult> {
  const rpc = async <T>(method: string, params: Record<string, unknown>): Promise<T> => {
    const response = await (input.fetchImpl ?? fetch)(`${input.stateBase.replace(/\/+$/, "")}/codex/app-server/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method, params }),
    });
    const payload = (await response.json()) as { ok?: boolean; result?: T; error?: string };
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error ?? `codex_rpc_failed:${method}`);
    }
    return payload.result as T;
  };

  const started = await rpc<{ thread?: { id?: string } }>("thread/start", {
    cwd: input.cwd,
  });
  const threadId = started.thread?.id;
  if (!threadId) throw new Error("codex_thread_start_missing_thread_id");

  const turn = await rpc<{ turn?: { id?: string } }>("turn/start", {
    threadId,
    input: [
      {
        type: "text",
        text: `Thread name: ${input.threadName}\n\n${input.prompt}`,
        text_elements: [],
      },
    ],
  });

  return { threadId, turnId: turn.turn?.id };
}
