// Farplane's dark theme for the extension, mirrored from Farplane-UI's `.dark` tokens in
// ui/src/styles.css (farplane-theme.test.ts fails when the two drift). The popup declares them on
// :root under their plain names; the YouTube overlay declares them on its shadow roots prefixed with
// --farplane-, so they never clash with YouTube's own variables.

export const FARPLANE_DARK = {
  background: "oklch(0.1635 0.0045 264.4427)",
  foreground: "oklch(0.8717 0.0093 258.3382)",
  card: "oklch(0.1993 0.0068 258.3682)",
  // --nexus-cool and --nexus-light in the dark theme.
  primary: "#6f918f",
  "primary-foreground": "oklch(0.1635 0.0045 264.4427)",
  muted: "oklch(0.2346 0.0083 264.4038)",
  "muted-foreground": "oklch(0.7107 0.0351 256.7878)",
  accent: "oklch(0.2431 0.0082 264.4119)",
  border: "oklch(0.28 0.0102 260.7048)",
  ring: "#aebcb5",
  destructive: "oklch(0.3958 0.1331 25.723)",
  // The extension's own: error text on the dark card, and the green that marks what's new or ready.
  "destructive-fg": "oklch(0.7705 0.1129 17.3797)",
  success: "oklch(0.696 0.17 162.48)",
} as const;

/** The theme as CSS custom properties, e.g. `--primary:#6f918f` or, prefixed, `--farplane-primary:#6f918f`. */
export function themeVars(prefix = ""): string {
  return Object.entries(FARPLANE_DARK)
    .map(([name, value]) => `--${prefix}${name}:${value}`)
    .join(";");
}
