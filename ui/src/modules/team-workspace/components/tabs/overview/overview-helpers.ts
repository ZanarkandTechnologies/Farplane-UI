/**
 * OVERVIEW TAB HELPERS
 * ====================
 * Deterministic display helpers for compact team roster cards.
 *
 * KEY CONCEPTS:
 * - Compact card previews must keep a stable face palette per employee seed.
 * - Relative update timestamps should stay terse and scan-friendly.
 *
 * USAGE:
 * - Imported by the Overview tab and preview components for mini avatar previews and update labels.
 *
 * MEMORY REFERENCES:
 * - MEM-0196
 */

import { HAIR_COLORS, PANTS_COLORS, SHIRT_COLORS, SKIN_COLORS } from "@/constants";

export type AvatarPalette = {
  hair: string;
  skin: string;
  shirt: string;
  pants: string;
};

export function formatRelativeTime(timestamp?: number, now: number = Date.now()): string {
  if (!timestamp || !Number.isFinite(timestamp)) return "No recent update";
  const diff = Math.max(0, now - timestamp);
  if (diff < 60_000) return "Updated just now";
  if (diff < 3_600_000) return `Updated ${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `Updated ${Math.floor(diff / 3_600_000)}h ago`;
  return `Updated ${Math.floor(diff / 86_400_000)}d ago`;
}

export function pickStableColor(seed: string, palette: readonly string[]): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return palette[hash % palette.length] ?? palette[0] ?? "#888888";
}

export function resolvePreviewPalette(seed: string): AvatarPalette {
  return {
    hair: pickStableColor(`${seed}:hair`, HAIR_COLORS),
    skin: pickStableColor(`${seed}:skin`, SKIN_COLORS),
    shirt: pickStableColor(`${seed}:shirt`, SHIRT_COLORS),
    pants: pickStableColor(`${seed}:pants`, PANTS_COLORS),
  };
}

export function compactMarkdownText(value: string, fallback: string, limit = 220): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  return normalized.length > limit ? `${normalized.slice(0, limit - 3)}...` : normalized;
}

export function bulletLines(markdown: string, limit = 4): string[] {
  return markdown
    .split(/\r?\n/g)
    .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

export type OverviewKpiAxis = {
  axis: string;
  weight: string;
  currentBet: string;
  target: string;
  provider: string;
  evidence: string;
  heartbeat: string;
};

function isKpiWeightCell(value: string | undefined): boolean {
  return /^\d+(?:\.\d+)?%?$/.test(value?.trim() ?? "");
}

export function overviewKpiFromRow(row: string[]): OverviewKpiAxis {
  const hasWeight = isKpiWeightCell(row[1]);
  return {
    axis: row[0] ?? "KPI",
    weight: hasWeight ? (row[1] ?? "?") : "goal",
    currentBet: hasWeight ? (row[2] ?? "Bet pending") : (row[1] ?? "Bet pending"),
    target: hasWeight ? (row[3] ?? "Target pending") : (row[1] ?? "Target pending"),
    provider: hasWeight ? (row[4] ?? "provider_missing") : (row[3] ?? "provider_missing"),
    evidence: hasWeight ? (row[5] ?? "evidence missing") : (row[2] ?? "evidence missing"),
    heartbeat: hasWeight ? (row[7] ?? "cadence missing") : (row[5] ?? "cadence missing"),
  };
}

export function findKpiAxis(kpis: OverviewKpiAxis[], patterns: RegExp[]): OverviewKpiAxis | null {
  return (
    kpis.find((kpi) =>
      patterns.some((pattern) => pattern.test(`${kpi.axis} ${kpi.target} ${kpi.currentBet}`)),
    ) ?? null
  );
}
