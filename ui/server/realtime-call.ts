/**
 * Server-side LiveKit room orchestration for project employee calls.
 * Inputs: a bounded browser request plus Doppler-injected LIVEKIT_* values.
 * Outputs: a short-lived operator token and one explicit dispatch per employee.
 * Side effects: creates LiveKit dispatches; credentials never enter browser payloads.
 */

import { randomUUID } from "node:crypto";
import { AccessToken, AgentDispatchClient } from "livekit-server-sdk";

export const FARPLANE_LIVEKIT_AGENT_NAME = "farplane-employee";
const MAX_CALL_AGENTS = 8;

export type RealtimeCallVoice = {
  provider: string;
  model: string;
  voiceId: string;
};

export type RealtimeCallAgent = {
  agentId: string;
  name: string;
  title?: string;
  background?: string;
  portraitUrl?: string;
  voice: RealtimeCallVoice;
  vision?: { mode: "off" | "turn_snapshot" };
};

export type RealtimeCallSessionInput = {
  projectPath: string;
  agents: RealtimeCallAgent[];
};

export type RealtimeCallSession = {
  ok: true;
  serverUrl: string;
  roomName: string;
  token: string;
  agentCount: number;
};

type LiveKitEnvironment = {
  serverUrl: string;
  apiHost: string;
  apiKey: string;
  apiSecret: string;
  agentName: string;
};

type DispatchApi = Pick<AgentDispatchClient, "createDispatch" | "deleteDispatch">;

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeLiveKitApiHost(serverUrl: string): string {
  const url = new URL(serverUrl);
  if (url.protocol === "ws:") url.protocol = "http:";
  if (url.protocol === "wss:") url.protocol = "https:";
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("livekit_url_must_use_ws_wss_http_or_https");
  }
  return url.toString().replace(/\/$/, "");
}

export function readLiveKitEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): LiveKitEnvironment {
  const serverUrl = cleanString(environment.LIVEKIT_URL, 2048);
  const apiKey = cleanString(environment.LIVEKIT_API_KEY, 512);
  const apiSecret = cleanString(environment.LIVEKIT_API_SECRET, 2048);
  if (!serverUrl || !apiKey || !apiSecret) throw new Error("livekit_not_configured_in_doppler");
  return {
    serverUrl,
    apiHost: normalizeLiveKitApiHost(serverUrl),
    apiKey,
    apiSecret,
    agentName:
      cleanString(environment.LIVEKIT_AGENT_NAME, 128) || FARPLANE_LIVEKIT_AGENT_NAME,
  };
}

function normalizeAgent(value: unknown): RealtimeCallAgent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const voiceRow =
    row.voice && typeof row.voice === "object" && !Array.isArray(row.voice)
      ? (row.voice as Record<string, unknown>)
      : {};
  const agentId = cleanString(row.agentId, 160);
  const name = cleanString(row.name, 120);
  const voice = {
    provider: cleanString(voiceRow.provider, 80),
    model: cleanString(voiceRow.model, 120),
    voiceId: cleanString(voiceRow.voiceId, 160),
  };
  if (!agentId || !name || !voice.model || !voice.voiceId) return null;
  const visionRow =
    row.vision && typeof row.vision === "object" && !Array.isArray(row.vision)
      ? (row.vision as Record<string, unknown>)
      : {};
  return {
    agentId,
    name,
    title: cleanString(row.title, 160) || undefined,
    background: cleanString(row.background, 4_000) || undefined,
    portraitUrl: cleanString(row.portraitUrl, 4_000) || undefined,
    voice,
    vision: { mode: visionRow.mode === "turn_snapshot" ? "turn_snapshot" : "off" },
  };
}

export function normalizeRealtimeCallSessionInput(value: unknown): RealtimeCallSessionInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("realtime_call_request_invalid");
  }
  const row = value as Record<string, unknown>;
  const projectPath = cleanString(row.projectPath, 4_000);
  const rawAgents = Array.isArray(row.agents) ? row.agents : [];
  if (!projectPath || !projectPath.startsWith("/")) throw new Error("project_path_required");
  if (rawAgents.length < 1 || rawAgents.length > MAX_CALL_AGENTS) {
    throw new Error("realtime_call_agent_count_invalid");
  }
  const agents = rawAgents.map(normalizeAgent);
  if (agents.some((agent) => agent === null)) throw new Error("realtime_call_agent_invalid");
  const normalizedAgents = agents as RealtimeCallAgent[];
  if (new Set(normalizedAgents.map((agent) => agent.agentId)).size !== normalizedAgents.length) {
    throw new Error("realtime_call_agent_duplicate");
  }
  return { projectPath, agents: normalizedAgents };
}

export async function createRealtimeCallSession(
  inputValue: unknown,
  options: {
    environment?: NodeJS.ProcessEnv;
    dispatchApi?: DispatchApi;
    uuid?: () => string;
  } = {},
): Promise<RealtimeCallSession> {
  const input = normalizeRealtimeCallSessionInput(inputValue);
  const config = readLiveKitEnvironment(options.environment);
  const uuid = options.uuid ?? randomUUID;
  const roomName = `farplane-${uuid()}`;
  const dispatchApi =
    options.dispatchApi ??
    new AgentDispatchClient(config.apiHost, config.apiKey, config.apiSecret);
  const createdDispatches: string[] = [];

  try {
    for (const [index, agent] of input.agents.entries()) {
      const dispatch = await dispatchApi.createDispatch(roomName, config.agentName, {
        metadata: JSON.stringify({
          projectPath: input.projectPath,
          agent,
          groupSize: input.agents.length,
          isPrimary: index === 0,
          aliases: [agent.name],
        }),
      });
      if (dispatch.id) createdDispatches.push(dispatch.id);
    }
  } catch (error) {
    await Promise.allSettled(
      createdDispatches.map((dispatchId) => dispatchApi.deleteDispatch(dispatchId, roomName)),
    );
    throw error;
  }

  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: `farplane-operator-${uuid()}`,
    name: "Farplane operator",
    ttl: "45m",
    metadata: JSON.stringify({ projectPath: input.projectPath }),
  });
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return {
    ok: true,
    serverUrl: config.serverUrl,
    roomName,
    token: await token.toJwt(),
    agentCount: input.agents.length,
  };
}
