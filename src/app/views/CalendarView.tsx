import React from "react";
import type { DailyGoal, Outcome, WeekStartsOn } from "../types";
import { actions, useAppState } from "../store";
import {
  dateISOsInRange,
  formatDaysOfWeek,
  formatMonthLabel,
  formatShortDate,
  isDateActive,
  monthKeyFromDate,
  parseISODate,
  startOfWeek,
  toISODate,
  yearsInRange
} from "../date";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Modal from "../ui/Modal";
import { cn } from "../ui/cn";

type DayState = "out" | "none" | "planned" | "done";

function dailyHasPlan(entry: DailyGoal | undefined): boolean {
  if (!entry) return false;
  const items = Array.isArray(entry.items) && entry.items.length ? entry.items : [entry.title];
  return items.some((t) => t.trim().length > 0);
}

function dayState(outcomeId: string, dateISO: string, daily: Record<string, DailyGoal>, inRange: boolean): DayState {
  if (!inRange) return "out";
  const entry = daily[`${outcomeId}:${dateISO}`];
  if (!entry) return "none";
  if (entry.done) return "done";
  if (dailyHasPlan(entry)) return "planned";
  return "none";
}

function isoInRange(dateISO: string, startISO: string, endISO: string): boolean {
  const d = parseISODate(dateISO).getTime();
  return d >= parseISODate(startISO).getTime() && d <= parseISODate(endISO).getTime();
}

function streakInfo(outcome: Outcome, daily: Record<string, DailyGoal>): { current: number; best: number } {
  const start = parseISODate(outcome.startDate);
  const end = parseISODate(outcome.endDate);
  const today = new Date();
  const until = today.getTime() > end.getTime() ? end : today;

  let current = 0;
  for (let d = new Date(until); d.getTime() >= start.getTime(); d.setDate(d.getDate() - 1)) {
    const iso = toISODate(d);
    if (!isDateActive(iso, outcome.daysOfWeek)) continue;
    const entry = daily[`${outcome.id}:${iso}`];
    if (entry?.done) current++;
    else break;
  }

  let best = 0;
  let run = 0;
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
    const iso = toISODate(d);
    if (!isDateActive(iso, outcome.daysOfWeek)) continue;
    const entry = daily[`${outcome.id}:${iso}`];
    if (entry?.done) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }

  return { current, best };
}

