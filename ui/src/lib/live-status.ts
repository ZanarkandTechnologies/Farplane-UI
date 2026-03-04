import type { AgentLiveStatus } from "./openclaw-types";

export function coerceLiveState(value: string): AgentLiveStatus["state"] {
  if (
    value === "running" ||
    value === "ok" ||
    value === "no_work" ||
    value === "error" ||
    value === "idle" ||
    value === "planning" ||
    value === "executing" ||
    value === "blocked" ||
    value === "done"
  ) {
    return value;
  }
  return "idle";
}
