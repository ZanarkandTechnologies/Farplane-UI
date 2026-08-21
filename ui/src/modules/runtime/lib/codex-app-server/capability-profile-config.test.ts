import { describe, expect, it } from "vitest";
import { compileCapabilityProfileConfig } from "./capability-profile-config";

describe("compileCapabilityProfileConfig", () => {
  it("denies every live capability that is not explicitly allowed", () => {
    expect(
      compileCapabilityProfileConfig(
        { skill_ids: ["research"], mcp_server_ids: ["Ref"] },
        {
          skillIds: ["openai-docs", "research", "imagegen"],
          mcpServerIds: ["Ref", "notion"],
        },
      ),
    ).toEqual({
      "skills.config": [
        { name: "imagegen", enabled: false },
        { name: "openai-docs", enabled: false },
        { name: "research", enabled: true },
      ],
      "mcp_servers.Ref.enabled": true,
      "mcp_servers.notion.enabled": false,
    });
  });

  it("fails closed when a portable profile references unavailable runtime IDs", () => {
    expect(() =>
      compileCapabilityProfileConfig(
        { skill_ids: ["missing-skill"], mcp_server_ids: ["missing-mcp"] },
        { skillIds: ["research"], mcpServerIds: ["Ref"] },
      ),
    ).toThrow(
      "capability_profile_runtime_ids_unavailable:skills=missing-skill;mcp_servers=missing-mcp",
    );
  });
});
