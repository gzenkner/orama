import React from "react";
import type { DailyGoal, Outcome, WeekStartsOn } from "../types";
import { actions, useAppState } from "../store";
import {
  daysForWeekInMonth,
  formatDaysOfWeek,
  dayNumberToISO,
  formatMonthLabel,
  formatShortDate,
  formatWeekLabel,
  isoToDayNumber,
  isDateActive,
  lastFullyElapsedDateISO,
  monthKeysInRange,
  parseISODate,
  startOfWeek,
  toISODate,
  weekStartsForMonth
} from "../date";
import { summarizePlanningActions } from "../planningActions";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Textarea from "../ui/Textarea";
import { cn } from "../ui/cn";
import {
  dayFillVar,
  daySurfaceClass,
  dayVisualState,
  entryHasPlan,
  trafficLightSurfaceClass,
  trafficLightToneFromProgress,
  trafficLightVar,
  type DayVisualState,
  type TrafficLightTone
} from "../ui/trafficLight";

const MAX_PLAN_MONTHS = 150;

function dayTabLabel(dateISO: string) {
  const d = parseISODate(dateISO);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function compactMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function todayISO(): string {
  return toISODate(new Date());
}

function isToday(dateISO: string): boolean {
  return dateISO === todayISO();
}

function elapsedProgress(dateISOs: string[], outcomeId: string, daily: Record<string, DailyGoal>, today: string): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const dateISO of dateISOs) {
    if (dateISO > today) continue;
    total++;
    if (daily[`${outcomeId}:${dateISO}`]?.done) done++;
  }
  return { done, total };
}

function clampNum(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={[
        "h-4 w-4 shrink-0 text-current opacity-70 transition-transform",
        open ? "rotate-0" : "-rotate-90"
      ].join(" ")}
    >
      <path
        fill="currentColor"
        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z"
      />
    </svg>
  );
}

function FinderTab({ label, className = "" }: { label: string; className?: string }) {
  return <div className={`app-finder-tab ${className}`.trim()}>{label}</div>;
}

