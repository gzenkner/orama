import type { MonthlyGoal, Outcome, WeekStartsOn, WeeklyGoal, YearlyGoal } from "./types";
import { daysForWeekInMonth, monthKeysInRange, weekStartsForMonth } from "./date";
import { outcomeDurationCategory, type OutcomeDurationCategory } from "./rules";

export const MAX_PLAN_MONTHS = 150;

export type PlanningActionDimension = "years" | "months" | "weeks";

export type PlanningActionCount = {
  dimension: PlanningActionDimension;
  total: number;
  outstanding: number;
  populated: number;
};

export type OutcomePlanningActionSummary = {
  category: OutcomeDurationCategory;
  durationMonths: number;
  requiredDimensions: PlanningActionDimension[];
  total: number;
  outstanding: number;
  populated: number;
  years: PlanningActionCount;
  months: PlanningActionCount;
  weeks: PlanningActionCount;
  yearKeys: string[];
  monthKeys: string[];
  immediateMonthKeys: string[];
  mediumMonthKeys: string[];
  longMonthKeys: string[];
};

export type PlanningActionTarget =
  | {
      dimension: "years";
      yearKey: string;
      monthKey: string | null;
    }
  | {
      dimension: "months";
      monthKey: string;
    }
  | {
      dimension: "weeks";
      monthKey: string;
      weekStartISO: string;
    };

export type PlanningRecords = {
  yearly?: Record<string, YearlyGoal>;
  monthly: Record<string, MonthlyGoal>;
  weekly: Record<string, WeeklyGoal>;
};

function hasTitle(goal: { title: string } | undefined): boolean {
  return Boolean(goal?.title?.trim());
}

export function yearKeysForOutcome(outcome: Outcome): string[] {
  const longMonthKeys = monthKeysForOutcome(outcome).slice(24);
  return Array.from(new Set(longMonthKeys.map((monthKey) => monthKey.slice(0, 4))));
}

export function monthKeysForOutcome(outcome: Outcome): string[] {
  return monthKeysInRange(outcome.startDate, outcome.endDate).slice(0, MAX_PLAN_MONTHS);
}

function weeksForOutcome(outcome: Outcome, monthKeys: string[], weekStartsOn: WeekStartsOn): Array<{ monthKey: string; weekStartISO: string }> {
  return monthKeys.flatMap((monthKey) =>
    weekStartsForMonth(monthKey, weekStartsOn)
      .filter((weekStartISO) => daysForWeekInMonth(weekStartISO, monthKey, outcome.startDate, outcome.endDate, outcome.daysOfWeek).length > 0)
      .map((weekStartISO) => ({ monthKey, weekStartISO }))
  );
}

