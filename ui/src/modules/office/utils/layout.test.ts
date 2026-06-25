import { describe, expect, it } from "vitest";

import {
  MAX_GRID_DESKS_PER_TEAM,
  ROUND_TEAM_TABLE_DESIGN_MAX_STATIONS,
  ROUND_TEAM_TABLE_MIN_STATIONS,
  getClusterOccupancyFootprint,
  getEmployeePositionAtRoundTableStation,
  resolveTeamStationLayout,
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
    expect(layout.radius).toBeGreaterThanOrEqual(1.95);
    expect(layout.stations[0]).toMatchObject({
      x: 0,
      z: layout.stationRadius,
      yaw: 0,
    });
    expect(layout.stations[2]?.x).toBeCloseTo(layout.stationRadius);
    expect(layout.stations[2]?.z).toBeCloseTo(0);
    expect(layout.stations[4]?.x).toBeCloseTo(0);
    expect(layout.stations[4]?.z).toBeCloseTo(-layout.stationRadius);
  });

  it("grows round-table occupancy up to the active-agent design cap", () => {
    const seven = getClusterOccupancyFootprint(7);
    const ten = getClusterOccupancyFootprint(
      ROUND_TEAM_TABLE_DESIGN_MAX_STATIONS,
    );

    expect(seven.width).toBeCloseTo(seven.depth);
    expect(ten.width).toBeCloseTo(ten.depth);
    expect(ten.width).toBeGreaterThan(seven.width);
  });

  it("keeps a minimum gap between neighboring monitor stations at the design cap", () => {
    const layout = solveRoundTeamTableLayout(
      ROUND_TEAM_TABLE_DESIGN_MAX_STATIONS,
    );
    const first = layout.stations[0];
    const second = layout.stations[1];
    const stationGap = Math.hypot(first.x - second.x, first.z - second.z);

    expect(stationGap).toBeGreaterThanOrEqual(0.82);
  });

  it("keeps stress layouts above ten seats bounded instead of expanding the room", () => {
    const ten = getClusterOccupancyFootprint(
      ROUND_TEAM_TABLE_DESIGN_MAX_STATIONS,
    );
    const twenty = getClusterOccupancyFootprint(20);
    const stressLayout = solveRoundTeamTableLayout(20);
    const designLayout = solveRoundTeamTableLayout(
      ROUND_TEAM_TABLE_DESIGN_MAX_STATIONS,
    );

    expect(stressLayout.stations).toHaveLength(20);
    expect(stressLayout.radius).toBeCloseTo(designLayout.radius);
    expect(twenty.width).toBeCloseTo(ten.width);
  });

  it("places round-table employees outside their monitor station", () => {
    const layout = solveRoundTeamTableLayout(7);
    const station = layout.stations[0];
    const employeePosition = getEmployeePositionAtRoundTableStation(station);

    expect(employeePosition[0]).toBeCloseTo(0);
    expect(employeePosition[2]).toBeGreaterThan(station.z);
  });

  it("uses employee count when resolving shared team station topology", () => {
    const layout = resolveTeamStationLayout({ deskCount: 1, employeeCount: 6 });

    expect(layout.stationCount).toBe(6);
    expect(layout.usesRoundTable).toBe(true);
    expect(layout.visibleGridDeskCount).toBe(0);
  });
});
