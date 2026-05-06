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
    label: "Bilberry",
    accent: "#8fa8ff",
    accentStrong: "#3158c9",
    soft: "#eef2ff",
    border: "#adc0fb",
    ink: "#1d347d",
    glow: "rgba(49, 88, 201, 0.16)",
    glowStrong: "rgba(49, 88, 201, 0.3)"
  },
  sage: {
    label: "Damson",
    accent: "#8bb6d9",
    accentStrong: "#386f9d",
    soft: "#eef6fb",
    border: "#a9c8dd",
    ink: "#21445f",
    glow: "rgba(56, 111, 157, 0.16)",
    glowStrong: "rgba(56, 111, 157, 0.3)"
  },
  sky: {
    label: "Fig",
    accent: "#c79ac8",
    accentStrong: "#8a4b8f",
    soft: "#f8eff8",
    border: "#d7b5d8",
    ink: "#522957",
    glow: "rgba(138, 75, 143, 0.16)",
    glowStrong: "rgba(138, 75, 143, 0.3)"
  },
  lavender: {
    label: "Yuzu",
    accent: "#f2e78d",
    accentStrong: "#b6a72f",
    soft: "#fffbe6",
    border: "#e7d979",
    ink: "#5f5520",
    glow: "rgba(182, 167, 47, 0.16)",
    glowStrong: "rgba(182, 167, 47, 0.3)"
  },
  butter: {
    label: "Pitaya",
    accent: "#dea1ef",
    accentStrong: "#9f42b6",
    soft: "#fbf0ff",
    border: "#e0b7ec",
    ink: "#61206e",
    glow: "rgba(159, 66, 182, 0.16)",
    glowStrong: "rgba(159, 66, 182, 0.3)"
  },
  rose: {
    label: "Guava",
    accent: "#f3a99c",
    accentStrong: "#c75f53",
    soft: "#fff1ee",
    border: "#edb9b0",
    ink: "#74362f",
    glow: "rgba(199, 95, 83, 0.16)",
    glowStrong: "rgba(199, 95, 83, 0.3)"
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
