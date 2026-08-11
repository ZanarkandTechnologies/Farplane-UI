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
  "finance-office",
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
    darkMetal: "#5d615c",
    lightMetal: "#bcb4a4",
    walnut: "#9a7c5c",
    darkWalnut: "#7d6248",
    warmPaper: "#e9e1cf",
    stone: "#9c9485",
    upholstery: "#99938b",
    inactiveScreen: "#7e948f",
  },
  roles: {
    knowledge: "#cdb385",
    coordination: "#a6b695",
    systems: "#99b0ba",
    communication: "#98beaf",
    creative: "#cda188",
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
    "finance-office": "knowledge",
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

/** Shared material roles for the light automatic department-island office. */
export type OfficeDioramaTheme = {
  mode: "day" | "night";
  canvas: string;
  islandTop: string;
  islandEdge: string;
  roomSurface: string;
  nexusTop: string;
  bridge: string;
  text: string;
  shadow: string;
  nexusVortex: {
    ink: string;
    cool: string;
    pale: string;
    warm: string;
    light: string;
  };
  lighting: {
    ambientIntensity: number;
    directionalIntensity: number;
    workLight: string;
    workLightIntensity: number;
  };
};

/** Daytime miniature-office tokens. */
export const OFFICE_DIORAMA_THEME: OfficeDioramaTheme = {
  mode: "day",
  canvas: "#f6f2e7",
  islandTop: "#eae5d4",
  islandEdge: "#b6ae9c",
  roomSurface: "#d5d3c6",
  nexusTop: "#e6dfc6",
  nexusVortex: {
    ink: "#18313e",
    cool: "#74ced6",
    pale: "#c8f3e6",
    warm: "#e7c47c",
    light: "#c6eee1",
  },
  bridge: "#e0dac7",
  text: "#3c4038",
  shadow: "#6b675c",
  lighting: {
    ambientIntensity: 0.62,
    directionalIntensity: 1.65,
    workLight: "#fff1cf",
    workLightIntensity: 0.42,
  },
};

/**
 * A low-luminance after-hours treatment: neutral graphite surfaces leave the
 * World Nexus and a few warm work pools as the only deliberate colour cues.
 */
export const OFFICE_DIORAMA_NIGHT_THEME: OfficeDioramaTheme = {
  mode: "night",
  canvas: "#151515",
  islandTop: "#74746f",
  islandEdge: "#3a3a38",
  roomSurface: "#656560",
  nexusTop: "#686864",
  nexusVortex: {
    ink: "#46504e",
    cool: "#6f918f",
    pale: "#b4bbb6",
    warm: "#ad9f82",
    light: "#aebcb5",
  },
  bridge: "#4d4d4b",
  text: "#e2e2df",
  shadow: "#050505",
  lighting: {
    ambientIntensity: 0.46,
    directionalIntensity: 1.2,
    workLight: "#b2a58c",
    workLightIntensity: 0.18,
  },
};

export function getOfficeDioramaTheme(isDarkMode: boolean): OfficeDioramaTheme {
  return isDarkMode ? OFFICE_DIORAMA_NIGHT_THEME : OFFICE_DIORAMA_THEME;
}

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
      floor: isDarkMode ? "#363636" : "#cbd3d8",
      walls: isDarkMode ? "#3c3c3a" : "#d8dfe3",
      background: isDarkMode ? "#151515" : "#e7edf1",
    },
    lighting: {
      ambient: isDarkMode ? "#c4c4c0" : "#fffaf2",
      directional: isDarkMode ? "#d8d8d3" : "#ffffff",
      point: isDarkMode ? "#d6c9ae" : "#d9e6ef",
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
