"use client";

/**
 * OPENCLAW RUNTIME ADAPTER
 * ========================
 * Optional Farplane UI adapter for persistent agents, workspaces, channel
 * routing, scheduler state, and OpenClaw gateway operations.
 */

import { OpenClawAdapter } from "@/lib/openclaw-adapter";
import type { RuntimeAdapterCapabilities } from "./contract";

const OPENCLAW_CAPABILITIES: RuntimeAdapterCapabilities = {
  persistentAgents: true,
  agentConfigWrite: true,
  agentWorkspaceFiles: true,
  agentSkillRuntimeControls: true,
  toolPolicy: true,
  channels: true,
  scheduler: true,
  sessionMessaging: true,
  teamAgentProvisioning: true,
  threadListing: true,
  threadRead: true,
  promptSend: true,
  liveEvents: true,
};

export class OpenClawRuntimeAdapter extends OpenClawAdapter {
  readonly runtimeKind = "openclaw" as const;
  readonly runtimeLabel = "OpenClaw";
  readonly capabilities = OPENCLAW_CAPABILITIES;
}
