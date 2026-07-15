/**
 * Shared geometry contract for walk-in activity destination rooms.
 *
 * The auto-layout solver, renderer, and employee targeting all consume this
 * module so the reserved floor, visible room patch, and interior activity spot
 * cannot drift apart. Even room dimensions use half-tile object centers so the
 * visible zone still maps exactly to integer-centered floor tiles.
 */

export const ACTIVITY_DESTINATION_ROOM_WIDTH = 5;
export const ACTIVITY_DESTINATION_ROOM_DEPTH = 5;
export const ACTIVITY_DESTINATION_BAY_WIDTH = 5;
export const ACTIVITY_DESTINATION_BAY_DEPTH = 4;
export const ACTIVITY_DESTINATION_INTERIOR_INSET = 1.15;

export function getActivityDestinationRoomDimensions(
  footprintWidth?: number,
  footprintDepth?: number,
  destinationBayZone = false,
): { width: number; depth: number } {
  const minimumWidth = destinationBayZone
    ? ACTIVITY_DESTINATION_BAY_WIDTH
    : ACTIVITY_DESTINATION_ROOM_WIDTH;
  const minimumDepth = destinationBayZone
    ? ACTIVITY_DESTINATION_BAY_DEPTH
    : ACTIVITY_DESTINATION_ROOM_DEPTH;
  return {
    width: Math.max(footprintWidth ?? 0, minimumWidth),
    depth: Math.max(footprintDepth ?? 0, minimumDepth),
  };
}