export function summarizePlanningActions(
  outcome: Outcome,
  records: PlanningRecords,
  weekStartsOn: WeekStartsOn
): OutcomePlanningActionSummary {
  const monthKeys = monthKeysForOutcome(outcome);
  const yearKeys = yearKeysForOutcome(outcome);
  const durationMonths = monthKeys.length;
  const category = outcomeDurationCategory(durationMonths).key;
  const immediateMonthKeys = monthKeys.slice(0, 6);
  const mediumMonthKeys = monthKeys.slice(6, 24);
  const longMonthKeys = monthKeys.slice(24);
  const requiredMonthKeys = [...immediateMonthKeys, ...mediumMonthKeys];

  const yearsPopulated = yearKeys.reduce((count, yearKey) => count + (hasTitle(records.yearly?.[`${outcome.id}:${yearKey}`]) ? 1 : 0), 0);
  const years: PlanningActionCount = {
    dimension: "years",
    total: yearKeys.length,
    populated: yearsPopulated,
    outstanding: Math.max(0, yearKeys.length - yearsPopulated)
  };

  const monthsPopulated = requiredMonthKeys.reduce(
    (count, monthKey) => count + (hasTitle(records.monthly[`${outcome.id}:${monthKey}`]) ? 1 : 0),
    0
  );
  const months: PlanningActionCount = {
    dimension: "months",
    total: requiredMonthKeys.length,
    populated: monthsPopulated,
    outstanding: Math.max(0, requiredMonthKeys.length - monthsPopulated)
  };

  const weekKeys = weeksForOutcome(outcome, immediateMonthKeys, weekStartsOn);
  const weeksPopulated = weekKeys.reduce(
    (count, { monthKey, weekStartISO }) => count + (hasTitle(records.weekly[`${outcome.id}:${monthKey}:${weekStartISO}`]) ? 1 : 0),
    0
  );
  const weeks: PlanningActionCount = {
    dimension: "weeks",
    total: weekKeys.length,
    populated: weeksPopulated,
    outstanding: Math.max(0, weekKeys.length - weeksPopulated)
  };

  const requiredDimensions: PlanningActionDimension[] = [
    ...(months.total ? (["months"] as const) : []),
    ...(weeks.total ? (["weeks"] as const) : []),
    ...(years.total ? (["years"] as const) : [])
  ];
  const requiredCounts = requiredDimensions.map((dimension) => ({ years, months, weeks })[dimension]);
  const total = requiredCounts.reduce((sum, item) => sum + item.total, 0);
  const outstanding = requiredCounts.reduce((sum, item) => sum + item.outstanding, 0);

  return {
    category,
    durationMonths,
    requiredDimensions,
    total,
    outstanding,
    populated: Math.max(0, total - outstanding),
    years,
    months,
    weeks,
    yearKeys,
    monthKeys,
    immediateMonthKeys,
    mediumMonthKeys,
    longMonthKeys
  };
}

function firstRequiredDimension(summary: OutcomePlanningActionSummary): PlanningActionDimension | null {
  if (summary.category === "long" && summary.years.total) return "years";
  if (summary.months.total) return "months";
  if (summary.weeks.total) return "weeks";
  if (summary.years.total) return "years";
  return null;
}

export function firstOutstandingPlanningTarget(
  outcome: Outcome,
  records: PlanningRecords,
  weekStartsOn: WeekStartsOn,
  dimension?: PlanningActionDimension
): PlanningActionTarget | null {
  const summary = summarizePlanningActions(outcome, records, weekStartsOn);
  const targetDimension = dimension ?? firstRequiredDimension(summary);
  if (!targetDimension) return null;

  if (targetDimension === "years") {
    const yearKey =
      summary.yearKeys.find((key) => !hasTitle(records.yearly?.[`${outcome.id}:${key}`])) ??
      summary.yearKeys[0] ??
      null;
    if (!yearKey) return null;
    return {
      dimension: "years",
      yearKey,
      monthKey: summary.monthKeys.find((monthKey) => monthKey.startsWith(`${yearKey}-`)) ?? null
    };
  }

  if (targetDimension === "months") {
    const requiredMonthKeys = [...summary.immediateMonthKeys, ...summary.mediumMonthKeys];
    const monthKey =
      requiredMonthKeys.find((key) => !hasTitle(records.monthly[`${outcome.id}:${key}`])) ??
      requiredMonthKeys[0] ??
      null;
    if (!monthKey) return null;
    return { dimension: "months", monthKey };
  }

  const weekKeys = weeksForOutcome(outcome, summary.immediateMonthKeys, weekStartsOn);
  const targetWeek =
    weekKeys.find(({ monthKey, weekStartISO }) => !hasTitle(records.weekly[`${outcome.id}:${monthKey}:${weekStartISO}`])) ??
    weekKeys[0] ??
    null;
  if (!targetWeek) return null;
  return { dimension: "weeks", monthKey: targetWeek.monthKey, weekStartISO: targetWeek.weekStartISO };
}

export function planningCoverage(summary: OutcomePlanningActionSummary): number {
  return summary.total ? summary.populated / summary.total : 1;
}
