/** Shared rendered-geometry contract for the command commons and its validator footprint. */

export const COMMAND_COMMONS_SCALE = 1.15;
export const COMMAND_COMMONS_VISUAL_WIDTH = 11.8;
export const COMMAND_COMMONS_VISUAL_DEPTH = 8.4;

export const COMMAND_COMMONS_FRAME = {
  postX: 4.95,
  postZ: 3.35,
  height: 2.62,
  beamThickness: 0.14,
} as const;

export function commandCommonsFrameFitsVisualFootprint(): boolean {
  const halfWidth =
    (COMMAND_COMMONS_FRAME.postX + COMMAND_COMMONS_FRAME.beamThickness / 2) *
    COMMAND_COMMONS_SCALE;
  const halfDepth =
    (COMMAND_COMMONS_FRAME.postZ + COMMAND_COMMONS_FRAME.beamThickness / 2) *
    COMMAND_COMMONS_SCALE;
  return (
    halfWidth <= COMMAND_COMMONS_VISUAL_WIDTH / 2 &&
    halfDepth <= COMMAND_COMMONS_VISUAL_DEPTH / 2
  );
}
