import { describe, expect, it } from "vitest";
import {
  getOfficeDioramaTheme,
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
      darkMetal: "#5d615c",
      lightMetal: "#bcb4a4",
      walnut: "#9a7c5c",
      darkWalnut: "#7d6248",
      warmPaper: "#e9e1cf",
      stone: "#9c9485",
      upholstery: "#99938b",
      inactiveScreen: "#7e948f",
    });
  });

  it("uses a neutral control-room environment instead of a sepia scene wash", () => {
    expect(getOfficeTheme(true).scene).toEqual({
      floor: "#363636",
      walls: "#3c3c3a",
      background: "#151515",
    });
    expect(getOfficeTheme(true).lighting).toEqual({
      ambient: "#c4c4c0",
      directional: "#d8d8d3",
      point: "#d6c9ae",
    });
  });

  it("uses a matte graphite diorama for the app's night theme", () => {
    expect(getOfficeDioramaTheme(false)).toMatchObject({
      mode: "day",
      canvas: "#f6f2e7",
    });
    expect(getOfficeDioramaTheme(true)).toMatchObject({
      mode: "night",
      canvas: "#151515",
      islandTop: "#74746f",
      islandEdge: "#3a3a38",
      roomSurface: "#656560",
      lighting: {
        ambientIntensity: 0.46,
        directionalIntensity: 1.2,
        workLightIntensity: 0.18,
      },
    });
  });
});
