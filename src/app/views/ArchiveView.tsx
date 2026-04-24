import React from "react";
import { actions, useAppState } from "../store";
import type { ArchivedOutcome, DailyGoal } from "../types";
import { dateISOsInRange, dayNumberToISO, formatDaysOfWeek, formatShortDate, isoToDayNumber, toISODate } from "../date";
import { getOutcomeTheme, getOutcomeThemeStyle } from "../theme";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Progress from "../ui/Progress";
import { cn } from "../ui/cn";
import { trafficLightSurfaceClass, trafficLightToneFromProgress, type TrafficLightTone } from "../ui/trafficLight";

type ArchivedOutcomeSummary = {
  outcome: ArchivedOutcome;
  completedDateISO: string;
  plannedDurationDays: number;
  actualDurationDays: number;
  timelinePercent: number;
  timelineTone: TrafficLightTone;
  aheadDays: number;
  aheadPercent: number;
  consistencyDone: number;
  consistencyTotal: number;
  consistencyPercent: number;
  consistencyTone: TrafficLightTone;
};

function summarizeArchivedOutcome(outcome: ArchivedOutcome, daily: Record<string, DailyGoal>): ArchivedOutcomeSummary {
  const completionDate = new Date(outcome.completedAt);
  const completedDateISO = Number.isNaN(completionDate.getTime()) ? outcome.endDate : toISODate(completionDate);

  const startDay = isoToDayNumber(outcome.startDate);
  const endDay = isoToDayNumber(outcome.endDate);
  const completedDay = isoToDayNumber(completedDateISO);

  const plannedDurationDays = Math.max(endDay - startDay + 1, 1);
  const actualDurationDays = Math.max(completedDay - startDay + 1, 1);
  const timelineRatio = actualDurationDays / plannedDurationDays;
  const timelinePercent = Math.round(timelineRatio * 100);
  const aheadDays = endDay - completedDay;
  const aheadPercent = Math.round(((plannedDurationDays - actualDurationDays) / plannedDurationDays) * 100);

  const consistencyDates =
    completedDay < startDay
      ? []
      : dateISOsInRange(outcome.startDate, dayNumberToISO(Math.min(Math.max(completedDay, startDay), endDay)), outcome.daysOfWeek);
  const consistencyDone = consistencyDates.reduce((count, dateISO) => count + (daily[`${outcome.id}:${dateISO}`]?.done ? 1 : 0), 0);
  const consistencyTotal = consistencyDates.length;
  const consistencyRatio = consistencyTotal ? consistencyDone / consistencyTotal : 0;
  const consistencyPercent = Math.round(consistencyRatio * 100);

  const timelineTone: TrafficLightTone = timelineRatio <= 1 ? "green" : timelineRatio <= 1.12 ? "amber" : "red";
  const consistencyTone = consistencyTotal ? trafficLightToneFromProgress(consistencyRatio) : "amber";

  return {
    outcome,
    completedDateISO,
    plannedDurationDays,
    actualDurationDays,
    timelinePercent,
    timelineTone,
    aheadDays,
    aheadPercent,
    consistencyDone,
    consistencyTotal,
    consistencyPercent,
    consistencyTone
  };
}

function MetricTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[0.75rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] app-subtle">{label}</div>
      <div className="font-display mt-2 text-[1.5rem] font-semibold leading-none">{value}</div>
      <div className="mt-2 text-xs app-muted">{detail}</div>
    </div>
  );
}

