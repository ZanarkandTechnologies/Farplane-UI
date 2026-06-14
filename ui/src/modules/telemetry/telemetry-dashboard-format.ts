import type { RuntimeTurn } from "./telemetry-dashboard-types";

export function formatHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "0h";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 10) return `${hours.toFixed(1)}h`;
  return `${Math.round(hours)}h`;
}

export function formatDeltaHours(hours: number): string {
  const sign = hours >= 0 ? "+" : "-";
  return `${sign}${formatHours(Math.abs(hours))}`;
}

export function formatDuration(durationMs: number): string {
  const minutes = Math.max(0, Math.round(durationMs / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
}

export function formatCompletionSource(turn: RuntimeTurn): string {
  if (turn.filteredReason === "duration_cap") return "over cap";
  if (turn.completionSource === "explicit_end") return "stop hook";
  if (turn.completionSource === "next_start_recovery") return "next start";
  return "diagnostic";
}

export function formatRelativeTime(timestamp: number): string {
  const diffMs = timestamp - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);
  const absMinutes = Math.abs(diffMinutes);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (absMinutes < 60) return formatter.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return formatter.format(diffHours, "hour");
  return formatter.format(Math.round(diffHours / 24), "day");
}
