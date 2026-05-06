import React from "react";
import { actions, useAppState } from "../store";
import type { DailyGoal, Outcome } from "../types";
import {
  ALL_DAYS_OF_WEEK,
  DAY_OF_WEEK_LABELS_SHORT,
  dateISOsInRange,
  formatShortDate,
  isoToDayNumber,
  normalizeDaysOfWeek,
  toISODate
} from "../date";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Input from "../ui/Input";
import { cn } from "../ui/cn";
import { getOutcomeThemeStyle } from "../theme";
import { trafficLightSurfaceClass, type TrafficLightTone } from "../ui/trafficLight";

type OutcomePhase = "upcoming" | "active" | "ended";
type OutcomeActionStatus = "needs-task" | "ready" | "clear" | "closed" | "off-day" | "upcoming" | "ended";

type OutcomeSummary = {
  outcome: Outcome;
  phase: OutcomePhase;
  activeDates: string[];
  daysUntilStart: number;
  nextOpenDate: string | null;
};

type TodaySummary = {
  dateISO: string;
  entry: DailyGoal | undefined;
  items: string[];
  itemsDone: boolean[];
  hasTasks: boolean;
  intentionalRest: boolean;
};

type OutcomeActionItem = {
  summary: OutcomeSummary;
  today: TodaySummary | null;
  status: OutcomeActionStatus;
};

const STATUS_TONE: Record<OutcomeActionStatus, TrafficLightTone> = {
  "needs-task": "red",
  ready: "amber",
  clear: "amber",
  upcoming: "amber",
  "off-day": "amber",
  ended: "red",
  closed: "green"
};

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function dailyItems(entry: DailyGoal | undefined): string[] {
  if (Array.isArray(entry?.items) && entry.items.length) return entry.items;
  return [entry?.title ?? ""];
}

function hasMeaningfulItems(items: string[]): boolean {
  return items.some((item) => item.trim().length > 0);
}

function taskPreview(today: TodaySummary | null): string {
  if (!today) return "";
  const tasks = today.items.map((item) => item.trim()).filter(Boolean);
  if (!tasks.length) return "";
  return tasks.length === 1 ? tasks[0] : `${tasks[0]} +${tasks.length - 1} more`;
}

function summarizeOutcome(
  outcome: Outcome,
  daily: Record<string, DailyGoal>,
  todayISO: string,
  todayDay: number
): OutcomeSummary {
  const activeDates = dateISOsInRange(outcome.startDate, outcome.endDate, outcome.daysOfWeek);
  const startDay = isoToDayNumber(outcome.startDate);
  const endDay = isoToDayNumber(outcome.endDate);
  const phase: OutcomePhase = todayDay < startDay ? "upcoming" : todayDay > endDay ? "ended" : "active";
  const nextOpenDate = activeDates.find((dateISO) => dateISO >= todayISO && !daily[`${outcome.id}:${dateISO}`]?.done) ?? null;

  return {
    outcome,
    phase,
    activeDates,
    daysUntilStart: Math.max(startDay - todayDay, 0),
    nextOpenDate
  };
}

function buildTodaySummary(outcomeId: string, daily: Record<string, DailyGoal>, todayISO: string): TodaySummary {
  const entry = daily[`${outcomeId}:${todayISO}`];
  const items = dailyItems(entry);
  return {
    dateISO: todayISO,
    entry,
    items,
    itemsDone: Array.isArray(entry?.itemsDone) ? entry.itemsDone : [],
    hasTasks: hasMeaningfulItems(items),
    intentionalRest: Boolean(entry?.intentionalRest)
  };
}

function actionStatus(summary: OutcomeSummary, today: TodaySummary | null, todayISO: string): OutcomeActionStatus {
  if (summary.phase === "upcoming") return "upcoming";
  if (summary.phase === "ended") return "ended";
  if (!summary.activeDates.includes(todayISO)) return "off-day";
  if (today?.entry?.done) return "closed";
  if (!today?.hasTasks) return "needs-task";
  return "ready";
}

