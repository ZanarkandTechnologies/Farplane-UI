import { describe, expect, it } from "vitest";
import { isAgentAddressed } from "./addressing.js";

const metadata = {
  projectPath: "/project",
  agent: {
    agentId: "maya",
    name: "Maya Chen",
    voice: { provider: "livekit-inference", model: "cartesia/sonic-3", voiceId: "maya" },
  },
  groupSize: 3,
  isPrimary: true,
  aliases: ["Maya", "maya"],
};

describe("multi-agent response routing", () => {
  it("responds when its configured name is called", () => {
    expect(isAgentAddressed("Maya, can you review this?", metadata)).toBe(true);
  });

  it("stays silent when a different employee is addressed", () => {
    expect(isAgentAddressed("Ken, what is your take?", metadata)).toBe(false);
    expect(isAgentAddressed("What does everyone think?", metadata)).toBe(false);
    expect(isAgentAddressed("Team, what is your take?", metadata)).toBe(false);
  });

  it("always responds in a one-to-one call", () => {
    expect(isAgentAddressed("What do you think?", { ...metadata, groupSize: 1 })).toBe(true);
  });
});
