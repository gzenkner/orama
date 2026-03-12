import type { CSSProperties } from "react";
import type { OutcomeThemeId } from "./types";

type OutcomeTheme = {
  label: string;
  accent: string;
  accentStrong: string;
  soft: string;
  border: string;
  ink: string;
  glow: string;
  glowStrong: string;
};

export const OUTCOME_THEME_ORDER: OutcomeThemeId[] = ["apricot", "sage", "sky", "lavender", "butter", "rose"];

export const OUTCOME_THEMES: Record<OutcomeThemeId, OutcomeTheme> = {
  apricot: {
    label: "Apricot",
    accent: "#f1c6b2",
    accentStrong: "#d78663",
    soft: "#fbefe8",
    border: "#e8c5b4",
    ink: "#6a3e27",
    glow: "rgba(215, 134, 99, 0.16)",
    glowStrong: "rgba(215, 134, 99, 0.3)"
  },
  sage: {
    label: "Sage",
    accent: "#c6decb",
    accentStrong: "#769d7d",
    soft: "#eff6ef",
    border: "#c6dbc9",
    ink: "#31513a",
    glow: "rgba(118, 157, 125, 0.16)",
    glowStrong: "rgba(118, 157, 125, 0.3)"
  },
  sky: {
    label: "Sky",
    accent: "#c4dcf2",
    accentStrong: "#6f98bf",
    soft: "#eef5fb",
    border: "#c3d8eb",
    ink: "#234463",
    glow: "rgba(111, 152, 191, 0.16)",
    glowStrong: "rgba(111, 152, 191, 0.3)"
  },
  lavender: {
    label: "Lavender",
    accent: "#dbcdf0",
    accentStrong: "#8f78b8",
    soft: "#f5f0fb",
    border: "#d6c8ea",
    ink: "#4d356d",
    glow: "rgba(143, 120, 184, 0.16)",
    glowStrong: "rgba(143, 120, 184, 0.3)"
  },
  butter: {
    label: "Butter",
    accent: "#f0e0b0",
    accentStrong: "#b68c38",
    soft: "#fbf7e8",
    border: "#eadba9",
    ink: "#5d4818",
    glow: "rgba(182, 140, 56, 0.16)",
    glowStrong: "rgba(182, 140, 56, 0.3)"
  },
  rose: {
    label: "Rose",
    accent: "#f1c7d4",
    accentStrong: "#c67b95",
    soft: "#fbf0f4",
    border: "#ecc6d2",
    ink: "#6a3046",
    glow: "rgba(198, 123, 149, 0.16)",
    glowStrong: "rgba(198, 123, 149, 0.3)"
  }
};

export function isOutcomeThemeId(value: unknown): value is OutcomeThemeId {
  return typeof value === "string" && value in OUTCOME_THEMES;
}

export function normalizeOutcomeTheme(themeId: unknown, index = 0): OutcomeThemeId {
  if (isOutcomeThemeId(themeId)) return themeId;
  return OUTCOME_THEME_ORDER[index % OUTCOME_THEME_ORDER.length] ?? OUTCOME_THEME_ORDER[0];
}

export function nextOutcomeThemeId(themeIds: OutcomeThemeId[]): OutcomeThemeId {
  const counts = OUTCOME_THEME_ORDER.reduce<Record<OutcomeThemeId, number>>(
    (acc, themeId) => ({ ...acc, [themeId]: 0 }),
    {} as Record<OutcomeThemeId, number>
  );

  for (const themeId of themeIds) counts[themeId] += 1;

  let next = OUTCOME_THEME_ORDER[0];
  let lowestCount = counts[next];
  for (const themeId of OUTCOME_THEME_ORDER) {
    if (counts[themeId] < lowestCount) {
      next = themeId;
      lowestCount = counts[themeId];
    }
  }
  return next;
}

export function getOutcomeTheme(themeId: OutcomeThemeId): OutcomeTheme {
  return OUTCOME_THEMES[themeId];
}

export function getOutcomeThemeStyle(themeId: OutcomeThemeId): CSSProperties {
  const theme = OUTCOME_THEMES[themeId];
  return {
    "--outcome-accent": theme.accent,
    "--outcome-accent-strong": theme.accentStrong,
    "--outcome-soft": theme.soft,
    "--outcome-border": theme.border,
    "--outcome-ink": theme.ink,
    "--outcome-glow": theme.glow,
    "--outcome-glow-strong": theme.glowStrong
  } as CSSProperties;
}