function TimelineYardstick({
  outcome,
  monthKeys,
  weekStartsOn,
  expandedMonths,
  expandedWeekKeys,
  allExpanded,
  monthly,
  weekly,
  daily,
  onToggleAll,
  onJumpMonth,
  onJumpWeek,
  onJumpDay
}: {
  outcome: Outcome;
  monthKeys: string[];
  weekStartsOn: WeekStartsOn;
  expandedMonths: Set<string>;
  expandedWeekKeys: Set<string>;
  allExpanded: boolean;
  monthly: Record<string, { title: string }>;
  weekly: Record<string, { title: string }>;
  daily: Record<string, DailyGoal>;
  onToggleAll: () => void;
  onJumpMonth: (monthKey: string) => void;
  onJumpWeek: (monthKey: string, weekStartISO: string) => void;
  onJumpDay: (monthKey: string, weekStartISO: string, dateISO: string) => void;
}) {
  const startDay = isoToDayNumber(outcome.startDate);
  const endDay = isoToDayNumber(outcome.endDate);
  const span = Math.max(1, endDay - startDay);

  const width = 1000;
  const height = 136;
  const pad = 18;
  const y = 76;

  const xForDay = (dayNumber: number) => {
    const t = (dayNumber - startDay) / span;
    return pad + t * (width - pad * 2);
  };

  const todayISO = toISODate(new Date());
  const todayDay = isoToDayNumber(todayISO);
  const hasToday = todayDay >= startDay && todayDay <= endDay;

  const monthSegments = React.useMemo(() => {
    return monthKeys.map((monthKey) => {
      const [yy, mm] = monthKey.split("-").map(Number);
      const monthStart = Math.floor(Date.UTC(yy, mm - 1, 1) / 86400000);
      const monthEnd = Math.floor(Date.UTC(yy, mm, 0) / 86400000);
      const segStart = clampNum(monthStart, startDay, endDay);
      const segEnd = clampNum(monthEnd, startDay, endDay);

      const monthTitle = monthly[`${outcome.id}:${monthKey}`]?.title?.trim() ?? "";

      let done = 0;
      let planned = 0;
      let total = 0;
      for (let dn = segStart; dn <= segEnd; dn++) {
        const iso = dayNumberToISO(dn);
        if (!isDateActive(iso, outcome.daysOfWeek)) continue;
        total++;
        const entry = daily[`${outcome.id}:${iso}`];
        if (entry?.done) done++;
        else if (entryHasPlan(entry)) planned++;
      }

      const doneRatio = total ? done / total : 0;
      const plannedRatio = total ? planned / total : 0;
      return { monthKey, segStart, segEnd, monthTitle, done, planned, total, doneRatio, plannedRatio };
    });
  }, [daily, endDay, monthKeys, monthly, outcome.daysOfWeek, outcome.id, startDay]);

  const expandedWeekDetails = React.useMemo(() => {
    const out: Array<{ monthKey: string; weekStartISO: string; weekTitle: string; days: string[] }> = [];
    for (const wk of expandedWeekKeys) {
      const [monthKey, weekStartISO] = wk.split(":");
      if (!monthKey || !weekStartISO) continue;
      const filteredDays = daysForWeekInMonth(weekStartISO, monthKey, outcome.startDate, outcome.endDate, outcome.daysOfWeek);
      if (!filteredDays.length) continue;
      const weekTitle = weekly[`${outcome.id}:${monthKey}:${weekStartISO}`]?.title?.trim() ?? "";
      out.push({ monthKey, weekStartISO, weekTitle, days: filteredDays });
    }
    return out;
  }, [expandedWeekKeys, outcome.daysOfWeek, outcome.endDate, outcome.id, outcome.startDate, weekly]);

  function monthLabel(monthKey: string): string {
    const [yy, mm] = monthKey.split("-").map(Number);
    const d = new Date(yy, mm - 1, 1);
    return d.toLocaleString(undefined, { month: "short" });
  }

  return (
    <div className="outcome-header-timeline-body">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="app-kicker">Navigate</div>
          <div className="mt-1 text-xs app-muted">It zooms in as you expand months and weeks.</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button size="sm" variant="ghost" onClick={onToggleAll}>
            {allExpanded ? "Collapse all" : "Expand all"}
          </Button>
          <div className="flex flex-wrap items-center gap-3 text-[11px] app-muted">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-[color:var(--outcome-border)]" /> Open
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: trafficLightVar("red", "fill") }} /> Missed
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: trafficLightVar("amber", "fill") }} /> Planned
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: trafficLightVar("green", "fill") }} /> Done
            </div>
          </div>
        </div>
      </div>

      <svg className="mt-3 h-[6.75rem] w-full sm:h-[7.5rem]" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Navigate outcome plan">
        <line
          x1={pad}
          y1={y}
          x2={width - pad}
          y2={y}
          stroke="var(--outcome-border)"
          strokeWidth={2}
          opacity={0.5}
        />

        {monthSegments.map((m) => {
          const x1 = xForDay(m.segStart);
          const x2 = xForDay(m.segEnd);
          const len = Math.max(2, x2 - x1);
          const labelX = x1 + len / 2;
          const wideEnough = len >= 48;

          return (
            <g key={m.monthKey}>
              <line
                x1={x1}
                y1={y}
                x2={x1 + len}
                y2={y}
                stroke="var(--outcome-border)"
                strokeWidth={12}
                strokeLinecap="round"
                opacity={0.3}
                style={{ cursor: "pointer" }}
                onClick={() => onJumpMonth(m.monthKey)}
              >
                <title>
                  {m.monthKey} - {m.done}/{m.total} done - {m.planned}/{m.total} planned
                </title>
              </line>
              {m.done > 0 ? (
                <line
                  x1={x1}
                  y1={y}
                  x2={x1 + len}
                  y2={y}
                  stroke={trafficLightVar("green", "fill")}
                  strokeWidth={12}
                  strokeLinecap="round"
                  opacity={0.2 + clampNum(m.doneRatio, 0, 1) * 0.8}
                  style={{ cursor: "pointer" }}
                  onClick={() => onJumpMonth(m.monthKey)}
                >
                  <title>
                    {m.monthKey} - {m.done}/{m.total} done - {m.planned}/{m.total} planned
                  </title>
                </line>
              ) : null}

              {m.planned > 0 ? (
                <line
                  x1={x1}
                  y1={y + 10}
                  x2={x1 + len}
                  y2={y + 10}
                  stroke={trafficLightVar("amber", "fill")}
                  strokeWidth={4}
                  strokeLinecap="round"
                  opacity={0.2 + clampNum(m.plannedRatio, 0, 1) * 0.75}
                />
              ) : null}

              {wideEnough ? (
                <text
                  x={labelX}
                  y={y + 34}
                  textAnchor="middle"
                  fill="color-mix(in srgb, var(--outcome-ink) 58%, var(--app-subtle) 42%)"
                  fontSize={12}
                >
                  {monthLabel(m.monthKey)}
                </text>
              ) : null}

              {m.monthTitle ? (
                <circle cx={labelX} cy={y + 16} r={4} fill={trafficLightVar("amber", "fill")}>
                  <title>Monthly goal: {m.monthTitle}</title>
                </circle>
              ) : null}
            </g>
          );
        })}

        {Array.from(expandedMonths).flatMap((monthKey) => {
          const weekStarts = weekStartsForMonth(monthKey, weekStartsOn).filter(
            (ws) => daysForWeekInMonth(ws, monthKey, outcome.startDate, outcome.endDate, outcome.daysOfWeek).length > 0
          );

          return weekStarts.map((weekStartISO) => {
            const dn = isoToDayNumber(weekStartISO);
            if (dn < startDay || dn > endDay) return null;
            const x = xForDay(dn);
            const title = weekly[`${outcome.id}:${monthKey}:${weekStartISO}`]?.title?.trim() ?? "";
            const tick = title ? trafficLightVar("amber", "fill") : "var(--outcome-border)";
            return (
              <g key={`${monthKey}:${weekStartISO}`}>
                <line
                  x1={x}
                  y1={y - 14}
                  x2={x}
                  y2={y + 14}
                  stroke={tick}
                  strokeWidth={2}
                  opacity={0.9}
                  style={{ cursor: "pointer" }}
                  onClick={() => onJumpWeek(monthKey, weekStartISO)}
                >
                  <title>{title ? `Weekly goal: ${title}` : "No weekly goal yet"}</title>
                </line>
              </g>
            );
          });
        })}

        {expandedWeekDetails.flatMap((w) =>
          w.days.map((dateISO, idx) => {
            const dn = isoToDayNumber(dateISO);
            const x = xForDay(dn);
            const entry = daily[`${outcome.id}:${dateISO}`];
            const state = dayVisualState(entry, dateISO, todayISO);
            const fill = dayFillVar(state);
            const cy = y - 34 - (idx % 2) * 10;
            return (
              <circle
                key={`${w.monthKey}:${w.weekStartISO}:${dateISO}`}
                cx={x}
                cy={cy}
                r={4}
                fill={fill}
                style={{ cursor: "pointer" }}
                onClick={() => onJumpDay(w.monthKey, w.weekStartISO, dateISO)}
              >
                <title>
                  {dateISO} - {state} - {entry?.title?.trim() ?? ""}
                </title>
              </circle>
            );
          })
        )}

        {hasToday ? (
          <g>
            <line
              x1={xForDay(todayDay)}
              y1={y - 36}
              x2={xForDay(todayDay)}
              y2={y + 28}
              stroke="var(--outcome-ink)"
              strokeWidth={2}
              opacity={0.7}
            />
            <text x={xForDay(todayDay)} y={y + 46} textAnchor="middle" fill="var(--outcome-ink)" fontSize={11}>
              Today
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}

function Arrow({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={["h-4 w-4 shrink-0 text-[color:var(--app-text)]", dir === "left" ? "" : "rotate-180"].join(" ")}
    >
      <path
        fill="currentColor"
        d="M12.78 4.47a.75.75 0 0 1 0 1.06L8.31 10l4.47 4.47a.75.75 0 1 1-1.06 1.06l-5-5a.75.75 0 0 1 0-1.06l5-5a.75.75 0 0 1 1.06 0Z"
      />
    </svg>
  );
}

function dailyItems(entry: DailyGoal | undefined): string[] {
  if (Array.isArray(entry?.items) && entry.items.length) return entry.items;
  return [entry?.title ?? ""];
}

function dailyItemsDone(entry: DailyGoal | undefined, items: string[]): boolean[] {
  const raw = Array.isArray(entry?.itemsDone) ? entry.itemsDone : [];
  return items.map((_, index) => Boolean(raw[index]));
}

function meaningfulItemCount(items: string[]): number {
  return items.reduce((count, item) => count + (item.trim().length > 0 ? 1 : 0), 0);
}

function completedItemCount(itemsDone: boolean[]): number {
  return itemsDone.reduce((count, done) => count + (done ? 1 : 0), 0);
}

function populatedGoalCount(values: string[]): number {
  return values.reduce((count, value) => count + (value.trim().length > 0 ? 1 : 0), 0);
}

function currentReviewCycle(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function daysUntilNextMonthlyReview(date = new Date()): number {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((next.getTime() - date.getTime()) / msPerDay));
}

function dayStateLabel(state: DayVisualState): string {
  if (state === "done") return "Done";
  if (state === "planned") return "Planned";
  if (state === "missed") return "Missed";
  if (state === "future") return "Future";
  return "Open";
}

function goalCoverageTone(done: number, total: number): TrafficLightTone {
  if (total > 0 && done >= total) return "green";
  if (done > 0) return "amber";
  return "red";
}

function GoalCoverageRing({ done, total, label }: { done: number; total: number; label: string }) {
  const ratio = total ? done / total : 0;
  const tone = goalCoverageTone(done, total);
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - ratio);

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex shrink-0 flex-col items-center">
        <div className="relative h-14 w-14">
          <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
            <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--app-border)" strokeWidth="6" opacity="0.35" />
            <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke={trafficLightVar(tone, "fill")}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-sm font-semibold leading-none">{done}/{total}</div>
        </div>
        </div>
        <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] app-subtle">{label}</div>
      </div>
      <div className={cn("rounded-[0.7rem] border px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap", trafficLightSurfaceClass(tone))}>
        {done >= total ? "Complete" : done > 0 ? "In progress" : "Start here"}
      </div>
    </div>
  );
}

