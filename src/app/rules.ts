import type { ArchivedOutcome, Outcome } from "./types";

export const MAX_ACTIVE_OUTCOMES = 6;
export const OUTCOME_TITLE_MAX_CHARACTERS = 20;
export const OUTCOME_TITLE_TRUNCATION_PARAM = OUTCOME_TITLE_MAX_CHARACTERS;

export const ACTIVE_OUTCOME_LIMIT_EXPLANATION =
  "Six is the maximum because fewer active outcomes makes it more likely you will hit your target.";

export function normalizeOutcomeTitle(title: string): string {
  return title.trim().slice(0, OUTCOME_TITLE_MAX_CHARACTERS);
}

export type OutcomeDurationCategory = "short" | "medium" | "long";

export function outcomeDurationCategory(months: number): { key: OutcomeDurationCategory; label: string } {
  if (months <= 6) return { key: "short", label: "Short" };
  if (months <= 24) return { key: "medium", label: "Medium" };
  return { key: "long", label: "Long" };
}

export function activeOutcomeCount(outcomes: Outcome[], archivedOutcomes: ArchivedOutcome[]): number {
  const archivedOutcomeIdSet = new Set(archivedOutcomes.map((outcome) => outcome.id));
  return outcomes.filter((outcome) => !archivedOutcomeIdSet.has(outcome.id)).length;
}
