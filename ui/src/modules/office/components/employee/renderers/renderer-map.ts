"use client";

/**
 * Character graphics renderer map for office employees.
 *
 * Ownership: static mapping from renderer ids to React renderer components.
 * Inputs: renderer ids selected by the resolver/settings layer.
 * Outputs: renderer definitions that share the CharacterRendererProps interface.
 * Side effects: none; individual renderers own their own visual side effects.
 */

import { SpriteSheet2dCharacterRenderer } from "./sprite-sheet-2d";
import { ThreeHumanCharacterRenderer } from "./three-human";
import type { CharacterRendererDefinition, CharacterRendererId } from "./types";

export const DEFAULT_CHARACTER_RENDERER_ID: CharacterRendererId = "three-human";

export const characterGraphicsRendererMap = {
  "three-human": {
    id: "three-human",
    displayName: "Three.js Human",
    Render: ThreeHumanCharacterRenderer,
  },
  "sprite-sheet-2d": {
    id: "sprite-sheet-2d",
    displayName: "2D Sprite Sheet",
    Render: SpriteSheet2dCharacterRenderer,
  },
} satisfies Record<CharacterRendererId, CharacterRendererDefinition>;

export function getCharacterRendererDefinition(
  id: CharacterRendererId,
): CharacterRendererDefinition {
  return characterGraphicsRendererMap[id] ?? characterGraphicsRendererMap[DEFAULT_CHARACTER_RENDERER_ID];
}
