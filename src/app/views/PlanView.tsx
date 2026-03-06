import React from "react";
import type { DailyGoal, Outcome, WeekStartsOn } from "../types";
import { actions, useAppState } from "../store";
import {
  daysForWeekInMonth,
  dayNumberToISO,
  formatMonthLabel,
  formatWeekLabel,
  isoToDayNumber,
  monthKeysInRange,
  parseISODate,
  startOfWeek,
  toISODate,
  weekStartsForMonth
} from "../date";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Progress from "../ui/Progress";

function dailyHasPlan(entry: DailyGoal | undefined): boolean {
  if (!entry) return false;
  const items = Array.isArray(entry.items) && entry.items.length ? entry.items : [entry.title];
  return items.some((t) => t.trim().length > 0);
}

function dayLabel(dateISO: string) {
  const d = parseISODate(dateISO);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function todayISO(): string {
  return toISODate(new Date());
}

function isToday(dateISO: string): boolean {
  return dateISO === todayISO();
}

function clampNum(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace("#", "").trim();
  const v = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(v)) return [255, 255, 255];
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const to2 = (n: number) => clampNum(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

function mixColor(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const mixed = [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)] as [number, number, number];
  return rgbToHex(mixed);
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={[
        "h-4 w-4 shrink-0 text-zinc-400 transition-transform",
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

function TimelineYardstick({
  outcome,
  monthKeys,
  weekStartsOn,
  expandedMonths,
  expandedWeekKeys,
  monthly,
  weekly,
  daily,
  onJumpMonth,
  onJumpWeek,
  onJumpDay
}: {
  outcome: Outcome;
  monthKeys: string[];
  weekStartsOn: WeekStartsOn;
  expandedMonths: Set<string>;
  expandedWeekKeys: Set<string>;
  monthly: Record<string, { title: string }>;
  weekly: Record<string, { title: string }>;
  daily: Record<string, DailyGoal>;
  onJumpMonth: (monthKey: string) => void;
  onJumpWeek: (monthKey: string, weekStartISO: string) => void;
  onJumpDay: (monthKey: string, weekStartISO: string, dateISO: string) => void;
}) {
  const startDay = isoToDayNumber(outcome.startDate);
  const endDay = isoToDayNumber(outcome.endDate);
  const span = Math.max(1, endDay - startDay);

  const width = 1000;
  const height = 140;
  const pad = 28;
  const y = 78;

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
        total++;
        const iso = dayNumberToISO(dn);
        const entry = daily[`${outcome.id}:${iso}`];
        if (entry?.done) done++;
        else if (dailyHasPlan(entry)) planned++;
      }

      const doneRatio = total ? done / total : 0;
      const plannedRatio = total ? planned / total : 0;
      return { monthKey, segStart, segEnd, monthTitle, done, planned, total, doneRatio, plannedRatio };
    });
  }, [daily, endDay, monthKeys, monthly, outcome.id, startDay]);

  const expandedWeekDetails = React.useMemo(() => {
    const out: Array<{ monthKey: string; weekStartISO: string; weekTitle: string; days: string[] }> = [];
    for (const wk of expandedWeekKeys) {
      const [monthKey, weekStartISO] = wk.split(":");
      if (!monthKey || !weekStartISO) continue;
      const days = daysForWeekInMonth(weekStartISO, monthKey, outcome.startDate, outcome.endDate);
      if (!days.length) continue;
      const weekTitle = weekly[`${outcome.id}:${monthKey}:${weekStartISO}`]?.title?.trim() ?? "";
      out.push({ monthKey, weekStartISO, weekTitle, days });
    }
    return out;
  }, [expandedWeekKeys, outcome.endDate, outcome.id, outcome.startDate, weekly]);

  function monthLabel(monthKey: string): string {
    const [yy, mm] = monthKey.split("-").map(Number);
    const d = new Date(yy, mm - 1, 1);
    return d.toLocaleString(undefined, { month: "short" });
  }

  const base = "#18181b"; // zinc-900
  const doneColor = "#34d399"; // emerald-400
  const plannedColor = "#fbbf24"; // amber-400

  return (
    <div className="rounded-2xl border border-zinc-900 bg-zinc-950/20 p-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-zinc-400">Timeline yardstick</div>
          <div className="mt-1 text-xs text-zinc-500">It “zooms in” as you expand months/weeks.</div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: plannedColor }} /> Planned
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: doneColor }} /> Done
          </div>
        </div>
      </div>

      <svg className="mt-3 h-28 w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Timeline yardstick">
        <line x1={pad} y1={y} x2={width - pad} y2={y} stroke="#27272a" strokeWidth={2} />

        {monthSegments.map((m) => {
          const x1 = xForDay(m.segStart);
          const x2 = xForDay(m.segEnd);
          const len = Math.max(2, x2 - x1);
          const doneStroke = mixColor(base, doneColor, clampNum(m.doneRatio, 0, 1));
          const plannedStroke = mixColor(base, plannedColor, clampNum(m.plannedRatio, 0, 1));
          const labelX = x1 + len / 2;
          const wideEnough = len >= 48;

          return (
            <g key={m.monthKey}>
              <line
                x1={x1}
                y1={y}
                x2={x1 + len}
                y2={y}
                stroke={doneStroke}
                strokeWidth={12}
                strokeLinecap="round"
                style={{ cursor: "pointer" }}
                onClick={() => onJumpMonth(m.monthKey)}
              >
                <title>
                  {m.monthKey} • {m.done}/{m.total} done • {m.planned}/{m.total} planned
                </title>
              </line>

              {m.planned > 0 ? (
                <line
                  x1={x1}
                  y1={y + 10}
                  x2={x1 + len}
                  y2={y + 10}
                  stroke={plannedStroke}
                  strokeWidth={4}
                  strokeLinecap="round"
                  opacity={0.9}
                />
              ) : null}

              {wideEnough ? (
                <text x={labelX} y={y - 22} textAnchor="middle" fill="#a1a1aa" fontSize={12}>
                  {monthLabel(m.monthKey)}
                </text>
              ) : null}

              {m.monthTitle ? (
                <circle cx={labelX} cy={y - 10} r={4} fill="#e4e4e7">
                  <title>Monthly goal: {m.monthTitle}</title>
                </circle>
              ) : null}
            </g>
          );
        })}

        {Array.from(expandedMonths).flatMap((monthKey) => {
          const weekStarts = weekStartsForMonth(monthKey, weekStartsOn).filter(
            (ws) => daysForWeekInMonth(ws, monthKey, outcome.startDate, outcome.endDate).length > 0
          );

          return weekStarts.map((weekStartISO) => {
            const dn = isoToDayNumber(weekStartISO);
            if (dn < startDay || dn > endDay) return null;
            const x = xForDay(dn);
            const title = weekly[`${outcome.id}:${monthKey}:${weekStartISO}`]?.title?.trim() ?? "";
            const tick = title ? plannedColor : "#3f3f46";
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
            const isDone = Boolean(entry?.done);
            const isPlanned = dailyHasPlan(entry);
            const fill = isDone ? doneColor : isPlanned ? plannedColor : "#3f3f46";
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
                  {dateISO} • {isDone ? "done" : isPlanned ? "planned" : "unplanned"} • {entry?.title?.trim() ?? ""}
                </title>
              </circle>
            );
          })
        )}

        {hasToday ? (
          <g>
            <line x1={xForDay(todayDay)} y1={y - 36} x2={xForDay(todayDay)} y2={y + 28} stroke="#e4e4e7" strokeWidth={2} opacity={0.7} />
            <text x={xForDay(todayDay)} y={y + 46} textAnchor="middle" fill="#e4e4e7" fontSize={11}>
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
      className={["h-4 w-4 shrink-0 text-zinc-200", dir === "left" ? "" : "rotate-180"].join(" ")}
    >
      <path
        fill="currentColor"
        d="M12.78 4.47a.75.75 0 0 1 0 1.06L8.31 10l4.47 4.47a.75.75 0 1 1-1.06 1.06l-5-5a.75.75 0 0 1 0-1.06l5-5a.75.75 0 0 1 1.06 0Z"
      />
    </svg>
  );
}

