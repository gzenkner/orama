import React from "react";
import type {
  AppTab,
  ArchivedOutcome,
  DailyGoal,
  MonthlyGoal,
  Outcome,
  OutcomeCoachThread,
  OverviewScope,
  PersistedStateV1,
  WeekStartsOn,
  WeeklyGoal
} from "./types";
import { normalizeDaysOfWeek } from "./date";
import { nextOutcomeThemeId, normalizeOutcomeTheme } from "./theme";

const STORAGE_KEY = "orama_state_v1";
const LEGACY_STORAGE_KEYS = ["goals_app_state_v1"];

type State = PersistedStateV1;

type Listener = () => void;

type Store = {
  get: () => State;
  set: (updater: (prev: State) => State) => void;
  subscribe: (listener: Listener) => () => void;
};

function safeUUID(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function defaultState(): State {
  return {
    version: 1,
    weekStartsOn: 0,
    selectedOutcomeId: undefined,
    ui: {
      showMonthlyObjectives: false,
      showWeeklyObjectives: false,
      activeTab: "overview",
      overviewScope: "global",
      themeMode: "white",
      scrollTopByTab: {}
    },
    outcomes: [],
    archivedOutcomes: [],
    monthly: {},
    weekly: {},
    daily: {},
    coachThreads: {}
  };
}

function normalizeOutcome(outcome: Omit<Outcome, "daysOfWeek"> & { daysOfWeek?: number[] }): Outcome {
  return {
    ...outcome,
    daysOfWeek: normalizeDaysOfWeek(outcome.daysOfWeek)
  };
}

function normalizeArchivedOutcome(
  outcome: Omit<Outcome, "daysOfWeek"> & { daysOfWeek?: number[]; completedAt?: string },
  index: number
): ArchivedOutcome {
  const normalizedOutcome = normalizeOutcome({
    ...outcome,
    themeId: normalizeOutcomeTheme((outcome as Partial<Outcome>).themeId, index)
  });
  return {
    ...normalizedOutcome,
    completedAt: typeof outcome.completedAt === "string" ? outcome.completedAt : normalizedOutcome.createdAt
  };
}

function mergeActiveWithArchived(outcomes: Outcome[], archivedOutcomes: ArchivedOutcome[]): Outcome[] {
  const outcomeIds = new Set(outcomes.map((outcome) => outcome.id));
  const restoredFromArchive = archivedOutcomes
    .filter((outcome) => !outcomeIds.has(outcome.id))
    .map(({ completedAt: _completedAt, ...outcome }) => outcome);
  return [...outcomes, ...restoredFromArchive];
}

function normalizeDailyItems(goal: DailyGoal | undefined): string[] {
  if (!goal) return [""];
  if (Array.isArray(goal.items) && goal.items.length) return goal.items;
  return [goal.title ?? ""];
}

function normalizeDailyItemsDone(goal: DailyGoal | undefined, items: string[]): boolean[] {
  const raw = goal && Array.isArray(goal.itemsDone) ? goal.itemsDone : [];
  return items.map((_, idx) => Boolean(raw[idx]));
}

function hasMeaningfulDailyItems(items: string[]): boolean {
  return items.some((item) => item.trim().length > 0);
}

function normalizeAppTab(tab: unknown): AppTab {
  if (tab === "coach" || tab === "wizard") return "assistant";
  if (tab === "overview" || tab === "assistant" || tab === "plan" || tab === "calendar" || tab === "archive" || tab === "settings") {
    return tab;
  }
  return "overview";
}

function readState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as State;
    if (parsed?.version !== 1) return defaultState();

    const outcomes = Array.isArray(parsed.outcomes)
      ? parsed.outcomes.map((outcome, index) =>
          normalizeOutcome({
            ...outcome,
            themeId: normalizeOutcomeTheme((outcome as Partial<Outcome>).themeId, index)
          })
        )
      : [];
    const archivedOutcomes = Array.isArray(parsed.archivedOutcomes)
      ? parsed.archivedOutcomes.map((outcome, index) => normalizeArchivedOutcome(outcome, index))
      : [];

    return {
      ...defaultState(),
      ...parsed,
      ui: {
        ...defaultState().ui,
        ...(parsed as Partial<State>).ui,
        activeTab: normalizeAppTab((parsed as Partial<State>).ui?.activeTab),
        overviewScope: (parsed as Partial<State>).ui?.overviewScope ?? "global",
        themeMode: "white",
        scrollTopByTab: {
          ...((parsed as Partial<State>).ui?.scrollTopByTab ?? {}),
          overview: 0
        }
      },
      outcomes: mergeActiveWithArchived(outcomes, archivedOutcomes),
      archivedOutcomes,
      coachThreads:
        parsed && parsed.coachThreads && typeof parsed.coachThreads === "object" && !Array.isArray(parsed.coachThreads)
          ? parsed.coachThreads
          : {}
    };
  } catch {
    return defaultState();
  }
}

