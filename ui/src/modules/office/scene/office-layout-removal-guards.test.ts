import { describe, expect, it } from "vitest";

import type { OfficeObjectSidecarModel } from "@/modules/runtime";
import type { OfficeObject, TeamData } from "../lib/types";

import {
  describeOfficeLayoutRemovalBlockers,
  formatOfficeLayoutRemovalBlockers,
  getNewOfficeLayoutRemovalBlockers,
  getOfficeLayoutRemovalBlockers,
  mergeOfficeObjectsWithPersistedPositions,
  mergeTeamsWithPersistedClusterPositions,
} from "./office-layout-removal-guards";

const fullLayout = {
  version: 1 as const,
  tileSize: 1 as const,
  tiles: [
    "0:0",
    "1:0",
    "2:0",
    "3:0",
    "4:0",
    "0:1",
    "1:1",
    "2:1",
    "3:1",
    "4:1",
    "0:2",
    "1:2",
    "2:2",
    "3:2",
    "4:2",
  ],
};

function makeOfficeObject(overrides: Partial<OfficeObject> = {}): OfficeObject {
  return {
    _id: "plant-1",
    companyId: "company-demo",
    meshType: "plant",
    position: [1, 0, 1],
    rotation: [0, 0, 0],
    ...overrides,
  };
}

function makePersistedObject(
  overrides: Partial<OfficeObjectSidecarModel> = {},
): OfficeObjectSidecarModel {
  return {
    id: "office-plant-1",
    identifier: "plant-1",
    meshType: "plant",
    position: [1, 0, 1],
    rotation: [0, 0, 0],
    metadata: {},
    ...overrides,
  };
}

function makeTeam(overrides: Partial<TeamData> = {}): TeamData {
  return {
    _id: "team-alpha",
    companyId: "company-demo",
    name: "Alpha",
    description: "Alpha team",
    clusterPosition: [2, 0, 1],
    employees: [],
    ...overrides,
  };
}

function layoutWithout(...removedTiles: string[]): typeof fullLayout {
  return {
    ...fullLayout,
    tiles: fullLayout.tiles.filter((tile) => !removedTiles.includes(tile)),
  };
}

describe("office layout removal guards", () => {
  it("prefers the latest persisted object position over stale provider state", () => {
    const providerObjects = [makeOfficeObject({ position: [0, 0, 0] })];
    const persistedObjects = [makePersistedObject({ position: [3, 0, 1] })];

    const effectiveObjects = mergeOfficeObjectsWithPersistedPositions(
      providerObjects,
      persistedObjects,
    );

    const removingOldTile = getOfficeLayoutRemovalBlockers({
      candidateLayout: layoutWithout("0:1"),
      officeObjects: effectiveObjects,
      teams: [],
      managementAnchor: [2, 0, 1],
    });

    expect(removingOldTile.isValid).toBe(true);

    const removingNewTile = getOfficeLayoutRemovalBlockers({
      candidateLayout: layoutWithout("3:1"),
      officeObjects: effectiveObjects,
      teams: [],
      managementAnchor: [2, 0, 1],
    });

    expect(removingNewTile.isValid).toBe(false);
    expect(removingNewTile.objectIds).toEqual(["plant-1"]);
  });

  it("updates team anchors from persisted cluster objects", () => {
    const teams = [makeTeam({ clusterPosition: [0, 0, 0] })];
    const persistedObjects = [
      makePersistedObject({
        id: "office-cluster-team-alpha",
        identifier: "cluster-team-alpha",
        meshType: "team-cluster",
        position: [2, 0, 1],
      }),
    ];

    const effectiveTeams = mergeTeamsWithPersistedClusterPositions(teams, persistedObjects);

    expect(effectiveTeams[0]?.clusterPosition).toEqual([2, 0, 1]);
  });

  it("formats blocker details for the builder error message", () => {
    expect(
      formatOfficeLayoutRemovalBlockers({
        objectIds: ["plant-1", "bookshelf-1"],
        teamIds: ["team-alpha", "team-beta"],
        keepsManagementArea: false,
      }),
    ).toBe("plant-1, bookshelf-1, team-alpha +2 more");
  });

  for (const { name, input, expected } of [
    {
      name: "describes blockers with readable object and team labels",
      input: {
        blockers: {
          objectIds: ["plant-1"],
          teamIds: ["team-alpha"],
          keepsManagementArea: false,
        },
        officeObjects: [makeOfficeObject()],
        teams: [makeTeam()],
        persistedObjects: [
          makePersistedObject({
            id: "plant-1",
            identifier: "plant-main",
          }),
        ],
      },
      expected: "plant-main, Team: Alpha, Management zone",
    },
    {
      name: "describes blocking team-cluster objects with the team name",
      input: {
        blockers: {
          objectIds: ["team-cluster-team-alpha"],
          teamIds: [],
          keepsManagementArea: true,
        },
        officeObjects: [
          makeOfficeObject({
            _id: "team-cluster-team-alpha",
            meshType: "team-cluster",
            position: [2, 0, 1],
            metadata: { teamId: "team-alpha" },
          }),
        ],
        teams: [makeTeam()],
        persistedObjects: [
          makePersistedObject({
            id: "team-cluster-team-alpha",
            identifier: "team-cluster-team-alpha",
            meshType: "team-cluster",
            position: [2, 0, 1],
            metadata: { teamId: "team-alpha" },
          }),
        ],
      },
      expected: "Team: Alpha",
    },
  ] as const) {
    it(name, () => {
      expect(describeOfficeLayoutRemovalBlockers(input)).toBe(expected);
    });
  }

  it("does not double-count a team when its blocking cluster object is already present", () => {
    const blockers = getOfficeLayoutRemovalBlockers({
      candidateLayout: layoutWithout("2:1"),
      officeObjects: [
        makeOfficeObject({
          _id: "team-cluster-team-alpha",
          meshType: "team-cluster",
          position: [2, 0, 1],
          metadata: { teamId: "team-alpha" },
        }),
      ],
      teams: [makeTeam()],
      managementAnchor: [4, 0, 1],
    });

    expect(blockers.objectIds).toEqual(["team-cluster-team-alpha"]);
    expect(blockers.teamIds).toEqual([]);
  });

  it("only reports blockers newly introduced by the candidate layout", () => {
    const baseline = {
      objectIds: ["team-cluster-team-alpha"],
      teamIds: [],
      keepsManagementArea: false,
      isValid: false,
    };
    const candidate = {
      objectIds: ["team-cluster-team-alpha", "plant-1"],
      teamIds: ["team-beta"],
      keepsManagementArea: false,
      isValid: false,
    };

    expect(
      getNewOfficeLayoutRemovalBlockers({
        baseline,
        candidate,
      }),
    ).toEqual({
      objectIds: ["plant-1"],
      teamIds: ["team-beta"],
      keepsManagementArea: true,
      isValid: false,
    });
  });

  it("does not block removal when the management zone was already invalid before the stroke", () => {
    expect(
      getNewOfficeLayoutRemovalBlockers({
        baseline: {
          objectIds: ["team-cluster-team-alpha"],
          teamIds: [],
          keepsManagementArea: false,
          isValid: false,
        },
        candidate: {
          objectIds: ["team-cluster-team-alpha"],
          teamIds: [],
          keepsManagementArea: false,
          isValid: false,
        },
      }),
    ).toEqual({
      objectIds: [],
      teamIds: [],
      keepsManagementArea: true,
      isValid: true,
    });
  });
});
