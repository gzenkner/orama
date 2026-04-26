import React from "react";
import type { DailyGoal, Outcome, WeekStartsOn } from "../types";
import { actions, useAppState } from "../store";
import {
  dateISOsInRange,
  formatDaysOfWeek,
  formatMonthLabel,
  formatShortDate,
  formatWeekLabel,
  isoToDayNumber,
  monthKeyFromDate,
  parseISODate,
  startOfWeek,
  toISODate
} from "../date";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Progress from "../ui/Progress";
import { cn } from "../ui/cn";
import {
  daySurfaceClass,
  dayVisualState,
  trafficLightSurfaceClass,
  trafficLightToneFromProgress,
  trafficLightVar,
  type DayVisualState,
  type TrafficLightTone
} from "../ui/trafficLight";

type OverviewPhase = "upcoming" | "active" | "ended";

function dailyItems(entry: DailyGoal | undefined): string[] {
  if (Array.isArray(entry?.items) && entry.items.length) return entry.items;
  return [entry?.title ?? ""];
}

function hasMeaningfulItems(items: string[]): boolean {
  return items.some((item) => item.trim().length > 0);
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function streakInfo(outcome: Outcome, daily: Record<string, DailyGoal>): { current: number; best: number } {
  const activeDates = dateISOsInRange(outcome.startDate, outcome.endDate, outcome.daysOfWeek);
  const until = Math.min(isoToDayNumber(toISODate(new Date())), isoToDayNumber(outcome.endDate));

  let current = 0;
  for (const dateISO of [...activeDates].reverse()) {
    if (isoToDayNumber(dateISO) > until) continue;
    if (daily[`${outcome.id}:${dateISO}`]?.done) current++;
    else break;
  }

  let best = 0;
  let run = 0;
  for (const dateISO of activeDates) {
    if (daily[`${outcome.id}:${dateISO}`]?.done) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }

  return { current, best };
}

function toneClasses(state: DayVisualState): string {
  return daySurfaceClass(state);
}

function progressSnapshot(dateISOs: string[], outcomeId: string, daily: Record<string, DailyGoal>, todayISO: string): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const dateISO of dateISOs) {
    if (dateISO > todayISO) continue;
    total++;
    if (daily[`${outcomeId}:${dateISO}`]?.done) done++;
  }
  return { done, total };
}

function MiniDayCell({
  dateISO,
  state,
  highlight = false,
  className
}: {
  dateISO: string;
  state: DayVisualState;
  highlight?: boolean;
  className?: string;
}) {
  const weekday = parseISODate(dateISO).toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1);
  const day = parseISODate(dateISO).toLocaleDateString(undefined, { day: "numeric" });

  return (
    <div
      title={formatShortDate(dateISO)}
      className={cn(
        "flex h-12 w-10 flex-col items-center justify-center rounded-[0.6rem] border text-xs",
        toneClasses(state),
        highlight ? "shadow-[inset_0_0_0_1px_var(--app-text)]" : "",
        className
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">{weekday}</div>
      <div className="mt-0.5 text-sm font-semibold leading-none">{day}</div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[0.65rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] app-subtle">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function ProgressRing({
  value,
  headline,
  subline,
  tone
}: {
  value: number;
  headline: string;
  subline: string;
  tone: TrafficLightTone;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);

  return (
    <div className="flex items-center justify-center">
      <div className="relative h-32 w-32">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--app-border)" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={trafficLightVar(tone, "fill")}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="font-display text-[1.4rem] font-semibold leading-none" style={{ color: trafficLightVar(tone, "text") }}>
            {headline}
          </div>
          <div className="mt-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] app-subtle">{subline}</div>
        </div>
      </div>
    </div>
  );
}

function DateRow({
  dateISO,
  state,
  rightLabel
}: {
  dateISO: string;
  state: DayVisualState;
  rightLabel: string;
}) {
  const weekday = parseISODate(dateISO).toLocaleDateString(undefined, { weekday: "short" });
  const shortDate = parseISODate(dateISO).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-[0.7rem] border px-3 py-3", toneClasses(state))}>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">{weekday}</div>
        <div className="mt-1 text-sm font-semibold">{shortDate}</div>
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-75">{rightLabel}</div>
    </div>
  );
}

