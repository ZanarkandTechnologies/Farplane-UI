"use client";

export const TIER_COLORS: Record<number, string> = {
  1: "#E11D48",
  2: "#2563EB",
  3: "#94A3B8",
};

export const TIER_LABELS: Record<number, string> = {
  1: "CORE",
  2: "FLOW",
  3: "APP",
};

export function tierColor(tier: number | undefined): string {
  return TIER_COLORS[tier ?? 3] ?? TIER_COLORS[3];
}

export function shortLabel(skillId: string): string {
  const parts = skillId.split("-");
  if (parts.length === 1) return skillId.slice(0, 6).toUpperCase();
  return parts
    .map((part) => part[0])
    .join("")
    .slice(0, 6)
    .toUpperCase();
}
