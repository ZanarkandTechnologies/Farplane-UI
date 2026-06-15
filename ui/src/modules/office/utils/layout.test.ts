import { describe, expect, it } from "vitest";

import {
  MAX_GRID_DESKS_PER_TEAM,
  ROUND_TEAM_TABLE_MIN_STATIONS,
  getClusterOccupancyFootprint,
  getEmployeePositionAtRoundTableStation,
  shouldUseRoundTeamTable,
  solveRoundTeamTableLayout,
} from "./layout";

describe("office cluster layout", () => {
  it("switches team clusters to round-table topology at six stations", () => {
    expect(shouldUseRoundTeamTable(MAX_GRID_DESKS_PER_TEAM)).toBe(false);
    expect(shouldUseRoundTeamTable(ROUND_TEAM_TABLE_MIN_STATIONS)).toBe(true);
  });

  it("distributes round-table stations evenly around the circle", () => {
    const layout = solveRoundTeamTableLayout(8);

    expect(layout.stations).toHaveLength(8);
    expect(layout.stations[0]).toMatchObject({ x: 0, z: layout.stationRadius, yaw: 0 });
    expect(layout.stations[2]?.x).toBeCloseTo(layout.stationRadius);
    expect(layout.stations[2]?.z).toBeCloseTo(0);
    expect(layout.stations[4]?.x).toBeCloseTo(0);
    expect(layout.stations[4]?.z).toBeCloseTo(-layout.stationRadius);
  });

  it("keeps large-team occupancy compact instead of growing as a desk row", () => {
    const seven = getClusterOccupancyFootprint(7);
    const twelve = getClusterOccupancyFootprint(12);

    expect(seven.width).toBeCloseTo(seven.depth);
    expect(twelve.width).toBeCloseTo(twelve.depth);
    expect(twelve.width).toBeLessThan(6);
  });

  it("places round-table employees outside their monitor station", () => {
    const layout = solveRoundTeamTableLayout(7);
    const station = layout.stations[0];
    const employeePosition = getEmployeePositionAtRoundTableStation(station);

    expect(employeePosition[0]).toBeCloseTo(0);
    expect(employeePosition[2]).toBeGreaterThan(station.z);
  });
});
