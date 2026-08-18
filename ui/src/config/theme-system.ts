/**
 * FARPLANE THEME SYSTEM
 * =====================
 * One small registry owns user-facing theme names, browser persistence, and
 * the Company Nexus primitives shared by HTML panels and the Three.js Office.
 *
 * `next-themes` remains the runtime owner for DOM classes, system preference,
 * cross-tab updates, and localStorage. CSS semantic variables remain the panel
 * contract; `office-theme.ts` maps these shared primitives onto scene roles.
 */

export const FARPLANE_THEME_STORAGE_KEY = "farplane.theme";

export const FARPLANE_THEME_IDS = ["dark", "light", "system"] as const;

export type FarplaneThemeId = (typeof FARPLANE_THEME_IDS)[number];
export type ResolvedFarplaneTheme = Exclude<FarplaneThemeId, "system">;

export type NexusPalette = {
  ink: string;
  cool: string;
  pale: string;
  warm: string;
  light: string;
};

export const NEXUS_THEME_PALETTES = {
  light: {
    ink: "#18313e",
    cool: "#74ced6",
    pale: "#c8f3e6",
    warm: "#e7c47c",
    light: "#c6eee1",
  },
  dark: {
    ink: "#46504e",
    cool: "#6f918f",
    pale: "#b4bbb6",
    warm: "#ad9f82",
    light: "#aebcb5",
  },
} as const satisfies Record<ResolvedFarplaneTheme, NexusPalette>;

export const FARPLANE_THEME_BROWSER_COLORS = {
  dark: "#0d0e10",
  light: "#f6f2e7",
} as const satisfies Record<ResolvedFarplaneTheme, string>;

export type FarplaneThemeOption = {
  id: FarplaneThemeId;
  label: string;
  description: string;
  swatches: readonly string[];
};

export const FARPLANE_THEME_OPTIONS = [
  {
    id: "dark",
    label: "Nexus Graphite",
    description: "After-hours graphite with restrained Nexus blue-gray signals.",
    swatches: ["#0d0e10", "#141619", NEXUS_THEME_PALETTES.dark.cool],
  },
  {
    id: "light",
    label: "Nexus Daylight",
    description: "Warm daylight surfaces with deep ink and cool Nexus signals.",
    swatches: ["#f6f2e7", "#eae5d4", NEXUS_THEME_PALETTES.light.cool],
  },
  {
    id: "system",
    label: "Follow System",
    description: "Use this device's light or dark appearance automatically.",
    swatches: ["#f6f2e7", "#0d0e10", NEXUS_THEME_PALETTES.dark.cool],
  },
] as const satisfies readonly FarplaneThemeOption[];

export const DEFAULT_FARPLANE_THEME: FarplaneThemeId = "dark";

export function isFarplaneThemeId(value: string | undefined): value is FarplaneThemeId {
  return FARPLANE_THEME_IDS.some((themeId) => themeId === value);
}

export function resolveFarplaneTheme(resolvedTheme: string | undefined): ResolvedFarplaneTheme {
  return resolvedTheme === "light" ? "light" : "dark";
}
