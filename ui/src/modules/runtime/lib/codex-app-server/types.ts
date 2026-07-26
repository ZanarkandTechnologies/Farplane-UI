import type { CodexThreadGoalMetadata } from "../openclaw/types.js";

export type CodexJson =
  | null
  | boolean
  | number
  | string
  | CodexJson[]
  | { [key: string]: CodexJson };

export type CodexThreadStatus =
  | { type: "notLoaded" }
  | { type: "idle" }
  | { type: "systemError" }
  | { type: "active"; activeFlags?: unknown[] };

export type CodexThreadItem =
  | { type: "userMessage"; id: string; content?: Array<{ type?: string; text?: string }> }
  | { type: "agentMessage"; id: string; text?: string; phase?: string | null }
  | { type: "plan"; id: string; text?: string }
  | { type: "reasoning"; id: string; summary?: string[]; content?: string[] }
  | {
      type: "commandExecution";
      id: string;
      command?: string;
      cwd?: string;
      status?: string;
      aggregatedOutput?: string | null;
      exitCode?: number | null;
    }
  | {
      type: "mcpToolCall" | "dynamicToolCall";
      id: string;
      server?: string;
      namespace?: string | null;
      tool?: string;
      status?: string;
      arguments?: CodexJson;
      result?: CodexJson | null;
      error?: unknown;
      success?: boolean | null;
    }
  | { type: "fileChange"; id: string; status?: string; changes?: unknown[] }
  | { type: string; id?: string; [key: string]: unknown };

export type CodexTurn = {
  id: string;
  items?: CodexThreadItem[];
  status?: string;
  startedAt?: number | null;
  completedAt?: number | null;
  durationMs?: number | null;
  error?: unknown;
};

export type CodexThread = {
  id: string;
  sessionId?: string;
  parentThreadId?: string | null;
  preview?: string;
  modelProvider?: string;
  createdAt?: number;
  updatedAt?: number;
  status?: CodexThreadStatus;
  path?: string | null;
  cwd?: string;
  source?: unknown;
  agentNickname?: string | null;
  agentRole?: string | null;
  name?: string | null;
  goal?: CodexThreadGoalMetadata | null;
  turns?: CodexTurn[];
};

export type CodexThreadListResponse = {
  data?: CodexThread[];
  nextCursor?: string | null;
  backwardsCursor?: string | null;
};

export type CodexThreadReadResponse = {
  thread?: CodexThread;
};

export type CodexThreadStartResponse = {
  thread?: CodexThread;
};

export type CodexTurnStartResponse = {
  turn?: CodexTurn;
};

export type CodexConfigReadResponse = {
  config?: {
    projects?: Record<string, unknown>;
    [key: string]: unknown;
  };
  origins?: unknown;
};

export type CodexUiStateResponse = {
  savedWorkspaceRoots?: string[];
  activeWorkspaceRoots?: string[];
  projectOrder?: string[];
  pinnedProjectIds?: string[];
  pinnedThreadIds?: string[];
  projectlessThreadIds?: string[];
};

export type CodexProjectReadModelTask = {
  id: string;
  projectId: string;
  title: string;
  status: "todo" | "in_progress" | "review" | "blocked" | "done";
  ownerAgentId?: string;
  priority?: "low" | "medium" | "high";
  provider?: "internal" | "notion" | "vibe" | "linear";
  canonicalProvider?: "internal" | "notion" | "vibe" | "linear";
  providerUrl?: string;
  artefactPath?: string;
  syncState?: "healthy" | "pending" | "conflict" | "error";
  syncError?: string;
  frontMatter?: Record<string, string>;
  markdown?: string;
  notes?: string;
  approvalState?:
    | "draft"
    | "pending_review"
    | "approved"
    | "rejected"
    | "changes_requested"
    | "executed";
  linkedSessionKey?: string;
  createdAt?: number;
  dueAt?: number;
  updatedAt?: number;
};

export type CodexProjectManagerPin = {
  projectId?: string;
  projectPath?: string;
  threadId: string;
  label?: string;
};

export type CodexProjectPmThreads = {
  chats?: string[];
  automations?: string[];
};

export type CodexProjectPmConfig = {
  version?: 1;
  name?: string;
  role?: "founder_operator" | "pm" | "custom" | string;
  threads?: CodexProjectPmThreads | string[];
};

export type CodexProjectPmBinding = {
  projectId: string;
  projectPath: string;
  pm: CodexProjectPmConfig;
};

export type CodexOfficeVisibilityConfig = {
  recentThreadWindowMinutes?: number;
  alwaysShowHeartbeatThreads?: boolean;
  showAutomationThreadsAsHeartbeat?: boolean;
  ceoThreadId?: string;
  leadershipPins?: {
    ceoThreadId?: string;
    projectManagers?: CodexProjectManagerPin[];
  };
  projectManagers?: CodexProjectManagerPin[];
  heartbeatThreadIds?: string[];
  projectlessThreadIds?: string[];
  miscProjectName?: string;
  miscPathIncludes?: string[];
};

export type CodexProjectReadModelResponse = {
  generatedAt?: number;
  ticketTasks?: CodexProjectReadModelTask[];
  ticketReadIssues?: Array<{
    projectId?: string;
    ticketId?: string;
    artefactPath?: string;
    error?: string;
  }>;
  projectManagers?: CodexProjectManagerPin[];
  projectPms?: CodexProjectPmBinding[];
  officeVisibility?: CodexOfficeVisibilityConfig;
};

export type CodexRpcBridgeResponse<T> = { ok: true; result: T } | { ok: false; error?: string };

export type CodexAppServerHealthResponse = {
  ok: boolean;
  configured?: boolean;
  transport?: string;
  error?: string;
};