function weekStartISOsForOutcomeMonth(outcome: Outcome, monthKey: string, weekStartsOn: WeekStartsOn): string[] {
  return weekStartsForMonth(monthKey, weekStartsOn).filter(
    (weekStartISO) => daysForWeekInMonth(weekStartISO, monthKey, outcome.startDate, outcome.endDate, outcome.daysOfWeek).length > 0
  );
}

function preferredWeekStartForMonth(
  outcome: Outcome,
  monthKey: string,
  weekStartsOn: WeekStartsOn,
  preferredDateISO?: string | null
): string | null {
  const weekStarts = weekStartISOsForOutcomeMonth(outcome, monthKey, weekStartsOn);
  if (!weekStarts.length) return null;
  if (!preferredDateISO) return weekStarts[0] ?? null;

  const preferredWeekStart = toISODate(startOfWeek(parseISODate(preferredDateISO), weekStartsOn));
  if (weekStarts.includes(preferredWeekStart)) return preferredWeekStart;

  const next = weekStarts.find((weekStartISO) => weekStartISO >= preferredWeekStart);
  if (next) return next;
  return weekStarts[weekStarts.length - 1] ?? null;
}

function preferredDayForWeek(
  outcome: Outcome,
  monthKey: string,
  weekStartISO: string,
  preferredDateISO?: string | null
): string | null {
  const days = daysForWeekInMonth(weekStartISO, monthKey, outcome.startDate, outcome.endDate, outcome.daysOfWeek);
  if (!days.length) return null;
  if (!preferredDateISO) return days[0] ?? null;
  if (days.includes(preferredDateISO)) return preferredDateISO;

  const next = days.find((dateISO) => dateISO >= preferredDateISO);
  if (next) return next;
  return days[days.length - 1] ?? null;
}

