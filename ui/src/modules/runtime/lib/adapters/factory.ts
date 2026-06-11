import type { GatewayWsClient } from "../gateway/ws-client";
import { CodexRuntimeAdapter } from "./codex-runtime-adapter";
import type { OfficeRuntimeAdapter, RuntimeAdapterKind } from "./contract";
import { OpenClawRuntimeAdapter } from "./openclaw-runtime-adapter";

export function createOfficeRuntimeAdapter(input: {
  kind: RuntimeAdapterKind;
  stateUrl: string;
  wsClient?: GatewayWsClient;
}): OfficeRuntimeAdapter {
  if (input.kind === "openclaw") {
    return new OpenClawRuntimeAdapter("", input.stateUrl, input.wsClient);
  }
  return new CodexRuntimeAdapter("", input.stateUrl, input.wsClient);
}
