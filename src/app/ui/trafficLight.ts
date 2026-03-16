import type { DailyGoal } from "../types";

export type TrafficLightTone = "red" | "amber" | "green";
export type DayVisualState = "open" | "future" | "planned" | "missed" | "done";

export function clampProgress(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export function trafficLightToneFromProgress(value: number): TrafficLightTone {
  const clamped = clampProgress(value);
  if (clamped >= 0.67) return "green";
  if (clamped >= 0.34) return "amber";
  return "red";
}

export function trafficLightToneFromState(state: "open" | "planned" | "done"): TrafficLightTone {
  if (state === "done") return "green";
  if (state === "planned") return "amber";
  return "red";
}

export function entryHasPlan(entry: DailyGoal | undefined): boolean {
  if (!entry) return false;
  const items = Array.isArray(entry.items) && entry.items.length ? entry.items : [entry.title];
  return items.some((item) => item.trim().length > 0);
}

export function dayVisualState(entry: DailyGoal | undefined, dateISO: string, todayISO: string): DayVisualState {
  if (entry?.done) return "done";
  if (dateISO > todayISO) return "future";
  if (dateISO < todayISO) return "missed";
  if (entryHasPlan(entry)) return "planned";
  return "open";
}

const SURFACE_CLASSES: Record<TrafficLightTone, string> = {
  red: "border-[color:var(--app-signal-red-border)] bg-[color:var(--app-signal-red-bg)] text-[color:var(--app-signal-red-text)]",
  amber:
    "border-[color:var(--app-signal-amber-border)] bg-[color:var(--app-signal-amber-bg)] text-[color:var(--app-signal-amber-text)]",
  green:
    "border-[color:var(--app-signal-green-border)] bg-[color:var(--app-signal-green-bg)] text-[color:var(--app-signal-green-text)]"
};

export function trafficLightSurfaceClass(tone: TrafficLightTone): string {
  return SURFACE_CLASSES[tone];
}

export function daySurfaceClass(state: DayVisualState): string {
  if (state === "missed") return trafficLightSurfaceClass("red");
  if (state === "planned") return trafficLightSurfaceClass("amber");
  if (state === "done") return trafficLightSurfaceClass("green");
  if (state === "future") {
    return "border-[color:var(--app-border)] border-dashed bg-[color:var(--app-card)] text-[color:var(--app-text)] opacity-75";
  }
  return "border-[color:var(--app-border)] bg-[color:var(--app-elevated)] text-[color:var(--app-text)]";
}

export function trafficLightVar(
  tone: TrafficLightTone,
  token: "bg" | "border" | "fill" | "text"
): `var(--app-signal-${TrafficLightTone}-${"bg" | "border" | "fill" | "text"})` {
  return `var(--app-signal-${tone}-${token})`;
}

export function dayFillVar(state: DayVisualState): string {
  if (state === "missed") return trafficLightVar("red", "fill");
  if (state === "planned") return trafficLightVar("amber", "fill");
  if (state === "done") return trafficLightVar("green", "fill");
  if (state === "future") return "var(--app-border)";
  return "var(--app-border)";
}