export default function OverviewView({ outcome, weekStartsOn }: { outcome: Outcome; weekStartsOn: WeekStartsOn }) {
  const monthly = useAppState((s) => s.monthly);
  const weekly = useAppState((s) => s.weekly);
  const daily = useAppState((s) => s.daily);

  const todayISO = toISODate(new Date());
  const todayDayNumber = isoToDayNumber(todayISO);
  const startDayNumber = isoToDayNumber(outcome.startDate);
  const endDayNumber = isoToDayNumber(outcome.endDate);

  const activeDates = React.useMemo(
    () => dateISOsInRange(outcome.startDate, outcome.endDate, outcome.daysOfWeek),
    [outcome.daysOfWeek, outcome.endDate, outcome.startDate]
  );

  const phase: OverviewPhase =
    todayDayNumber < startDayNumber ? "upcoming" : todayDayNumber > endDayNumber ? "ended" : "active";
  const hasActiveDays = activeDates.length > 0;

  const elapsedDates = React.useMemo(
    () => activeDates.filter((dateISO) => isoToDayNumber(dateISO) <= Math.min(todayDayNumber, endDayNumber)),
    [activeDates, endDayNumber, todayDayNumber]
  );
  const upcomingDates = React.useMemo(
    () => activeDates.filter((dateISO) => isoToDayNumber(dateISO) >= todayDayNumber),
    [activeDates, todayDayNumber]
  );

  const consistencyDone = elapsedDates.reduce((count, dateISO) => count + (daily[`${outcome.id}:${dateISO}`]?.done ? 1 : 0), 0);
  const consistencyTotal = elapsedDates.length;
  const consistencyPercent = consistencyTotal ? Math.round((consistencyDone / consistencyTotal) * 100) : 0;

  const totalDone = activeDates.reduce((count, dateISO) => count + (daily[`${outcome.id}:${dateISO}`]?.done ? 1 : 0), 0);
  const openDaysLeft = upcomingDates.reduce((count, dateISO) => count + (daily[`${outcome.id}:${dateISO}`]?.done ? 0 : 1), 0);
  const daysUntilStart = Math.max(startDayNumber - todayDayNumber, 0);

  const { current: currentStreak, best: bestStreak } = React.useMemo(() => streakInfo(outcome, daily), [daily, outcome]);

  const boardDateISO = React.useMemo(() => {
    if (!hasActiveDays) return outcome.startDate;
    if (phase === "upcoming") return activeDates[0];
    if (phase === "ended") return activeDates[activeDates.length - 1];
    return activeDates.find((dateISO) => isoToDayNumber(dateISO) >= todayDayNumber) ?? activeDates[activeDates.length - 1];
  }, [activeDates, hasActiveDays, outcome.startDate, phase, todayDayNumber]);

  const boardEntry = hasActiveDays ? daily[`${outcome.id}:${boardDateISO}`] : undefined;
  const boardItems = hasActiveDays ? dailyItems(boardEntry) : [];
  const boardItemsDone = Array.isArray(boardEntry?.itemsDone) ? boardEntry.itemsDone : [];
  const boardState = dayVisualState(boardEntry, boardDateISO, todayISO);
  const boardPlannedCount = boardItems.filter((item) => item.trim().length > 0).length;
  const boardDoneCount = boardItems.reduce((count, _, index) => count + (boardItemsDone[index] ? 1 : 0), 0);
  const boardDateIndex = hasActiveDays ? activeDates.indexOf(boardDateISO) + 1 : 0;
  const boardHasTasks = hasMeaningfulItems(boardItems);
  const boardIntentionalRest = Boolean(boardEntry?.intentionalRest);
  const boardHasCommitment = boardHasTasks || boardIntentionalRest;
  const boardNeedsAcknowledgement = boardDateISO === todayISO && phase === "active" && !boardHasTasks;

  const focusDate = parseISODate(boardDateISO);
  const focusMonthKey = monthKeyFromDate(focusDate);
  const focusWeekStartISO = toISODate(startOfWeek(focusDate, weekStartsOn));
  const focusWeekStartDayNumber = isoToDayNumber(focusWeekStartISO);

  const monthTitle = monthly[`${outcome.id}:${focusMonthKey}`]?.title ?? "";
  const weekTitle = weekly[`${outcome.id}:${focusMonthKey}:${focusWeekStartISO}`]?.title ?? "";

  const monthDates = activeDates.filter((dateISO) => monthKeyFromDate(parseISODate(dateISO)) === focusMonthKey);
  const monthProgress = progressSnapshot(monthDates, outcome.id, daily, todayISO);
  const weekDates = activeDates.filter((dateISO) => {
    const dayNumber = isoToDayNumber(dateISO);
    return dayNumber >= focusWeekStartDayNumber && dayNumber < focusWeekStartDayNumber + 7;
  });
  const weekProgress = progressSnapshot(weekDates, outcome.id, daily, todayISO);

  const consistencyStripDates = phase === "upcoming" ? activeDates.slice(0, 7) : elapsedDates.slice(-7);
  const rhythmDates = phase === "upcoming" ? activeDates.slice(0, 7) : elapsedDates.slice(-7);
  const nextDates = phase === "ended" ? activeDates.slice(-3).reverse() : upcomingDates.slice(0, 3);

  const phaseCopy = {
    upcoming: {
      label: "Upcoming",
      title: "Set the opening stretch before the window arrives.",
      body: `${pluralize(daysUntilStart, "day")} until ${formatShortDate(outcome.startDate)}. The best use of the runway is to shape the first few active days now.`
    },
    active: {
      label: "In motion",
      title: "Consistency so far should only count the active days that have already happened.",
      body: `${consistencyDone} of ${consistencyTotal} elapsed active days are closed. ${pluralize(openDaysLeft, "open day")} remain in the window.`
    },
    ended: {
      label: "Window closed",
      title: "The window is finished. What matters now is the rhythm you actually kept.",
      body: `${totalDone} of ${activeDates.length} active days were closed before ${formatShortDate(outcome.endDate)}.`
    }
  }[phase];

  const boardHeader = !hasActiveDays
    ? "No active day available"
    : phase === "upcoming"
      ? "Nothing is due today"
      : phase === "ended"
        ? "This outcome has finished"
        : boardDateISO === todayISO
          ? "What needs to happen today"
          : "Nothing is due today";

  const boardIntro = !hasActiveDays
    ? "No active days fall inside this range and cadence."
    : phase === "upcoming"
      ? `${formatShortDate(boardDateISO)} is the first active day. Seed it now so starting feels obvious.`
      : phase === "ended"
        ? `The final active day was ${formatShortDate(boardDateISO)}.`
        : boardDateISO === todayISO
          ? "Keep the next commitment small enough to finish without friction."
          : `${formatShortDate(boardDateISO)} is the next active day in this cadence.`;

  const ringValue = phase === "upcoming" ? 0 : consistencyTotal ? consistencyDone / consistencyTotal : 0;
  const ringHeadline = phase === "upcoming" ? `${daysUntilStart}` : `${consistencyPercent}%`;
  const ringSubline = phase === "upcoming" ? "until start" : "consistency";
  const ringTone = phase === "upcoming" ? "amber" : trafficLightToneFromProgress(ringValue);

  return (
    <div className="grid gap-4">
      <Card className="app-card-soft rounded-[0.95rem] p-5 sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_280px]">
          <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="app-outcome-pill rounded-[0.55rem] px-3 py-1 text-xs font-semibold">{phaseCopy.label}</span>
                  <span className="app-pill rounded-[0.55rem] px-3 py-1 text-xs font-semibold">{formatDaysOfWeek(outcome.daysOfWeek)}</span>
                </div>
                <div className="font-display mt-3 text-[1.55rem] font-semibold leading-tight sm:text-[1.95rem]">{boardHeader}</div>
                <div className="mt-2 max-w-2xl text-sm leading-6 app-muted">{boardIntro}</div>
              </div>

              {hasActiveDays ? (
                <div className={cn("rounded-[0.65rem] border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em]", toneClasses(boardState))}>
                  {boardDateISO === todayISO && phase === "active" ? "Today" : formatShortDate(boardDateISO)}
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <MetricPill label="Streak" value={pluralize(currentStreak, "day")} />
              <MetricPill label="Best run" value={pluralize(bestStreak, "day")} />
              <MetricPill label="Cadence" value={`${outcome.daysOfWeek.length}/wk`} />
              {phase !== "upcoming" ? <MetricPill label="Open days" value={pluralize(openDaysLeft, "day")} /> : null}
            </div>

            {hasActiveDays ? (
              <>
                <div className="mt-4 flex flex-wrap gap-2 text-xs app-muted">
                  <span>{boardIntentionalRest && !boardHasTasks ? "Intentional rest day" : pluralize(boardPlannedCount, "task")}</span>
                  <span>{boardDoneCount}/{boardPlannedCount || 0} done</span>
                  <span>Active day {boardDateIndex}/{activeDates.length}</span>
                </div>

                <div className="mt-4 grid gap-2">
                  {boardItems.map((title, index) => {
                    const itemDone = Boolean(boardItemsDone[index]);
                    return (
                      <div key={index} className="flex items-center gap-2">
                        <button
                          type="button"
                          className="app-check inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[0.4rem] transition"
                          data-state={itemDone ? "done" : title.trim().length ? "planned" : "none"}
                          aria-label={itemDone ? `Mark task ${index + 1} not done` : `Mark task ${index + 1} done`}
                          aria-pressed={itemDone}
                          onClick={() => actions.toggleDailyItemDone(outcome.id, boardDateISO, index)}
                        >
                          x
                        </button>

                        <Input
                          value={title}
                          onChange={(e) => actions.setDailyItem(outcome.id, boardDateISO, index, e.target.value)}
                          placeholder={index === 0 ? "The smallest meaningful task for this day." : "Another tiny task..."}
                          className={cn("h-10 flex-1 rounded-[0.55rem] px-3 text-[13px]", itemDone ? "line-through opacity-70" : "")}
                          aria-label={`Daily task ${index + 1}`}
                        />

                        <button
                          type="button"
                          className="app-ghost-outline inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.5rem] text-sm transition"
                          aria-label={`Delete daily task ${index + 1}`}
                          onClick={() => actions.removeDailyItem(outcome.id, boardDateISO, index)}
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
                      onClick={() => actions.addDailyItem(outcome.id, boardDateISO)}
                    >
                      +
                    </button>
                  </div>
                </div>

                {boardNeedsAcknowledgement ? (
                  <div className="mt-4 rounded-[0.75rem] border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] p-4">
                    <div className="text-sm font-semibold">
                      {boardIntentionalRest ? "You have intentionally left today empty." : "Today is still empty."}
                    </div>
                    <div className="mt-2 text-sm leading-6 app-muted">
                      Add at least one task for today, or explicitly acknowledge that you are intentionally not doing anything for this outcome today.
                    </div>
                    <button
                      type="button"
                      className={cn(
                        "mt-3 inline-flex items-center gap-2 rounded-[0.65rem] border px-3 py-2 text-sm font-semibold transition",
                        boardIntentionalRest
                          ? "app-tab app-tab-active"
                          : "border-[color:var(--app-border)] bg-[color:var(--app-card)] hover:bg-[color:var(--app-nav-hover)]"
                      )}
                      aria-pressed={boardIntentionalRest}
                      onClick={() => actions.setDailyIntentionalRest(outcome.id, boardDateISO, !boardIntentionalRest)}
                    >
                      <span
                        className={cn(
                          "inline-flex h-4 w-4 items-center justify-center rounded-[0.3rem] border text-[11px]",
                          boardIntentionalRest ? "border-current" : "border-[color:var(--app-border)]"
                        )}
                      >
                        {boardIntentionalRest ? "x" : ""}
                      </span>
                      I am intentionally not doing anything for this outcome today
                    </button>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Button
                    variant={boardEntry?.done ? "secondary" : "primary"}
                    onClick={() => actions.toggleDailyDone(outcome.id, boardDateISO)}
                    disabled={boardDateISO === todayISO && phase === "active" && !boardHasCommitment}
                    title={
                      boardDateISO === todayISO && phase === "active" && !boardHasCommitment
                        ? "Add a task or acknowledge an intentional rest day first"
                        : undefined
                    }
                  >
                    {boardEntry?.done ? "Mark not done" : boardDateISO === todayISO && phase === "active" ? "Mark today done" : "Mark day done"}
                  </Button>
                  <Button size="sm" onClick={() => actions.setActiveTab("plan")}>
                    Open plan
                  </Button>
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-[0.7rem] border border-dashed border-[color:var(--app-border)] px-4 py-5 text-sm leading-6 app-muted">
                Edit the outcome dates or planning days so the cadence creates at least one active day.
              </div>
            )}
          </div>

          <div
            className="grid gap-3 rounded-[0.8rem] border bg-[color:var(--app-card)] p-4"
            style={{ borderColor: trafficLightVar(ringTone, "border") }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="app-kicker">{phase === "upcoming" ? "Runway" : "Consistency"}</div>
              <div
                className={cn("rounded-[0.55rem] border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]", trafficLightSurfaceClass(ringTone))}
              >
                {phase === "upcoming" ? `${daysUntilStart}d` : `${consistencyDone}/${consistencyTotal || 0}`}
              </div>
            </div>

            <ProgressRing value={ringValue} headline={ringHeadline} subline={ringSubline} tone={ringTone} />

            <div className="text-center text-xs app-muted">
              {phase === "upcoming" ? `${activeDates.length} active days planned` : `${openDaysLeft} open days left`}
            </div>

            {consistencyStripDates.length ? (
              <div className="grid grid-cols-7 gap-1.5">
                {consistencyStripDates.map((dateISO) => (
                  <MiniDayCell
                    key={dateISO}
                    dateISO={dateISO}
                    state={dayVisualState(daily[`${outcome.id}:${dateISO}`], dateISO, todayISO)}
                    highlight={dateISO === todayISO}
                    className="w-full min-w-0"
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[0.7rem] border border-dashed border-[color:var(--app-border)] px-4 py-4 text-sm app-muted">
                No active days have landed yet.
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
        <Card className="rounded-[0.85rem] p-5">
          <div className="app-kicker">Current focus</div>
          <div className="mt-2 text-base font-semibold">The month and week should make the next active day feel obvious.</div>

          <div className="mt-4 grid gap-3">
            <div className="rounded-[0.7rem] border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="app-kicker">Month</div>
                  <div className="mt-2 text-sm font-semibold">{formatMonthLabel(focusMonthKey)}</div>
                  <div className="mt-2 text-sm leading-6">{monthTitle || "Set a monthly goal in the Plan tab."}</div>
                </div>
                <div className="text-xs app-muted">{monthProgress.done}/{monthProgress.total || 0}</div>
              </div>
              <div className="mt-3">
                <Progress value={monthProgress.total ? monthProgress.done / monthProgress.total : 0} tone={monthProgress.total ? undefined : "amber"} />
              </div>
            </div>

            <div className="rounded-[0.7rem] border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="app-kicker">Week</div>
                  <div className="mt-2 text-sm font-semibold">{formatWeekLabel(focusWeekStartISO)}</div>
                  <div className="mt-2 text-sm leading-6">{weekTitle || "Set a weekly goal in the Plan tab."}</div>
                </div>
                <div className="text-xs app-muted">{weekProgress.done}/{weekProgress.total || 0}</div>
              </div>
              <div className="mt-3">
                <Progress value={weekProgress.total ? weekProgress.done / weekProgress.total : 0} tone={weekProgress.total ? undefined : "amber"} />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Button size="sm" onClick={() => actions.setActiveTab("plan")}>
              Refine plan
            </Button>
          </div>
        </Card>

        <Card className="rounded-[0.85rem] p-5">
          <div className="app-kicker">Rhythm</div>
          <div className="mt-2 text-base font-semibold">
            {phase === "upcoming" ? "The first few active days set the tone." : "A compact read on the days shaping momentum."}
          </div>

          {rhythmDates.length ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {rhythmDates.map((dateISO) => (
                <MiniDayCell
                  key={dateISO}
                  dateISO={dateISO}
                  state={dayVisualState(daily[`${outcome.id}:${dateISO}`], dateISO, todayISO)}
                  highlight={dateISO === todayISO}
                />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-[0.7rem] border border-dashed border-[color:var(--app-border)] px-4 py-4 text-sm app-muted">
              No active days are available to show yet.
            </div>
          )}

          {nextDates.length ? (
            <div className="mt-5 grid gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] app-subtle">
                {phase === "ended" ? "Final stretch" : "Up next"}
              </div>
              {nextDates.map((dateISO) => {
                const nextState = dayVisualState(daily[`${outcome.id}:${dateISO}`], dateISO, todayISO);
                return (
                  <DateRow
                    key={dateISO}
                    dateISO={dateISO}
                    state={nextState}
                    rightLabel={
                      dateISO === todayISO
                        ? "Today"
                        : nextState === "done"
                          ? "Closed"
                          : nextState === "future"
                            ? "Future"
                          : nextState === "missed"
                            ? "Missed"
                            : nextState === "planned"
                              ? "Planned"
                              : "Open"
                    }
                  />
                );
              })}
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
