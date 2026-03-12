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

type OverviewPhase = "upcoming" | "active" | "ended";
type OverviewDayState = "open" | "planned" | "done";

function dailyItems(entry: DailyGoal | undefined): string[] {
  if (Array.isArray(entry?.items) && entry.items.length) return entry.items;
  return [entry?.title ?? ""];
}

function plannedItemCount(entry: DailyGoal | undefined): number {
  return dailyItems(entry).filter((item) => item.trim().length > 0).length;
}

function dayState(entry: DailyGoal | undefined): OverviewDayState {
  if (entry?.done) return "done";
  if (plannedItemCount(entry) > 0) return "planned";
  return "open";
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function streakInfo(outcome: Outcome, daily: Record<string, DailyGoal>): { current: number; best: number } {
  const activeDates = dateISOsInRange(outcome.startDate, outcome.endDate, outcome.daysOfWeek);
  const end = isoToDayNumber(outcome.endDate);
  const today = isoToDayNumber(toISODate(new Date()));
  const until = Math.min(today, end);

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

function MetricTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[0.7rem] border border-[color:var(--outcome-border)] bg-[color:var(--app-card)] p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] app-subtle">{label}</div>
      <div className="mt-2 text-[1.35rem] font-semibold leading-none">{value}</div>
      <div className="mt-2 text-xs leading-5 app-muted">{detail}</div>
    </div>
  );
}

