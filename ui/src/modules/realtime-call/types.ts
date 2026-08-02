export type AgentVisionMode = "off" | "turn_snapshot";

export interface ProjectAgentProfile {
  agentId: string;
  name?: string;
  title?: string;
  background?: string;
  portrait?: string;
  portraitUrl?: string;
  appearance?: {
    accent: string;
    skinTone: string;
    hairColor: string;
    eyebrows: "angled" | "arched" | "straight";
  };
  voice?: {
    provider: string;
    model: string;
    voiceId: string;
  };
  vision?: {
    mode: AgentVisionMode;
  };
  localOverride: true;
}

export interface AgentProfilesResponse {
  ok: boolean;
  exists: boolean;
  sourceRef?: string;
  profiles: Record<string, ProjectAgentProfile>;
  error?: string;
}

export interface RealtimeCallSession {
  serverUrl: string;
  token: string;
  roomName: string;
}

export interface RealtimeCallSessionResponse extends Partial<RealtimeCallSession> {
  ok: boolean;
  error?: string;
}
