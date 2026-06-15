import { describe, expect, it } from "vitest";

import { getEmployeeIndicatorColor, resolveEmployeePresenceVisual } from "./presence-visuals";

describe("employee presence visuals", () => {
  it("ghosts ephemeral agents", () => {
    expect(resolveEmployeePresenceVisual({ presencePersistent: false })).toMatchObject({
      kind: "ephemeral",
      bodyOpacity: 0.5,
    });
  });

  it("marks staff or heartbeat agents as persistent", () => {
    expect(resolveEmployeePresenceVisual({ presencePersistent: true })).toMatchObject({
      kind: "persistent",
      bodyOpacity: 1,
    });
    expect(resolveEmployeePresenceVisual({ heartbeatState: "running" })).toMatchObject({
      kind: "persistent",
      auraColor: "#22d3ee",
    });
  });

  it("lets explicit ephemeral presence override heartbeat state", () => {
    expect(
      resolveEmployeePresenceVisual({
        presencePersistent: false,
        heartbeatState: "running",
      }),
    ).toMatchObject({ kind: "ephemeral" });
  });

  it("prefers activity colors over stable team colors for renderer indicators", () => {
    expect(getEmployeeIndicatorColor({ teamId: "team-alpha", activityState: "running" })).toBe(
      "#38BDF8",
    );
    expect(getEmployeeIndicatorColor({ teamId: "team-alpha" })).toBe(
      getEmployeeIndicatorColor({ teamId: "team-alpha" }),
    );
    expect(getEmployeeIndicatorColor({})).toBe("#00E676");
  });
});