function writeState(state: State): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createStore(): Store {
  let state = typeof window === "undefined" ? defaultState() : readState();
  const listeners = new Set<Listener>();

  return {
    get: () => state,
    set: (updater) => {
      state = updater(state);
      if (typeof window !== "undefined") writeState(state);
      for (const l of listeners) l();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

const store = createStore();

export function useAppState<T>(selector: (s: State) => T): T {
  const state = React.useSyncExternalStore(store.subscribe, store.get, defaultState);
  return selector(state);
}

export function getAppState(): State {
  return store.get();
}

export const actions = {
  setWeekStartsOn: (weekStartsOn: WeekStartsOn) => {
    store.set((prev) => ({ ...prev, weekStartsOn }));
  },
  setThemeMode: (themeMode: State["ui"]["themeMode"]) => {
    store.set((prev) => ({ ...prev, ui: { ...prev.ui, themeMode } }));
  },
  toggleShowMonthlyObjectives: () => {
    store.set((prev) => ({ ...prev, ui: { ...prev.ui, showMonthlyObjectives: !prev.ui.showMonthlyObjectives } }));
  },
  toggleShowWeeklyObjectives: () => {
    store.set((prev) => ({ ...prev, ui: { ...prev.ui, showWeeklyObjectives: !prev.ui.showWeeklyObjectives } }));
  },
  setActiveTab: (activeTab: AppTab) => {
    store.set((prev) => ({ ...prev, ui: { ...prev.ui, activeTab } }));
  },
  openOverview: (scope: OverviewScope, selectedOutcomeId?: string) => {
    store.set((prev) => ({
      ...prev,
      selectedOutcomeId: selectedOutcomeId ?? prev.selectedOutcomeId,
      ui: {
        ...prev.ui,
        activeTab: "overview",
        overviewScope: scope
      }
    }));
  },
  setScrollTopForTab: (tab: AppTab, scrollTop: number) => {
    store.set((prev) => ({
      ...prev,
      ui: {
        ...prev.ui,
        scrollTopByTab: { ...prev.ui.scrollTopByTab, [tab]: scrollTop }
      }
    }));
  },
  selectOutcome: (id: string) => {
    store.set((prev) => ({ ...prev, selectedOutcomeId: id }));
  },
  addOutcome: (input: { title: string; notes?: string; startDate: string; endDate: string; daysOfWeek: number[] }) => {
    const now = new Date().toISOString();
    const themeId = nextOutcomeThemeId(store.get().outcomes.map((outcome) => outcome.themeId));
    const outcome = normalizeOutcome({
      id: safeUUID(),
      title: input.title.trim(),
      notes: (input.notes ?? "").trim(),
      startDate: input.startDate,
      endDate: input.endDate,
      daysOfWeek: input.daysOfWeek,
      themeId,
      createdAt: now
    });
    store.set((prev) => ({
      ...prev,
      outcomes: [outcome, ...prev.outcomes],
      selectedOutcomeId: outcome.id,
      ui: {
        ...prev.ui,
        activeTab: "overview",
        overviewScope: "outcome",
        scrollTopByTab: {
          ...prev.ui.scrollTopByTab,
          overview: 0
        }
      }
    }));
    return outcome.id;
  },
  updateOutcome: (id: string, patch: Partial<Pick<Outcome, "title" | "notes" | "startDate" | "endDate" | "daysOfWeek">>) => {
    store.set((prev) => {
      const outcomes = prev.outcomes.map((outcome) => (outcome.id === id ? normalizeOutcome({ ...outcome, ...patch }) : outcome));
      const archivedOutcomes = prev.archivedOutcomes.map((archivedOutcome) => {
        if (archivedOutcome.id !== id) return archivedOutcome;
        const { completedAt, ...baseOutcome } = archivedOutcome;
        return {
          ...normalizeOutcome({ ...baseOutcome, ...patch }),
          completedAt
        };
      });
      return { ...prev, outcomes, archivedOutcomes };
    });
  },
  moveOutcome: (draggedId: string, targetId: string, position: "before" | "after") => {
    store.set((prev) => {
      if (draggedId === targetId) return prev;

      const outcomes = [...prev.outcomes];
      const draggedIndex = outcomes.findIndex((outcome) => outcome.id === draggedId);
      const targetIndex = outcomes.findIndex((outcome) => outcome.id === targetId);
      if (draggedIndex < 0 || targetIndex < 0) return prev;

      const [draggedOutcome] = outcomes.splice(draggedIndex, 1);
      const nextTargetIndex = outcomes.findIndex((outcome) => outcome.id === targetId);
      if (!draggedOutcome || nextTargetIndex < 0) return prev;

      const insertAt = position === "before" ? nextTargetIndex : nextTargetIndex + 1;
      outcomes.splice(insertAt, 0, draggedOutcome);

      return { ...prev, outcomes };
    });
  },
  deleteOutcome: (id: string) => {
    store.set((prev) => {
      const outcomes = prev.outcomes.filter((o) => o.id !== id);
      const selectedOutcomeId = prev.selectedOutcomeId === id ? outcomes[0]?.id : prev.selectedOutcomeId;
      const archivedOutcomes = prev.archivedOutcomes.filter((o) => o.id !== id);

      const prefix = `${id}:`;
      const monthly: Record<string, MonthlyGoal> = {};
      for (const [k, v] of Object.entries(prev.monthly)) if (!k.startsWith(prefix)) monthly[k] = v;
      const weekly: Record<string, WeeklyGoal> = {};
      for (const [k, v] of Object.entries(prev.weekly)) if (!k.startsWith(prefix)) weekly[k] = v;
      const daily: Record<string, DailyGoal> = {};
      for (const [k, v] of Object.entries(prev.daily)) if (!k.startsWith(prefix)) daily[k] = v;
      const coachThreads: Record<string, OutcomeCoachThread> = {};
      for (const [k, v] of Object.entries(prev.coachThreads)) if (k !== id) coachThreads[k] = v;

      return { ...prev, outcomes, archivedOutcomes, selectedOutcomeId, monthly, weekly, daily, coachThreads };
    });
  },
  completeOutcome: (id: string, completedAt = new Date().toISOString()) => {
    store.set((prev) => {
      const outcome = prev.outcomes.find((o) => o.id === id);
      if (!outcome) return prev;

      const archivedOutcomes = [{ ...outcome, completedAt }, ...prev.archivedOutcomes.filter((o) => o.id !== id)];
      const archivedOutcomeIdSet = new Set(archivedOutcomes.map((item) => item.id));
      const firstVisibleOutcomeId = prev.outcomes.find((item) => !archivedOutcomeIdSet.has(item.id))?.id;
      const selectedOutcomeId = prev.selectedOutcomeId === id ? firstVisibleOutcomeId : prev.selectedOutcomeId;
      const overviewScope =
        prev.ui.overviewScope === "outcome" && prev.selectedOutcomeId === id && !selectedOutcomeId ? "global" : prev.ui.overviewScope;

      return {
        ...prev,
        archivedOutcomes,
        selectedOutcomeId,
        ui: {
          ...prev.ui,
          overviewScope
        }
      };
    });
  },
  setMonthlyTitle: (outcomeId: string, monthKey: string, title: string) => {
    const key = `${outcomeId}:${monthKey}`;
    store.set((prev) => ({ ...prev, monthly: { ...prev.monthly, [key]: { title } } }));
  },
  setWeeklyTitle: (outcomeId: string, monthKey: string, weekStartISO: string, title: string) => {
    const key = `${outcomeId}:${monthKey}:${weekStartISO}`;
    store.set((prev) => ({ ...prev, weekly: { ...prev.weekly, [key]: { title } } }));
  },
  setDaily: (outcomeId: string, dateISO: string, patch: Partial<DailyGoal>) => {
    const key = `${outcomeId}:${dateISO}`;
    store.set((prev) => {
      const prevDaily = prev.daily[key] ?? { title: "", done: false };
      let nextDaily: DailyGoal = { ...prevDaily, ...patch };

      if ("items" in patch && Array.isArray(patch.items)) {
        const items = patch.items.length ? patch.items : [""];
        const itemsDoneRaw = "itemsDone" in patch && Array.isArray(patch.itemsDone) ? patch.itemsDone : prevDaily.itemsDone;
        const itemsDone = normalizeDailyItemsDone({ ...prevDaily, itemsDone: itemsDoneRaw } as DailyGoal, items);
        nextDaily = { ...nextDaily, title: items[0] ?? "", items, itemsDone };
      } else if (typeof patch.title === "string" && Array.isArray(prevDaily.items) && prevDaily.items.length) {
        const items = [...prevDaily.items];
        items[0] = patch.title;
        const itemsDone = normalizeDailyItemsDone(prevDaily, items);
        nextDaily = { ...nextDaily, items, itemsDone };
      } else if ("itemsDone" in patch && Array.isArray(patch.itemsDone)) {
        const items = normalizeDailyItems(prevDaily);
        const itemsDone = normalizeDailyItemsDone({ ...prevDaily, itemsDone: patch.itemsDone } as DailyGoal, items);
        nextDaily = { ...nextDaily, title: items[0] ?? "", items, itemsDone };
      }

      const effectiveItems = normalizeDailyItems(nextDaily);
      if (hasMeaningfulDailyItems(effectiveItems)) {
        nextDaily = { ...nextDaily, intentionalRest: false };
      }

      return { ...prev, daily: { ...prev.daily, [key]: nextDaily } };
    });
  },
  setDailyItem: (outcomeId: string, dateISO: string, index: number, title: string) => {
    const key = `${outcomeId}:${dateISO}`;
    store.set((prev) => {
      const prevDaily = prev.daily[key] ?? { title: "", done: false };
      const items = [...normalizeDailyItems(prevDaily)];
      while (items.length <= index) items.push("");
      items[index] = title;
      const itemsDone = normalizeDailyItemsDone(prevDaily, items);
      return {
        ...prev,
        daily: {
          ...prev.daily,
          [key]: { ...prevDaily, title: items[0] ?? "", items, itemsDone, intentionalRest: hasMeaningfulDailyItems(items) ? false : prevDaily.intentionalRest }
        }
      };
    });
  },
  addDailyItem: (outcomeId: string, dateISO: string) => {
    const key = `${outcomeId}:${dateISO}`;
    store.set((prev) => {
      const prevDaily = prev.daily[key] ?? { title: "", done: false };
      const baseItems = normalizeDailyItems(prevDaily);
      const baseDone = normalizeDailyItemsDone(prevDaily, baseItems);
      const items = [...baseItems, ""];
      const itemsDone = [...baseDone, false];
      return { ...prev, daily: { ...prev.daily, [key]: { ...prevDaily, title: items[0] ?? "", items, itemsDone, intentionalRest: false } } };
    });
  },
  removeDailyItem: (outcomeId: string, dateISO: string, index: number) => {
    const key = `${outcomeId}:${dateISO}`;
    store.set((prev) => {
      const prevDaily = prev.daily[key] ?? { title: "", done: false };
      const baseItems = normalizeDailyItems(prevDaily);
      const baseDone = normalizeDailyItemsDone(prevDaily, baseItems);
      const items = baseItems.filter((_, idx) => idx !== index);
      const itemsDone = baseDone.filter((_, idx) => idx !== index);
      const nextItems = items.length ? items : [""];
      const nextItemsDone = nextItems.length === itemsDone.length ? itemsDone : normalizeDailyItemsDone({ ...prevDaily, itemsDone }, nextItems);
      return {
        ...prev,
        daily: {
          ...prev.daily,
          [key]: {
            ...prevDaily,
            title: nextItems[0] ?? "",
            items: nextItems,
            itemsDone: nextItemsDone,
            intentionalRest: hasMeaningfulDailyItems(nextItems) ? false : prevDaily.intentionalRest
          }
        }
      };
    });
  },
  toggleDailyItemDone: (outcomeId: string, dateISO: string, index: number) => {
    const key = `${outcomeId}:${dateISO}`;
    store.set((prev) => {
      const prevDaily = prev.daily[key] ?? { title: "", done: false };
      const items = [...normalizeDailyItems(prevDaily)];
      while (items.length <= index) items.push("");
      const itemsDone = [...normalizeDailyItemsDone(prevDaily, items)];
      while (itemsDone.length <= index) itemsDone.push(false);
      itemsDone[index] = !itemsDone[index];
      return { ...prev, daily: { ...prev.daily, [key]: { ...prevDaily, title: items[0] ?? "", items, itemsDone } } };
    });
  },
  toggleDailyDone: (outcomeId: string, dateISO: string) => {
    const key = `${outcomeId}:${dateISO}`;
    store.set((prev) => {
      const prevDaily = prev.daily[key] ?? { title: "", done: false };
      const done = !prevDaily.done;
      return {
        ...prev,
        daily: {
          ...prev.daily,
          [key]: { ...prevDaily, done, doneAt: done ? new Date().toISOString() : undefined }
        }
      };
    });
  },
  setDailyIntentionalRest: (outcomeId: string, dateISO: string, intentionalRest: boolean) => {
    const key = `${outcomeId}:${dateISO}`;
    store.set((prev) => {
      const prevDaily = prev.daily[key] ?? { title: "", done: false };
      const items = normalizeDailyItems(prevDaily);
      const canRest = !hasMeaningfulDailyItems(items);
      return {
        ...prev,
        daily: {
          ...prev.daily,
          [key]: { ...prevDaily, intentionalRest: canRest ? intentionalRest : false }
        }
      };
    });
  },
  setOutcomeCoachThread: (outcomeId: string, thread: OutcomeCoachThread) => {
    store.set((prev) => ({
      ...prev,
      coachThreads: {
        ...prev.coachThreads,
        [outcomeId]: thread
      }
    }));
  },
  resetOutcomeCoachThread: (outcomeId: string) => {
    store.set((prev) => {
      const coachThreads = { ...prev.coachThreads };
      delete coachThreads[outcomeId];
      return { ...prev, coachThreads };
    });
  },
  exportJSON: (): string => JSON.stringify(store.get(), null, 2),
  importJSON: (raw: string) => {
    const parsed = JSON.parse(raw) as State;
    if (parsed?.version !== 1) throw new Error("Unsupported state version.");

    const outcomes = Array.isArray(parsed.outcomes)
      ? parsed.outcomes.map((outcome, index) =>
          normalizeOutcome({
            ...outcome,
            themeId: normalizeOutcomeTheme((outcome as Partial<Outcome>).themeId, index)
          })
        )
      : [];
    const archivedOutcomes = Array.isArray(parsed.archivedOutcomes)
      ? parsed.archivedOutcomes.map((outcome, index) => normalizeArchivedOutcome(outcome, index))
      : [];

    store.set(() => ({
      ...defaultState(),
      ...parsed,
      ui: {
        ...defaultState().ui,
        ...(parsed as Partial<State>).ui,
        activeTab: normalizeAppTab((parsed as Partial<State>).ui?.activeTab),
        overviewScope: (parsed as Partial<State>).ui?.overviewScope ?? "global",
        themeMode: "white",
        scrollTopByTab: {
          ...((parsed as Partial<State>).ui?.scrollTopByTab ?? {}),
          overview: 0
        }
      },
      outcomes: mergeActiveWithArchived(outcomes, archivedOutcomes),
      archivedOutcomes,
      coachThreads:
        parsed && parsed.coachThreads && typeof parsed.coachThreads === "object" && !Array.isArray(parsed.coachThreads)
          ? parsed.coachThreads
          : {}
    }));
  },
  resetAll: () => {
    store.set(() => defaultState());
  }
};
