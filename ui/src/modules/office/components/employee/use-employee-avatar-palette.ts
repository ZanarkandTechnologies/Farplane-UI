"use client";

/**
 * Employee avatar palette selection.
 *
 * Ownership: stable per-employee colors for renderer components.
 * Inputs: CEO flag and optional appearance overrides.
 * Outputs: renderer-ready hair/skin/shirt/pants palette.
 * Side effects: none after initial random palette selection.
 */

import { useMemo } from "react";
import { HAIR_COLORS, PANTS_COLORS, SHIRT_COLORS, SKIN_COLORS } from "@/constants";
import { getRandomItem } from "@/lib/utils";
import type { AvatarPalette } from "./renderers/types";

export function useEmployeeAvatarPalette(input: {
  isCEO?: boolean;
  appearance?: {
    clothesStyle?: "default" | "dj" | "professional" | "techBro";
    hairColor?: string;
    skinColor?: string;
    shirtColor?: string;
    pantsColor?: string;
  };
}): AvatarPalette {
  const { isCEO, appearance } = input;
  const colors = useMemo(
    () => ({
      hair: getRandomItem(HAIR_COLORS),
      skin: getRandomItem(SKIN_COLORS),
      shirt: getRandomItem(SHIRT_COLORS),
      pants: getRandomItem(PANTS_COLORS),
    }),
    [],
  );

  return useMemo<AvatarPalette>(() => {
    const base: AvatarPalette = isCEO
      ? {
          hair: "#FFD700",
          skin: "#FF5722",
          shirt: "#CC2200",
          pants: "#8B0000",
        }
      : colors;

    if (!appearance) return base;

    let shirt = base.shirt;
    let pants = base.pants;

    switch (appearance.clothesStyle) {
      case "dj":
        shirt = "#FF4081";
        pants = "#111111";
        break;
      case "professional":
        shirt = "#ECEFF1";
        pants = "#263238";
        break;
      case "techBro":
        shirt = "#37474F";
        pants = "#111111";
        break;
      default:
        shirt = "#90A4AE";
        pants = "#1565C0";
        break;
    }

    return {
      hair: appearance.hairColor ?? base.hair,
      skin: appearance.skinColor ?? base.skin,
      shirt: appearance.shirtColor ?? shirt,
      pants: appearance.pantsColor ?? pants,
    };
  }, [appearance, colors, isCEO]);
}
