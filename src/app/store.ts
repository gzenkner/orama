import React from "react";
import type { DailyGoal, MonthlyGoal, Outcome, PersistedStateV1, WeekStartsOn, WeeklyGoal } from "./types";

const STORAGE_KEY = "goals_app_state_v1";

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
      showWeeklyObjectives: false
    },
    outcomes: [],
    monthly: {},
    weekly: {},
    daily: {}
  };
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

function readState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as State;
    if (parsed?.version !== 1) return defaultState();
    return {
      ...defaultState(),
      ...parsed,
      ui: {
        ...defaultState().ui,
        ...(parsed as Partial<State>).ui
      },
      outcomes: Array.isArray(parsed.outcomes) ? parsed.outcomes : []
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
  return React.useSyncExternalStore(store.subscribe, () => selector(store.get()), () => selector(defaultState()));
}

export function getAppState(): State {
  return store.get();
}

export const actions = {
  setWeekStartsOn: (weekStartsOn: WeekStartsOn) => {
    store.set((prev) => ({ ...prev, weekStartsOn }));
  },
  toggleShowMonthlyObjectives: () => {
    store.set((prev) => ({ ...prev, ui: { ...prev.ui, showMonthlyObjectives: !prev.ui.showMonthlyObjectives } }));
  },
  toggleShowWeeklyObjectives: () => {
    store.set((prev) => ({ ...prev, ui: { ...prev.ui, showWeeklyObjectives: !prev.ui.showWeeklyObjectives } }));
  },
  selectOutcome: (id: string) => {
    store.set((prev) => ({ ...prev, selectedOutcomeId: id }));
  },
  addOutcome: (input: { title: string; notes?: string; startDate: string; endDate: string }) => {
    const now = new Date().toISOString();
    const outcome: Outcome = {
      id: safeUUID(),
      title: input.title.trim(),
      notes: (input.notes ?? "").trim(),
      startDate: input.startDate,
      endDate: input.endDate,
      createdAt: now
    };
    store.set((prev) => ({
      ...prev,
      outcomes: [outcome, ...prev.outcomes],
      selectedOutcomeId: outcome.id
    }));
    return outcome.id;
  },
  updateOutcome: (id: string, patch: Partial<Pick<Outcome, "title" | "notes" | "startDate" | "endDate">>) => {
    store.set((prev) => ({
      ...prev,
      outcomes: prev.outcomes.map((o) => (o.id === id ? { ...o, ...patch } : o))
    }));
  },
  deleteOutcome: (id: string) => {
    store.set((prev) => {
      const outcomes = prev.outcomes.filter((o) => o.id !== id);
      const selectedOutcomeId = prev.selectedOutcomeId === id ? outcomes[0]?.id : prev.selectedOutcomeId;

      const prefix = `${id}:`;
      const monthly: Record<string, MonthlyGoal> = {};
      for (const [k, v] of Object.entries(prev.monthly)) if (!k.startsWith(prefix)) monthly[k] = v;
      const weekly: Record<string, WeeklyGoal> = {};
      for (const [k, v] of Object.entries(prev.weekly)) if (!k.startsWith(prefix)) weekly[k] = v;
      const daily: Record<string, DailyGoal> = {};
      for (const [k, v] of Object.entries(prev.daily)) if (!k.startsWith(prefix)) daily[k] = v;

      return { ...prev, outcomes, selectedOutcomeId, monthly, weekly, daily };
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
      return { ...prev, daily: { ...prev.daily, [key]: { ...prevDaily, title: items[0] ?? "", items, itemsDone } } };
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
      return { ...prev, daily: { ...prev.daily, [key]: { ...prevDaily, title: items[0] ?? "", items, itemsDone } } };
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
  exportJSON: (): string => JSON.stringify(store.get(), null, 2),
  importJSON: (raw: string) => {
    const parsed = JSON.parse(raw) as State;
    if (parsed?.version !== 1) throw new Error("Unsupported state version.");
    store.set(() => ({
      ...defaultState(),
      ...parsed,
      ui: {
        ...defaultState().ui,
        ...(parsed as Partial<State>).ui
      },
      outcomes: Array.isArray(parsed.outcomes) ? parsed.outcomes : []
    }));
  },
  resetAll: () => {
    store.set(() => defaultState());
  }
};
