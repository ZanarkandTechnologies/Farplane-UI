/** Shared, server-owned calendar-day rules for Content Intelligence paging. */

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function timelineDayFromMs(value: number): string {
  return new Date(value).toISOString().slice(0, 10);
}

export function timelineDayFromValue(value: string | undefined, fallbackMs: number): string {
  if (value && isTimelineDay(value)) {
    return value;
  }
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? timelineDayFromMs(parsed) : timelineDayFromMs(fallbackMs);
}

export function isTimelineDay(value: string): boolean {
  if (!DAY.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