function focusForOutcome(
  outcome: Outcome | null | undefined,
  monthKeys: string[],
  weekStartsOn: WeekStartsOn
): { monthKey: string | null; weekKey: string | null; dateISO: string | null } {
  if (!outcome) return { monthKey: null, weekKey: null, dateISO: null };
  if (!monthKeys.length) return { monthKey: null, weekKey: null, dateISO: null };

  const today = todayISO();
  const todayDate = parseISODate(today);
  const start = parseISODate(outcome.startDate);
  const end = parseISODate(outcome.endDate);

  let monthKey = monthKeys[0] ?? null;
  if (todayDate.getTime() >= start.getTime() && todayDate.getTime() <= end.getTime()) {
    const m = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}`;
    if (monthKeys.includes(m)) monthKey = m;
  }

  if (!monthKey) return { monthKey, weekKey: null, dateISO: null };

  const weekStartISO = preferredWeekStartForMonth(outcome, monthKey, weekStartsOn, today);
  const dateISO = weekStartISO ? preferredDayForWeek(outcome, monthKey, weekStartISO, today) : null;
  return {
    monthKey,
    weekKey: weekStartISO ? `${monthKey}:${weekStartISO}` : null,
    dateISO
  };
}

export type PlanNavigation = {
  monthKeys: string[];
  yearKeys: string[];
  activeYearKey: string | null;
  activeMonthKey: string | null;
  activeWeekKey: string | null;
  activeWeekStartISO: string | null;
  activeDateISO: string | null;
  expandedMonths: Set<string>;
  expandedWeekKeys: Set<string>;
  allExpanded: boolean;
  goToYear: (yearKey: string) => void;
  goToMonth: (monthKey: string) => void;
  goToWeek: (monthKey: string, weekStartISO: string) => void;
  goToDay: (monthKey: string, weekStartISO: string, dateISO: string) => void;
  goRelativeMonth: (delta: -1 | 1) => void;
  toggleMonth: (monthKey: string) => void;
  toggleWeek: (weekKey: string) => void;
  toggleAll: () => void;
};

export function usePlanNavigation(outcome: Outcome | null | undefined, weekStartsOn: WeekStartsOn): PlanNavigation {
  const monthKeys = React.useMemo(
    () => (outcome ? monthKeysInRange(outcome.startDate, outcome.endDate).slice(0, MAX_PLAN_MONTHS) : []),
    [outcome?.startDate, outcome?.endDate]
  );
  const yearKeys = React.useMemo(() => Array.from(new Set(monthKeys.slice(24).map((monthKey) => monthKey.slice(0, 4)))), [monthKeys]);
  const [focusedMonth, setFocusedMonth] = React.useState<string | null>(null);
  const [focusedYearKey, setFocusedYearKey] = React.useState<string | null>(null);
  const [focusedWeekKey, setFocusedWeekKey] = React.useState<string | null>(null);
  const [focusedDateISO, setFocusedDateISO] = React.useState<string | null>(null);

  const [expandedMonths, setExpandedMonths] = React.useState<Set<string>>(() => {
    const { monthKey } = focusForOutcome(outcome, monthKeys, weekStartsOn);
    return monthKey ? new Set([monthKey]) : new Set();
  });

  const [expandedWeekKeys, setExpandedWeekKeys] = React.useState<Set<string>>(() => {
    const { weekKey } = focusForOutcome(outcome, monthKeys, weekStartsOn);
    return weekKey ? new Set([weekKey]) : new Set();
  });

  React.useEffect(() => {
    const { monthKey, weekKey, dateISO } = focusForOutcome(outcome, monthKeys, weekStartsOn);
    const currentYear = String(parseISODate(todayISO()).getFullYear());
    const preferredYearKey = yearKeys.includes(currentYear) ? currentYear : yearKeys[0] ?? null;
    setExpandedMonths(monthKey ? new Set([monthKey]) : new Set());
    setExpandedWeekKeys(weekKey ? new Set([weekKey]) : new Set());
    setFocusedMonth(monthKey);
    setFocusedYearKey(preferredYearKey);
    setFocusedWeekKey(weekKey);
    setFocusedDateISO(dateISO);
  }, [outcome?.id, outcome?.startDate, outcome?.endDate, monthKeys, weekStartsOn, yearKeys]);

  const allWeekKeys = React.useMemo(() => {
    if (!outcome) return [];
    return monthKeys.flatMap((monthKey) =>
      weekStartISOsForOutcomeMonth(outcome, monthKey, weekStartsOn).map((weekStartISO) => `${monthKey}:${weekStartISO}`)
    );
  }, [monthKeys, outcome, weekStartsOn]);

  const activeMonthKey = React.useMemo(() => {
    if (focusedMonth && monthKeys.includes(focusedMonth)) return focusedMonth;
    for (const monthKey of monthKeys) if (expandedMonths.has(monthKey)) return monthKey;
    return focusForOutcome(outcome, monthKeys, weekStartsOn).monthKey;
  }, [expandedMonths, focusedMonth, monthKeys, outcome, weekStartsOn]);

  const activeWeekStartISO = React.useMemo(() => {
    if (!outcome || !activeMonthKey) return null;
    const weekStarts = weekStartISOsForOutcomeMonth(outcome, activeMonthKey, weekStartsOn);
    if (!weekStarts.length) return null;

    const [focusedWeekMonthKey, focusedWeekStart] = focusedWeekKey?.split(":") ?? [];
    if (focusedWeekMonthKey === activeMonthKey && focusedWeekStart && weekStarts.includes(focusedWeekStart)) return focusedWeekStart;

    return preferredWeekStartForMonth(outcome, activeMonthKey, weekStartsOn, focusedDateISO ?? todayISO());
  }, [activeMonthKey, focusedDateISO, focusedWeekKey, outcome, weekStartsOn]);

  const activeWeekKey = activeMonthKey && activeWeekStartISO ? `${activeMonthKey}:${activeWeekStartISO}` : null;
  const activeYearKey = React.useMemo(() => {
    if (focusedYearKey && yearKeys.includes(focusedYearKey)) return focusedYearKey;
    if (activeMonthKey && yearKeys.includes(activeMonthKey.slice(0, 4))) return activeMonthKey.slice(0, 4);
    return yearKeys[0] ?? null;
  }, [activeMonthKey, focusedYearKey, yearKeys]);

  const activeDateISO = React.useMemo(() => {
    if (!outcome || !activeMonthKey || !activeWeekStartISO) return null;
    return preferredDayForWeek(outcome, activeMonthKey, activeWeekStartISO, focusedDateISO ?? todayISO());
  }, [activeMonthKey, activeWeekStartISO, focusedDateISO, outcome]);

  const allExpanded = monthKeys.length > 0 && expandedMonths.size === monthKeys.length && expandedWeekKeys.size === allWeekKeys.length;

  function scrollToMonth(monthKey: string) {
    const el = document.getElementById(`month-${monthKey}`);
    el?.scrollIntoView({ block: "nearest", inline: "start", behavior: "smooth" });
  }

  function goToMonth(monthKey: string) {
    const weekStartISO = outcome ? preferredWeekStartForMonth(outcome, monthKey, weekStartsOn, focusedDateISO ?? todayISO()) : null;
    const dateISO = outcome && weekStartISO ? preferredDayForWeek(outcome, monthKey, weekStartISO, focusedDateISO ?? todayISO()) : null;
    setFocusedMonth(monthKey);
    const yearKey = monthKey.slice(0, 4);
    if (yearKeys.includes(yearKey)) setFocusedYearKey(yearKey);
    setFocusedWeekKey(weekStartISO ? `${monthKey}:${weekStartISO}` : null);
    setFocusedDateISO(dateISO);
    setExpandedMonths((prev) => new Set([...prev, monthKey]));
    if (weekStartISO) {
      setExpandedWeekKeys((prev) => new Set([...prev, `${monthKey}:${weekStartISO}`]));
    }
    requestAnimationFrame(() => scrollToMonth(monthKey));
  }

  function goToYear(yearKey: string) {
    if (!yearKeys.includes(yearKey)) return;
    const firstMonthInYear = monthKeys.find((monthKey) => monthKey.startsWith(`${yearKey}-`)) ?? null;
    const weekStartISO = outcome && firstMonthInYear ? preferredWeekStartForMonth(outcome, firstMonthInYear, weekStartsOn, todayISO()) : null;
    const dateISO = outcome && firstMonthInYear && weekStartISO ? preferredDayForWeek(outcome, firstMonthInYear, weekStartISO, todayISO()) : null;
    setFocusedYearKey(yearKey);
    setFocusedMonth(firstMonthInYear);
    setFocusedWeekKey(firstMonthInYear && weekStartISO ? `${firstMonthInYear}:${weekStartISO}` : null);
    setFocusedDateISO(dateISO);
    if (firstMonthInYear) {
      setExpandedMonths((prev) => new Set([...prev, firstMonthInYear]));
      if (weekStartISO) setExpandedWeekKeys((prev) => new Set([...prev, `${firstMonthInYear}:${weekStartISO}`]));
    }
    requestAnimationFrame(() => {
      const el = document.getElementById(`year-${yearKey}`);
      el?.scrollIntoView({ block: "nearest", inline: "start", behavior: "smooth" });
    });
  }

  function goToWeek(monthKey: string, weekStartISO: string) {
    const dateISO = outcome ? preferredDayForWeek(outcome, monthKey, weekStartISO, focusedDateISO ?? todayISO()) : null;
    setFocusedMonth(monthKey);
    setFocusedWeekKey(`${monthKey}:${weekStartISO}`);
    setFocusedDateISO(dateISO);
    setExpandedMonths((prev) => new Set([...prev, monthKey]));
    setExpandedWeekKeys((prev) => new Set([...prev, `${monthKey}:${weekStartISO}`]));
    requestAnimationFrame(() => {
      const el = document.getElementById(`week-${monthKey}-${weekStartISO}`);
      el?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  function goToDay(monthKey: string, weekStartISO: string, dateISO: string) {
    setFocusedMonth(monthKey);
    setFocusedWeekKey(`${monthKey}:${weekStartISO}`);
    setFocusedDateISO(dateISO);
    setExpandedMonths((prev) => new Set([...prev, monthKey]));
    setExpandedWeekKeys((prev) => new Set([...prev, `${monthKey}:${weekStartISO}`]));
    requestAnimationFrame(() => {
      const el = document.getElementById(`day-${dateISO}`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  function goRelativeMonth(delta: -1 | 1) {
    if (!monthKeys.length) return;
    const current = activeMonthKey ?? monthKeys[0]!;
    const idx = monthKeys.indexOf(current);
    const next = monthKeys[idx + delta];
    if (!next) return;
    goToMonth(next);
  }

  function toggleMonth(monthKey: string) {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
    setFocusedMonth(monthKey);
  }

  function toggleWeek(weekKey: string) {
    setExpandedWeekKeys((prev) => {
      const next = new Set(prev);
      if (next.has(weekKey)) next.delete(weekKey);
      else next.add(weekKey);
      return next;
    });
  }

  function toggleAll() {
    if (allExpanded) {
      setExpandedMonths(new Set());
      setExpandedWeekKeys(new Set());
      setFocusedMonth(null);
      return;
    }

    setExpandedMonths(new Set(monthKeys));
    setExpandedWeekKeys(new Set(allWeekKeys));
    setFocusedMonth(activeMonthKey ?? monthKeys[0] ?? null);
  }

  return {
    monthKeys,
    yearKeys,
    activeYearKey,
    activeMonthKey,
    activeWeekKey,
    activeWeekStartISO,
    activeDateISO,
    expandedMonths,
    expandedWeekKeys,
    allExpanded,
    goToYear,
    goToMonth,
    goToWeek,
    goToDay,
    goRelativeMonth,
    toggleMonth,
    toggleWeek,
    toggleAll
  };
}

export { TimelineYardstick };

export default function PlanView({
  outcome,
  weekStartsOn,
  navigation
}: {
  outcome: Outcome;
  weekStartsOn: WeekStartsOn;
  navigation: PlanNavigation;
}) {
  const yearly = useAppState((s) => s.yearly);
  const monthly = useAppState((s) => s.monthly);
  const weekly = useAppState((s) => s.weekly);
  const daily = useAppState((s) => s.daily);
  const today = todayISO();
  const {
    monthKeys,
    yearKeys,
    activeYearKey,
    activeMonthKey,
    activeWeekStartISO,
    activeDateISO,
    goToYear,
    goToMonth,
    goToWeek,
    goToDay,
    goRelativeMonth
  } = navigation;
  const planningActions = React.useMemo(
    () => summarizePlanningActions(outcome, { yearly, monthly, weekly }, weekStartsOn),
    [monthly, outcome, weekStartsOn, weekly, yearly]
  );
  const isLongPlan = planningActions.category === "long";
  const reviewCycle = currentReviewCycle();
  const daysToNextReview = daysUntilNextMonthlyReview();
  const activeMonthIndex = activeMonthKey ? monthKeys.indexOf(activeMonthKey) : -1;
  const selectedMonthKey = activeMonthKey ?? monthKeys[0] ?? null;
  const selectedYearKey = activeYearKey && yearKeys.includes(activeYearKey) ? activeYearKey : yearKeys[0] ?? null;
  const selectedYearTitle = selectedYearKey ? yearly[`${outcome.id}:${selectedYearKey}`]?.title ?? "" : "";
  const yearSummaries = yearKeys.map((yearKey) => ({
    yearKey,
    title: yearly[`${outcome.id}:${yearKey}`]?.title?.trim() ?? ""
  }));
  const yearGoalsSet = yearSummaries.reduce((count, summary) => count + (summary.title ? 1 : 0), 0);
  const monthGoalValues = monthKeys.map((monthKey) => monthly[`${outcome.id}:${monthKey}`]?.title ?? "");
  const monthGoalsSet = populatedGoalCount(monthGoalValues);
  const monthGoalsReviewed = monthKeys.reduce((count, monthKey) => {
    const goal = monthly[`${outcome.id}:${monthKey}`];
    return count + (goal?.title?.trim().length && goal.reviewedCycle === reviewCycle ? 1 : 0);
  }, 0);
  const monthGoalsStale = monthKeys.reduce((count, monthKey) => {
    const goal = monthly[`${outcome.id}:${monthKey}`];
    return count + (goal?.title?.trim().length && goal.reviewedCycle !== reviewCycle ? 1 : 0);
  }, 0);
  const monthCoverageTone = goalCoverageTone(monthGoalsReviewed, monthKeys.length);
  const primaryCoverageTone = isLongPlan ? goalCoverageTone(yearGoalsSet, yearKeys.length) : monthCoverageTone;
  const selectedMonthGoal = selectedMonthKey ? monthly[`${outcome.id}:${selectedMonthKey}`] : undefined;
  const selectedMonthTitle = selectedMonthGoal?.title ?? "";
  const selectedMonthReviewed = Boolean(selectedMonthGoal?.title?.trim() && selectedMonthGoal.reviewedCycle === reviewCycle);
  const selectedWeekStarts = selectedMonthKey ? weekStartISOsForOutcomeMonth(outcome, selectedMonthKey, weekStartsOn) : [];
  const selectedWeekStartISO =
    activeWeekStartISO && selectedWeekStarts.includes(activeWeekStartISO) ? activeWeekStartISO : selectedWeekStarts[0] ?? null;
  const selectedWeekDays =
    selectedMonthKey && selectedWeekStartISO
      ? daysForWeekInMonth(selectedWeekStartISO, selectedMonthKey, outcome.startDate, outcome.endDate, outcome.daysOfWeek)
      : [];

  const monthSummaries = monthKeys.map((monthKey) => {
    const weeks = weekStartISOsForOutcomeMonth(outcome, monthKey, weekStartsOn);
    const weekGoalsSet = weeks.reduce((count, weekStartISO) => {
      const title = weekly[`${outcome.id}:${monthKey}:${weekStartISO}`]?.title?.trim() ?? "";
      return count + (title ? 1 : 0);
    }, 0);
    const days = weeks.flatMap((weekStartISO) => daysForWeekInMonth(weekStartISO, monthKey, outcome.startDate, outcome.endDate, outcome.daysOfWeek));
    const daysPlanned = days.reduce((count, dateISO) => count + (entryHasPlan(daily[`${outcome.id}:${dateISO}`]) ? 1 : 0), 0);
    const goal = monthly[`${outcome.id}:${monthKey}`];
    return {
      monthKey,
      weeks,
      weekGoalsSet,
      days,
      daysPlanned,
      title: goal?.title?.trim() ?? "",
      reviewed: Boolean(goal?.title?.trim() && goal.reviewedCycle === reviewCycle)
    };
  });

  function jumpToToday() {
    const start = parseISODate(outcome.startDate);
    const end = parseISODate(outcome.endDate);
    const current = parseISODate(today);
    if (current.getTime() < start.getTime() || current.getTime() > end.getTime()) return;
    if (!isDateActive(today, outcome.daysOfWeek)) return;
    const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
    const weekStartISO = toISODate(startOfWeek(current, weekStartsOn));
    goToDay(monthKey, weekStartISO, today);
  }

  function selectYear(yearKey: string) {
    goToYear(yearKey);
  }

  return (
    <div className="app-plan-view grid min-w-0 gap-3 overflow-hidden sm:gap-4">
      <Card className="app-plan-stage min-w-0 overflow-hidden rounded-[0.95rem] p-4 sm:rounded-[1rem] sm:p-6">
        <div className="app-plan-hero flex flex-wrap items-start justify-between gap-3 sm:gap-4">
          <div className="app-plan-hero-copy max-w-3xl min-w-0">
            <div className="app-kicker">{isLongPlan ? "Yearly Goals First" : "Monthly Goals First"}</div>
            <div className="font-display mt-1.5 text-[1.12rem] font-semibold leading-tight sm:mt-2 sm:text-[1.55rem]">
              Set the next layer.
            </div>
            <div className="app-plan-rule-copy mt-2 text-[13px] leading-5 app-muted sm:text-sm sm:leading-6">
              Months 1-6 need month and week goals. Months 7-24 need month goals. Month 25 onward needs year goals.
            </div>
          </div>

          <div className="app-plan-hero-actions flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Button size="sm" variant="ghost" onClick={jumpToToday}>
              Jump to today
            </Button>
            <Button size="sm" variant="ghost" aria-label="Previous month" onClick={() => goRelativeMonth(-1)} disabled={activeMonthIndex <= 0}>
              <Arrow dir="left" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Next month"
              onClick={() => goRelativeMonth(1)}
              disabled={activeMonthIndex < 0 || activeMonthIndex >= monthKeys.length - 1}
            >
              <Arrow dir="right" />
            </Button>
          </div>
        </div>

        <div className="app-plan-summary mt-4 grid gap-3 rounded-[0.85rem] border border-[color:var(--outcome-border)] bg-[color:var(--app-card)] p-3 sm:mt-5 sm:rounded-[0.9rem] sm:p-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
          <GoalCoverageRing done={isLongPlan ? yearGoalsSet : monthGoalsSet} total={isLongPlan ? yearKeys.length : monthKeys.length} label={isLongPlan ? "years" : "months"} />
          <div className="min-w-0">
            <div className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", trafficLightSurfaceClass(primaryCoverageTone))}>
              {isLongPlan ? `${yearGoalsSet} of ${yearKeys.length} year goals populated` : `${monthGoalsSet} of ${monthKeys.length} month goals populated`}
            </div>
            <div className="mt-2 text-[13px] leading-5 app-muted sm:text-sm sm:leading-6">
              {isLongPlan
                ? planningActions.years.outstanding > 0
                  ? `${planningActions.years.outstanding} year goal${planningActions.years.outstanding === 1 ? "" : "s"} still need defining.`
                  : "All year goals are defined. Use the monthly plan for detail."
                : monthGoalsReviewed >= monthKeys.length
                  ? "All month goals reviewed this month."
                  : monthGoalsStale > 0
                    ? `${monthGoalsStale} month goal${monthGoalsStale === 1 ? "" : "s"} need review this month.`
                    : "Start here. Set each month before getting precise."}
            </div>
          </div>
          <div className="flex items-center lg:justify-end">
            <div className="app-plan-summary-tile rounded-[0.9rem] border border-[color:var(--outcome-border)] bg-[color:var(--app-elevated)] px-3 py-2 text-right">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] app-subtle">{isLongPlan ? "Actions left" : "Next review"}</div>
              <div className="mt-1 text-sm font-semibold">
                {isLongPlan ? planningActions.outstanding : `${daysToNextReview} day${daysToNextReview === 1 ? "" : "s"}`}
              </div>
            </div>
          </div>
        </div>

        <div className="app-plan-note app-plan-rule-strip mt-4 flex flex-wrap items-center gap-2 rounded-[0.85rem] p-2.5 text-[13px] sm:mt-5 sm:p-3 sm:text-sm">
          <span className="app-plan-step-index">1</span>
          <span className="font-semibold">{isLongPlan ? "Year" : "Month"}</span>
          <span className="app-muted">&gt;</span>
          <span className="app-plan-step-index">2</span>
          <span className="font-semibold">{isLongPlan ? "Month" : "Weeks"}</span>
          <span className="app-muted">&gt;</span>
          <span className="app-plan-step-index">3</span>
          <span className="font-semibold">{isLongPlan ? "Weeks" : "Days"}</span>
          {isLongPlan ? (
            <>
              <span className="app-muted">&gt;</span>
              <span className="app-plan-step-index">4</span>
              <span className="font-semibold">Days</span>
            </>
          ) : null}
          <span className="min-w-[12rem] flex-1 text-[13px] leading-5 app-muted sm:text-sm sm:leading-6">
            Short plans require months and weeks. Medium plans add months after month 6. Long plans add year goals after month 24.
          </span>
        </div>

        {isLongPlan ? (
          <>
            <div className="app-plan-scroll-row app-plan-snap-row app-plan-year-row mt-4 flex gap-3 overflow-x-auto sm:mt-5">
              {yearSummaries.map((summary) => {
                const active = summary.yearKey === selectedYearKey;
                const tone = summary.title ? "green" : "red";
                return (
                  <button
                    key={summary.yearKey}
                    type="button"
                    id={`year-${summary.yearKey}`}
                    className="app-plan-rail-button app-plan-year-slide rounded-[0.85rem] p-2.5 text-left sm:rounded-[0.9rem] sm:p-3"
                    data-active={active}
                    onClick={() => selectYear(summary.yearKey)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="app-kicker">{summary.yearKey}</div>
                        <div className="mt-1 line-clamp-2 text-sm font-semibold">{summary.title || "Set yearly goal"}</div>
                      </div>
                      <span className={cn("rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]", trafficLightSurfaceClass(tone))}>
                        {summary.title ? "Set" : "Open"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedYearKey ? (
              <div className="app-plan-lane-card app-plan-year-goal-card mt-4 rounded-[0.9rem] p-3 sm:mt-5 sm:rounded-[1rem] sm:p-4" data-active="true">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)] lg:items-start">
                  <div>
                    <div className="app-kicker">Year goal</div>
                    <div className="font-display mt-1.5 text-[1.15rem] font-semibold leading-tight sm:mt-2 sm:text-[1.25rem]">{selectedYearKey}</div>
                    <div className="mt-2 text-[13px] leading-5 app-muted sm:text-sm sm:leading-6">
                      Set the broad outcome for this year. The monthly plan below should inherit from this.
                    </div>
                  </div>
                  <Textarea
                    value={selectedYearTitle}
                    onChange={(event) => actions.setYearlyTitle(outcome.id, selectedYearKey, event.target.value)}
                    placeholder="What should be true by the end of this year?"
                    className="app-plan-goal-textarea min-h-[6rem] resize-none rounded-[0.75rem] sm:min-h-[7rem]"
                  />
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        <div className="app-plan-scroll-row app-plan-snap-row app-plan-month-row mt-4 flex gap-3 overflow-x-auto sm:mt-5">
          {monthSummaries.map((summary) => {
            const active = summary.monthKey === selectedMonthKey;
            const tone = summary.reviewed ? "green" : summary.title ? "amber" : "red";
            return (
              <button
                key={summary.monthKey}
                type="button"
                id={`month-${summary.monthKey}`}
                className="app-plan-rail-button app-plan-month-slide rounded-[0.85rem] p-2.5 text-left sm:rounded-[0.9rem] sm:p-3"
                data-active={active}
                onClick={() => goToMonth(summary.monthKey)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="app-kicker">{compactMonthLabel(summary.monthKey)}</div>
                    <div className="mt-1 line-clamp-2 text-sm font-semibold">
                      {summary.title || "Set monthly goal"}
                    </div>
                  </div>
                  <span className={cn("rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]", trafficLightSurfaceClass(tone))}>
                    {summary.reviewed ? "Reviewed" : summary.title ? "Review" : "Open"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] app-muted">
                  <div>{summary.weekGoalsSet}/{summary.weeks.length} weeks</div>
                  <div>{summary.daysPlanned}/{summary.days.length} days</div>
                </div>
              </button>
            );
          })}
        </div>

        {selectedMonthKey ? (
          <div className="app-plan-cascade-grid mt-4 grid min-w-0 items-stretch gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-3">
            <div className="app-plan-lane-card app-plan-month-goal-card flex min-h-0 flex-col rounded-[0.9rem] p-3 sm:rounded-[1rem] sm:p-4" data-active="true">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="app-kicker">Month goal</div>
                  <div className="font-display mt-1.5 text-[1.15rem] font-semibold leading-tight sm:mt-2 sm:text-[1.25rem]">{formatMonthLabel(selectedMonthKey)}</div>
                </div>
                <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]", trafficLightSurfaceClass(selectedMonthReviewed ? "green" : selectedMonthTitle.trim() ? "amber" : "red"))}>
                  {selectedMonthReviewed ? "Reviewed" : selectedMonthTitle.trim() ? "Needs review" : "Open"}
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:mt-4">
                <div className="app-kicker">Goal for the month</div>
                <Textarea
                  value={selectedMonthTitle}
                  onChange={(event) => actions.setMonthlyTitle(outcome.id, selectedMonthKey, event.target.value)}
                  placeholder="What needs to be true by the end of this month?"
                  className="app-plan-goal-textarea min-h-[7rem] resize-none rounded-[0.75rem] sm:min-h-[8.5rem]"
                />
              </div>

              <div className="app-plan-note mt-3 rounded-[0.85rem] p-2.5 text-[13px] leading-5 app-muted sm:mt-4 sm:p-3 sm:text-sm sm:leading-6">
                Review monthly before changing the weekly plan. This keeps the cascade honest instead of letting old goals drift.
              </div>

              <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
                <Button
                  size="sm"
                  variant={selectedMonthReviewed ? "secondary" : "primary"}
                  disabled={!selectedMonthTitle.trim()}
                  onClick={() => actions.reviewMonthlyGoal(outcome.id, selectedMonthKey)}
                >
                  {selectedMonthReviewed ? "Reviewed this month" : "Review month"}
                </Button>
              </div>
            </div>

            <div className="app-plan-lane-card app-plan-week-lane flex min-h-0 flex-col rounded-[0.9rem] p-3 sm:rounded-[1rem] sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="app-kicker">Weekly goals</div>
                  <div className="mt-1.5 text-[13px] leading-5 app-muted sm:mt-2 sm:text-sm sm:leading-6">Turn the month into useful weekly checkpoints.</div>
                </div>
                <span className="app-pill rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
                  {selectedWeekStarts.length} weeks
                </span>
              </div>

              <div className="mt-3 grid gap-2.5 sm:mt-4 sm:gap-3">
                {selectedWeekStarts.map((weekStartISO) => {
                  const weekKey = `${selectedMonthKey}:${weekStartISO}`;
                  const active = weekStartISO === selectedWeekStartISO;
                  const weekDays = daysForWeekInMonth(weekStartISO, selectedMonthKey, outcome.startDate, outcome.endDate, outcome.daysOfWeek);
                  const plannedDays = weekDays.reduce((count, dateISO) => count + (entryHasPlan(daily[`${outcome.id}:${dateISO}`]) ? 1 : 0), 0);
                  const title = weekly[`${outcome.id}:${weekKey}`]?.title ?? "";
                  return (
                    <div
                      key={weekStartISO}
                      id={`week-${selectedMonthKey}-${weekStartISO}`}
                      className="app-plan-week-card rounded-[0.85rem] p-2.5 sm:rounded-[0.9rem] sm:p-3"
                      data-active={active}
                    >
                      <button type="button" className="w-full text-left" onClick={() => goToWeek(selectedMonthKey, weekStartISO)}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold">{formatWeekLabel(weekStartISO)}</div>
                          <div className="text-[11px] app-muted">{plannedDays}/{weekDays.length} days</div>
                        </div>
                      </button>
                      <Input
                        value={title}
                        onFocus={() => goToWeek(selectedMonthKey, weekStartISO)}
                        onChange={(event) => actions.setWeeklyTitle(outcome.id, selectedMonthKey, weekStartISO, event.target.value)}
                        placeholder="Weekly checkpoint..."
                        className="mt-2 h-9 rounded-[0.65rem] border-none bg-[color:var(--app-card)] px-3 text-[13px]"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="app-plan-lane-card app-plan-day-lane flex min-h-0 flex-col rounded-[0.9rem] p-3 sm:rounded-[1rem] sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="app-kicker">Daily commitments</div>
                  <div className="mt-1.5 text-[13px] leading-5 app-muted sm:mt-2 sm:text-sm sm:leading-6">
                    Make the selected week executable, one small commitment at a time.
                  </div>
                </div>
                <span className="app-pill rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
                  {selectedWeekStartISO ? formatWeekLabel(selectedWeekStartISO) : "No week"}
                </span>
              </div>

              <div className="mt-3 grid gap-2.5 sm:mt-4">
                {selectedWeekDays.map((dateISO) => {
                  const entry = daily[`${outcome.id}:${dateISO}`];
                  const items = dailyItems(entry);
                  const active = dateISO === activeDateISO;
                  const state = dayVisualState(entry, dateISO, today);
                  return (
                    <div
                      key={dateISO}
                      id={`day-${dateISO}`}
                      className="app-plan-day-button rounded-[0.8rem] p-2.5 sm:rounded-[0.85rem] sm:p-3"
                      data-active={active}
                    >
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 text-left"
                        onClick={() => selectedWeekStartISO && goToDay(selectedMonthKey, selectedWeekStartISO, dateISO)}
                      >
                        <div className="text-sm font-semibold">{dayTabLabel(dateISO)}</div>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]", daySurfaceClass(state))}>
                          {dayStateLabel(state)}
                        </span>
                      </button>
                      <Input
                        value={items[0] ?? ""}
                        onFocus={() => selectedWeekStartISO && goToDay(selectedMonthKey, selectedWeekStartISO, dateISO)}
                        onChange={(event) => actions.setDailyItem(outcome.id, dateISO, 0, event.target.value)}
                        placeholder="Smallest meaningful task..."
                        className="mt-2 h-9 rounded-[0.65rem] border-none bg-[color:var(--app-card)] px-3 text-[13px]"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
