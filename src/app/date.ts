import type { DayOfWeek, WeekStartsOn } from "./types";

export const ALL_DAYS_OF_WEEK: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];
export const DAY_OF_WEEK_LABELS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function normalizeDaysOfWeek(daysOfWeek?: readonly number[]): DayOfWeek[] {
  if (!Array.isArray(daysOfWeek)) return [...ALL_DAYS_OF_WEEK];
  const normalized = Array.from(
    new Set(daysOfWeek.filter((day): day is DayOfWeek => Number.isInteger(day) && day >= 0 && day <= 6))
  ).sort((a, b) => a - b);
  return normalized.length ? normalized : [...ALL_DAYS_OF_WEEK];
}

export function isDayOfWeekActive(dayOfWeek: number, daysOfWeek: readonly DayOfWeek[]): boolean {
  return daysOfWeek.includes(dayOfWeek as DayOfWeek);
}

export function isDateActive(dateISO: string, daysOfWeek: readonly DayOfWeek[]): boolean {
  return isDayOfWeekActive(parseISODate(dateISO).getDay(), daysOfWeek);
}

export function formatDaysOfWeek(daysOfWeek: readonly DayOfWeek[]): string {
  const normalized = normalizeDaysOfWeek(daysOfWeek);
  if (normalized.length === ALL_DAYS_OF_WEEK.length) return "Every day";
  return normalized.map((day) => DAY_OF_WEEK_LABELS_SHORT[day]).join(", ");
}

export function parseISODate(date: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Invalid date: ${date}`);
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  return new Date(year, monthIndex, day);
}

// Date-only helpers that avoid DST drift by using UTC internally.
export function isoToDayNumber(date: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Invalid date: ${date}`);
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  return Math.floor(Date.UTC(year, monthIndex, day) / 86400000);
}

export function dayNumberToISO(dayNumber: number): string {
  const d = new Date(dayNumber * 86400000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function isBeforeOrEqual(a: Date, b: Date): boolean {
  return a.getTime() <= b.getTime();
}

export function isAfterOrEqual(a: Date, b: Date): boolean {
  return a.getTime() >= b.getTime();
}

export function clampDate(d: Date, min: Date, max: Date): Date {
  if (d.getTime() < min.getTime()) return min;
  if (d.getTime() > max.getTime()) return max;
  return d;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function monthKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function monthKeyToDate(monthKey: string): Date {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) throw new Error(`Invalid monthKey: ${monthKey}`);
  return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}

export function startOfWeek(d: Date, weekStartsOn: WeekStartsOn): Date {
  const dayIndex = d.getDay(); // 0..6 (Sun..Sat)
  const delta = (dayIndex - weekStartsOn + 7) % 7;
  return addDays(d, -delta);
}

export function endOfWeek(d: Date, weekStartsOn: WeekStartsOn): Date {
  return addDays(startOfWeek(d, weekStartsOn), 6);
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function isWithinInclusive(d: Date, start: Date, end: Date): boolean {
  return isAfterOrEqual(d, start) && isBeforeOrEqual(d, end);
}

export function formatMonthLabel(monthKey: string): string {
  const d = monthKeyToDate(monthKey);
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

export function formatShortDate(date: string): string {
  const d = parseISODate(date);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatWeekLabel(weekStartISO: string): string {
  const d = parseISODate(weekStartISO);
  const end = addDays(d, 6);
  const startLabel = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

export function monthKeysInRange(startISO: string, endISO: string): string[] {
  const start = startOfMonth(parseISODate(startISO));
  const end = startOfMonth(parseISODate(endISO));
  const out: string[] = [];
  let cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    out.push(monthKeyFromDate(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return out;
}

export function dateISOsInRange(startISO: string, endISO: string, daysOfWeek?: readonly DayOfWeek[]): string[] {
  const startDay = isoToDayNumber(startISO);
  const endDay = isoToDayNumber(endISO);
  const out: string[] = [];
  for (let dayNumber = startDay; dayNumber <= endDay; dayNumber++) {
    const dayOfWeek = new Date(dayNumber * 86400000).getUTCDay();
    if (daysOfWeek && !isDayOfWeekActive(dayOfWeek, daysOfWeek)) continue;
    out.push(dayNumberToISO(dayNumber));
  }
  return out;
}

export function weekStartsForMonth(monthKey: string, weekStartsOn: WeekStartsOn): string[] {
  const monthStart = monthKeyToDate(monthKey);
  const monthEnd = endOfMonth(monthStart);
  let cursor = startOfWeek(monthStart, weekStartsOn);
  const out: string[] = [];
  while (cursor.getTime() <= monthEnd.getTime()) {
    out.push(toISODate(cursor));
    cursor = addDays(cursor, 7);
  }
  return out;
}

export function daysForWeekInMonth(
  weekStartISO: string,
  monthKey: string,
  rangeStartISO: string,
  rangeEndISO: string,
  daysOfWeek?: readonly DayOfWeek[]
): string[] {
  const weekStart = parseISODate(weekStartISO);
  const monthStart = monthKeyToDate(monthKey);
  const monthEnd = endOfMonth(monthStart);
  const rangeStart = parseISODate(rangeStartISO);
  const rangeEnd = parseISODate(rangeEndISO);

  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    if (!isSameMonth(d, monthStart)) continue;
    if (!isWithinInclusive(d, rangeStart, rangeEnd)) continue;
    if (!isWithinInclusive(d, monthStart, monthEnd)) continue;
    if (daysOfWeek && !isDayOfWeekActive(d.getDay(), daysOfWeek)) continue;
    out.push(toISODate(d));
  }
  return out;
}

export function yearsInRange(startISO: string, endISO: string): number[] {
  const startY = parseISODate(startISO).getFullYear();
  const endY = parseISODate(endISO).getFullYear();
  const years: number[] = [];
  for (let y = startY; y <= endY; y++) years.push(y);
  return years;
}