export default function ArchiveView({
  onOpenOutcome,
  onEditOutcome
}: {
  onOpenOutcome?: (outcomeId: string) => void;
  onEditOutcome?: (outcomeId: string) => void;
}) {
  const archivedOutcomes = useAppState((s) => s.archivedOutcomes);
  const daily = useAppState((s) => s.daily);

  const openOutcomeHistory = React.useCallback(
    (outcomeId: string) => {
      if (onOpenOutcome) onOpenOutcome(outcomeId);
      else actions.openOverview("outcome", outcomeId);
    },
    [onOpenOutcome]
  );

  const openOutcomeEditor = React.useCallback(
    (outcomeId: string) => {
      if (onEditOutcome) onEditOutcome(outcomeId);
      else openOutcomeHistory(outcomeId);
    },
    [onEditOutcome, openOutcomeHistory]
  );

  const summaries = React.useMemo(
    () =>
      [...archivedOutcomes]
        .sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1))
        .map((outcome) => summarizeArchivedOutcome(outcome, daily)),
    [archivedOutcomes, daily]
  );

  const averageTimelinePercent = summaries.length
    ? Math.round(summaries.reduce((sum, summary) => sum + summary.timelinePercent, 0) / summaries.length)
    : 0;
  const averageConsistencyPercent = summaries.length
    ? Math.round(summaries.reduce((sum, summary) => sum + summary.consistencyPercent, 0) / summaries.length)
    : 0;
  const aheadCount = summaries.filter((summary) => summary.aheadDays > 0).length;
  const onTargetCount = summaries.filter((summary) => summary.aheadDays === 0).length;

  return (
    <div className="grid gap-4">
      <Card className="app-card-soft rounded-[0.95rem] p-5 sm:p-6">
        <div className="app-kicker">Victory Wall</div>
        <div className="font-display mt-3 text-[1.7rem] font-semibold leading-tight sm:text-[2.05rem]">Targets hit. Wins worth celebrating.</div>
        <div className="mt-2 max-w-3xl text-sm leading-6 app-muted">
          A running record of finished work, timeline wins, and consistency so your hard work is impossible to miss.
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Completed" value={`${summaries.length}`} detail="Wins captured" />
          <MetricTile
            label="Time to finish"
            value={`${averageTimelinePercent}%`}
            detail={summaries.length ? "Average share of your original timeline used" : "No completed wins yet"}
          />
          <MetricTile
            label="Consistency"
            value={`${averageConsistencyPercent}%`}
            detail={summaries.length ? "Average consistency before completion" : "No consistency data yet"}
          />
          <MetricTile
            label="Beat target"
            value={`${aheadCount}`}
            detail={summaries.length ? `${onTargetCount} exactly on target` : "No wins in the wall yet"}
          />
        </div>
      </Card>

      {summaries.length ? (
        <div className="grid gap-3">
          {summaries.map((summary) => {
            const theme = getOutcomeTheme(summary.outcome.themeId);
            const timelineValue = Math.min(summary.actualDurationDays / summary.plannedDurationDays, 1);
            const timelineSignalLabel =
              summary.aheadDays > 0 ? `${summary.aheadDays} day${summary.aheadDays === 1 ? "" : "s"} early` : summary.aheadDays === 0 ? "on target" : `${Math.abs(summary.aheadDays)} day${Math.abs(summary.aheadDays) === 1 ? "" : "s"} late`;
            const paceCopy =
              summary.aheadPercent > 0
                ? `${summary.aheadPercent}% faster than planned`
                : summary.aheadPercent === 0
                  ? "finished exactly on your planned timeline"
                  : `${Math.abs(summary.aheadPercent)}% slower than planned`;

            return (
              <Card key={summary.outcome.id} className="rounded-[0.9rem] border p-4 sm:p-5" style={getOutcomeThemeStyle(summary.outcome.themeId)}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        style={getOutcomeThemeStyle(summary.outcome.themeId)}
                        className="app-outcome-pill rounded-[0.55rem] px-3 py-1 text-xs font-semibold"
                      >
                        {theme.label}
                      </span>
                      <span className="app-pill rounded-[0.55rem] px-3 py-1 text-xs font-semibold">{formatDaysOfWeek(summary.outcome.daysOfWeek)}</span>
                    </div>
                    <button
                      type="button"
                      className="font-display mt-3 text-left text-[1.35rem] font-semibold leading-tight transition hover:opacity-80 sm:text-[1.6rem]"
                      onClick={() => openOutcomeHistory(summary.outcome.id)}
                      title="Open full history and tasks"
                    >
                      {summary.outcome.title}
                    </button>
                    <div className="mt-2 text-sm app-muted">
                      Completed {formatShortDate(summary.completedDateISO)}. Planned {formatShortDate(summary.outcome.startDate)} to{" "}
                      {formatShortDate(summary.outcome.endDate)}.
                    </div>
                  </div>

                  <div className={cn("shrink-0 rounded-[0.55rem] border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]", trafficLightSurfaceClass(summary.timelineTone))}>
                    {timelineSignalLabel}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[0.75rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] app-subtle">Time to finish</div>
                    <div className="font-display mt-2 text-[1.7rem] font-semibold leading-none">{summary.timelinePercent}%</div>
                    <div className="mt-2 text-xs app-muted">{paceCopy}</div>
                    <div className="mt-3">
                      <Progress value={timelineValue} tone={summary.timelineTone} />
                    </div>
                  </div>

                  <div className="rounded-[0.75rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] app-subtle">Consistency</div>
                    <div className="font-display mt-2 text-[1.7rem] font-semibold leading-none">{summary.consistencyPercent}%</div>
                    <div className="mt-2 text-xs app-muted">
                      {summary.consistencyTotal ? `${summary.consistencyDone}/${summary.consistencyTotal} active days closed before completion` : "No active days landed before completion"}
                    </div>
                    <div className="mt-3">
                      <Progress
                        value={summary.consistencyTotal ? summary.consistencyDone / summary.consistencyTotal : 0}
                        tone={summary.consistencyTone}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      openOutcomeHistory(summary.outcome.id);
                    }}
                  >
                    Open full history
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      openOutcomeEditor(summary.outcome.id);
                    }}
                  >
                    Edit goal
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="rounded-[0.9rem] border border-dashed p-5 text-sm app-muted">
          Mark outcomes done to build your victory wall. Every finished goal will show its timeline and consistency snapshot here.
        </Card>
      )}
    </div>
  );
}
