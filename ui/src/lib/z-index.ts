/**
 * UI Z-Index Hierarchy
 * ====================
 * Centralized z-index values for office overlays.
 *
 * Ordering (low -> high):
 * - Isolated 3D canvas and its bounded Html overlays
 * - Scene HUD chrome
 * - Standard panels/dialogs
 * - Elevated panels (team/session/skills/memory)
 * - Chat
 * - Onboarding overlays that must stay visible during guided modal flows
 * - Critical confirms
 */
export const UI_Z = {
  // `Canvas` creates a stacking context at this level so Drei Html cannot escape into app panels.
  sceneCanvas: 0,
  sceneHtmlDebug: 20,
  sceneHtmlLabel: 50,
  sceneHtmlStatus: 90,
  sceneHtmlControl: 130,
  sceneHud: 200,
  sceneHudElevated: 220,
  panelBase: 1200,
  panelElevated: 1400,
  // Nested dialogs that open on top of panelElevated panels (e.g. task detail modal inside team panel)
  panelModal: 1600,
  chat: 1800,
  onboarding: 1900,
  critical: 2000,
} as const;

export type HtmlZIndexRange = [max: number, min: number];

/**
 * Bounded z-index ranges for `@react-three/drei` Html overlays in the Office canvas.
 *
 * Html converts camera depth into a CSS z-index within its supplied range. Keep every
 * Office overlay in one of these ranges: it preserves in-scene depth ordering while
 * guaranteeing HUD and portalled panels remain above the entire canvas.
 */
export const OFFICE_HTML_Z: Record<"debug" | "label" | "status" | "control", HtmlZIndexRange> = {
  debug: [UI_Z.sceneHtmlDebug, UI_Z.sceneCanvas + 1],
  label: [UI_Z.sceneHtmlLabel, UI_Z.sceneHtmlDebug + 1],
  status: [UI_Z.sceneHtmlStatus, UI_Z.sceneHtmlLabel + 1],
  control: [UI_Z.sceneHtmlControl, UI_Z.sceneHtmlStatus + 1],
};