function actionHeadline(item: OutcomeActionItem): string {
  if (item.status === "needs-task") return "Add one small task.";
  if (item.status === "ready") return taskPreview(item.today) || "Task set.";
  if (item.status === "clear") return "You chose no task today.";
  if (item.status === "closed") return "Done for today.";
  if (item.status === "upcoming") return `Starts ${formatShortDate(item.summary.outcome.startDate)}.`;
  if (item.status === "ended") return `Ended ${formatShortDate(item.summary.outcome.endDate)}.`;
  if (item.summary.nextOpenDate) return `Next open day ${formatShortDate(item.summary.nextOpenDate)}.`;
  return "Not scheduled today.";
}

function actionSupport(item: OutcomeActionItem): string {
  if (item.status === "needs-task") return "";
  if (item.status === "ready") return "";
  if (item.status === "clear") return "Add a task if that changed.";
  if (item.status === "closed") return "";
  if (item.status === "upcoming") return `${pluralize(item.summary.daysUntilStart, "day")} until the window opens.`;
  if (item.status === "ended") return "Review it or move it to the Victory Wall.";
  return "Not scheduled today.";
}

function statusLabel(status: OutcomeActionStatus): string {
  if (status === "needs-task") return "Task required";
  if (status === "ready") return "In motion";
  if (status === "clear") return "No task today";
  if (status === "closed") return "Done";
  if (status === "off-day") return "Not today";
  if (status === "upcoming") return "Upcoming";
  return "Review";
}

function openOutcome(outcomeId: string) {
  actions.openOverview("outcome", outcomeId);
}

