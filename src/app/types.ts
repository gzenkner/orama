export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday ... 6 = Saturday

export type WeekStartsOn = 0 | 1; // 0 = Sunday (US), 1 = Monday

export type AppTab = "overview" | "plan" | "calendar" | "backup";

export type Outcome = {
  id: string;
  title: string;
  notes: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  daysOfWeek: DayOfWeek[];
  createdAt: string; // ISO
};

export type MonthlyGoal = {
  title: string;
};

export type WeeklyGoal = {
  title: string;
};

export type DailyGoal = {
  title: string;
  items?: string[];
  itemsDone?: boolean[];
  done: boolean;
  doneAt?: string;
};

export type PersistedStateV1 = {
  version: 1;
  weekStartsOn: WeekStartsOn;
  selectedOutcomeId?: string;
  ui: {
    showMonthlyObjectives: boolean;
    showWeeklyObjectives: boolean;
    activeTab: AppTab;
    scrollTopByTab: Partial<Record<AppTab, number>>;
  };
  outcomes: Outcome[];
  monthly: Record<string, MonthlyGoal>;
  weekly: Record<string, WeeklyGoal>;
  daily: Record<string, DailyGoal>;
};
