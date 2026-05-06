import React from "react";
import type { DailyGoal, Outcome, WeekStartsOn } from "../types";
import { actions, useAppState } from "../store";
import {
  ALL_DAYS_OF_WEEK,
  DAY_OF_WEEK_LABELS_SHORT,
  dateISOsInRange,
  formatShortDate,
  isoToDayNumber,
  normalizeDaysOfWeek,
  parseISODate,
  startOfWeek,
  toISODate,
} from "../date";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { cn } from "../ui/cn";
import {
  daySurfaceClass,
  dayVisualState,
  trafficLightSurfaceClass,
  trafficLightToneFromProgress,
  type DayVisualState
} from "../ui/trafficLight";
import { getOutcomeThemeStyle } from "../theme";

type OverviewPhase = "upcoming" | "active" | "ended";
type TodayCardStatus = "needs-task" | "ready" | "clear" | "closed" | "off-day" | "upcoming" | "ended";

const TODAY_CARD_STATUS_TONE: Record<TodayCardStatus, "red" | "amber" | "green"> = {
  "needs-task": "red",
  ready: "amber",
  clear: "amber",
  closed: "green",
  "off-day": "amber",
  upcoming: "amber",
  ended: "red"
};

function dailyItems(entry: DailyGoal | undefined): string[] {
  if (Array.isArray(entry?.items) && entry.items.length) return entry.items;
  return [entry?.title ?? ""];
}

function hasMeaningfulItems(items: string[]): boolean {
  return items.some((item) => item.trim().length > 0);
}

function todayCardStatus({
  phase,
  scheduledToday,
  entry,
  hasTasks,
  intentionalRest
}: {
  phase: OverviewPhase;
  scheduledToday: boolean;
  entry: DailyGoal | undefined;
  hasTasks: boolean;
  intentionalRest: boolean;
}): TodayCardStatus {
  if (phase === "upcoming") return "upcoming";
  if (phase === "ended") return "ended";
  if (!scheduledToday) return "off-day";
  if (entry?.done) return "closed";
  if (intentionalRest && !hasTasks) return "clear";
  if (!hasTasks) return "needs-task";
  return "ready";
}

function todayCardStatusLabel(status: TodayCardStatus): string {
  if (status === "needs-task") return "Task required";
  if (status === "ready") return "In motion";
  if (status === "clear") return "No task today";
  if (status === "closed") return "Done";
  if (status === "off-day") return "Not today";
  if (status === "upcoming") return "Upcoming";
  return "Review";
}

function TaskDoneIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 8.2 6.6 11 12.8 4.8" />
    </svg>
  );
}

function DayTiles({ daysOfWeek }: { daysOfWeek: Outcome["daysOfWeek"] }) {
  const activeDaySet = new Set(normalizeDaysOfWeek(daysOfWeek));

  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Planning days">
      {ALL_DAYS_OF_WEEK.map((day) => {
        const active = activeDaySet.has(day);
        return (
          <span
            key={day}
            className={cn(
              "inline-flex h-6 min-w-7 items-center justify-center rounded-[0.45rem] border px-1.5 text-[10px] font-bold uppercase tracking-[0.08em]",
              active
                ? "border-[color:var(--outcome-border)] bg-[color:var(--outcome-soft)] text-[color:var(--outcome-ink)]"
                : "border-[color:var(--app-border)] bg-[color:var(--app-elevated)] text-[color:var(--app-subtle)] opacity-55"
            )}
          >
            {DAY_OF_WEEK_LABELS_SHORT[day].slice(0, 1)}
          </span>
        );
      })}
    </div>
  );
}

function closeDayAndEliminateTasks(outcomeId: string, dateISO: string, items: string[], itemsDone: boolean[]) {
  items.forEach((task, index) => {
    if (task.trim() && !itemsDone[index]) {
      actions.toggleDailyItemDone(outcomeId, dateISO, index);
    }
  });
  actions.toggleDailyDone(outcomeId, dateISO);
}

function toneClasses(state: DayVisualState): string {
  return daySurfaceClass(state);
}

function fixedWeekState({
  dateISO,
  activeDateSet,
  daily,
  outcomeId,
  todayISO
}: {
  dateISO: string;
  activeDateSet: Set<string>;
  daily: Record<string, DailyGoal>;
  outcomeId: string;
  todayISO: string;
}): DayVisualState {
  if (!activeDateSet.has(dateISO)) return "future";
  return dayVisualState(daily[`${outcomeId}:${dateISO}`], dateISO, todayISO);
}