function focusForOutcome(
  outcome: Outcome,
  monthKeys: string[],
  weekStartsOn: WeekStartsOn
): { monthKey: string | null; weekKey: string | null } {
  if (!monthKeys.length) return { monthKey: null, weekKey: null };

  const today = parseISODate(todayISO());
  const start = parseISODate(outcome.startDate);
  const end = parseISODate(outcome.endDate);

  let monthKey = monthKeys[0] ?? null;
  if (today.getTime() >= start.getTime() && today.getTime() <= end.getTime()) {
    const m = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    if (monthKeys.includes(m)) monthKey = m;
  }

  if (!monthKey) return { monthKey, weekKey: null };
  const weekStart = toISODate(startOfWeek(today, weekStartsOn));
  return { monthKey, weekKey: `${monthKey}:${weekStart}` };
}

export default function PlanView({ outcome, weekStartsOn }: { outcome: Outcome; weekStartsOn: WeekStartsOn }) {
  const monthly = useAppState((s) => s.monthly);
  const weekly = useAppState((s) => s.weekly);
  const daily = useAppState((s) => s.daily);
  const showMonthlyObjectives = useAppState((s) => s.ui.showMonthlyObjectives);
  const showWeeklyObjectives = useAppState((s) => s.ui.showWeeklyObjectives);

  const monthKeys = React.useMemo(() => monthKeysInRange(outcome.startDate, outcome.endDate), [outcome.startDate, outcome.endDate]);

  const [focusedMonth, setFocusedMonth] = React.useState<string | null>(null);

  const [expandedMonths, setExpandedMonths] = React.useState<Set<string>>(() => {
    const { monthKey } = focusForOutcome(outcome, monthKeys, weekStartsOn);
    return monthKey ? new Set([monthKey]) : new Set();
  });

  const [expandedWeekKeys, setExpandedWeekKeys] = React.useState<Set<string>>(() => {
    const { weekKey } = focusForOutcome(outcome, monthKeys, weekStartsOn);
    return weekKey ? new Set([weekKey]) : new Set();
  });

  React.useEffect(() => {
    const { monthKey, weekKey } = focusForOutcome(outcome, monthKeys, weekStartsOn);
    setExpandedMonths(monthKey ? new Set([monthKey]) : new Set());
    setExpandedWeekKeys(weekKey ? new Set([weekKey]) : new Set());
    setFocusedMonth(monthKey);
  }, [outcome.id, outcome.startDate, outcome.endDate, monthKeys, weekStartsOn]);

  const activeMonthKey = React.useMemo(() => {
    if (focusedMonth && monthKeys.includes(focusedMonth)) return focusedMonth;
    for (const mk of monthKeys) if (expandedMonths.has(mk)) return mk;
    return focusForOutcome(outcome, monthKeys, weekStartsOn).monthKey;
  }, [expandedMonths, focusedMonth, monthKeys, outcome, weekStartsOn]);

  function scrollToMonth(monthKey: string) {
    const el = document.getElementById(`month-${monthKey}`);
    el?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function goToMonth(monthKey: string) {
    setFocusedMonth(monthKey);
    setExpandedMonths((prev) => new Set([...prev, monthKey]));
    requestAnimationFrame(() => scrollToMonth(monthKey));
  }

  function goToWeek(monthKey: string, weekStartISO: string) {
    setFocusedMonth(monthKey);
    setExpandedMonths((prev) => new Set([...prev, monthKey]));
    setExpandedWeekKeys((prev) => new Set([...prev, `${monthKey}:${weekStartISO}`]));
    requestAnimationFrame(() => {
      const el = document.getElementById(`week-${monthKey}-${weekStartISO}`);
      el?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  function goToDay(monthKey: string, weekStartISO: string, dateISO: string) {
    setFocusedMonth(monthKey);
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

  function monthProgress(monthKey: string): { done: number; total: number } {
    const weekStarts = weekStartsForMonth(monthKey, weekStartsOn);
    let done = 0;
    let total = 0;
    for (const ws of weekStarts) {
      const days = daysForWeekInMonth(ws, monthKey, outcome.startDate, outcome.endDate);
      total += days.length;
      for (const d of days) if (daily[`${outcome.id}:${d}`]?.done) done++;
    }
    return { done, total };
  }

  return (
    <div className="grid gap-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Plan</div>
            <div className="mt-1 text-sm text-zinc-400">
              Fill the plan top-down: outcome → month focus → week focus → daily commitment.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={showMonthlyObjectives ? "secondary" : "ghost"}
              aria-pressed={showMonthlyObjectives}
              onClick={() => actions.toggleShowMonthlyObjectives()}
              title="Toggle showing monthly objectives in the collapsed month rows"
            >
              {showMonthlyObjectives ? "Monthly objectives: on" : "Monthly objectives: off"}
            </Button>
            <Button
              size="sm"
              variant={showWeeklyObjectives ? "secondary" : "ghost"}
              aria-pressed={showWeeklyObjectives}
              onClick={() => actions.toggleShowWeeklyObjectives()}
              title="Toggle showing weekly objectives in the collapsed week rows"
            >
              {showWeeklyObjectives ? "Weekly objectives: on" : "Weekly objectives: off"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const today = todayISO();
                const start = parseISODate(outcome.startDate);
                const end = parseISODate(outcome.endDate);
                const t = parseISODate(today);
                if (t.getTime() < start.getTime() || t.getTime() > end.getTime()) return;
                const monthKey = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
                setFocusedMonth(monthKey);
                setExpandedMonths((prev) => new Set([...prev, monthKey]));
                const weekStart = toISODate(startOfWeek(t, weekStartsOn));
                setExpandedWeekKeys((prev) => new Set([...prev, `${monthKey}:${weekStart}`]));
                const el = document.getElementById(`day-${today}`);
                el?.scrollIntoView({ block: "center" });
              }}
            >
              Jump to today
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              aria-label="Previous month"
              onClick={() => goRelativeMonth(-1)}
              disabled={!activeMonthKey || monthKeys.indexOf(activeMonthKey) <= 0}
            >
              <Arrow dir="left" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Next month"
              onClick={() => goRelativeMonth(1)}
              disabled={!activeMonthKey || monthKeys.indexOf(activeMonthKey) >= monthKeys.length - 1}
            >
              <Arrow dir="right" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setExpandedMonths(new Set());
                setExpandedWeekKeys(new Set());
                setFocusedMonth(null);
              }}
            >
              Collapse all
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <TimelineYardstick
            outcome={outcome}
            monthKeys={monthKeys}
            weekStartsOn={weekStartsOn}
            expandedMonths={expandedMonths}
            expandedWeekKeys={expandedWeekKeys}
            monthly={monthly}
            weekly={weekly}
            daily={daily}
            onJumpMonth={goToMonth}
            onJumpWeek={goToWeek}
            onJumpDay={goToDay}
          />
        </div>
      </Card>

      <div className="grid gap-3">
        {monthKeys.map((monthKey) => {
          const expanded = expandedMonths.has(monthKey);
          const monthStoreKey = `${outcome.id}:${monthKey}`;
          const monthTitle = monthly[monthStoreKey]?.title ?? "";
          const { done, total } = monthProgress(monthKey);
          const weekStarts = weekStartsForMonth(monthKey, weekStartsOn).filter(
            (ws) => daysForWeekInMonth(ws, monthKey, outcome.startDate, outcome.endDate).length > 0
          );

          return (
            <Card key={monthKey} id={`month-${monthKey}`} className="overflow-hidden">
              <button
                className="flex w-full items-center justify-between gap-3 border-b border-zinc-900 bg-zinc-950/30 px-4 py-3 text-left hover:bg-zinc-950/60"
                aria-expanded={expanded}
                onClick={() => toggleMonth(monthKey)}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{formatMonthLabel(monthKey)}</div>
                  {showMonthlyObjectives ? (
                    <div
                      className={["mt-1 truncate text-xs", monthTitle.trim() ? "text-zinc-200" : "text-zinc-500"].join(" ")}
                      title={monthTitle.trim() ? monthTitle : "No monthly objective yet"}
                    >
                      Monthly: {monthTitle.trim() ? monthTitle : "—"}
                    </div>
                  ) : null}
                  <div className="mt-1 text-xs text-zinc-400">
                    {total ? `${done}/${total} consistent days` : "No days in range"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-32">
                    <Progress value={total ? done / total : 0} />
                  </div>
                  <Chevron open={expanded} />
                </div>
              </button>

              {expanded ? (
                <div className="grid gap-3 p-4">
                  <div className="grid gap-2">
                    <div className="text-xs font-medium text-zinc-400">Monthly goal (single calendar month)</div>
                    <Input
                      value={monthTitle}
                      onChange={(e) => actions.setMonthlyTitle(outcome.id, monthKey, e.target.value)}
                      placeholder="What outcome matters most this month?"
                    />
                  </div>

                  <div className="grid gap-2">
                    <div className="text-xs font-medium text-zinc-400">Weekly goals (calendar weeks)</div>
                    <div className="grid gap-2">
                      {weekStarts.map((weekStartISO) => {
                        const weekKey = `${outcome.id}:${monthKey}:${weekStartISO}`;
                        const weekTitle = weekly[weekKey]?.title ?? "";
                        const weekDays = daysForWeekInMonth(weekStartISO, monthKey, outcome.startDate, outcome.endDate);
                        const expandedWeek = expandedWeekKeys.has(`${monthKey}:${weekStartISO}`);
                        const expandedWeekKey = `${monthKey}:${weekStartISO}`;

                        const doneDays = weekDays.reduce(
                          (acc, d) => acc + (daily[`${outcome.id}:${d}`]?.done ? 1 : 0),
                          0
                        );

                        return (
                          <Card key={weekKey} id={`week-${monthKey}-${weekStartISO}`} className="overflow-hidden">
	                            <button
	                              className="flex w-full items-center justify-between gap-3 border-b border-zinc-900 bg-zinc-950/20 px-4 py-3 text-left hover:bg-zinc-950/50"
	                              aria-expanded={expandedWeek}
	                              onClick={() => toggleWeek(expandedWeekKey)}
	                            >
	                              <div className="min-w-0">
	                                <div className="truncate text-sm font-semibold">{formatWeekLabel(weekStartISO)}</div>
	                                {showWeeklyObjectives ? (
	                                  <div
	                                    className={["mt-1 truncate text-xs", weekTitle.trim() ? "text-zinc-200" : "text-zinc-500"].join(" ")}
	                                    title={weekTitle.trim() ? weekTitle : "No weekly objective yet"}
	                                  >
	                                    Weekly: {weekTitle.trim() ? weekTitle : "—"}
	                                  </div>
	                                ) : null}
	                                <div className="mt-1 text-xs text-zinc-400">
	                                  {weekDays.length ? `${doneDays}/${weekDays.length} days done` : "No days in this month-week"}
	                                </div>
	                              </div>
                              <div className="flex items-center gap-3">
                                <div className="w-24">
                                  <Progress value={weekDays.length ? doneDays / weekDays.length : 0} />
                                </div>
                                <Chevron open={expandedWeek} />
                              </div>
                            </button>

                            {expandedWeek ? (
                              <div className="grid gap-3 p-4">
                                <div className="grid gap-2">
                                  <div className="text-xs font-medium text-zinc-400">Weekly goal</div>
                                  <Input
                                    value={weekTitle}
                                    onChange={(e) => actions.setWeeklyTitle(outcome.id, monthKey, weekStartISO, e.target.value)}
                                    placeholder="What would make this week a win?"
                                  />
                                </div>

                                <div className="grid gap-2">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-xs font-medium text-zinc-400">Daily commitments</div>
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        const first = weekDays[0];
                                        if (!first) return;
                                        const el = document.getElementById(`day-${first}`);
                                        el?.scrollIntoView({ block: "center" });
                                      }}
                                    >
                                      First day
                                    </Button>
                                  </div>

                                  <div className="grid gap-2">
                                    {weekDays.map((dateISO) => {
                                      const dayKey = `${outcome.id}:${dateISO}`;
                                      const entry = daily[dayKey] ?? { title: "", done: false };
                                      const items =
                                        Array.isArray(entry.items) && entry.items.length ? entry.items : [entry.title ?? ""];
                                      const itemsDone = Array.isArray(entry.itemsDone) ? entry.itemsDone : [];
                                      return (
                                        <div
                                          key={dateISO}
                                          id={`day-${dateISO}`}
                                          className={[
                                            "flex flex-col gap-2 rounded-2xl border p-3 sm:flex-row sm:items-start",
                                            isToday(dateISO) ? "border-emerald-500/40 bg-emerald-500/5" : "border-zinc-900 bg-zinc-950/30"
                                          ].join(" ")}
                                        >
                                          <div className="flex items-center gap-3 sm:w-44">
                                            <button
                                              className={[
                                                "h-6 w-6 rounded-lg border transition",
                                                entry.done ? "border-emerald-400 bg-emerald-400/20" : "border-zinc-800 bg-zinc-950"
                                              ].join(" ")}
                                              aria-label={entry.done ? "Mark not done" : "Mark done"}
                                              onClick={() => actions.toggleDailyDone(outcome.id, dateISO)}
                                            />
                                            <div className="text-sm font-medium">{dayLabel(dateISO)}</div>
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <div className="grid gap-2">
                                              {items.map((t, idx) => {
                                                const done = Boolean(itemsDone[idx]);
                                                return (
                                                  <div key={idx} className="flex items-center gap-2">
                                                    <button
                                                      type="button"
                                                      className={[
                                                        "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition focus:outline-none focus:ring-2 focus:ring-zinc-200/20",
                                                        done
                                                          ? "border-emerald-400 bg-emerald-400/20 text-emerald-200"
                                                          : "border-zinc-800 bg-zinc-950 text-transparent hover:bg-zinc-900"
                                                      ].join(" ")}
                                                      aria-label={done ? `Mark task ${idx + 1} not done` : `Mark task ${idx + 1} done`}
                                                      aria-pressed={done}
                                                      title={done ? "Mark not done" : "Mark done"}
                                                      onClick={() => actions.toggleDailyItemDone(outcome.id, dateISO, idx)}
                                                    >
                                                      ✓
                                                    </button>
                                                    <Input
                                                      value={t}
                                                      onChange={(e) => actions.setDailyItem(outcome.id, dateISO, idx, e.target.value)}
                                                      placeholder={idx === 0 ? "Daily: the smallest thing you’ll actually do." : "Another tiny task…"}
                                                      className={[
                                                        "h-9 rounded-lg px-2 text-[13px]",
                                                        done ? "text-zinc-400 line-through placeholder:text-zinc-600" : ""
                                                      ].join(" ")}
                                                      aria-label={`Daily task ${idx + 1}`}
                                                    />
                                                  </div>
                                                );
                                              })}
                                              <div className="flex justify-end">
                                                <button
                                                  type="button"
                                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-200/20"
                                                  aria-label="Add daily task"
                                                  title="Add daily task"
                                                  onClick={() => actions.addDailyItem(outcome.id, dateISO)}
                                                >
                                                  +
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
