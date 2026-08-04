import { describe, expect, it } from "vitest";
import { buildOperatingRooms } from "./operating-room-catalog";
import { buildRoomHostConversationKey, buildRoomHostEmployees } from "./room-hosts";

describe("operating room hosts", () => {
  it("projects exactly one stable deskless host at each final room anchor", () => {
    const objects = buildOperatingRooms().map((object, index) => ({
      ...object,
      position: [index * 7, 0, 5] as [number, number, number],
      rotation: [0, index % 2 === 0 ? 0 : Math.PI / 2, 0] as [number, number, number],
    }));
    const hosts = buildRoomHostEmployees({ officeObjects: objects, companyId: "company-test" });

    expect(hosts).toHaveLength(11);
    expect(new Set(hosts.map((host) => host._id)).size).toBe(11);
    expect(hosts.every((host) => host.deskId === undefined)).toBe(true);
    expect(hosts.every((host) => host.teamId === undefined)).toBe(true);
    expect(hosts.every((host) => host.wantsToWander === false)).toBe(true);
    expect(hosts.every((host) => host.presencePersistent === true)).toBe(true);
    expect(hosts[0]?.initialPosition).toEqual([0, 0, 6.15]);
    expect(hosts[1]?.initialPosition[0]).toBeCloseTo(5.85);
    expect(hosts[1]?.initialPosition[2]).toBeCloseTo(5);
  });

  it("does not invent a spatial host when a room has not been placed", () => {
    expect(buildRoomHostEmployees({ officeObjects: [] })).toEqual([]);
  });

  it("uses one office-scoped thread for office hosts", () => {
    expect(
      buildRoomHostConversationKey({
        hostAgentId: "farplane-harness",
        selectedProjectId: "project-a",
      }),
    ).toEqual({ hostAgentId: "farplane-harness", roomId: "harness", scopeKind: "office" });
  });

  it("isolates project hosts and refuses to guess an unselected project", () => {
    expect(
      buildRoomHostConversationKey({
        hostAgentId: "farplane-research",
        selectedProjectId: "project-a",
      }),
    ).toEqual({
      hostAgentId: "farplane-research",
      roomId: "research",
      scopeKind: "project",
      projectId: "project-a",
    });
    expect(
      buildRoomHostConversationKey({
        hostAgentId: "farplane-research",
        selectedProjectId: null,
      }),
    ).toBeNull();
  });
});
