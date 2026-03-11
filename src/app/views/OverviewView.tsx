import React from "react";
import type { Outcome, WeekStartsOn } from "../types";
import { actions, useAppState } from "../store";
import {
  addDays,
  dateISOsInRange,
  formatShortDate,
  isDateActive,
  monthKeyFromDate,
  parseISODate,
  startOfWeek,
  toISODate
} from "../date";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Progress from "../ui/Progress";

function isoInRange(dateISO: string, startISO: string, endISO: string): boolean {
  const d = parseISODate(dateISO).getTime();
  return d >= parseISODate(startISO).getTime() && d <= parseISODate(endISO).getTime();
}

export default function OverviewView({ outcome, weekStartsOn }: { outcome: Outcome; weekStartsOn: WeekStartsOn }) {
  const monthly = useAppState((s) => s.monthly);
  const weekly = useAppState((s) => s.weekly);
  const daily = useAppState((s) => s.daily);

  const today = toISODate(new Date());
  const inRange = isoInRange(today, outcome.startDate, outcome.endDate) && isDateActive(today, outcome.daysOfWeek);
  const todayEntry = daily[`${outcome.id}:${today}`] ?? { title: "", done: false };
  const todayItems =
    Array.isArray(todayEntry.items) && todayEntry.items.length ? todayEntry.items : [todayEntry.title ?? ""];
  const todayItemsDone = Array.isArray(todayEntry.itemsDone) ? todayEntry.itemsDone : [];

  const weekStart = toISODate(startOfWeek(parseISODate(today), weekStartsOn));
  const monthKey = monthKeyFromDate(parseISODate(today));
  const monthTitle = monthly[`${outcome.id}:${monthKey}`]?.title ?? "";
  const weekTitle = weekly[`${outcome.id}:${monthKey}:${weekStart}`]?.title ?? "";

  const activeDates = React.useMemo(
    () => dateISOsInRange(outcome.startDate, outcome.endDate, outcome.daysOfWeek),
    [outcome.daysOfWeek, outcome.endDate, outcome.startDate]
  );
  const total = activeDates.length;
  const done = activeDates.reduce((acc, dateISO) => acc + (daily[`${outcome.id}:${dateISO}`]?.done ? 1 : 0), 0);
  const progress = total ? done / total : 0;

  const weekDays = React.useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => toISODate(addDays(parseISODate(weekStart), i))).filter((d) =>
        isoInRange(d, outcome.startDate, outcome.endDate) && isDateActive(d, outcome.daysOfWeek)
      ),
    [weekStart, outcome.daysOfWeek, outcome.startDate, outcome.endDate]
  );
  const weekDone = weekDays.reduce((acc, d) => acc + (daily[`${outcome.id}:${d}`]?.done ? 1 : 0), 0);

  return (
    <div className="grid gap-4">
      <Card className="p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="text-sm font-semibold">At a glance</div>
            <div className="mt-1 text-sm text-zinc-400">
              Keep monthly + weekly goals outcome-oriented, then make daily commitments tiny and consistent.
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
            <span className="text-zinc-400">Overall consistency:</span> {done}/{total}
          </div>
        </div>
        <div className="mt-3">
          <Progress value={progress} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs font-medium text-zinc-400">This month</div>
          <div className="mt-1 text-sm text-zinc-200">{monthTitle || "Set a monthly goal in the Plan tab."}</div>
          <div className="mt-3 text-xs text-zinc-500">Focus: one calendar month at a time.</div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-medium text-zinc-400">This week</div>
          <div className="mt-1 text-sm text-zinc-200">{weekTitle || "Set a weekly goal in the Plan tab."}</div>
          <div className="mt-3 text-xs text-zinc-500">
            {weekDays.length ? `${weekDone}/${weekDays.length}` : "0/0"} days done (even a tiny slice counts).
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-medium text-zinc-400">Today</div>
          <div className="mt-2 grid gap-2">
            <div className="text-xs text-zinc-500">{formatShortDate(today)}</div>
            <div className="grid gap-2">
              {todayItems.map((t, idx) => {
                const done = Boolean(todayItemsDone[idx]);
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <button
                      type="button"
                      className={[
                        "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition focus:outline-none focus:ring-2 focus:ring-zinc-200/20 disabled:opacity-50 disabled:cursor-not-allowed",
                        done
                          ? "border-emerald-400 bg-emerald-400/20 text-emerald-200"
                          : "border-zinc-800 bg-zinc-950 text-transparent hover:bg-zinc-900"
                      ].join(" ")}
                      aria-label={done ? `Mark task ${idx + 1} not done` : `Mark task ${idx + 1} done`}
                      aria-pressed={done}
                      title={done ? "Mark not done" : "Mark done"}
                      onClick={() => actions.toggleDailyItemDone(outcome.id, today, idx)}
                      disabled={!inRange}
                    >
                      ✓
                    </button>
                    <Input
                      value={t}
                      onChange={(e) => actions.setDailyItem(outcome.id, today, idx, e.target.value)}
                      placeholder={
                        inRange
                          ? idx === 0
                            ? "Daily task for today…"
                            : "Another tiny task…"
                          : "Outside outcome date range"
                      }
                      disabled={!inRange}
                      className={[
                        "h-9 flex-1 rounded-lg px-2 text-[13px]",
                        done ? "text-zinc-400 line-through placeholder:text-zinc-600" : ""
                      ].join(" ")}
                      aria-label={`Daily task ${idx + 1}`}
                    />
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-200/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={`Delete daily task ${idx + 1}`}
                      title="Delete daily task"
                      onClick={() => actions.removeDailyItem(outcome.id, today, idx)}
                      disabled={!inRange}
                    >
                      -
                    </button>
                  </div>
                );
              })}
              <div className="flex justify-end">
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-200/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Add daily task"
                  title="Add daily task"
                  onClick={() => actions.addDailyItem(outcome.id, today)}
                  disabled={!inRange}
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={todayEntry.done ? "secondary" : "primary"}
                disabled={!inRange}
                onClick={() => actions.toggleDailyDone(outcome.id, today)}
              >
                {todayEntry.done ? "Done (undo)" : "Mark done"}
              </Button>
              <div className="text-xs text-zinc-500">
                {inRange ? "Consistency beats intensity." : "Today is outside this goal's active date range or selected weekdays."}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