function DayTiles({ daysOfWeek }: { daysOfWeek: Outcome["daysOfWeek"] }) {
  const activeDaySet = new Set(normalizeDaysOfWeek(daysOfWeek));

  return (
    <div className="app-day-tiles flex flex-wrap gap-1.5" aria-label="Planning days">
      {ALL_DAYS_OF_WEEK.map((day) => {
        const active = activeDaySet.has(day);
        return (
          <span
            key={day}
            className={cn(
              "app-day-tile inline-flex h-6 min-w-7 items-center justify-center rounded-[0.45rem] border px-1.5 text-[10px] font-bold uppercase tracking-[0.08em]",
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

function closeDayAndEliminateTasks(outcomeId: string, today: TodaySummary) {
  today.items.forEach((task, index) => {
    if (task.trim() && !today.itemsDone[index]) {
      actions.toggleDailyItemDone(outcomeId, today.dateISO, index);
    }
  });
  actions.toggleDailyDone(outcomeId, today.dateISO);
}

function OutcomeActionRow({ item }: { item: OutcomeActionItem }) {
  const { summary, today, status } = item;
  const outcome = summary.outcome;
  const statusTone = STATUS_TONE[status];
  const canClose = status === "ready" || status === "clear" || status === "closed";
  const support = actionSupport(item);
  const canEditTasks = Boolean(today && status !== "upcoming" && status !== "ended" && status !== "off-day");
  const prominentStatus = status === "needs-task" || status === "ready" || status === "clear" || status === "closed";
  const taskRows = today ? today.items.map((task, index) => ({ task, index, done: Boolean(today.itemsDone[index]) })) : [];
  const activeTaskRows = taskRows.filter((row) => !row.done);
  const eliminatedTaskRows = taskRows.filter((row) => row.done && row.task.trim());

  return (
    <div
      style={getOutcomeThemeStyle(outcome.themeId)}
      className={cn(
        "app-today-action-card group flex min-h-[9.25rem] min-w-0 flex-col rounded-[0.9rem] border bg-[color:var(--app-card)] p-3.5 transition",
        "border-[color:var(--outcome-border)] hover:bg-[color:var(--app-elevated)]"
      )}
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="app-today-card-header flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex h-3 w-3 shrink-0 rounded-full border border-[color:var(--outcome-border)] bg-[color:var(--outcome-accent)]" />
            <button
              type="button"
              className="min-w-0 truncate text-left text-base font-semibold leading-6 transition hover:opacity-75"
              onClick={() => openOutcome(outcome.id)}
            >
              {outcome.title}
            </button>
          </div>
          <span
            data-status={status}
            className={cn(
              "app-today-status inline-flex shrink-0 items-center rounded-[0.55rem] border font-bold uppercase tracking-[0.14em]",
              prominentStatus ? "px-3.5 py-1.5 text-[12px] shadow-sm" : "px-2.5 py-1 text-[10px]",
              status === "needs-task" ? "shadow-[0_0_0_2px_var(--app-signal-red-bg)]" : "",
              trafficLightSurfaceClass(statusTone)
            )}
          >
            {status === "needs-task" ? (
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
            {statusLabel(status)}
          </span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col justify-center">
          {canEditTasks && today ? (
            <div className="app-today-task-list grid min-w-0 gap-2">
              {activeTaskRows.map(({ task, index }) => (
                <div key={index} className="app-today-task-row grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.55rem] border border-[color:var(--outcome-border)] bg-[color:var(--outcome-soft)] text-[color:var(--outcome-ink)] transition hover:bg-[color:var(--outcome-accent)] disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Mark task done"
                    disabled={!task.trim()}
                    onClick={() => actions.toggleDailyItemDone(outcome.id, today.dateISO, index)}
                  >
                    <TaskDoneIcon />
                  </button>
                  <Input
                    value={task}
                    onChange={(event) => actions.setDailyItem(outcome.id, today.dateISO, index, event.target.value)}
                    placeholder={index === 0 ? "One task for today..." : "Another small task..."}
                    className="min-w-0 h-10 rounded-[0.7rem] border-[color:var(--outcome-border)] bg-[color:var(--app-elevated)] text-sm font-semibold text-[color:var(--outcome-ink)]"
                  />
                  {today.items.length > 1 || task.trim() ? (
                    <button
                      type="button"
                      className="h-8 w-8 shrink-0 rounded-[0.55rem] text-sm font-semibold text-[color:var(--app-muted)] transition hover:bg-[color:var(--app-nav-hover)] hover:text-[color:var(--app-text)]"
                      aria-label="Remove task"
                      onClick={() => actions.removeDailyItem(outcome.id, today.dateISO, index)}
                    >
                      -
                    </button>
                  ) : (
                    <span className="h-8 w-8" aria-hidden="true" />
                  )}
                </div>
              ))}
              {eliminatedTaskRows.length ? (
                <div className="mt-1 grid gap-1.5 pt-2">
                  {eliminatedTaskRows.map(({ task, index }) => (
                    <button
                      key={index}
                      type="button"
                      className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-[0.55rem] px-1 py-1 text-left text-[color:var(--app-muted)] transition hover:text-[color:var(--app-text)]"
                      aria-label="Move task back to active"
                      onClick={() => actions.toggleDailyItemDone(outcome.id, today.dateISO, index)}
                    >
                      <TaskDoneIcon />
                      <span className="truncate text-[12px] font-semibold sm:text-sm">{task}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="truncate text-sm font-semibold leading-5 text-[color:var(--app-text)]">{actionHeadline(item)}</div>
          )}
        </div>

        <div className="app-today-card-footer flex items-center justify-between gap-2 pt-2.5">
          <div className="min-w-0">
            <DayTiles daysOfWeek={outcome.daysOfWeek} />
            {support ? <div className="app-today-card-support mt-1 truncate text-[11px] app-muted">{support}</div> : null}
          </div>
          {canEditTasks && today ? (
            <div className="app-today-card-actions flex shrink-0 items-center gap-1">
              <button
                type="button"
                className="h-8 rounded-[0.55rem] px-2.5 text-[11px] font-semibold text-[color:var(--app-muted)] transition hover:bg-[color:var(--app-nav-hover)] hover:text-[color:var(--app-text)]"
                onClick={() => actions.addDailyItem(outcome.id, today.dateISO)}
              >
                + Add
              </button>
              <Button
                variant={today.entry?.done ? "secondary" : "primary"}
                size="sm"
                className="h-8 rounded-[0.55rem] px-3 text-[12px]"
                disabled={!canClose}
                onClick={() => {
                  if (today.entry?.done) {
                    actions.toggleDailyDone(outcome.id, today.dateISO);
                    return;
                  }
                  closeDayAndEliminateTasks(outcome.id, today);
                }}
              >
                {today.entry?.done ? "Reopen" : "Mark done"}
              </Button>
            </div>
          ) : null}

          {!canEditTasks && status !== "needs-task" ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 rounded-[0.55rem] px-3 text-[12px]"
              onClick={() => openOutcome(outcome.id)}
            >
              Open
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function OverviewLandingView() {
  const outcomes = useAppState((s) => s.outcomes);
  const archivedOutcomes = useAppState((s) => s.archivedOutcomes);
  const daily = useAppState((s) => s.daily);

  const todayISO = toISODate(new Date());
  const todayDay = isoToDayNumber(todayISO);
  const archivedOutcomeIdSet = React.useMemo(() => new Set(archivedOutcomes.map((outcome) => outcome.id)), [archivedOutcomes]);
  const activeOutcomes = React.useMemo(
    () => outcomes.filter((outcome) => !archivedOutcomeIdSet.has(outcome.id)),
    [archivedOutcomeIdSet, outcomes]
  );

  const actionItems = React.useMemo(() => {
    return activeOutcomes.map((outcome) => {
      const summary = summarizeOutcome(outcome, daily, todayISO, todayDay);
      const today = summary.phase === "active" && summary.activeDates.includes(todayISO) ? buildTodaySummary(outcome.id, daily, todayISO) : null;
      const status = actionStatus(summary, today, todayISO);
      return { summary, today, status } satisfies OutcomeActionItem;
    });
  }, [activeOutcomes, daily, todayDay, todayISO]);

  const activeActionItems = actionItems.filter((item) => item.status !== "closed");
  const completedActionItems = actionItems.filter((item) => item.status === "closed");

  return (
    <Card className="app-today-landing-card min-w-0 rounded-[0.95rem] p-3.5 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <div className="app-kicker">Outcomes</div>
          <div className="font-display mt-1.5 text-[1.42rem] font-semibold leading-tight sm:mt-2 sm:text-[2rem]">Start here.</div>
        </div>
        <div className="shrink-0 rounded-[0.7rem] border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] px-3 py-2 text-right shadow-sm sm:rounded-[0.75rem] sm:px-3.5 sm:py-2.5">
          <div className="app-kicker">Today</div>
          <div className="mt-1 text-sm font-semibold text-[color:var(--app-text)]">{formatShortDate(todayISO)}</div>
        </div>
      </div>

      <div className="app-today-list-grid mt-4 grid min-w-0 gap-3 sm:mt-5 lg:grid-cols-2">
        {activeActionItems.length ? (
          activeActionItems.map((item) => <OutcomeActionRow key={item.summary.outcome.id} item={item} />)
        ) : (
          <div className="rounded-[0.9rem] border border-dashed border-[color:var(--app-border)] px-4 py-8 text-center text-sm app-muted lg:col-span-2">
            {completedActionItems.length ? (
              <div className="mx-auto flex max-w-md flex-col items-center gap-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--app-signal-green-border)] bg-[color:var(--app-signal-green-bg)] text-[color:var(--app-signal-green-text)] shadow-sm">
                  <TaskDoneIcon />
                </div>
                <div>
                  <div className="font-display text-lg font-semibold leading-tight text-[color:var(--app-text)]">Great job.</div>
                  <div className="mt-1 text-sm app-muted">Everything for today is done.</div>
                </div>
              </div>
            ) : (
              "No active outcomes yet. Create one from the sidebar when you are ready to commit."
            )}
          </div>
        )}
      </div>

      {completedActionItems.length ? (
        <div className="app-today-completed-panel mt-4 min-w-0 rounded-[0.95rem] border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] p-3.5 sm:mt-5 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="app-kicker">Completed tasks</div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--app-text)]">
                Done outcomes move here so the remaining work stays visually stable.
              </div>
            </div>
            <span className={cn("shrink-0 rounded-[0.55rem] border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]", trafficLightSurfaceClass("green"))}>
              {completedActionItems.length} done
            </span>
          </div>
          <div className="app-today-list-grid grid min-w-0 gap-3 lg:grid-cols-2">
            {completedActionItems.map((item) => (
              <OutcomeActionRow key={item.summary.outcome.id} item={item} />
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
