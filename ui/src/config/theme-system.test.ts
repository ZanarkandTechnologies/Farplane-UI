import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OFFICE_DIORAMA_NIGHT_THEME, OFFICE_DIORAMA_THEME } from "./office-theme";
import {
  DEFAULT_FARPLANE_THEME,
  FARPLANE_THEME_BROWSER_COLORS,
  FARPLANE_THEME_IDS,
  FARPLANE_THEME_OPTIONS,
  FARPLANE_THEME_STORAGE_KEY,
  isFarplaneThemeId,
  NEXUS_THEME_PALETTES,
  resolveFarplaneTheme,
} from "./theme-system";

describe("Farplane theme system", () => {
  it("keeps one option for every persisted theme id", () => {
    expect(FARPLANE_THEME_OPTIONS.map((option) => option.id)).toEqual(FARPLANE_THEME_IDS);
    expect(new Set(FARPLANE_THEME_OPTIONS.map((option) => option.label)).size).toBe(
      FARPLANE_THEME_OPTIONS.length,
    );
    expect(DEFAULT_FARPLANE_THEME).toBe("dark");
    expect(FARPLANE_THEME_STORAGE_KEY).toBe("farplane.theme");
  });

  it("resolves only an explicit light theme to the daylight scene", () => {
    expect(resolveFarplaneTheme("light")).toBe("light");
    expect(resolveFarplaneTheme("dark")).toBe("dark");
    expect(resolveFarplaneTheme(undefined)).toBe("dark");
  });

  it("publishes the canonical Company Nexus signal colors", () => {
    expect(NEXUS_THEME_PALETTES.dark).toMatchObject({
      cool: "#6f918f",
      pale: "#b4bbb6",
      warm: "#ad9f82",
      light: "#aebcb5",
    });
    expect(NEXUS_THEME_PALETTES.light.cool).toBe("#74ced6");
    expect(OFFICE_DIORAMA_NIGHT_THEME.nexusVortex).toBe(NEXUS_THEME_PALETTES.dark);
    expect(OFFICE_DIORAMA_THEME.nexusVortex).toBe(NEXUS_THEME_PALETTES.light);
    expect(FARPLANE_THEME_BROWSER_COLORS).toEqual({
      dark: "#0d0e10",
      light: "#f6f2e7",
    });
  });

  it("keeps the CSS variable bridge aligned with both Nexus palettes", () => {
    const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

    for (const palette of Object.values(NEXUS_THEME_PALETTES)) {
      for (const [role, color] of Object.entries(palette)) {
        expect(styles).toContain(`--nexus-${role}: ${color};`);
      }
    }
    expect(styles).not.toContain("oklch(0.598 0.0997 43.6627)");
  });

  it("rejects unknown stored theme values", () => {
    expect(isFarplaneThemeId("system")).toBe(true);
    expect(isFarplaneThemeId("orange-office")).toBe(false);
    expect(isFarplaneThemeId(undefined)).toBe(false);
  });
});
