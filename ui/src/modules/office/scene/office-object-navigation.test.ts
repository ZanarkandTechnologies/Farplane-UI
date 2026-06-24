import { describe, expect, it } from "vitest";

import type {
  DeskLayoutData,
  OfficeObject,
  TeamData,
} from "@/modules/office/lib/types";
import {
  buildNavigableOfficeObjectSignature,
  getNavigableOfficeObjects,
} from "./office-object-navigation";

function createTeam(overrides: Partial<TeamData> = {}): TeamData {
  return {
    _id: "team-farplane",
    name: "Farplane",
    description: "",
    employees: ["employee-1"],
    ...overrides,
  };
}

function createObject(overrides: Partial<OfficeObject> = {}): OfficeObject {
  return {
    _id: "object-1",
    meshType: "plant",
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    metadata: {},
    ...overrides,
  };
}

describe("office object navigation helpers", () => {
  it("counts only objects that render registered navigation obstacles", () => {
    const teamById = new Map([["team-farplane", createTeam()]]);
    const objects = [
      createObject({ _id: "plant-1", meshType: "plant" }),
      createObject({ _id: "wall-art-1", meshType: "wall-art" }),
      createObject({ _id: "unknown-1", meshType: "unknown-widget" }),
      createObject({
        _id: "cluster-1",
        meshType: "team-cluster",
        metadata: { teamId: "missing-team" },
      }),
      createObject({
        _id: "cluster-2",
        meshType: "team-cluster",
        metadata: { teamId: "team-farplane" },
      }),
    ];

    expect(
      getNavigableOfficeObjects({
        officeObjects: objects,
        teamById,
        enabled: true,
      }).map((object) => object._id),
    ).toEqual(["plant-1", "cluster-2"]);
  });

  it("changes the nav signature when team cluster geometry inputs change", () => {
    const cluster = createObject({
      _id: "cluster-1",
      meshType: "team-cluster",
      metadata: { teamId: "team-farplane" },
    });
    const desks: DeskLayoutData[] = [
      { id: "desk-1", deskIndex: 0, team: "Farplane" },
    ];
    const baseTeamById = new Map([["team-farplane", createTeam()]]);
    const largerTeamById = new Map([
      [
        "team-farplane",
        createTeam({
          employees: Array.from(
            { length: 5 },
            (_, index) => `employee-${index}`,
          ),
        }),
      ],
    ]);

    const baseSignature = buildNavigableOfficeObjectSignature({
      officeObjects: [cluster],
      teamById: baseTeamById,
      desksByTeamId: new Map([["team-farplane", desks]]),
    });
    const largerSignature = buildNavigableOfficeObjectSignature({
      officeObjects: [cluster],
      teamById: largerTeamById,
      desksByTeamId: new Map([["team-farplane", desks]]),
    });

    expect(largerSignature).not.toBe(baseSignature);
  });
});
