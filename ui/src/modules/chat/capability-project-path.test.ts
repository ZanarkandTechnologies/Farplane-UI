import { describe, expect, it } from "vitest";
import { resolveChatCapabilityProjectPath } from "./capability-project-path";

const projects = [
  { projectId: "acme", projectPath: "/workspace/acme" },
  { projectId: "nova", projectPath: "/workspace/nova" },
];

describe("resolveChatCapabilityProjectPath", () => {
  it("uses the project bound to a room-host conversation", () => {
    expect(
      resolveChatCapabilityProjectPath({
        threadId: "room-host:research:acme",
        threads: [
          {
            _id: "room-host:research:acme",
            conversationKey: { projectId: "acme" },
          },
        ],
        projects,
      }),
    ).toBe("/workspace/acme");
  });

  it("falls back to the selected company agent's project", () => {
    expect(
      resolveChatCapabilityProjectPath({
        threadId: "dm-pm",
        threads: [{ _id: "dm-pm" }],
        selectedAgentProjectId: "nova",
        projects,
      }),
    ).toBe("/workspace/nova");
  });
});
