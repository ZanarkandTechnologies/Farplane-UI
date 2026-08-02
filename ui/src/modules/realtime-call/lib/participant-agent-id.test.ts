import { describe, expect, it } from "vitest";
import { participantAgentId } from "./participant-agent-id";

describe("participantAgentId", () => {
  it("binds a per-job LiveKit participant through its stable Farplane attribute", () => {
    expect(
      participantAgentId({
        attributes: { "farplane.agentId": " product-lead " },
      }),
    ).toBe("product-lead");
  });

  it("does not guess from a missing participant attribute", () => {
    expect(participantAgentId({ attributes: {} })).toBeNull();
  });
});
