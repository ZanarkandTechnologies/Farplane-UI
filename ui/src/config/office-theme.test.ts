import { describe, expect, it } from "vitest";
import {
  getOfficeLandmarkTheme,
  getOfficeTheme,
  OFFICE_LANDMARK_KINDS,
  OFFICE_LANDMARK_THEME,
} from "./office-theme";

describe("office theme", () => {
  it("owns the complete restrained activity-landmark palette", () => {
    const roleColors = new Set(Object.values(OFFICE_LANDMARK_THEME.roles));
    const resolvedColors = OFFICE_LANDMARK_KINDS.map(
      (kind) => getOfficeLandmarkTheme(kind).zoneColor,
    );

    expect(resolvedColors).toHaveLength(OFFICE_LANDMARK_KINDS.length);
    expect(new Set(resolvedColors)).toEqual(roleColors);
    expect(getOfficeTheme(false).landmarks).toBe(OFFICE_LANDMARK_THEME);
    expect(OFFICE_LANDMARK_THEME.presentation).toEqual({
      scale: 0.68,
      offsetZ: -0.1,
    });
    expect(OFFICE_LANDMARK_THEME.roleByKind).toEqual({
      gym: "creative",
      library: "knowledge",
      studio: "creative",
      planning: "knowledge",
      "qa-arcade": "systems",
      workshop: "creative",
      "skill-lab": "coordination",
      "organization-hall": "coordination",
      "finance-office": "knowledge",
      "resource-archive": "knowledge",
      "comms-hub": "communication",
      "telemetry-console": "systems",
      "thread-data-lab": "systems",
      "world-orb": "communication",
    });
  });

  it("keeps shared permanent materials neutral and warm", () => {
    expect(OFFICE_LANDMARK_THEME.materials).toEqual({
      darkMetal: "#34383a",
      lightMetal: "#a9a096",
      walnut: "#6f543e",
      darkWalnut: "#4f3a2c",
      warmPaper: "#d8cdba",
      stone: "#81786e",
      upholstery: "#746e67",
      inactiveScreen: "#4e625f",
    });
  });

  it("uses a neutral control-room environment instead of a sepia scene wash", () => {
    expect(getOfficeTheme(true).scene).toEqual({
      floor: "#30363d",
      walls: "#313740",
      background: "#0f1720",
    });
    expect(getOfficeTheme(true).lighting).toEqual({
      ambient: "#d8e1e8",
      directional: "#f5f7fa",
      point: "#a7bdd0",
    });
  });
});