function CompactDate({ dateISO }: { dateISO: string }) {
  const weekday = parseISODate(dateISO).toLocaleDateString(undefined, { weekday: "short" });
  const shortDate = parseISODate(dateISO).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] app-subtle">{weekday}</div>
      <div className="mt-1 text-sm font-semibold">{shortDate}</div>
    </>
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

  const hasActiveDays = activeDates.length > 0;
  const phase: OverviewPhase =
    todayDayNumber < startDayNumber ? "upcoming" : todayDayNumber > endDayNumber ? "ended" : "active";

  const progressDone = activeDates.reduce((count, dateISO) => count + (daily[`${outcome.id}:${dateISO}`]?.done ? 1 : 0), 0);
  const progressTotal = activeDates.length;
  const progressValue = progressTotal ? progressDone / progressTotal : 0;
  const progressPercent = Math.round(progressValue * 100);

  const remainingDates = activeDates.filter((dateISO) => isoToDayNumber(dateISO) >= todayDayNumber);
  const unfinishedRemaining = remainingDates.reduce((count, dateISO) => count + (daily[`${outcome.id}:${dateISO}`]?.done ? 0 : 1), 0);
  const daysUntilStart = Math.max(startDayNumber - todayDayNumber, 0);
  const daysSinceEnd = Math.max(todayDayNumber - endDayNumber, 0);

  const { current: currentStreak, best: bestStreak } = React.useMemo(() => streakInfo(outcome, daily), [daily, outcome]);

  const boardDateISO = React.useMemo(() => {
    if (!hasActiveDays) return outcome.startDate;
    if (phase === "ended") {
      return [...activeDates].reverse().find((dateISO) => isoToDayNumber(dateISO) <= todayDayNumber) ?? activeDates[activeDates.length - 1];
    }
    return activeDates.find((dateISO) => isoToDayNumber(dateISO) >= todayDayNumber) ?? activeDates[activeDates.length - 1];
  }, [activeDates, hasActiveDays, outcome.startDate, phase, todayDayNumber]);

  const boardDateIndex = hasActiveDays ? activeDates.indexOf(boardDateISO) + 1 : 0;
  const boardIsToday = boardDateISO === todayISO;
  const boardEntry = hasActiveDays ? daily[`${outcome.id}:${boardDateISO}`] : undefined;
  const boardItems = hasActiveDays ? dailyItems(boardEntry) : [];
  const boardItemsDone = Array.isArray(boardEntry?.itemsDone) ? boardEntry.itemsDone : [];
  const boardPlannedCount = boardItems.filter((item) => item.trim().length > 0).length;
  const boardDoneCount = boardItems.reduce((count, _, index) => count + (boardItemsDone[index] ? 1 : 0), 0);

  const focusDateISO = hasActiveDays ? boardDateISO : outcome.startDate;
  const focusDate = parseISODate(focusDateISO);
  const focusMonthKey = monthKeyFromDate(focusDate);
  const focusWeekStartISO = toISODate(startOfWeek(focusDate, weekStartsOn));
  const focusWeekStartDayNumber = isoToDayNumber(focusWeekStartISO);

  const monthTitle = monthly[`${outcome.id}:${focusMonthKey}`]?.title ?? "";
  const weekTitle = weekly[`${outcome.id}:${focusMonthKey}:${focusWeekStartISO}`]?.title ?? "";

  const monthDates = activeDates.filter((dateISO) => monthKeyFromDate(parseISODate(dateISO)) === focusMonthKey);
  const monthDone = monthDates.reduce((count, dateISO) => count + (daily[`${outcome.id}:${dateISO}`]?.done ? 1 : 0), 0);
  const monthPlanned = monthDates.reduce((count, dateISO) => count + (plannedItemCount(daily[`${outcome.id}:${dateISO}`]) ? 1 : 0), 0);

  const weekDates = activeDates.filter((dateISO) => {
    const dayNumber = isoToDayNumber(dateISO);
    return dayNumber >= focusWeekStartDayNumber && dayNumber < focusWeekStartDayNumber + 7;
  });
  const weekDone = weekDates.reduce((count, dateISO) => count + (daily[`${outcome.id}:${dateISO}`]?.done ? 1 : 0), 0);
  const weekPlanned = weekDates.reduce((count, dateISO) => count + (plannedItemCount(daily[`${outcome.id}:${dateISO}`]) ? 1 : 0), 0);

  const rhythmDates = React.useMemo(() => {
    if (!hasActiveDays) return [];
    if (phase === "upcoming") return activeDates.slice(0, 6);
    const pastDates = activeDates.filter((dateISO) => isoToDayNumber(dateISO) <= todayDayNumber);
    return (pastDates.length ? pastDates : activeDates).slice(-6);
  }, [activeDates, hasActiveDays, phase, todayDayNumber]);

  const queueDates = React.useMemo(() => {
    if (!hasActiveDays) return [];
    if (phase === "ended") return activeDates.slice(-4).reverse();
    const startIndex = Math.max(activeDates.indexOf(boardDateISO), 0);
    return activeDates.slice(startIndex, startIndex + 4);
  }, [activeDates, boardDateISO, hasActiveDays, phase]);

  const cadenceValue = `${outcome.daysOfWeek.length}/wk`;
  const cadenceDetail = formatDaysOfWeek(outcome.daysOfWeek);

  const phaseMeta = {
    upcoming: {
      label: "Upcoming",
      title: "Use the runway to make the opening stretch feel easy to start.",
      body: `The outcome starts ${formatShortDate(outcome.startDate)}. Set the first month, the first week, and the first active day now so momentum already has a shape.`
    },
    active: {
      label: "In motion",
      title: "Keep the direction ambitious and the daily load small enough to finish.",
      body: `${unfinishedRemaining} unfinished ${unfinishedRemaining === 1 ? "active day remains" : "active days remain"} in the window. The overview should make the next honest step obvious.`
    },
    ended: {
      label: "Window closed",
      title: "The outcome window is over, so the signal now is the rhythm you actually kept.",
      body: `You closed ${progressDone} of ${progressTotal} active days before ${formatShortDate(outcome.endDate)}. Review the slices that carried the work and the gaps that broke it.`
    }
  }[phase];

  const boardIntro = !hasActiveDays
    ? "No active days fall inside this date range and planning cadence. Edit the outcome dates or planning days to fix that."
    : phase === "upcoming"
      ? `${formatShortDate(boardDateISO)} is the first active day in the window. Seed a tiny task now so starting feels obvious.`
      : phase === "ended"
        ? `This was the final active day in the window. Tighten the record of what actually shipped.`
        : boardIsToday
          ? "The only job today is to make the smallest meaningful commitment easy to finish."
          : `Today is outside this outcome's cadence. ${formatShortDate(boardDateISO)} is the next active day.`;

  return (
    <div className="grid gap-4">
      <Card className="app-card-soft rounded-[0.95rem] p-5 sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,1fr)] xl:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="app-outcome-pill rounded-[0.55rem] px-3 py-1 text-xs font-semibold">{phaseMeta.label}</span>
              <span className="app-pill rounded-[0.55rem] px-3 py-1 text-xs font-semibold">{cadenceValue} cadence</span>
            </div>

            <div className="font-display mt-3 text-[1.5rem] font-semibold leading-tight sm:text-[1.85rem]">{phaseMeta.title}</div>
            <div className="mt-3 max-w-2xl text-sm leading-6 app-muted">{phaseMeta.body}</div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <MetricTile label="Consistency" value={`${progressPercent}%`} detail={`${progressDone}/${progressTotal || 0} active days done`} />
            <MetricTile label="Current streak" value={pluralize(currentStreak, "day")} detail={`Best run: ${pluralize(bestStreak, "day")}`} />
            <MetricTile
              label={phase === "upcoming" ? "Starts in" : phase === "ended" ? "Since finish" : "Open days"}
              value={
                phase === "upcoming" ? pluralize(daysUntilStart, "day") : phase === "ended" ? pluralize(daysSinceEnd, "day") : `${unfinishedRemaining}`
              }
              detail={
                phase === "upcoming"
                  ? `${remainingDates.length} active days scheduled`
                  : phase === "ended"
                    ? `Window ended ${formatShortDate(outcome.endDate)}`
                    : `${remainingDates.length} active days left in range`
              }
            />
            <MetricTile label="Rhythm" value={cadenceValue} detail={cadenceDetail} />
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="app-muted">Outcome window: {formatShortDate(outcome.startDate)} to {formatShortDate(outcome.endDate)}</span>
            <span className="app-subtle">{hasActiveDays ? `${progressTotal} scheduled active days` : "No active days scheduled"}</span>
          </div>
          <Progress value={progressValue} />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)]">
        <Card className="app-card-soft rounded-[0.95rem] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="app-kicker">
                {hasActiveDays ? (boardIsToday ? "Today" : phase === "upcoming" ? "First active day" : phase === "ended" ? "Last active day" : "Next active day") : "Daily board"}
              </div>
              <div className="font-display mt-2 text-[1.3rem] font-semibold leading-tight">{hasActiveDays ? formatShortDate(boardDateISO) : "No active day to work from"}</div>
              <div className="mt-2 text-sm leading-6 app-muted">{boardIntro}</div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:w-[220px]">
              <div className="rounded-[0.7rem] border border-[color:var(--outcome-border)] bg-[color:var(--app-card)] p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] app-subtle">Tasks</div>
                <div className="mt-2 text-lg font-semibold">{boardPlannedCount}</div>
                <div className="mt-1 text-xs app-muted">{hasActiveDays ? `Active day ${boardDateIndex}/${progressTotal || 0}` : "Nothing scheduled yet"}</div>
              </div>
              <div className="rounded-[0.7rem] border border-[color:var(--outcome-border)] bg-[color:var(--app-card)] p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] app-subtle">Done</div>
                <div className="mt-2 text-lg font-semibold">{boardDoneCount}</div>
                <div className="mt-1 text-xs app-muted">{boardPlannedCount ? `${boardDoneCount}/${boardPlannedCount} task${boardPlannedCount === 1 ? "" : "s"}` : "No tasks yet"}</div>
              </div>
            </div>
          </div>

          {hasActiveDays ? (
            <>
              <div className="mt-5 grid gap-2">
                {boardItems.map((title, index) => {
                  const itemDone = Boolean(boardItemsDone[index]);
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <button
                        type="button"
                        className="app-check inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[0.4rem] transition"
                        data-state={itemDone ? "done" : "none"}
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

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Button variant={boardEntry?.done ? "secondary" : "primary"} onClick={() => actions.toggleDailyDone(outcome.id, boardDateISO)}>
                  {boardEntry?.done ? "Mark not done" : "Mark day done"}
                </Button>
                <Button size="sm" onClick={() => actions.setActiveTab("calendar")}>
                  Open calendar
                </Button>
                <div className="text-xs leading-5 app-muted">
                  {boardEntry?.done ? "The day is already closed. Reopen it only if the record is wrong." : "Keep the bar low enough that finishing feels automatic."}
                </div>
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-[0.7rem] border border-dashed border-[color:var(--app-border)] px-4 py-5 text-sm leading-6 app-muted">
              Edit the outcome and make sure the selected planning days actually occur between the start and end dates.
            </div>
          )}
        </Card>

        <div className="grid gap-4">
          <Card className="rounded-[0.85rem] p-5">
            <div className="app-kicker">Current focus</div>
            <div className="mt-2 text-base font-semibold">
              {phase === "upcoming" ? "Define the first month and week before the window opens." : "The current slices should make the daily work feel obvious."}
            </div>

            <div className="mt-4 grid gap-3">
              <div className="rounded-[0.7rem] border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="app-kicker">Month</div>
                    <div className="mt-2 text-sm font-semibold">{formatMonthLabel(focusMonthKey)}</div>
                    <div className="mt-2 text-sm leading-6">{monthTitle || "Set a monthly goal in the Plan tab."}</div>
                  </div>
                  <div className="shrink-0 text-xs app-muted">{monthDone}/{monthDates.length || 0}</div>
                </div>
                <div className="mt-3">
                  <Progress value={monthDates.length ? monthDone / monthDates.length : 0} />
                </div>
                <div className="mt-2 text-xs app-muted">{monthPlanned}/{monthDates.length || 0} days currently planned</div>
              </div>

              <div className="rounded-[0.7rem] border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="app-kicker">Week</div>
                    <div className="mt-2 text-sm font-semibold">{formatWeekLabel(focusWeekStartISO)}</div>
                    <div className="mt-2 text-sm leading-6">{weekTitle || "Set a weekly goal in the Plan tab."}</div>
                  </div>
                  <div className="shrink-0 text-xs app-muted">{weekDone}/{weekDates.length || 0}</div>
                </div>
                <div className="mt-3">
                  <Progress value={weekDates.length ? weekDone / weekDates.length : 0} />
                </div>
                <div className="mt-2 text-xs app-muted">{weekPlanned}/{weekDates.length || 0} days currently planned</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant={monthTitle.trim() && weekTitle.trim() ? "secondary" : "primary"} onClick={() => actions.setActiveTab("plan")}>
                {monthTitle.trim() && weekTitle.trim() ? "Refine plan" : "Shape the plan"}
              </Button>
              <Button size="sm" onClick={() => actions.setActiveTab("calendar")}>
                Open calendar
              </Button>
            </div>
          </Card>

          <Card className="rounded-[0.85rem] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="app-kicker">{phase === "upcoming" ? "Opening stretch" : "Recent rhythm"}</div>
                <div className="mt-2 text-base font-semibold">
                  {phase === "upcoming" ? "These are the first active days that will set the tone." : "A quick scan of the days shaping momentum."}
                </div>
              </div>
              <div className="text-xs app-muted">{pluralize(currentStreak, "day")} current</div>
            </div>

            {rhythmDates.length ? (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {rhythmDates.map((dateISO) => {
                  const state = dayState(daily[`${outcome.id}:${dateISO}`]);
                  return (
                    <div
                      key={dateISO}
                      className={cn(
                        "rounded-[0.7rem] border p-3",
                        state === "done"
                          ? "border-[color:var(--outcome-accent-strong)] bg-[color:var(--outcome-accent)] text-[color:var(--outcome-ink)]"
                          : state === "planned"
                            ? "border-[color:var(--outcome-border)] bg-[color:var(--outcome-soft)]"
                            : "border-[color:var(--app-border)] bg-[color:var(--app-elevated)]"
                      )}
                    >
                      <CompactDate dateISO={dateISO} />
                      <div className="mt-2 text-xs app-muted">{state === "done" ? "Closed" : state === "planned" ? "Planned" : "Open"}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-[0.7rem] border border-dashed border-[color:var(--app-border)] px-4 py-5 text-sm app-muted">
                No active days are available to show a rhythm yet.
              </div>
            )}
          </Card>

          <Card className="rounded-[0.85rem] p-5">
            <div className="app-kicker">{phase === "ended" ? "Final active days" : "Next active days"}</div>
            <div className="mt-2 text-base font-semibold">
              {phase === "ended" ? "The tail of the window, in reverse order." : "The next few active days, so the path ahead is visible."}
            </div>

            {queueDates.length ? (
              <div className="mt-4 grid gap-2">
                {queueDates.map((dateISO) => {
                  const state = dayState(daily[`${outcome.id}:${dateISO}`]);
                  return (
                    <div
                      key={dateISO}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-[0.7rem] border px-3 py-3",
                        state === "done"
                          ? "border-[color:var(--outcome-accent-strong)] bg-[color:var(--outcome-accent)] text-[color:var(--outcome-ink)]"
                          : state === "planned"
                            ? "border-[color:var(--outcome-border)] bg-[color:var(--outcome-soft)]"
                            : "border-[color:var(--app-border)] bg-[color:var(--app-elevated)]"
                      )}
                    >
                      <div>
                        <CompactDate dateISO={dateISO} />
                      </div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] app-subtle">
                        {state === "done" ? "Closed" : state === "planned" ? "Planned" : "Open"}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-[0.7rem] border border-dashed border-[color:var(--app-border)] px-4 py-5 text-sm app-muted">
                No active days are available to queue right now.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
