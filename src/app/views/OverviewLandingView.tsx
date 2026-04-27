import React from "react";
import { actions, useAppState } from "../store";
import type { ArchivedOutcome, DailyGoal, Outcome } from "../types";
import { dateISOsInRange, formatDaysOfWeek, formatShortDate, isoToDayNumber, monthKeysInRange, toISODate } from "../date";
import { getOutcomeTheme } from "../theme";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Progress from "../ui/Progress";
import { cn } from "../ui/cn";
import { trafficLightSurfaceClass, trafficLightToneFromProgress, trafficLightVar, type TrafficLightTone } from "../ui/trafficLight";

type OutcomePhase = "upcoming" | "active" | "ended";

type OutcomeSummary = {
  outcome: Outcome;
  phase: OutcomePhase;
  phaseTone: TrafficLightTone;
  activeDates: string[];
  elapsedDates: string[];
  doneElapsed: number;
  elapsedTotal: number;
  progressValue: number;
  progressPercent: number;
  openDaysLeft: number;
  daysUntilStart: number;
  nextOpenDate: string | null;
  monthCount: number;
};

type TodaySummary = {
  summary: OutcomeSummary;
  dateISO: string;
  entry: DailyGoal | undefined;
  items: string[];
  itemsDone: boolean[];
  hasTasks: boolean;
  intentionalRest: boolean;
};

type OutcomeBoardItem =
  | {
      kind: "active";
      summary: OutcomeSummary;
    }
  | {
      kind: "completed";
      summary: OutcomeSummary;
      archivedOutcome: ArchivedOutcome;
    };

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

function phaseCopy(summary: OutcomeSummary): { label: string; detail: string } {
  if (summary.phase === "upcoming") {
    return {
      label: "Upcoming",
      detail: `${pluralize(summary.daysUntilStart, "day")} until ${formatShortDate(summary.outcome.startDate)}`
    };
  }

  if (summary.phase === "ended") {
    return {
      label: "Ended",
      detail: `Window closed on ${formatShortDate(summary.outcome.endDate)}`
    };
  }

  if (summary.nextOpenDate === toISODate(new Date())) {
    return { label: "In motion", detail: "Today is still open" };
  }

  if (summary.nextOpenDate) {
    return { label: "In motion", detail: `Next open day ${formatShortDate(summary.nextOpenDate)}` };
  }

  return { label: "In motion", detail: "Every remaining active day is already closed" };
}

function summarizeOutcome(outcome: Outcome, daily: Record<string, DailyGoal>, todayISO: string, todayDay: number): OutcomeSummary {
  const activeDates = dateISOsInRange(outcome.startDate, outcome.endDate, outcome.daysOfWeek);
  const startDay = isoToDayNumber(outcome.startDate);
  const endDay = isoToDayNumber(outcome.endDate);

  const phase: OutcomePhase = todayDay < startDay ? "upcoming" : todayDay > endDay ? "ended" : "active";
  const elapsedUntil = Math.min(todayDay, endDay);
  const elapsedDates = activeDates.filter((dateISO) => isoToDayNumber(dateISO) <= elapsedUntil);
  const doneElapsed = elapsedDates.reduce((count, dateISO) => count + (daily[`${outcome.id}:${dateISO}`]?.done ? 1 : 0), 0);
  const elapsedTotal = elapsedDates.length;
  const progressValue = elapsedTotal ? doneElapsed / elapsedTotal : 0;
  const openDaysLeft = activeDates.reduce((count, dateISO) => {
    if (dateISO < todayISO) return count;
    return count + (daily[`${outcome.id}:${dateISO}`]?.done ? 0 : 1);
  }, 0);
  const nextOpenDate = activeDates.find((dateISO) => dateISO >= todayISO && !daily[`${outcome.id}:${dateISO}`]?.done) ?? null;
  const phaseTone = phase === "upcoming" ? "amber" : trafficLightToneFromProgress(progressValue);

  return {
    outcome,
    phase,
    phaseTone,
    activeDates,
    elapsedDates,
    doneElapsed,
    elapsedTotal,
    progressValue,
    progressPercent: Math.round(progressValue * 100),
    openDaysLeft,
    daysUntilStart: Math.max(startDay - todayDay, 0),
    nextOpenDate,
    monthCount: monthKeysInRange(outcome.startDate, outcome.endDate).length
  };
}

function MetricTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[0.75rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] app-subtle">{label}</div>
      <div className="mt-2 font-display text-[1.5rem] font-semibold leading-none">{value}</div>
      <div className="mt-2 text-xs app-muted">{detail}</div>
    </div>
  );
}

function compactCount(value: number): string {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: value >= 1000 ? 1 : 0 }).format(value);
}

function OutcomeProgressBars({ summaries }: { summaries: OutcomeSummary[] }) {
  if (!summaries.length) {
    return (
      <div className="rounded-[0.8rem] border border-dashed border-[color:var(--app-border)] px-4 py-5 text-sm app-muted">
        Create an outcome to see progress here.
      </div>
    );
  }

  return (
    <div className="rounded-[0.85rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="app-kicker">Outcome progress</div>
        <div className="text-[11px] app-muted">All outcomes</div>
      </div>

      <div className="mt-4 grid gap-3">
        {summaries.map((summary) => {
          const theme = getOutcomeTheme(summary.outcome.themeId);
          return (
            <button
              key={summary.outcome.id}
              type="button"
              className="grid gap-2 text-left transition hover:opacity-85"
              onClick={() => {
                actions.openOverview("outcome", summary.outcome.id);
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2">
                  <span className="inline-flex h-3 w-3 shrink-0 rounded-full border" style={{ borderColor: theme.border, background: theme.accent }} />
                  <div className="truncate text-sm font-semibold" style={{ color: theme.ink }}>
                    {summary.outcome.title}
                  </div>
                </div>
                <div className="shrink-0 text-xs font-semibold" style={{ color: theme.ink }}>
                  {summary.progressPercent}%
                </div>
              </div>

              <Progress value={summary.progressValue} tone={summary.phaseTone} className="h-2 rounded-[0.35rem]" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function OverviewLandingView() {
  const outcomes = useAppState((s) => s.outcomes);
  const archivedOutcomes = useAppState((s) => s.archivedOutcomes);
  const daily = useAppState((s) => s.daily);
  const [showCompletedOnBoard, setShowCompletedOnBoard] = React.useState(false);

  const todayISO = toISODate(new Date());
  const todayDay = isoToDayNumber(todayISO);
  const archivedOutcomeIdSet = React.useMemo(() => new Set(archivedOutcomes.map((outcome) => outcome.id)), [archivedOutcomes]);
  const activeOutcomes = React.useMemo(
    () => outcomes.filter((outcome) => !archivedOutcomeIdSet.has(outcome.id)),
    [archivedOutcomeIdSet, outcomes]
  );

  const summaries = React.useMemo(
    () => activeOutcomes.map((outcome) => summarizeOutcome(outcome, daily, todayISO, todayDay)),
    [activeOutcomes, daily, todayDay, todayISO]
  );
  const archivedSummaries = React.useMemo(
    () => archivedOutcomes.map((outcome) => ({ archivedOutcome: outcome, summary: summarizeOutcome(outcome, daily, todayISO, todayDay) })),
    [archivedOutcomes, daily, todayDay, todayISO]
  );
  const boardItems = React.useMemo<OutcomeBoardItem[]>(
    () => [
      ...summaries.map((summary) => ({ kind: "active", summary }) satisfies OutcomeBoardItem),
      ...(showCompletedOnBoard
        ? archivedSummaries.map(({ archivedOutcome, summary }) => ({ kind: "completed", archivedOutcome, summary }) satisfies OutcomeBoardItem)
        : [])
    ],
    [archivedSummaries, showCompletedOnBoard, summaries]
  );

  const activeCount = summaries.filter((summary) => summary.phase === "active").length;
  const upcomingCount = summaries.filter((summary) => summary.phase === "upcoming").length;
  const endedCount = summaries.filter((summary) => summary.phase === "ended").length;
  const totalElapsed = summaries.reduce((count, summary) => count + summary.elapsedTotal, 0);
  const totalDone = summaries.reduce((count, summary) => count + summary.doneElapsed, 0);
  const totalOpenDays = summaries.reduce((count, summary) => count + summary.openDaysLeft, 0);
  const overallProgress = totalElapsed ? totalDone / totalElapsed : 0;
  const overallPercent = Math.round(overallProgress * 100);
  const overallTone = totalElapsed ? trafficLightToneFromProgress(overallProgress) : "amber";
  const totalOutcomes = summaries.length;
  const activeShare = totalOutcomes ? activeCount / totalOutcomes : 0;
  const upcomingShare = totalOutcomes ? upcomingCount / totalOutcomes : 0;
  const endedShare = totalOutcomes ? endedCount / totalOutcomes : 0;
  const compactOpenDays = compactCount(totalOpenDays);
  const nextUp = summaries
    .filter((summary) => summary.nextOpenDate)
    .sort((a, b) => (a.nextOpenDate! < b.nextOpenDate! ? -1 : 1))
    .slice(0, 6);
  const todaySummaries = summaries
    .filter((summary) => summary.phase === "active" && summary.activeDates.includes(todayISO))
    .map((summary) => {
      const entry = daily[`${summary.outcome.id}:${todayISO}`];
      const items = dailyItems(entry);
      return {
        summary,
        dateISO: todayISO,
        entry,
        items,
        itemsDone: Array.isArray(entry?.itemsDone) ? entry.itemsDone : [],
        hasTasks: hasMeaningfulItems(items),
        intentionalRest: Boolean(entry?.intentionalRest)
      } satisfies TodaySummary;
    });

  return (
    <div className="grid gap-4">
      <Card className="rounded-[0.95rem] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="app-kicker">Today</div>
            <div className="mt-1 text-sm font-semibold">Define today’s tasks here.</div>
            <div className="mt-1 max-w-3xl text-xs leading-5 app-muted">
              Each active outcome needs either a task or an explicit intentional-empty acknowledgement.
            </div>
          </div>
          <div className="text-xs app-muted">{formatShortDate(todayISO)}</div>
        </div>

        {todaySummaries.length ? (
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {todaySummaries.map(({ summary, entry, items, itemsDone, hasTasks, intentionalRest }) => {
              const theme = getOutcomeTheme(summary.outcome.themeId);
              const canClose = hasTasks || intentionalRest;
              const taskCount = items.filter((item) => item.trim().length > 0).length;
              return (
                <div
                  key={summary.outcome.id}
                  className="rounded-[0.8rem] border p-3"
                  style={{ borderColor: theme.border, background: theme.soft, color: theme.ink }}
                >
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex h-3 w-3 rounded-full border" style={{ borderColor: theme.border, background: theme.accent }} />
                        <div className="truncate text-sm font-semibold">{summary.outcome.title}</div>
                        <span
                          className="rounded-[0.45rem] border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                          style={{ borderColor: theme.border }}
                        >
                          {formatDaysOfWeek(summary.outcome.daysOfWeek)}
                        </span>
                        <span className="text-[11px] opacity-75">
                          {intentionalRest && !hasTasks ? "Intentional rest" : `${taskCount} task${taskCount === 1 ? "" : "s"}`}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-1.5">
                        {items.map((title, index) => {
                          const itemDone = Boolean(itemsDone[index]);
                          return (
                            <div key={index} className="flex items-center gap-2">
                              <button
                                type="button"
                                className="app-check inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[0.4rem] transition"
                                data-state={itemDone ? "done" : title.trim().length ? "planned" : "none"}
                                aria-pressed={itemDone}
                                onClick={() => actions.toggleDailyItemDone(summary.outcome.id, todayISO, index)}
                              >
                                x
                              </button>
                              <Input
                                value={title}
                                onChange={(e) => actions.setDailyItem(summary.outcome.id, todayISO, index, e.target.value)}
                                placeholder={index === 0 ? "What needs to happen today?" : "Another task..."}
                                className={cn("h-9 flex-1 rounded-[0.5rem] px-3 text-[13px]", itemDone ? "line-through opacity-70" : "")}
                              />
                              <button
                                type="button"
                                className="app-ghost-outline inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.45rem] text-sm transition"
                                onClick={() => actions.removeDailyItem(summary.outcome.id, todayISO, index)}
                              >
                                -
                              </button>
                            </div>
                          );
                        })}

                        <div className="flex justify-end">
                          <button
                            type="button"
                            className="app-ghost-outline inline-flex h-7 w-7 items-center justify-center rounded-[0.45rem] text-sm transition"
                            onClick={() => actions.addDailyItem(summary.outcome.id, todayISO)}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {!hasTasks ? (
                        <div className="mt-2 rounded-[0.65rem] border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] px-3 py-2 text-[color:var(--app-text)]">
                          <button
                            type="button"
                            className={cn(
                              "inline-flex items-center gap-2 rounded-[0.55rem] border px-2.5 py-1.5 text-left text-xs font-semibold transition",
                              intentionalRest
                                ? "app-tab app-tab-active"
                                : "border-[color:var(--app-border)] bg-[color:var(--app-card)] hover:bg-[color:var(--app-nav-hover)]"
                            )}
                            aria-pressed={intentionalRest}
                            onClick={() => actions.setDailyIntentionalRest(summary.outcome.id, todayISO, !intentionalRest)}
                          >
                            <span
                              className={cn(
                                "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[0.3rem] border text-[11px]",
                                intentionalRest ? "border-current" : "border-[color:var(--app-border)]"
                              )}
                            >
                              {intentionalRest ? "x" : ""}
                            </span>
                            I am intentionally not doing anything for this outcome today
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 lg:w-[11rem] lg:flex-col lg:items-stretch">
                      <Button size="sm" onClick={() => actions.openOverview("outcome", summary.outcome.id)}>
                        Open outcome
                      </Button>
                      <Button
                        variant={entry?.done ? "secondary" : "primary"}
                        disabled={!canClose}
                        title={!canClose ? "Add a task or acknowledge an intentional empty day first" : undefined}
                        onClick={() => actions.toggleDailyDone(summary.outcome.id, todayISO)}
                      >
                        {entry?.done ? "Mark not done" : "Mark today done"}
                      </Button>
                      <div className="text-[11px] app-muted lg:text-right">
                        {hasTasks ? `${taskCount} task${taskCount === 1 ? "" : "s"}` : "No tasks"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-[0.8rem] border border-dashed border-[color:var(--app-border)] px-4 py-5 text-sm app-muted">
            No active outcomes land on today.
          </div>
        )}
      </Card>

      <Card className="app-card-soft rounded-[0.95rem] p-5 sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_300px]">
          <div>
            <div className="app-kicker">Overview</div>
            <div className="font-display mt-3 text-[1.7rem] font-semibold leading-tight sm:text-[2.1rem]">Overall progress</div>
            <div className="mt-2 max-w-3xl text-sm leading-6 app-muted">One view for consistency, open days, and what needs attention next.</div>

            <div className="mt-5">
              <OutcomeProgressBars summaries={summaries} />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Outcomes" value={`${summaries.length}`} detail={`${activeCount} active, ${upcomingCount} upcoming`} />
              <MetricTile
                label="Consistency"
                value={`${overallPercent}%`}
                detail={totalElapsed ? `${totalDone}/${totalElapsed} days closed` : "No elapsed days yet"}
              />
              <MetricTile label="Open days" value={`${totalOpenDays}`} detail="Active days still open" />
              <MetricTile label="Closed windows" value={`${endedCount}`} detail={endedCount ? "Finished outcomes" : "None finished"} />
            </div>
          </div>

          <div
            className="grid gap-3 rounded-[0.85rem] border bg-[color:var(--app-card)] p-4"
            style={{ borderColor: `var(--app-signal-${overallTone}-border)` }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="app-kicker">Workspace rhythm</div>
              <div
                className={cn(
                  "rounded-[0.55rem] border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                  trafficLightSurfaceClass(overallTone)
                )}
              >
                {totalElapsed ? `${totalDone}/${totalElapsed}` : "No elapsed days"}
              </div>
            </div>

            <div className="rounded-[0.8rem] border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] p-3">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display text-[2.2rem] font-semibold leading-none">{overallPercent}%</div>
                  <div className="mt-1 truncate text-[11px] uppercase tracking-[0.16em] app-muted">overall consistency</div>
                </div>
                <div className="grid min-w-0 grid-cols-2 gap-2 text-right">
                  <div className="min-w-0 rounded-[0.65rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] px-2.5 py-2">
                    <div className="truncate text-[10px] uppercase tracking-[0.16em] app-subtle">Done</div>
                    <div className="mt-1 truncate text-sm font-semibold">{totalDone}</div>
                  </div>
                  <div className="min-w-0 rounded-[0.65rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] px-2.5 py-2">
                    <div className="truncate text-[10px] uppercase tracking-[0.16em] app-subtle">Elapsed</div>
                    <div className="mt-1 truncate text-sm font-semibold">{totalElapsed}</div>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <Progress value={overallProgress} tone={overallTone} className="h-3.5 rounded-[0.5rem]" />
              </div>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] app-muted">
                <span>Portfolio mix</span>
                <span>{totalOutcomes ? `${activeCount}/${upcomingCount}/${endedCount}` : "0/0/0"}</span>
              </div>
              <div className="flex h-3 overflow-hidden rounded-full bg-[color:var(--app-elevated)]">
                <div style={{ width: `${activeShare * 100}%`, background: trafficLightVar("green", "fill") }} />
                <div style={{ width: `${upcomingShare * 100}%`, background: trafficLightVar("amber", "fill") }} />
                <div style={{ width: `${endedShare * 100}%`, background: "var(--app-border)" }} />
              </div>
            </div>

            <div className="grid gap-2.5">
              {[
                { label: "Active", count: activeCount, share: activeShare, fill: trafficLightVar("green", "fill") },
                { label: "Upcoming", count: upcomingCount, share: upcomingShare, fill: trafficLightVar("amber", "fill") },
                { label: "Ended", count: endedCount, share: endedShare, fill: "var(--app-border)" }
              ].map((item) => (
                <div key={item.label} className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.16em]">
                    <div className="min-w-0 flex items-center gap-2 app-muted">
                      <span className="h-2 w-2 rounded-full" style={{ background: item.fill }} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    <span className="shrink-0 text-[color:var(--app-text)]">{item.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[color:var(--app-elevated)]">
                    <div className="h-full rounded-full" style={{ width: `${item.share * 100}%`, background: item.fill }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0 rounded-[0.7rem] border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] px-3 py-2">
                <div className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] app-subtle">Open days</div>
                <div className="mt-1 truncate text-base font-semibold leading-none">{compactOpenDays}</div>
              </div>
              <div className="min-w-0 rounded-[0.7rem] border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] px-3 py-2">
                <div className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] app-subtle">Outcomes</div>
                <div className="mt-1 truncate text-base font-semibold leading-none">{totalOutcomes}</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_340px]">
        <Card className="rounded-[0.9rem] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="app-kicker">Outcome board</div>
              <div className="mt-2 text-base font-semibold">Progress by outcome.</div>
            </div>
            {archivedSummaries.length ? (
              <Button
                size="sm"
                variant={showCompletedOnBoard ? "secondary" : "ghost"}
                onClick={() => setShowCompletedOnBoard((prev) => !prev)}
              >
                {showCompletedOnBoard ? "Hide completed" : "Show completed"}
              </Button>
            ) : null}
          </div>

          <div className="mt-4 grid gap-2.5">
            {boardItems.map((item) => {
              const summary = item.summary;
              const theme = getOutcomeTheme(summary.outcome.themeId);
              const copy =
                item.kind === "completed"
                  ? {
                      label: "Completed",
                      detail: `Victory Wall on ${formatShortDate(item.archivedOutcome.completedAt.slice(0, 10))}`
                    }
                  : phaseCopy(summary);

              return (
                <button
                  key={`${item.kind}:${summary.outcome.id}`}
                  type="button"
                  className="rounded-[0.8rem] border px-4 py-3 text-left transition hover:bg-[color:var(--app-nav-hover)]"
                  style={{
                    borderColor: theme.border,
                    background: theme.soft
                  }}
                  onClick={() => {
                    if (item.kind === "completed") {
                      actions.setActiveTab("archive");
                      return;
                    }
                    actions.selectOutcome(summary.outcome.id);
                    actions.setActiveTab("plan");
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="inline-flex h-3 w-3 rounded-full border" style={{ borderColor: theme.border, background: theme.accent }} />
                      <div className="truncate text-sm font-semibold" style={{ color: theme.ink }}>
                        {summary.outcome.title}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "rounded-[0.55rem] border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                        item.kind === "completed" ? trafficLightSurfaceClass("green") : trafficLightSurfaceClass(summary.phaseTone)
                      )}
                    >
                      {copy.label}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3 text-xs" style={{ color: theme.ink, opacity: 0.78 }}>
                    <div className="truncate">{copy.detail}</div>
                    <div className="text-right" style={{ color: theme.ink }}>
                      <span className="font-semibold">{summary.progressPercent}%</span>
                      <span className="ml-2 opacity-70">{summary.doneElapsed}/{summary.elapsedTotal || 0}</span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <Progress value={summary.progressValue} tone={summary.phaseTone} className="h-2 rounded-[0.35rem]" />
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]" style={{ color: theme.ink, opacity: 0.72 }}>
                    <span>{pluralize(summary.activeDates.length, "day")}</span>
                    <span>{item.kind === "completed" ? "In Victory Wall" : `${pluralize(summary.openDaysLeft, "open day")} left`}</span>
                    <span>{pluralize(summary.monthCount, "month")}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="grid gap-4">
          <Card className="rounded-[0.9rem] p-5">
            <div className="app-kicker">Up next</div>
            <div className="mt-2 text-base font-semibold">Next open days.</div>

            {nextUp.length ? (
              <div className="mt-4 grid gap-2">
                {nextUp.map((summary) => {
                  const theme = getOutcomeTheme(summary.outcome.themeId);
                  return (
                    <button
                      key={summary.outcome.id}
                      type="button"
                      className="rounded-[0.75rem] border px-3 py-3 text-left transition hover:bg-[color:var(--app-nav-hover)]"
                      style={{ borderColor: theme.border, background: theme.soft, color: theme.ink }}
                      onClick={() => {
                        actions.selectOutcome(summary.outcome.id);
                        actions.setActiveTab("plan");
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{summary.outcome.title}</div>
                          <div className="mt-1 text-xs opacity-75">{summary.nextOpenDate ? formatShortDate(summary.nextOpenDate) : "No open day found"}</div>
                        </div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-75">{phaseCopy(summary).label}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-[0.75rem] border border-dashed border-[color:var(--app-border)] px-4 py-5 text-sm app-muted">
                No open days to show yet.
              </div>
            )}
          </Card>

          <Card className="rounded-[0.9rem] p-5">
            <div className="app-kicker">Phase mix</div>
            <div className="mt-2 text-base font-semibold">Portfolio mix.</div>

            <div className="mt-4 grid gap-2">
              <div className="flex items-center justify-between rounded-[0.7rem] border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] px-3 py-3">
                <div className="text-sm font-semibold">Active</div>
                <div className="text-sm">{activeCount}</div>
              </div>
              <div className="flex items-center justify-between rounded-[0.7rem] border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] px-3 py-3">
                <div className="text-sm font-semibold">Upcoming</div>
                <div className="text-sm">{upcomingCount}</div>
              </div>
              <div className="flex items-center justify-between rounded-[0.7rem] border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] px-3 py-3">
                <div className="text-sm font-semibold">Ended</div>
                <div className="text-sm">{endedCount}</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