function YearCalendar({
  outcome,
  year,
  weekStartsOn,
  onSelectDay
}: {
  outcome: Outcome;
  year: number;
  weekStartsOn: WeekStartsOn;
  onSelectDay: (dateISO: string) => void;
}) {
  const daily = useAppState((s) => s.daily);

  const months = Array.from({ length: 12 }, (_, i) => i);
  const weekDayLabels = Array.from({ length: 7 }, (_, i) => {
    // 2023-01-01 is a Sunday; shift by weekStartsOn and then by i.
    const dayOfWeek = (weekStartsOn + i) % 7;
    const d = new Date(2023, 0, 1 + dayOfWeek);
    return d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2);
  });

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {months.map((monthIndex) => {
          const monthStart = new Date(year, monthIndex, 1);
          const monthKey = monthKeyFromDate(monthStart);
          const firstDay = monthStart;
          const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
          const offset = (firstDay.getDay() - weekStartsOn + 7) % 7;
          const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;

          return (
            <Card key={monthIndex} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">{formatMonthLabel(monthKey)}</div>
                <div className="text-xs text-zinc-500">Click a day to check in</div>
              </div>

              <div className="mt-3 grid grid-cols-7 gap-1 text-[11px] text-zinc-500">
                {weekDayLabels.map((w) => (
                  <div key={w} className="px-1 py-1">
                    {w}
                  </div>
                ))}
              </div>

              <div className="mt-1 grid grid-cols-7 gap-1">
                {Array.from({ length: totalCells }, (_, idx) => {
                  const dayNum = idx - offset + 1;
                  if (dayNum < 1 || dayNum > daysInMonth) return <div key={idx} className="h-7 rounded-lg" />;
                  const dateISO = toISODate(new Date(year, monthIndex, dayNum));
                  const inRange = isoInRange(dateISO, outcome.startDate, outcome.endDate);
                  const active = inRange && isDateActive(dateISO, outcome.daysOfWeek);
                  const state = dayState(outcome.id, dateISO, daily, active);

                  const base = "h-7 w-full rounded-lg border transition";
                  const styles: Record<DayState, string> = {
                    out: "border-transparent bg-zinc-950/10 opacity-40",
                    none: "border-zinc-900 bg-zinc-950 hover:bg-zinc-900",
                    planned: "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20",
                    done: "border-emerald-400/40 bg-emerald-500/20 hover:bg-emerald-500/30"
                  };

                  return (
                    <button
                      key={idx}
                      className={cn(base, styles[state])}
                      disabled={!active}
                      onClick={() => onSelectDay(dateISO)}
                      title={formatShortDate(dateISO)}
                    >
                      <div className="flex h-full items-center justify-center text-xs text-zinc-200">{dayNum}</div>
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function DayModal({
  open,
  onClose,
  outcome,
  weekStartsOn,
  dateISO
}: {
  open: boolean;
  onClose: () => void;
  outcome: Outcome;
  weekStartsOn: WeekStartsOn;
  dateISO: string | null;
}) {
  const monthly = useAppState((s) => s.monthly);
  const weekly = useAppState((s) => s.weekly);
  const daily = useAppState((s) => s.daily);

  if (!dateISO) return null;
  const entry = daily[`${outcome.id}:${dateISO}`] ?? { title: "", done: false };
  const items = Array.isArray(entry.items) && entry.items.length ? entry.items : [entry.title ?? ""];
  const itemsDone = Array.isArray(entry.itemsDone) ? entry.itemsDone : [];

  const d = parseISODate(dateISO);
  const monthKey = monthKeyFromDate(d);
  const weekStartISO = toISODate(startOfWeek(d, weekStartsOn));
  const monthTitle = monthly[`${outcome.id}:${monthKey}`]?.title ?? "";
  const weekTitle = weekly[`${outcome.id}:${monthKey}:${weekStartISO}`]?.title ?? "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={formatShortDate(dateISO)}
      footer={
        <>
          <Button
            onClick={() => actions.toggleDailyDone(outcome.id, dateISO)}
            variant={entry.done ? "secondary" : "primary"}
          >
            {entry.done ? "Mark not done" : "Mark done"}
          </Button>
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Card className="p-4">
          <div className="text-xs font-medium text-zinc-400">Context</div>
          <div className="mt-2 grid gap-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <div className="text-xs text-zinc-400">Monthly</div>
              <div className="mt-1 text-sm text-zinc-200">{monthTitle || "—"}</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <div className="text-xs text-zinc-400">Weekly</div>
              <div className="mt-1 text-sm text-zinc-200">{weekTitle || "—"}</div>
            </div>
          </div>
        </Card>

        <div className="grid gap-2">
          <div className="text-xs font-medium text-zinc-400">Daily tasks</div>
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
                    placeholder={idx === 0 ? "The smallest slice you can finish today." : "Another tiny task…"}
                    className={[
                      "h-9 flex-1 rounded-lg px-2 text-[13px]",
                      done ? "text-zinc-400 line-through placeholder:text-zinc-600" : ""
                    ].join(" ")}
                    aria-label={`Daily task ${idx + 1}`}
                  />
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-200/20"
                    aria-label={`Delete daily task ${idx + 1}`}
                    title="Delete daily task"
                    onClick={() => actions.removeDailyItem(outcome.id, dateISO, idx)}
                  >
                    -
                  </button>
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
          <div className="text-xs text-zinc-500">Tip: if it takes longer than ~10 minutes, make it smaller.</div>
        </div>
      </div>
    </Modal>
  );
}

export default function CalendarView({ outcome, weekStartsOn }: { outcome: Outcome; weekStartsOn: WeekStartsOn }) {
  const daily = useAppState((s) => s.daily);
  const years = React.useMemo(() => yearsInRange(outcome.startDate, outcome.endDate), [outcome.startDate, outcome.endDate]);
  const [year, setYear] = React.useState(years[0] ?? new Date().getFullYear());
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);
  const [dayOpen, setDayOpen] = React.useState(false);

  React.useEffect(() => {
    if (years.includes(year)) return;
    if (years.length) setYear(years[0]);
  }, [years, year]);

  const { current, best } = React.useMemo(() => streakInfo(outcome, daily), [outcome, daily]);

  const totalDays = React.useMemo(() => {
    return dateISOsInRange(outcome.startDate, outcome.endDate, outcome.daysOfWeek).length;
  }, [outcome.daysOfWeek, outcome.endDate, outcome.startDate]);

  const doneDays = React.useMemo(() => {
    return dateISOsInRange(outcome.startDate, outcome.endDate, outcome.daysOfWeek).reduce(
      (count, iso) => count + (daily[`${outcome.id}:${iso}`]?.done ? 1 : 0),
      0
    );
  }, [daily, outcome.daysOfWeek, outcome.endDate, outcome.id, outcome.startDate]);

  return (
    <div className="grid gap-4">
      <Card className="p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="text-sm font-semibold">Consistency calendar</div>
            <div className="mt-1 text-sm text-zinc-400">See the whole year at a glance. Green = done.</div>
            <div className="mt-2 text-xs text-zinc-500">Active days: {formatDaysOfWeek(outcome.daysOfWeek)}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
              <span className="text-zinc-400">Current streak:</span> {current} day{current === 1 ? "" : "s"}
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
              <span className="text-zinc-400">Best streak:</span> {best} day{best === 1 ? "" : "s"}
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
              <span className="text-zinc-400">Done:</span> {doneDays}/{totalDays}
            </div>

            {years.length > 1 ? (
              <select
                className="h-10 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            ) : null}

            <Button
              onClick={() => {
                const t = toISODate(new Date());
                if (!isoInRange(t, outcome.startDate, outcome.endDate)) return;
                if (!isDateActive(t, outcome.daysOfWeek)) return;
                setSelectedDay(t);
                setDayOpen(true);
              }}
            >
              Today
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded border border-zinc-900 bg-zinc-950" /> Unplanned
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded border border-amber-500/30 bg-amber-500/10" /> Planned
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded border border-emerald-400/40 bg-emerald-500/20" /> Done
          </div>
        </div>
      </Card>

      <YearCalendar
        outcome={outcome}
        year={year}
        weekStartsOn={weekStartsOn}
        onSelectDay={(d) => {
          setSelectedDay(d);
          setDayOpen(true);
        }}
      />

      <DayModal
        open={dayOpen}
        onClose={() => setDayOpen(false)}
        outcome={outcome}
        weekStartsOn={weekStartsOn}
        dateISO={selectedDay}
      />
    </div>
  );
}
