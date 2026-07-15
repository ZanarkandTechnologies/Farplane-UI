/**
 * OFFICE THEME CONFIG
 * ===================
 * Centralized visual tokens for office scene styling, landmarks, and interactions.
 */

export const OFFICE_LANDMARK_KINDS = [
  "gym",
  "library",
  "studio",
  "planning",
  "qa-arcade",
  "workshop",
  "skill-lab",
  "organization-hall",
  "resource-archive",
  "comms-hub",
  "telemetry-console",
  "thread-data-lab",
  "world-orb",
] as const;

export type OfficeLandmarkKind = (typeof OFFICE_LANDMARK_KINDS)[number];

export const OFFICE_LANDMARK_THEME = {
  presentation: {
    scale: 0.68,
    offsetZ: -0.1,
  },
  materials: {
    darkMetal: "#34383a",
    lightMetal: "#a9a096",
    walnut: "#6f543e",
    darkWalnut: "#4f3a2c",
    warmPaper: "#d8cdba",
    stone: "#81786e",
    upholstery: "#746e67",
    inactiveScreen: "#4e625f",
  },
  roles: {
    knowledge: "#9a7b4f",
    coordination: "#6f7c68",
    systems: "#64727a",
    communication: "#5e7772",
    creative: "#93695c",
  },
  roleByKind: {
    gym: "creative",
    library: "knowledge",
    studio: "creative",
    planning: "knowledge",
    "qa-arcade": "systems",
    workshop: "creative",
    "skill-lab": "coordination",
    "organization-hall": "coordination",
    "resource-archive": "knowledge",
    "comms-hub": "communication",
    "telemetry-console": "systems",
    "thread-data-lab": "systems",
    "world-orb": "communication",
  },
} as const satisfies {
  presentation: Readonly<Record<string, number>>;
  materials: Readonly<Record<string, string>>;
  roles: Readonly<Record<string, string>>;
  roleByKind: Readonly<Record<OfficeLandmarkKind, string>>;
};

export type OfficeLandmarkRole = keyof typeof OFFICE_LANDMARK_THEME.roles;

export function getOfficeLandmarkTheme(kind: OfficeLandmarkKind): {
  role: OfficeLandmarkRole;
  zoneColor: string;
} {
  const role = OFFICE_LANDMARK_THEME.roleByKind[kind];
  return { role, zoneColor: OFFICE_LANDMARK_THEME.roles[role] };
}

export interface OfficeTheme {
  scene: {
    floor: string;
    walls: string;
    background: string;
  };
  lighting: {
    ambient: string;
    directional: string;
    point: string;
  };
  interaction: {
    selectionEdge: string;
    hoverEdge: string;
    dragIndicator: string;
  };
  landmarks: typeof OFFICE_LANDMARK_THEME;
}

export function getOfficeTheme(isDarkMode: boolean): OfficeTheme {
  return {
    scene: {
      floor: isDarkMode ? "#34342f" : "#c9c0b2",
      walls: isDarkMode ? "#3a332d" : "#d8cbbb",
      background: isDarkMode ? "#1a1612" : "#e8dcc4",
    },
    lighting: {
      ambient: isDarkMode ? "#d9c7ae" : "#fff3df",
      directional: isDarkMode ? "#ffd7a6" : "#fff1d6",
      point: isDarkMode ? "#ffb96f" : "#ffd79b",
    },
    interaction: {
      selectionEdge: "#00ff00",
      hoverEdge: "#ffffff",
      dragIndicator: "#ffff00",
    },
    landmarks: OFFICE_LANDMARK_THEME,
  };
}

export const OFFICE_INTERACTION_COLORS = getOfficeTheme(false).interaction;
