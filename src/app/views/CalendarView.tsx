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
  return items.some((title) => title.trim().length > 0);
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
  const date = parseISODate(dateISO).getTime();
  return date >= parseISODate(startISO).getTime() && date <= parseISODate(endISO).getTime();
}

function streakInfo(outcome: Outcome, daily: Record<string, DailyGoal>): { current: number; best: number } {
  const start = parseISODate(outcome.startDate);
  const end = parseISODate(outcome.endDate);
  const today = new Date();
  const until = today.getTime() > end.getTime() ? end : today;

  let current = 0;
  for (let date = new Date(until); date.getTime() >= start.getTime(); date.setDate(date.getDate() - 1)) {
    const iso = toISODate(date);
    if (!isDateActive(iso, outcome.daysOfWeek)) continue;
    const entry = daily[`${outcome.id}:${iso}`];
    if (entry?.done) current++;
    else break;
  }

  let best = 0;
  let run = 0;
  for (let date = new Date(start); date.getTime() <= end.getTime(); date.setDate(date.getDate() + 1)) {
    const iso = toISODate(date);
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

  const months = Array.from({ length: 12 }, (_, index) => index);
  const weekDayLabels = Array.from({ length: 7 }, (_, index) => {
    const dayOfWeek = (weekStartsOn + index) % 7;
    const date = new Date(2023, 0, 1 + dayOfWeek);
    return date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2);
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
            <Card key={monthIndex} className="rounded-[0.85rem] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">{formatMonthLabel(monthKey)}</div>
                <div className="text-xs app-muted">Click a day to check in</div>
              </div>

              <div className="mt-3 grid grid-cols-7 gap-1 text-[11px] app-subtle">
                {weekDayLabels.map((label) => (
                  <div key={label} className="px-1 py-1">
                    {label}
                  </div>
                ))}
              </div>

              <div className="mt-1 grid grid-cols-7 gap-1">
                {Array.from({ length: totalCells }, (_, index) => {
                  const dayNum = index - offset + 1;
                  if (dayNum < 1 || dayNum > daysInMonth) return <div key={index} className="h-8 rounded-[0.5rem]" />;

                  const dateISO = toISODate(new Date(year, monthIndex, dayNum));
                  const inRange = isoInRange(dateISO, outcome.startDate, outcome.endDate);
                  const active = inRange && isDateActive(dateISO, outcome.daysOfWeek);
                  const state = dayState(outcome.id, dateISO, daily, active);

                  const styles: Record<DayState, string> = {
                    out: "border-transparent bg-transparent opacity-35",
                    none: "border-[color:var(--app-border)] bg-[color:var(--app-input)] hover:bg-[color:var(--app-nav-hover)]",
                    planned: "border-[color:var(--outcome-border)] bg-[color:var(--outcome-soft)] text-[color:var(--outcome-ink)] hover:opacity-90",
                    done: "border-[color:var(--outcome-accent-strong)] bg-[color:var(--outcome-accent-strong)] text-[#201611]"
                  };

                  return (
                    <button
                      key={index}
                      className={cn("h-8 w-full rounded-[0.5rem] border text-xs transition", styles[state])}
                      disabled={!active}
                      onClick={() => onSelectDay(dateISO)}
                      title={formatShortDate(dateISO)}
                    >
                      <div className={cn("flex h-full items-center justify-center", state === "out" ? "app-subtle" : "")}>{dayNum}</div>
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

  const date = parseISODate(dateISO);
  const monthKey = monthKeyFromDate(date);
  const weekStartISO = toISODate(startOfWeek(date, weekStartsOn));
  const monthTitle = monthly[`${outcome.id}:${monthKey}`]?.title ?? "";
  const weekTitle = weekly[`${outcome.id}:${monthKey}:${weekStartISO}`]?.title ?? "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={formatShortDate(dateISO)}
      footer={
        <>
          <Button onClick={() => actions.toggleDailyDone(outcome.id, dateISO)} variant={entry.done ? "secondary" : "primary"}>
            {entry.done ? "Mark not done" : "Mark done"}
          </Button>
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Card className="app-card-soft rounded-[0.75rem] p-4">
          <div className="app-kicker">Context</div>
          <div className="mt-3 grid gap-2">
            <div className="rounded-[0.6rem] border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] p-3">
              <div className="app-kicker">Monthly</div>
              <div className="mt-2 text-sm font-semibold">{monthTitle || "-"}</div>
            </div>
            <div className="rounded-[0.6rem] border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] p-3">
              <div className="app-kicker">Weekly</div>
              <div className="mt-2 text-sm font-semibold">{weekTitle || "-"}</div>
            </div>
          </div>
        </Card>

        <div className="grid gap-2">
          <div className="app-kicker">Daily tasks</div>
          <div className="grid gap-2">
            {items.map((title, index) => {
              const itemDone = Boolean(itemsDone[index]);
              return (
                <div key={index} className="flex items-center gap-2">
                  <button
                    type="button"
                    className="app-check inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[0.4rem] transition"
                    data-state={itemDone ? "done" : "none"}
                    aria-label={itemDone ? `Mark task ${index + 1} not done` : `Mark task ${index + 1} done`}
                    aria-pressed={itemDone}
                    onClick={() => actions.toggleDailyItemDone(outcome.id, dateISO, index)}
                  >
                    x
                  </button>

                  <Input
                    value={title}
                    onChange={(e) => actions.setDailyItem(outcome.id, dateISO, index, e.target.value)}
                    placeholder={index === 0 ? "The smallest slice you can finish today." : "Another tiny task..."}
                    className={cn("h-10 flex-1 rounded-[0.55rem] px-3 text-[13px]", itemDone ? "line-through opacity-70" : "")}
                    aria-label={`Daily task ${index + 1}`}
                  />

                  <button
                    type="button"
                    className="app-ghost-outline inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.5rem] text-sm transition"
                    aria-label={`Delete daily task ${index + 1}`}
                    onClick={() => actions.removeDailyItem(outcome.id, dateISO, index)}
                  >
                    -
                  </button>
                </div>
              );
            })}

            <div className="flex justify-end">
              <button
                type="button"
                className="app-ghost-outline inline-flex h-8 w-8 items-center justify-center rounded-[0.5rem] text-sm transition"
                aria-label="Add daily task"
                onClick={() => actions.addDailyItem(outcome.id, dateISO)}
              >
                +
              </button>
            </div>
          </div>

          <div className="text-xs app-muted">Tip: if it feels bigger than about 10 minutes, cut it down again.</div>
        </div>
      </div>
    </Modal>
  );
}

export default function CalendarView({ outcome, weekStartsOn }: { outcome: Outcome; weekStartsOn: WeekStartsOn }) {
  const daily = useAppState((s) => s.daily);
  const years = React.useMemo(() => yearsInRange(outcome.startDate, outcome.endDate), [outcome.endDate, outcome.startDate]);
  const [year, setYear] = React.useState(years[0] ?? new Date().getFullYear());
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);
  const [dayOpen, setDayOpen] = React.useState(false);

  React.useEffect(() => {
    if (years.includes(year)) return;
    if (years.length) setYear(years[0]);
  }, [year, years]);

  const { current, best } = React.useMemo(() => streakInfo(outcome, daily), [daily, outcome]);

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
      <Card className="app-card-soft rounded-[0.95rem] p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="app-kicker">Consistency calendar</div>
            <div className="font-display mt-2 text-lg font-semibold">Scan the whole range and drop into any day.</div>
            <div className="mt-2 text-sm leading-6 app-muted">Active days: {formatDaysOfWeek(outcome.daysOfWeek)}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="app-pill rounded-[0.6rem] px-4 py-3 text-sm">
              <span className="app-muted">Current streak:</span> {current} day{current === 1 ? "" : "s"}
            </div>
            <div className="app-pill rounded-[0.6rem] px-4 py-3 text-sm">
              <span className="app-muted">Best streak:</span> {best} day{best === 1 ? "" : "s"}
            </div>
            <div className="app-pill rounded-[0.6rem] px-4 py-3 text-sm">
              <span className="app-muted">Done:</span> {doneDays}/{totalDays}
            </div>

            {years.length > 1 ? (
              <select
                className="app-select h-10 rounded-[0.6rem] px-3 text-sm focus:outline-none"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {years.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            ) : null}

            <Button
              onClick={() => {
                const today = toISODate(new Date());
                if (!isoInRange(today, outcome.startDate, outcome.endDate)) return;
                if (!isDateActive(today, outcome.daysOfWeek)) return;
                setSelectedDay(today);
                setDayOpen(true);
              }}
            >
              Today
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2 app-muted">
            <span className="inline-block h-3 w-3 rounded border border-[color:var(--app-border)] bg-[color:var(--app-input)]" /> Unplanned
          </div>
          <div className="flex items-center gap-2 app-muted">
            <span className="inline-block h-3 w-3 rounded border border-[color:var(--outcome-border)] bg-[color:var(--outcome-soft)]" /> Planned
          </div>
          <div className="flex items-center gap-2 app-muted">
            <span className="inline-block h-3 w-3 rounded border border-[color:var(--outcome-accent-strong)] bg-[color:var(--outcome-accent-strong)]" /> Done
          </div>
        </div>
      </Card>

      <YearCalendar
        outcome={outcome}
        year={year}
        weekStartsOn={weekStartsOn}
        onSelectDay={(dateISO) => {
          setSelectedDay(dateISO);
          setDayOpen(true);
        }}
      />

      <DayModal open={dayOpen} onClose={() => setDayOpen(false)} outcome={outcome} weekStartsOn={weekStartsOn} dateISO={selectedDay} />
    </div>
  );
}