function MiniDayCell({
  dateISO,
  state,
  highlight = false,
  className,
  onClick
}: {
  dateISO: string;
  state: DayVisualState;
  highlight?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const weekday = parseISODate(dateISO).toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1);
  const day = parseISODate(dateISO).toLocaleDateString(undefined, { day: "numeric" });
  const Component = onClick ? "button" : "div";

  return (
    <Component
      {...(onClick ? { type: "button", onClick } : {})}
      title={formatShortDate(dateISO)}
      className={cn(
        "flex h-14 w-10 flex-col items-center justify-center rounded-[0.7rem] border text-xs",
        toneClasses(state),
        highlight ? "shadow-[inset_0_0_0_1px_var(--app-text)]" : "",
        onClick ? "cursor-pointer transition hover:-translate-y-[1px] hover:shadow-[0_8px_18px_var(--app-shadow)]" : "",
        className
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-70">{weekday}</div>
      <div className="font-display mt-1 text-[1.05rem] font-semibold leading-none">{day}</div>
    </Component>
  );
}

export default function OverviewView({
  outcome,
  weekStartsOn
}: {
  outcome: Outcome;
  weekStartsOn: WeekStartsOn;
}) {
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

  const daysUntilStart = Math.max(startDayNumber - todayDayNumber, 0);

  const boardDateISO = React.useMemo(() => {
    if (!hasActiveDays) return outcome.startDate;
    if (phase === "upcoming") return activeDates[0];
    if (phase === "ended") return activeDates[activeDates.length - 1];
    return activeDates.find((dateISO) => isoToDayNumber(dateISO) >= todayDayNumber) ?? activeDates[activeDates.length - 1];
  }, [activeDates, hasActiveDays, outcome.startDate, phase, todayDayNumber]);

  const boardEntry = hasActiveDays ? daily[`${outcome.id}:${boardDateISO}`] : undefined;
  const boardItems = hasActiveDays ? dailyItems(boardEntry) : [];
  const boardItemsDone = Array.isArray(boardEntry?.itemsDone) ? boardEntry.itemsDone : [];
  const boardHasTasks = hasMeaningfulItems(boardItems);
  const boardIntentionalRest = Boolean(boardEntry?.intentionalRest);
  const scheduledToday = activeDates.includes(todayISO);
  const boardStatus = todayCardStatus({
    phase,
    scheduledToday,
    entry: boardEntry,
    hasTasks: boardHasTasks,
    intentionalRest: boardIntentionalRest
  });
  const boardStatusTone = TODAY_CARD_STATUS_TONE[boardStatus];
  const canEditTodayCard = hasActiveDays && phase === "active" && scheduledToday;
  const canCloseTodayCard = boardStatus === "ready" || boardStatus === "clear" || boardStatus === "closed";
  const taskRows = boardItems.map((task, index) => ({ task, index, done: Boolean(boardItemsDone[index]) }));
  const activeTaskRows = taskRows.filter((row) => !row.done);
  const completedTaskRows = taskRows.filter((row) => row.done && row.task.trim());
  const activeDateSet = React.useMemo(() => new Set(activeDates), [activeDates]);
  const calendarWeekDates = React.useMemo(() => {
    const weekStart = startOfWeek(parseISODate(todayISO), weekStartsOn);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      return toISODate(date);
    });
  }, [todayISO, weekStartsOn]);
  const weekActiveDates = React.useMemo(
    () => calendarWeekDates.filter((dateISO) => activeDateSet.has(dateISO)),
    [activeDateSet, calendarWeekDates]
  );
  const weekDoneCount = weekActiveDates.reduce((count, dateISO) => count + (daily[`${outcome.id}:${dateISO}`]?.done ? 1 : 0), 0);
  const weekProgress = weekActiveDates.length ? weekDoneCount / weekActiveDates.length : phase === "upcoming" ? 0 : 1;
  const weekTone = weekActiveDates.length ? trafficLightToneFromProgress(weekProgress) : "amber";

  return (
    <div className="grid gap-4" style={getOutcomeThemeStyle(outcome.themeId)}>
      <div className="grid items-stretch gap-3 sm:gap-4 xl:grid-cols-2">
        <div
          className={cn(
            "app-today-action-card group flex h-full min-h-[9.25rem] flex-col rounded-[0.9rem] border bg-[color:var(--app-card)] p-3.5 transition",
            "border-[color:var(--outcome-border)] hover:bg-[color:var(--app-elevated)]"
          )}
        >
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="app-today-card-header flex min-w-0 items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="inline-flex h-3 w-3 shrink-0 rounded-full border border-[color:var(--outcome-border)] bg-[color:var(--outcome-accent)]" />
                <div className="min-w-0 truncate text-left text-base font-semibold leading-6">{outcome.title}</div>
              </div>
              <span
                data-status={boardStatus}
                className={cn(
                  "app-today-status inline-flex shrink-0 items-center rounded-[0.55rem] border px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em] shadow-sm",
                  boardStatus === "needs-task" ? "shadow-[0_0_0_2px_var(--app-signal-red-bg)]" : "",
                  trafficLightSurfaceClass(boardStatusTone)
                )}
              >
                {boardStatus === "needs-task" ? (
                  <span className="mr-1.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[color:var(--app-signal-red-fill)] text-white">
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                    >
                      <path d="M12 5.75v7" />
                      <circle cx="12" cy="18" r="1.8" fill="currentColor" stroke="none" />
                    </svg>
                  </span>
                ) : null}
                {todayCardStatusLabel(boardStatus)}
              </span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col justify-center">
              {canEditTodayCard ? (
                <div className="grid gap-2">
                  {activeTaskRows.map(({ task, index }) => (
                    <div key={index} className="app-today-task-row grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.55rem] border border-[color:var(--outcome-border)] bg-[color:var(--outcome-soft)] text-[color:var(--outcome-ink)] transition hover:bg-[color:var(--outcome-accent)] disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Mark task done"
                        disabled={!task.trim()}
                        onClick={() => actions.toggleDailyItemDone(outcome.id, boardDateISO, index)}
                      >
                        <TaskDoneIcon />
                      </button>
                      <Input
                        value={task}
                        onChange={(event) => actions.setDailyItem(outcome.id, boardDateISO, index, event.target.value)}
                        placeholder={index === 0 ? "One task for today..." : "Another small task..."}
                        className="h-10 rounded-[0.7rem] border-[color:var(--outcome-border)] bg-[color:var(--app-elevated)] text-sm font-semibold text-[color:var(--outcome-ink)]"
                        aria-label={`Daily task ${index + 1}`}
                      />
                      {boardItems.length > 1 || task.trim() ? (
                        <button
                          type="button"
                          className="h-8 w-8 shrink-0 rounded-[0.55rem] text-sm font-semibold text-[color:var(--app-muted)] transition hover:bg-[color:var(--app-nav-hover)] hover:text-[color:var(--app-text)]"
                          aria-label={`Delete daily task ${index + 1}`}
                          onClick={() => actions.removeDailyItem(outcome.id, boardDateISO, index)}
                        >
                          -
                        </button>
                      ) : (
                        <span className="h-8 w-8" aria-hidden="true" />
                      )}
                    </div>
                  ))}
                  {completedTaskRows.length ? (
                    <div className="mt-1 grid gap-1.5 pt-2">
                      {completedTaskRows.map(({ task, index }) => (
                        <button
                          key={index}
                          type="button"
                          className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-[0.55rem] px-1 py-1 text-left text-[color:var(--app-muted)] transition hover:text-[color:var(--app-text)]"
                          aria-label="Move task back to active"
                          onClick={() => actions.toggleDailyItemDone(outcome.id, boardDateISO, index)}
                        >
                          <TaskDoneIcon />
                          <span className="truncate text-[12px] font-semibold sm:text-sm">{task}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="truncate text-sm font-semibold leading-5 text-[color:var(--app-text)]">
                  {!hasActiveDays
                    ? "No active day is scheduled."
                    : boardStatus === "upcoming"
                      ? `Starts ${formatShortDate(outcome.startDate)}.`
                      : boardStatus === "ended"
                        ? `Ended ${formatShortDate(outcome.endDate)}.`
                        : boardStatus === "off-day"
                          ? `Next active day ${formatShortDate(boardDateISO)}.`
                          : boardHasTasks
                            ? boardItems.map((item) => item.trim()).filter(Boolean)[0]
                            : "One task for today..."}
                </div>
              )}
            </div>

            <div className="app-today-card-footer flex items-center justify-between gap-2 pt-2.5">
              <div className="min-w-0">
                <DayTiles daysOfWeek={outcome.daysOfWeek} />
              </div>
              {canEditTodayCard ? (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="h-8 rounded-[0.55rem] px-2.5 text-[11px] font-semibold text-[color:var(--app-muted)] transition hover:bg-[color:var(--app-nav-hover)] hover:text-[color:var(--app-text)]"
                    onClick={() => actions.addDailyItem(outcome.id, boardDateISO)}
                  >
                    + Add
                  </button>
                  <Button
                    variant={boardEntry?.done ? "secondary" : "primary"}
                    size="sm"
                    className="h-8 rounded-[0.55rem] px-3 text-[12px]"
                    disabled={!canCloseTodayCard}
                    onClick={() => {
                      if (boardEntry?.done) {
                        actions.toggleDailyDone(outcome.id, boardDateISO);
                        return;
                      }
                      closeDayAndEliminateTasks(outcome.id, boardDateISO, boardItems, boardItemsDone);
                    }}
                  >
                    {boardEntry?.done ? "Reopen" : "Mark done"}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className="app-week-summary-card grid h-full gap-3 rounded-[0.9rem] border border-[color:var(--outcome-border)] bg-[color:var(--app-card)] p-3.5 sm:gap-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="app-kicker">This week</div>
              <div className="font-display mt-1.5 text-[1.2rem] font-semibold leading-tight text-[color:var(--app-text)] sm:mt-2 sm:text-[1.6rem]">
                The week at a glance.
              </div>
            </div>
            <div className={cn("rounded-[0.55rem] border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]", trafficLightSurfaceClass(weekTone))}>
              {weekActiveDates.length ? `${weekDoneCount}/${weekActiveDates.length}` : phase === "upcoming" ? `${daysUntilStart}d` : "0/0"}
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {calendarWeekDates.map((dateISO) => (
              <MiniDayCell
                key={dateISO}
                dateISO={dateISO}
                state={fixedWeekState({ dateISO, activeDateSet, daily, outcomeId: outcome.id, todayISO })}
                highlight={dateISO === todayISO}
                className="w-full min-w-0"
              />
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
