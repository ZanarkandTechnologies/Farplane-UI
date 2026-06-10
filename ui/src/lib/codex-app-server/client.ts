import type {
  CodexConfigReadResponse,
  CodexRpcBridgeResponse,
  CodexThreadListResponse,
  CodexThreadReadResponse,
  CodexThreadStartResponse,
  CodexTurnStartResponse,
} from "./types";

type FetchLike = typeof fetch;

export type CodexAppServerClientOptions = {
  stateUrl: string;
  fetchImpl?: FetchLike;
};

export class CodexAppServerClient {
  private readonly stateUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: CodexAppServerClientOptions) {
    this.stateUrl = options.stateUrl.replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async request<T>(method: string, params: unknown = {}): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.stateUrl}/codex/app-server/rpc`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method, params }),
      });
    } catch {
      throw new Error("codex_app_server_bridge_unreachable");
    }
    let payload: CodexRpcBridgeResponse<T>;
    try {
      payload = (await response.json()) as CodexRpcBridgeResponse<T>;
    } catch {
      throw new Error(`codex_app_server_bridge_bad_json:${response.status}`);
    }
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.ok === false ? payload.error ?? `codex_rpc_failed:${method}` : `codex_rpc_failed:${response.status}`);
    }
    return payload.result;
  }

  async listThreads(limit = 50): Promise<CodexThreadListResponse> {
    return this.request<CodexThreadListResponse>("thread/list", {
      limit,
      sortKey: "updated_at",
      sortDirection: "desc",
      archived: false,
    });
  }

  async readConfig(): Promise<CodexConfigReadResponse> {
    return this.request<CodexConfigReadResponse>("config/read");
  }

  async readThread(threadId: string): Promise<CodexThreadReadResponse> {
    return this.request<CodexThreadReadResponse>("thread/read", {
      threadId,
      includeTurns: true,
    });
  }

  async startThread(cwd?: string): Promise<CodexThreadStartResponse> {
    return this.request<CodexThreadStartResponse>("thread/start", {
      ...(cwd ? { cwd } : {}),
    });
  }

  async startTurn(threadId: string, message: string): Promise<CodexTurnStartResponse> {
    return this.request<CodexTurnStartResponse>("turn/start", {
      threadId,
      input: [{ type: "text", text: message, text_elements: [] }],
    });
  }

  async steerTurn(threadId: string, expectedTurnId: string, message: string): Promise<CodexTurnStartResponse> {
    return this.request<CodexTurnStartResponse>("turn/steer", {
      threadId,
      expectedTurnId,
      input: [{ type: "text", text: message, text_elements: [] }],
    });
  }
}

export function createCodexAppServerClient(options: CodexAppServerClientOptions): CodexAppServerClient {
  return new CodexAppServerClient(options);
}
