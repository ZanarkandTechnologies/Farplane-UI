import type {
  CodexConfigReadResponse,
  CodexRpcBridgeResponse,
  CodexThreadListResponse,
  CodexThreadReadResponse,
  CodexThreadStartResponse,
  CodexTurnStartResponse,
  CodexProjectReadModelResponse,
  CodexOfficeVisibilityConfig,
  CodexProjectPmConfig,
  CodexUiStateResponse,
  CodexAppServerHealthResponse,
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

  async readHealth(): Promise<CodexAppServerHealthResponse> {
    try {
      const response = await this.fetchImpl(`${this.stateUrl}/codex/app-server/health`);
      if (!response.ok) {
        return { ok: false, configured: false, error: `codex_app_server_health_failed:${response.status}` };
      }
      return (await response.json()) as CodexAppServerHealthResponse;
    } catch {
      return { ok: false, configured: false, error: "codex_app_server_health_unreachable" };
    }
  }

  async readConfig(): Promise<CodexConfigReadResponse> {
    return this.request<CodexConfigReadResponse>("config/read");
  }

  async readUiState(): Promise<CodexUiStateResponse> {
    const response = await this.fetchImpl(`${this.stateUrl}/farplane/codex-ui-state`);
    if (!response.ok) {
      throw new Error(`farplane_codex_ui_state_failed:${response.status}`);
    }
    return (await response.json()) as CodexUiStateResponse;
  }

  async readProjectModel(
    projects: Array<{ projectId: string; projectPath: string }>,
  ): Promise<CodexProjectReadModelResponse> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.stateUrl}/farplane/projects/read-model`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projects }),
      });
    } catch {
      throw new Error("farplane_project_read_model_unreachable");
    }
    if (!response.ok) {
      throw new Error(`farplane_project_read_model_failed:${response.status}`);
    }
    return (await response.json()) as CodexProjectReadModelResponse;
  }

  async readOfficeVisibilityConfig(): Promise<CodexOfficeVisibilityConfig> {
    const response = await this.fetchImpl(`${this.stateUrl}/farplane/codex-office`);
    if (!response.ok) {
      throw new Error(`farplane_codex_office_config_failed:${response.status}`);
    }
    const payload = (await response.json()) as { config?: CodexOfficeVisibilityConfig };
    return payload.config ?? {};
  }

  async saveOfficeVisibilityConfig(
    config: CodexOfficeVisibilityConfig,
  ): Promise<CodexOfficeVisibilityConfig> {
    const response = await this.fetchImpl(`${this.stateUrl}/farplane/codex-office`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ config }),
    });
    if (!response.ok) {
      throw new Error(`farplane_codex_office_config_save_failed:${response.status}`);
    }
    const payload = (await response.json()) as {
      ok?: boolean;
      config?: CodexOfficeVisibilityConfig;
      error?: string;
    };
    if (payload.ok === false) {
      throw new Error(payload.error ?? "farplane_codex_office_config_save_failed");
    }
    return payload.config ?? config;
  }

  async readProjectPmConfig(projectPath: string): Promise<CodexProjectPmConfig | null> {
    const params = new URLSearchParams({ projectPath });
    const response = await this.fetchImpl(`${this.stateUrl}/farplane/project-pm?${params}`);
    if (!response.ok) {
      throw new Error(`farplane_project_pm_config_failed:${response.status}`);
    }
    const payload = (await response.json()) as { exists?: boolean; pm?: CodexProjectPmConfig };
    return payload.exists === false ? null : (payload.pm ?? null);
  }

  async saveProjectPmConfig(
    projectPath: string,
    pm: CodexProjectPmConfig,
  ): Promise<CodexProjectPmConfig> {
    const response = await this.fetchImpl(`${this.stateUrl}/farplane/project-pm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectPath, pm }),
    });
    if (!response.ok) {
      throw new Error(`farplane_project_pm_config_save_failed:${response.status}`);
    }
    const payload = (await response.json()) as {
      ok?: boolean;
      pm?: CodexProjectPmConfig;
      error?: string;
    };
    if (payload.ok === false) {
      throw new Error(payload.error ?? "farplane_project_pm_config_save_failed");
    }
    return payload.pm ?? pm;
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
